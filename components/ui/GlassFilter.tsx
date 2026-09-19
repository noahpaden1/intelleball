/** Stable filter id referenced by LiquidButton's Chromium-only backdrop layer. */
export const GLASS_FILTER_ID = "lg-glass";

/**
 * Site-wide SVG displacement filter behind the liquid-glass surfaces
 * (components/ui/LiquidButton). Mount ONCE in app/layout.tsx — buttons only
 * reference the stable id via `backdrop-filter: url(#lg-glass)`, which fixes
 * the reference component's per-instance-<svg> duplicate-id bug.
 *
 * Chain: fractalNoise turbulence → soften the noise (blur 2) → displace the
 * backdrop through it (scale 56) → final blur 3 melts displacement artifacts
 * into the glass. The filter region is widened to -20%/140% so samples
 * displaced near the pill edge don't clip against the default 0%/100% region
 * (another reference bug), and colorInterpolationFilters="sRGB" stops the
 * blur passes from darkening the backdrop mid-chain.
 *
 * Only Chromium applies `backdrop-filter: url(#…)`; Safari/Firefox drop that
 * declaration as invalid and keep LiquidButton's plain blur/saturate frost
 * layer, so this element is progressive enhancement with zero cost elsewhere.
 * Zero-sized, aria-hidden, unfocusable: it never paints or joins the a11y
 * tree. Server-safe (no state, no browser APIs).
 */
export function GlassFilter() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute h-0 w-0"
    >
      <filter
        id={GLASS_FILTER_ID}
        x="-20%"
        y="-20%"
        width="140%"
        height="140%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.05"
          numOctaves="1"
          seed="7"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="2" result="soft-noise" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="soft-noise"
          scale="56"
          xChannelSelector="R"
          yChannelSelector="G"
        />
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </svg>
  );
}
