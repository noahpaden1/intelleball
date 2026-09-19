"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type AmbientDriftVariant = "a" | "b" | "c";

export interface AmbientDriftProps {
  /**
   * Deterministic blob arrangement. Neighboring sections should pass
   * different variants so the stretches never read as copy-pasted.
   */
  variant?: AmbientDriftVariant;
  className?: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   Ambient gradient drift — the color layer for black scroll stretches.

   Adapted from the "background gradient animation" pattern (huge blurred
   blobs + goo filter + pointer blob) with the expensive parts deleted:
   soft edges come from the radial-gradient falloff itself — closest-side
   to rgba(…, 0) at 70% — which costs nothing, instead of a fullscreen
   blur()/goo filter chain. No JS loop, no pointer tracking: each blob is
   one idle GPU-composited quad whose keyframes animate TRANSFORM ONLY
   (translate/scale drift or an off-center-origin rotate "orbit", 26–48s,
   ease-in-out alternate, staggered negative delays so the ensemble never
   visibly loops).

   Constraints honored:
   · Per-section layer, not a fixed wrapper — absolute inset-0 inside the
     section (sections keep their opaque bg-canvas for deck transitions).
     Mount it as the FIRST child of a `relative` section and give the
     content sibling `relative` so DOM order paints copy above the layer.
   · Luminance budget: center alpha ≤ 0.14 per blob (rose lower still),
     mix-blend-screen inside an isolated wrapper, so overlaps stay
     additive-soft and text contrast is never threatened.
   · Blob CENTERS park at edges/corners (offsets in vmax, clear of the
     centered text column); only the gradient falloff reaches inward.
   · Reduced motion / pre-CSS: the keyframes + reduced-motion override
     live in the `ambient-blob` utility (globals.css). Until that lands —
     or whenever the user prefers reduced motion — blobs simply hold
     their authored positions: the composition is designed parked-first.
   · Mobile: the third blob is hidden below md via pure CSS, and vmax
     sizing scales the rest down with the viewport.
   · Offscreen gating: browsers do NOT reliably throttle offscreen
     compositor animations, so six always-running zones would deny the
     page idle frames forever. A minimal IntersectionObserver flips the
     inherited --ambient-play var to `paused` while the zone is
     off-viewport (rootMargin 25% so drift is underway before entry).
     Pausing (not unmounting) freezes each animation's clock, preserving
     the negative-delay decorrelation. Default state is `running`, so
     SSR markup, no-JS, and reduced-motion behavior are unchanged.
═══════════════════════════════════════════════════════════════════════ */

type Accent = "azure" | "violet" | "rose";

/** House accent channels — mirrors colors.* in theme.config.mjs. */
const RGB: Record<Accent, string> = {
  azure: "41, 151, 255",
  violet: "191, 90, 242",
  rose: "255, 55, 95",
};

interface Blob {
  accent: Accent;
  /** Center alpha — hard ceiling 0.14 (screen-blended over near-black). */
  alpha: number;
  /** Diameter in vmax; the box is square so closest-side is a circle. */
  size: number;
  /** Parked position (also the reduced-motion composition). */
  pos: React.CSSProperties;
  /** Keyframe track in globals.css: a/b wander+swell, c orbits. */
  track: "a" | "b" | "c";
  /** Animation seconds — varied per blob so siblings never sync. */
  dur: number;
  /** Negative: start mid-journey, decorrelating the ensemble. */
  delay: number;
  /** Track-c only: off-center transform-origin sets the orbit radius. */
  origin?: string;
  /** Third blob is desktop-only — phones composite two layers, not 3. */
  desktopOnly?: boolean;
}

/**
 * Three hand-placed arrangements. Azure/violet carry every variant; rose
 * appears only as the small desktop-only accent in "b" and "c".
 */
const VARIANTS: Record<AmbientDriftVariant, Blob[]> = {
  // Azure dawn top-left, violet answer bottom-right.
  a: [
    {
      accent: "azure",
      alpha: 0.14,
      size: 64,
      pos: { top: "-26vmax", left: "-22vmax" },
      track: "a",
      dur: 44,
      delay: -7,
    },
    {
      accent: "violet",
      alpha: 0.12,
      size: 52,
      pos: { bottom: "-20vmax", right: "-18vmax" },
      track: "b",
      dur: 34,
      delay: -19,
    },
    {
      accent: "azure",
      alpha: 0.08,
      size: 40,
      pos: { top: "4%", right: "-16vmax" },
      track: "c",
      dur: 48,
      delay: -12,
      origin: "38% 62%",
      desktopOnly: true,
    },
  ],
  // Violet dusk top-right, azure floor, faint rose ember on the left.
  b: [
    {
      accent: "violet",
      alpha: 0.13,
      size: 58,
      pos: { top: "-24vmax", right: "-20vmax" },
      track: "b",
      dur: 46,
      delay: -10,
    },
    {
      accent: "azure",
      alpha: 0.13,
      size: 64,
      pos: { bottom: "-26vmax", left: "-24vmax" },
      track: "a",
      dur: 37,
      delay: -23,
    },
    {
      accent: "rose",
      alpha: 0.07,
      size: 38,
      pos: { top: "8%", left: "-15vmax" },
      track: "c",
      dur: 42,
      delay: -16,
      origin: "60% 40%",
      desktopOnly: true,
    },
  ],
  // Azure flank mid-left, violet bottom-right, rose ember up top.
  c: [
    {
      accent: "azure",
      alpha: 0.13,
      size: 60,
      pos: { top: "32%", left: "-25vmax" },
      track: "b",
      dur: 40,
      delay: -14,
    },
    {
      accent: "violet",
      alpha: 0.12,
      size: 54,
      pos: { bottom: "-22vmax", right: "-19vmax" },
      track: "a",
      dur: 31,
      delay: -5,
    },
    {
      accent: "rose",
      alpha: 0.09,
      size: 44,
      pos: { top: "-17vmax", right: "-14vmax" },
      track: "c",
      dur: 47,
      delay: -26,
      origin: "58% 58%",
      desktopOnly: true,
    },
  ],
};

/**
 * Ambient accent-blob backdrop for a section's black stretch. Renders 2–3
 * softly drifting radial glows behind the content; static until the
 * `ambient-blob` utility + `ambient-drift-*` keyframes land in
 * globals.css, and static again under prefers-reduced-motion.
 */
export function AmbientDrift({ variant = "a", className }: AmbientDriftProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [onscreen, setOnscreen] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setOnscreen(entries[entries.length - 1].isIntersecting),
      { rootMargin: "25%" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      // Custom properties inherit, so pausing here reaches every blob;
      // the reduced-motion `animation: none` override still wins.
      style={
        onscreen
          ? undefined
          : ({ "--ambient-play": "paused" } as React.CSSProperties)
      }
      className={cn(
        // isolate: blend the blobs with each other only — never with
        // whatever the section happens to sit above during deck moves.
        "pointer-events-none absolute inset-0 isolate overflow-hidden",
        className
      )}
    >
      {VARIANTS[variant].map((blob, i) => (
        <div
          key={i}
          className={cn(
            "ambient-blob absolute aspect-square mix-blend-screen",
            blob.desktopOnly && "hidden md:block"
          )}
          // Position/size/tint are static per-blob data; the utility's
          // animation shorthand reads the three --ambient-* vars, so the
          // reduced-motion override in globals.css (animation: none)
          // still wins — nothing here touches `animation` directly.
          style={
            {
              width: `${blob.size}vmax`,
              ...blob.pos,
              backgroundImage: `radial-gradient(closest-side, rgba(${RGB[blob.accent]}, ${blob.alpha}), rgba(${RGB[blob.accent]}, 0) 70%)`,
              transformOrigin: blob.origin,
              "--ambient-anim": `ambient-drift-${blob.track}`,
              "--ambient-dur": `${blob.dur}s`,
              "--ambient-delay": `${blob.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
