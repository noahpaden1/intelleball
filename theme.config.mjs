/**
 * ════════════════════════════════════════════════════════════════════════
 *  Intelleball — Design System · SINGLE SOURCE OF TRUTH
 * ════════════════════════════════════════════════════════════════════════
 *
 *  Every color, gradient, type style, radius, and animation constant used
 *  anywhere on the site is defined in this one file.
 *
 *  How it flows into the site:
 *
 *   · CSS side — `npm run theme` (auto-runs before `dev` and `build`)
 *     compiles these tokens into `app/theme.css` as Tailwind v4 @theme
 *     variables, which generates utilities like `bg-surface`, `text-ink`,
 *     `text-display`, `rounded-card`, `ease-glide`.
 *
 *   · JS side — Framer Motion components consume the exact same tokens,
 *     with types, through `lib/motion.ts`. Change a spring here and every
 *     animation on the site updates.
 *
 *  Never edit `app/theme.css` by hand — it is generated from this file.
 */

// ─── Color ────────────────────────────────────────────────────────────────
// Apple-dark palette: pure-black canvas, near-black panels, off-white ink.
// Each key becomes a Tailwind color utility (bg-canvas, text-ink, …).

export const colors = {
  // Surfaces
  canvas: "#000000", //  page background — pure black, cinematic
  surface: "#0b0b0f", //  cards & panels
  raised: "#17171b", //  elevated panels, chips, code blocks
  line: "rgba(255, 255, 255, 0.09)", //  hairline borders

  // Text
  ink: "#f5f5f7", //  primary text (Apple's off-white)
  "ink-mid": "#a1a1a6", //  secondary text
  "ink-dim": "#86868b", //  tertiary text, captions (AA on black at caption sizes)

  // Accents
  azure: "#2997ff", //  primary accent — links, decorative tints
  "azure-deep": "#1470e6", //  filled-button surfaces (white text passes AA)
  violet: "#bf5af2", //  secondary accent
  rose: "#ff375f", //  tertiary accent
  mint: "#30d158", //  success / "live" markers
};

// ─── Gradients ────────────────────────────────────────────────────────────
// Exposed as CSS custom properties: var(--gradient-<name>)

export const gradients = {
  // Signature tri-color sweep, used for gradient text
  spectrum: "linear-gradient(120deg, #2997ff 0%, #bf5af2 55%, #ff375f 100%)",

  // Soft glow that sits behind the hero headline
  "hero-glow":
    "radial-gradient(ellipse 80% 55% at 50% -15%, rgba(41, 151, 255, 0.26), rgba(191, 90, 242, 0.10) 45%, transparent 70%)",

  // Faint top-light sheen for glass panels
  "panel-sheen":
    "linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.015) 40%, transparent)",

  // Per-project card washes (keyed by each project's `accent`)
  "card-azure":
    "radial-gradient(120% 120% at 20% 0%, rgba(41, 151, 255, 0.20), transparent 62%)",
  "card-violet":
    "radial-gradient(120% 120% at 20% 0%, rgba(191, 90, 242, 0.20), transparent 62%)",
  "card-rose":
    "radial-gradient(120% 120% at 20% 0%, rgba(255, 55, 95, 0.18), transparent 62%)",

  // ── v3 futuristic layer ──────────────────────────────────────────────
  // Contrast scrim under the hero headline, over the chip-scan canvas
  "scan-scrim":
    "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 78%, #000 100%)",
  // Hairline lip on deck covers (SectionDeck.Over)
  "deck-lip":
    "linear-gradient(90deg, transparent, rgba(41,151,255,0.5) 30%, rgba(191,90,242,0.5) 70%, transparent)",
  // Traveling chip in SeamPulse
  "seam-pulse":
    "linear-gradient(90deg, transparent, rgba(41,151,255,0.6), transparent)",
  // SpotlightCard background layers (position driven by per-card CSS vars)
  "spot-azure":
    "radial-gradient(240px 240px at var(--spot-x,50%) var(--spot-y,50%), rgba(41,151,255,0.12), transparent 70%)",
  "spot-violet":
    "radial-gradient(240px 240px at var(--spot-x,50%) var(--spot-y,50%), rgba(191,90,242,0.12), transparent 70%)",
  "spot-rose":
    "radial-gradient(240px 240px at var(--spot-x,50%) var(--spot-y,50%), rgba(255,55,95,0.10), transparent 70%)",
  // SpotlightCard border-ring gradients (per-accent, pointer-anchored —
  // consumed via --spot-ring set by the component; rose runs slightly
  // dimmer, matching the card-/spot- convention above)
  "spot-ring-azure":
    "radial-gradient(280px 280px at var(--spot-x,50%) var(--spot-y,50%), rgba(41,151,255,0.8), rgba(41,151,255,0.15) 70%)",
  "spot-ring-violet":
    "radial-gradient(280px 280px at var(--spot-x,50%) var(--spot-y,50%), rgba(191,90,242,0.8), rgba(191,90,242,0.15) 70%)",
  "spot-ring-rose":
    "radial-gradient(280px 280px at var(--spot-x,50%) var(--spot-y,50%), rgba(255,55,95,0.7), rgba(255,55,95,0.12) 70%)",
};

