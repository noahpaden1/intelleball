"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useScroll } from "framer-motion";
import { deck as deckTokens } from "@/lib/motion";
import { piecewise, useProgressValue } from "@/lib/scrub";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { SeamPulse } from "@/components/ui/SeamPulse";
import { cn } from "@/lib/utils";

/**
 * SectionDeck — the card-deck cover transition (spec §2.7 / §4).
 *
 * One Under section sticks at the top of the wrapper and gently recedes
 * (scale / rotate / dim / lift) while the Over section — plain normal
 * flow with an opaque bg-canvas and an optional rounded "lip" — slides
 * over it. Because the Under occupies 100svh of flow at the wrapper's
 * top and the Over follows in normal flow, the cover needs no negative
 * margins and the Over may legally contain its own sticky runways
 * (PinnedSection) — provided the Over is NEVER transformed or
 * overflow-clipped.
 *
 * Scroll plumbing follows the house framer/motion#2452 prod-freeze
 * discipline (lib/scrub.ts, proven in PillarsStory): progress is
 * mirrored ONCE into React state via useProgressValue and every style
 * is derived with piecewise as a plain style object — never a
 * MotionValue-bound style that can silently freeze in production.
 *
 * Eligibility is decided ONCE at mount (no live ResizeObserver mode
 * switching): the server and first client render are always plain flow
 * — matching the reduced-motion first paint, so hydration never
 * mismatches — then a one-time layout effect activates the deck before
 * first paint when the gates pass. Reduced motion is honored live via
 * usePrefersReducedMotion and always renders plain flow.
 */

// Deck choreography constants — the typed motionTokens.deck export
// (theme.config.mjs → lib/motion.ts, spec §3.2). Values per §4.1.
const DECK_TOKENS = {
  hero: {
    scaleTo: deckTokens.scaleTo,
    rotateTo: deckTokens.rotateTo,
    fadeTo: deckTokens.fadeTo,
  },
  gentle: {
    scaleTo: deckTokens.gentleScaleTo,
    rotateTo: deckTokens.gentleRotateTo,
    fadeTo: deckTokens.gentleFadeTo,
  },
} as const;

/** Rotation magnitude is clamped to −1° on viewports narrower than this. */
const ROTATE_CLAMP_BELOW_PX = 768;

/**
 * Covered hysteresis (§2.7): the covered signal flips true only once the
 * Over has essentially finished covering (p ≥ 0.995) and back to false
 * only after it has clearly receded (p ≤ 0.96) — so consumers such as
 * ChipScanHero's render gate never flap at the seam.
 */
const COVERED_AT = 0.995;
const UNCOVERED_AT = 0.96;

interface DeckTokens {
  scaleTo: number;
  rotateTo: number;
  fadeTo: number;
}

interface DeckState {
  /** Deck choreography is running (eligible at mount ∧ not reduced motion). */
  active: boolean;
  /** Hysteresis-latched "Over fully covers Under" signal. */
  covered: boolean;
  tokens: DeckTokens;
  underRef: RefObject<HTMLDivElement | null>;
  overRef: RefObject<HTMLDivElement | null>;
  setCovered: (covered: boolean) => void;
}

const DeckContext = createContext<DeckState | null>(null);

const CoveredContext = createContext(false);

/**
 * Whether the nearest SectionDeck's Under is fully covered by its Over.
 * Safe anywhere: returns false when no deck provider is present.
 */
export function useDeckCovered(): boolean {
  return useContext(CoveredContext);
}

export interface SectionDeckProps {
  /** hero: 0.92 / −1.5° / fade 0.3 · gentle: 0.94 / −1° / fade 0.35 */
  variant?: "hero" | "gentle";
  /** Under must fit one viewport (scrollHeight ≤ 1.02×innerHeight) or the deck disables. */
  requireFit?: boolean;
  /** Coarse-pointer / <768px renders plain flow. */
  desktopOnly?: boolean;
  /**
   * Fragment-navigation id for the Under (e.g. "philosophy"). Rendered on
   * an in-flow sentinel at the wrapper's top instead of on the Under's own
   * section: a stuck sticky's rect is its CURRENT pinned position, so an
   * anchor inside it would land bottom-up navigation mid-cover instead of
   * at the deck top. The section itself must NOT also carry the id.
   */
  anchorId?: string;
  /** Exactly one SectionDeck.Under followed by one SectionDeck.Over. */
  children: ReactNode;
}

