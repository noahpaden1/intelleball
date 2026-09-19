import { cn } from "@/lib/utils";
import { GLASS_FILTER_ID } from "@/components/ui/GlassFilter";

type LiquidVariant = "primary" | "ghost";
type LiquidSize = "lg" | "sm";

interface LiquidButtonBaseProps {
  /**
   * "primary" — glass with an interior azure-deep wash and white label; the
   * site's strongest control (it replaces a solid bg-azure-deep pill, so the
   * wash stays saturated enough to hold CTA hierarchy). "ghost" — pure
   * neutral glass with ink text, for the navbar chip.
   */
  variant?: LiquidVariant;
  /** "lg" — hero/contact CTA · "sm" — navbar chip. */
  size?: LiquidSize;
  className?: string;
  children: React.ReactNode;
}

export interface LiquidButtonAnchorProps
  extends LiquidButtonBaseProps,
    Omit<
      React.ComponentPropsWithoutRef<"a">,
      "className" | "children" | "href"
    > {
  /** Presence of href switches rendering from <button> to <a>. */
  href: string;
}

/** Anchor-only attributes, banned (`?: never`) on the button member so the
 *  union rejects stray `target`/`rel`/`download`/… when `href` is absent
 *  (TS's excess-property check on unions accepts any prop known to some
 *  member, so without this a refactor that drops `href` silently forwards
 *  dead anchor attrs onto the rendered <button>). */
type AnchorOnlyAttrs = {
  [K in Exclude<
    keyof React.ComponentPropsWithoutRef<"a">,
    keyof React.ComponentPropsWithoutRef<"button">
  >]?: never;
};

export interface LiquidButtonButtonProps
  extends LiquidButtonBaseProps,
    Omit<React.ComponentPropsWithoutRef<"button">, "className" | "children">,
    AnchorOnlyAttrs {
  href?: undefined;
}

export type LiquidButtonProps =
  | LiquidButtonAnchorProps
  | LiquidButtonButtonProps;

/** Everywhere-supported frost pass (Safari needs the -webkit- twin). */
const FROST = "blur(8px) saturate(150%)";

/**
 * White-tinted rim, adapted from the reference's dark-mode stack: hairline
 * bevels hugging top-left (bright) and bottom-right (dim) via negative
 * spread, a finer 1px bevel pair, a soft inner glow, and a 1px hairline ring
 * for definition against pure-black stretches.
 */
const RIM_SHADOW = [
  "inset 2px 2px 1px -2px rgba(255,255,255,0.90)",
  "inset -2px -2px 1px -2px rgba(255,255,255,0.50)",
  "inset 1px 1px 1px -0.5px rgba(255,255,255,0.55)",
  "inset -1px -1px 1px -0.5px rgba(255,255,255,0.35)",
  "inset 0 0 6px 2px rgba(255,255,255,0.08)",
  "inset 0 0 0 1px rgba(255,255,255,0.08)",
].join(", ");

/**
 * Outer lift — lives on the ROOT, not the chrome span: a child's outset
 * shadow falls entirely outside the root's overflow-hidden clip. Expressed
 * as a --tw-shadow utility (not inline style) so it composes with the
 * focus-visible ring utilities instead of overriding their box-shadow.
 * The primary CTA additionally glows azure-deep.
 */
const OUTER_SHADOW: Record<LiquidVariant, string> = {
  primary:
    "shadow-[0_1px_3px_rgba(0,0,0,0.30),0_8px_28px_rgba(20,112,230,0.35)]",
  ghost: "shadow-[0_1px_3px_rgba(0,0,0,0.30),0_6px_20px_rgba(0,0,0,0.30)]",
};

/**
 * Interior wash. Primary: top white glint over an azure→azure-deep column
 * (~0.58–0.64 alpha — strong enough that the CTA still reads as the filled
 * control it replaces). Ghost reuses the house panel-sheen token.
 */
const WASH: Record<LiquidVariant, string> = {
  primary: [
    "radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.16), transparent 55%)",
    "linear-gradient(180deg, rgba(41,151,255,0.60) 0%, rgba(20,112,230,0.64) 55%, rgba(10,58,130,0.58) 100%)",
  ].join(", "),
  ghost: "var(--gradient-panel-sheen)",
};

/** Hover/focus brightening — opacity-only fade (replaces hover:brightness). */
const SHEEN: Record<LiquidVariant, string> = {
  primary:
    "radial-gradient(120% 120% at 50% 0%, rgba(255,255,255,0.20), rgba(255,255,255,0.05) 60%, transparent 82%)",
  ghost:
    "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
};

const SIZE: Record<LiquidSize, string> = {
  lg: "px-7 py-3 text-[15px]",
  sm: "px-4 py-1.5 text-[13px]",
};