// NOTE (GLSL palette sync): the shader-side palette constants in
// `lib/glHarness.ts` (GLSL_PALETTE — AZURE/VIOLET/ROSE/INK, normalized
// 0..1) mirror `colors.azure / colors.violet / colors.rose / colors.ink`
// above. WebGL shaders cannot read CSS custom properties, so the two
// must be updated TOGETHER whenever an accent changes.

// ─── Typography ───────────────────────────────────────────────────────────
// A fluid, Apple-style scale. Each entry becomes a `text-<name>` utility
// carrying its size, line-height, letter-spacing, and weight together.

export const typography = {
  scale: {
    display: {
      size: "clamp(2.9rem, 6.5vw + 1rem, 6rem)",
      lineHeight: "1.03",
      letterSpacing: "-0.03em",
      weight: "600",
    },
    headline: {
      size: "clamp(2rem, 3.5vw + 0.6rem, 3.5rem)",
      lineHeight: "1.08",
      letterSpacing: "-0.025em",
      weight: "600",
    },
    title: {
      size: "clamp(1.4rem, 1.4vw + 0.9rem, 2rem)",
      lineHeight: "1.2",
      letterSpacing: "-0.02em",
      weight: "600",
    },
    lead: {
      size: "clamp(1.125rem, 0.6vw + 1rem, 1.375rem)",
      lineHeight: "1.5",
      letterSpacing: "-0.011em",
      weight: "400",
    },
    body: {
      size: "1.0625rem",
      lineHeight: "1.65",
      letterSpacing: "-0.008em",
      weight: "400",
    },
    caption: {
      size: "0.8125rem",
      lineHeight: "1.5",
      letterSpacing: "0",
      weight: "400",
    },
    eyebrow: {
      size: "0.8125rem",
      lineHeight: "1",
      letterSpacing: "0.14em",
      weight: "600",
    },
  },
};

// ─── Radii ────────────────────────────────────────────────────────────────
// Each key becomes a `rounded-<name>` utility.

export const radii = {
  card: "1.5rem",
  panel: "1rem",
  pill: "999px",
};

// ─── Motion ───────────────────────────────────────────────────────────────
// Every animation constant on the site. Consumed (typed) via lib/motion.ts;
// easings are also emitted as CSS `--ease-<name>` → `ease-<name>` utilities.

export const motionTokens = {
  // Cubic-bezier curves
  ease: {
    glide: [0.22, 1, 0.36, 1], //  signature decelerate — most reveals
    swing: [0.83, 0, 0.17, 1], //  symmetric in-out — crossfades, pins
    soft: [0.32, 0.72, 0, 1], //  gentle settle — nav, overlays
  },

  // Seconds
  duration: {
    fast: 0.35, //  micro-interactions: hovers, chips
    base: 0.7, //  standard reveals
    slow: 1.15, //  hero moments, large surfaces
  },

  // Framer Motion spring presets
  spring: {
    snappy: { type: "spring", stiffness: 420, damping: 34, mass: 0.9 },
    gentle: { type: "spring", stiffness: 170, damping: 26, mass: 1 },
    whisper: { type: "spring", stiffness: 90, damping: 22, mass: 1.2 },
  },

  // Scroll-triggered reveal defaults
  reveal: {
    distance: 28, //  px of upward drift
    stagger: 0.07, //  s between siblings
    viewportMargin: "0px 0px -12% 0px", //  trigger before fully in view
  },

  // Parallax drift strengths (total px travel across a viewport of scroll)
  parallax: {
    subtle: 40,
    medium: 90,
    strong: 160,
  },

  // Navbar behavior
  nav: {
    glassAt: 10, //  px scrolled before glass/blur kicks in
    hideAfter: 160, //  px scrolled before scroll-down hides the bar
  },

  // Deck cover transitions (SectionDeck)
  deck: {
    scaleTo: 0.92,
    rotateTo: -1.5,
    fadeTo: 0.3,
    gentleScaleTo: 0.94,
    gentleRotateTo: -1,
    gentleFadeTo: 0.35,
  },
};