export function SectionDeck({
  variant = "hero",
  requireFit = false,
  desktopOnly = false,
  anchorId,
  children,
}: SectionDeckProps) {
  const reduced = usePrefersReducedMotion();
  const underRef = useRef<HTMLDivElement>(null);
  const overRef = useRef<HTMLDivElement>(null);
  const [eligible, setEligible] = useState(false);
  const [clampRotate, setClampRotate] = useState(false);
  const [covered, setCovered] = useState(false);

  // Eligibility, decided ONCE at mount (§2.7): a mid-session resize or
  // rotation keeps the mode chosen here — the deck math tolerates ±10%
  // viewport change and a full reload re-decides. The fit-check measures
  // the Under's plain-flow content before the deck structure activates.
  useLayoutEffect(() => {
    if (
      desktopOnly &&
      !window.matchMedia("(min-width: 768px) and (pointer: fine)").matches
    ) {
      return;
    }

    let cancelled = false;
    let decided = false;
    const decide = () => {
      if (cancelled || decided) return;
      decided = true;
      if (requireFit) {
        const under = underRef.current;
        if (!under || under.scrollHeight > window.innerHeight * 1.02) return;
      }
      // Runway gate: progress reaches 1 only when the Over's top edge can
      // reach the viewport top, i.e. at least ~one viewport of document
      // must exist below the Over's top. A short Over (content + footer
      // < 100svh) would otherwise strand the cover mid-transition at max
      // scroll with the Under permanently half-receded — fall back to
      // plain flow instead of stalling.
      const over = overRef.current;
      if (over) {
        const overTop = window.scrollY + over.getBoundingClientRect().top;
        const runway = document.documentElement.scrollHeight - overTop;
        if (runway < window.innerHeight * 0.995) return;
      }
      setClampRotate(window.innerWidth < ROTATE_CLAMP_BELOW_PX);
      setEligible(true);
    };

    // The fit-check must measure SETTLED layout: on a cold visit the gate
    // can pass with fallback-font metrics, then clip once webfonts swap in
    // (Under is h-svh overflow-hidden while active). Wait for fonts —
    // bounded at 2 s — before deciding; deferred activation is invisible
    // because DeckScrub applies an identity transform at p = 0.
    if (requireFit && document.fonts && document.fonts.status !== "loaded") {
      const timer = window.setTimeout(decide, 2000);
      document.fonts.ready.then(() => {
        window.clearTimeout(timer);
        decide();
      });
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    decide();
    return () => {
      cancelled = true;
    };
    // Mount-only by design — no live mode switching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = eligible && !reduced;

  const value = useMemo<DeckState>(() => {
    const base = DECK_TOKENS[variant];
    return {
      active,
      covered,
      tokens: {
        scaleTo: base.scaleTo,
        // Clamp rotation magnitude to −1° on narrow viewports (§4.1).
        rotateTo: clampRotate ? Math.max(base.rotateTo, -1) : base.rotateTo,
        fadeTo: base.fadeTo,
      },
      underRef,
      overRef,
      setCovered,
    };
  }, [active, covered, clampRotate, variant]);

  // Covered is only meaningful while the deck is choreographing —
  // if reduced motion flips mid-session the plain flow must not leave
  // consumers (e.g. ChipScanHero's render gate) latched off.
  return (
    <CoveredContext.Provider value={active && covered}>
      <DeckContext.Provider value={value}>
        <div className="relative">
          {anchorId && (
            // In-flow anchor sentinel: absolutely positioned at the
            // wrapper's top (== the Under's flow position in BOTH modes),
            // so fragment navigation always lands at the deck top with the
            // Under fully uncovered — even when the sticky Under is
            // currently stuck far below. h-svh (not zero-height) keeps the
            // Navbar's center-band IntersectionObserver scroll-spy working.
            <div
              id={anchorId}
              aria-hidden
              className="pointer-events-none absolute top-0 h-svh w-px scroll-mt-16"
            />
          )}
          {children}
        </div>
      </DeckContext.Provider>
    </CoveredContext.Provider>
  );
}

/**
 * The section that sticks and recedes beneath the Over.
 *
 * Deck mode renders a sticky viewport-height wrapper (never transformed
 * itself — transforms live on the inner DeckScrub div, so the sticky
 * containing block stays intact) and hides it entirely once covered,
 * dropping its compositor layer. Plain flow renders the children
 * followed by a SeamPulse so the seam is still energized, never bare.
 */
function Under({ children }: { children: ReactNode }) {
  const deck = useContext(DeckContext);
  const active = !!deck?.active;

  // STRUCTURAL INVARIANT: both modes render the identical element skeleton
  // (div → DeckScrub's div → children) and only toggle classNames/styles.
  // The eligibility flip at mount would otherwise reconcile as a type /
  // depth change and unmount + rebuild the entire just-hydrated Under
  // subtree (Hero, or Philosophy for Deck B) on every deck-eligible load.
  return (
    <>
      <div
        ref={deck?.underRef}
        className={active ? "sticky top-0 z-0 h-svh overflow-hidden" : undefined}
        style={active && deck?.covered ? { visibility: "hidden" } : undefined}
      >
        {deck ? (
          <DeckScrub
            active={active}
            overRef={deck.overRef}
            tokens={deck.tokens}
            onCovered={deck.setCovered}
          >
            {children}
          </DeckScrub>
        ) : (
          <div>{children}</div>
        )}
      </div>
      {!active && <SeamPulse />}
    </>
  );
}

/**
 * The section that slides over the receding Under. Plain normal flow on
 * an opaque bg-canvas; `lip` adds the rounded top edge, 1px gradient
 * hairline and lifted shadow. NEVER overflow-hidden — the Over hosts
 * its own sticky runways (PillarsStory's PinnedSection) and a clipping
 * ancestor would break them; bg-canvas clips to the radius natively.
 * The lip is styling, not motion, so it is kept in plain flow too.
 */
function Over({ lip, children }: { lip?: boolean; children: ReactNode }) {
  const deck = useContext(DeckContext);

  return (
    <div
      ref={deck?.overRef}
      className={cn(
        "relative z-10 bg-canvas",
        lip && "rounded-t-card shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
      )}
    >
      {lip && (
        // z-10 lifts the hairline above the Over's z-auto children — the
        // opaque CyberGridCanvas fills the pillar stage flush with the
        // Over's top edge and would otherwise paint over this 1px line.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px"
          style={{ background: "var(--gradient-deck-lip)" }}
        />
      )}
      {children}
    </div>
  );
}

SectionDeck.Under = Under;
SectionDeck.Over = Over;

// Server components import client modules through a per-export reference
// proxy, so static properties (SectionDeck.Under) resolve to undefined in
// RSC files like app/page.tsx. These named exports are the RSC-safe path;
// the dot API above remains for client-side consumers.
export { Under as SectionDeckUnder, Over as SectionDeckOver };

interface DeckScrubProps {
  active: boolean;
  overRef: RefObject<HTMLDivElement | null>;
  tokens: DeckTokens;
  onCovered: (covered: boolean) => void;
  children: ReactNode;
}

/**
 * Leaf scrub host — the ONLY component that re-renders per scroll tick.
 *
 * INVARIANT: children must be passed through, never cloned/mapped per
 * render. The child elements are created once by the page (server
 * components in page.tsx), so their references never change across
 * ticks and React bails out of re-rendering the entire Under subtree —
 * only this wrapper div's style object is re-created each tick.
 *
 * Mounted in BOTH modes (structural stability, see Under); when inactive
 * it renders a bare pass-through div and applies no scrub styling. The
 * inert useScroll subscription is cheap and its MotionValue clamps to a
 * constant outside the seam range, so plain flow pays ~nothing.
 */
function DeckScrub({ active, overRef, tokens, onCovered, children }: DeckScrubProps) {
  // Progress = the Over's top edge traveling viewport-bottom → viewport-top.
  const { scrollYProgress } = useScroll({
    target: overRef,
    offset: ["start end", "start start"],
  });
  const p = useProgressValue(scrollYProgress);

  // Hysteresis latch (§2.7). setState with an unchanged value is a React
  // no-op, so the deck provider re-renders at most twice per seam
  // crossing; inside the dead band neither branch fires.
  useEffect(() => {
    if (!active) return;
    if (p >= COVERED_AT) onCovered(true);
    else if (p <= UNCOVERED_AT) onCovered(false);
  }, [active, p, onCovered]);

  if (!active) {
    return <div>{children}</div>;
  }

  const scale = piecewise([0, 1], [1, tokens.scaleTo], p);
  const rotate = piecewise([0, 1], [0, tokens.rotateTo], p);
  const opacity = piecewise([0, 0.55, 1], [1, 0.85, tokens.fadeTo], p);
  const y = piecewise([0, 1], [0, -4], p);

  const style: CSSProperties = {
    transform: `translate3d(0, ${y}svh, 0) scale(${scale}) rotate(${rotate}deg)`,
    opacity,
    transformOrigin: "50% 40%",
    // Promote a layer only while the seam is actually animating.
    willChange: p > 0 && p < 1 ? "transform" : undefined,
  };

  return (
    <div className="h-full w-full" style={style}>
      {children}
    </div>
  );
}