/**
 * House liquid-glass pill — the CTA control (adapted from 21st.dev's
 * "liquid glass button", bugs fixed). Renders <a> when `href` is given,
 * else <button type="button">. Designed to sit inside <Magnetic> (root is
 * inline-flex, so the inline-block wrapper shrink-wraps it cleanly).
 *
 * Layers, bottom → top (root is `isolate` with explicit z ordering so no
 * decorative layer can escape the pill's stacking context — reference bug):
 * 1. z-0 frost — backdrop-filter blur+saturate every engine supports, plus
 *    a black/25 tint so the worst-case bright GL backdrop is darkened and
 *    the label keeps ≥4.5:1 before any wash is even applied.
 * 2. z-0 liquid — `backdrop-filter: url(#lg-glass)` refraction, Chromium
 *    only; Safari/Firefox drop the invalid declaration harmlessly (no UA
 *    sniffing — the cascade is the feature test). The filter itself lives
 *    in GlassFilter, mounted once in app/layout.tsx.
 * 3. z-[1] chrome — per-variant interior wash + white rim bevels (outer
 *    lift sits on the ROOT, outside its own overflow-hidden clip).
 * 4. z-[2] sheen — hover/:focus-visible brightening, opacity-only.
 * 5. z-10 label with a faint text shadow for legibility over bright art.
 *
 * Perf budget: in Chromium each instance costs two serialized
 * backdrop-filter passes re-run every frame an animating canvas sits
 * behind it (~2× the pill region refiltered; worst case mid-range Android
 * at DPR 2.5–3 ≈ 1–2 ms/frame). Fine at the current ≤2 liquid surfaces
 * per viewport — re-profile before adding more over live canvases. Do NOT
 * merge the two passes into one declaration: Safari/Firefox drop the whole
 * merged value (url() is invalid there) and would lose the frost too —
 * the two-layer split IS the feature test.
 *
 * Motion is compositor-only: root transform scale (hover ~1.03 stacking
 * with Magnetic's 1.02, active 0.97) and layer opacity. All of it is gated
 * behind motion-safe / motion-reduce:transition-none, degrading to a fully
 * static glass pill; Tailwind v4's hover: variant is already
 * @media (hover:hover)-gated, so touch devices get no pointer-reactive
 * behavior. Every layer shares rounded-pill (no radius mismatch) and is
 * aria-hidden + pointer-events-none.
 */
export function LiquidButton(props: LiquidButtonProps) {
  const { variant = "primary", size = "lg", className, children } = props;

  const rootClassName = cn(
    "group/lb relative isolate inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-pill font-medium whitespace-nowrap",
    "transition-transform duration-300 ease-glide motion-reduce:transition-none",
    "motion-safe:hover:scale-[1.03] motion-safe:focus-visible:scale-[1.03] motion-safe:active:scale-[0.97]",
    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-azure/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
    SIZE[size],
    variant === "primary" ? "text-white" : "text-ink",
    OUTER_SHADOW[variant],
    className
  );

  const body = (
    <>
      {/* 1 — frost: the backdrop pass every engine applies */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-pill bg-black/25"
        style={{ WebkitBackdropFilter: FROST, backdropFilter: FROST }}
      />
      {/* 2 — liquid refraction: Chromium-only SVG displacement of the
          (already frosted) backdrop; invalid → dropped elsewhere */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-pill"
        style={{ backdropFilter: `url(#${GLASS_FILTER_ID})` }}
      />
      {/* 3 — chrome: variant wash + white rim bevels */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-[1] rounded-pill",
          variant === "ghost" && "bg-white/[0.04]"
        )}
        style={{
          backgroundImage: WASH[variant],
          boxShadow: RIM_SHADOW,
        }}
      />
      {/* 4 — sheen: hover / keyboard-focus brightening, opacity-only */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2] rounded-pill opacity-0 transition-opacity duration-300 ease-glide group-hover/lb:opacity-100 group-focus-visible/lb:opacity-100 motion-reduce:transition-none"
        style={{ backgroundImage: SHEEN[variant] }}
      />
      {/* 5 — label */}
      <span className="relative z-10 inline-flex items-center gap-2 [text-shadow:0_1px_2px_rgba(0,0,0,0.40)]">
        {children}
      </span>
    </>
  );

  if (props.href !== undefined) {
    const {
      variant: _v,
      size: _s,
      className: _c,
      children: _ch,
      ...anchorProps
    } = props;
    return (
      <a {...anchorProps} className={rootClassName}>
        {body}
      </a>
    );
  }

  const {
    variant: _v,
    size: _s,
    className: _c,
    children: _ch,
    href: _h,
    ...buttonProps
  } = props;
  return (
    <button type="button" {...buttonProps} className={rootClassName}>
      {body}
    </button>
  );
}
