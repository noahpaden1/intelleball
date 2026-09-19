"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { createGLSurface } from "@/lib/glHarness";
import { registerSurface } from "@/lib/glGovernor";

export interface CyberGridCanvasProps {
  /** Pillar crossfade t (0..1) — drives the azure→violet→rose accent lerp. */
  progress: number;
  className?: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   Cyber grid — tuning constants

   Instrument telemetry behind the pinned PillarsStory stage: a mouse-warped
   lattice with sparse energy pulses, its accent lerping azure→violet→rose
   in exact sync with the pillar crossfade. Desktop fine-pointer only —
   everywhere else the pure-CSS `grid-lines` backdrop underneath carries the
   texture. The grid is atmosphere, never foreground: center-dimmed with a
   hard 0.25 luminance ceiling so pillar copy always wins.
═══════════════════════════════════════════════════════════════════════ */

const SURFACE_ID = "cyber-grid";
const DESKTOP_QUERY = "(min-width: 768px) and (pointer: fine)";

const MAX_DPR = 1.5;
const INTERNAL_SCALE = 0.75;

// uTime is accumulated clamped dt in SECONDS. The only time term is the
// pulse phase `uTime * 0.07`, so wrapping at 1000/7 advances the phase by
// exactly 10 cycles — fract() stays continuous and the value stays small
// enough for mediump devices.
const MAX_DT_MS = 64;
const TIME_WRAP_S = 1000 / 7;

// Locked palette, normalized — mirrors GLSL_PALETTE in lib/glHarness.ts
// (and colors.* in theme.config.mjs); keep the three in sync by hand.
type RGB = readonly [number, number, number];
const AZURE: RGB = [0.161, 0.592, 1.0]; //  #2997ff
const VIOLET: RGB = [0.749, 0.353, 0.949]; // #bf5af2
const ROSE: RGB = [1.0, 0.216, 0.373]; //   #ff375f

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

const lerp3 = (a: RGB, b: RGB, k: number): RGB => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

/** azure→violet over t 0→0.5, violet→rose over t 0.5→1 (pillar crossfade). */
function accentAt(t: number): RGB {
  return lerp3(lerp3(AZURE, VIOLET, clamp01(t * 2)), ROSE, clamp01(t * 2 - 1));
}

// Grid lines sit where fract(uv·14) crosses 0.5 (the reference's
// convention), drawn with a manual 0.02-cell width — no fwidth, so the
// shader is WebGL1-safe without the standard-derivatives extension.
const FRAG = `
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;   // accumulated clamped seconds, wrapped mod 1000/7
uniform vec2 uPointer; // smoothed, vUv space
uniform vec3 uAccent;  // azure→violet→rose, lerped JS-side from progress

float hash(float n) {
  return fract(sin(n * 12.9898) * 43758.5453);
}

void main() {
  float ratio = uResolution.x / uResolution.y;
  vec2 uv = vec2(vUv.x * ratio, vUv.y);
  vec2 pt = vec2(uPointer.x * ratio, uPointer.y);

  // Pointer warp — push the lattice away from the cursor, fading with distance.
  vec2 toP = uv - pt;
  float dist = length(toP);
  uv += (toP / max(dist, 1e-4)) * 0.03 * exp(-dist * 4.0);

  // Cross-hatch lattice at 14.0 frequency, manual line width.
  vec2 gv = abs(fract(uv * 14.0) - 0.5);
  float line = smoothstep(0.02, 0.0, min(gv.x, gv.y));

  // Sparse energy pulses traveling up hash-selected vertical lines.
  float lane = floor(uv.x * 14.0);
  float h = hash(lane);
  float onLine = smoothstep(0.02, 0.0, abs(fract(uv.x * 14.0) - 0.5));
  float travel = smoothstep(0.15, 0.0, abs(fract(uv.y * 0.5 - uTime * 0.07 + h) - 0.5));
  float pulse = onLine * travel * step(0.78, h);

  // Copy protection: edge-weighted mask (dim in the CENTER, where the
  // pillar text sits) under a hard 0.25 luminance ceiling.
  float mask = 1.0 - smoothstep(0.55, 0.15, length(vUv - 0.5));
  vec3 col = uAccent * min(line * 0.6 + pulse * 1.4, 1.0) * mask * 0.25;
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ── Hydration-safe desktop gate ──────────────────────────────────────
   Server render and the hydration render both see `null` (renders
   nothing — matching the SSR output), then the real matchMedia value
   lands immediately after mount. */

function subscribeDesktop(onChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function useDesktopFinePointer(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => null
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════════════ */

/**
 * Living grid behind the pinned pillars. Self-gates to desktop fine-pointer
 * (mobile/touch keep the CSS `grid-lines` backdrop) and never mounts under
 * reduced motion — the parent's reduced branch doesn't render it either,
 * but the guard here makes the component safe anywhere. `progress` arrives
 * per scrub tick from PillarsStory; it is stored in a ref during render and
 * read by the rAF loop, so scrubbing costs zero extra re-renders and zero
 * uniform writes outside the frame. No WebGL, or a second context loss →
 * null (CSS fallback remains underneath).
 */
export function CyberGridCanvas({ progress, className }: CyberGridCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desktop = useDesktopFinePointer();
  const reduced = usePrefersReducedMotion();
  const [failed, setFailed] = useState(false);

  // Mirrored into a ref by a tiny effect — the rAF loop reads it; never a
  // state hook, so scrubbing costs no re-render of the canvas subtree.
  const tRef = useRef(progress);
  useEffect(() => {
    tRef.current = progress;
  }, [progress]);

  const active = desktop === true && !reduced && !failed;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let raf = 0;
    let running = false;
    let inView = false;
    let lost = false;
    let lossCount = 0;
    let timeS = 0;
    let lastTms = 0;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    const surface = createGLSurface(canvas, {
      frag: FRAG,
      maxDpr: MAX_DPR,
      internalScale: INTERNAL_SCALE,
      onContextRestored: () => {
        // Harness has rebuilt program/buffers (no textures here);
        // re-derive uResolution and resume.
        lost = false;
        surface?.resize();
        sync();
      },
    });
    if (!surface) {
      setFailed(true);
      return;
    }

    const governor = registerSurface(SURFACE_ID);

    const frame = (tms: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = lastTms === 0 ? 16 : tms - lastTms;
      lastTms = tms;
      if (lost || surface.isContextLost()) return;
      if (!governor.requestActive()) return;
      surface.noteFrame(dt);
      const dtS = Math.min(dt, MAX_DT_MS) / 1000;
      timeS = (timeS + dtS) % TIME_WRAP_S;
      const k = 1 - Math.exp(-dtS * 3); // hero-matched pointer smoothing
      pointer.x += (pointer.tx - pointer.x) * k;
      pointer.y += (pointer.ty - pointer.y) * k;
      const [r, g, b] = accentAt(tRef.current);
      surface.setUniform("uTime", timeS);
      surface.setUniform("uPointer", pointer.x, pointer.y);
      surface.setUniform("uAccent", r, g, b);
      surface.draw();
    };

    const sync = () => {
      const should = inView && !document.hidden && !lost;
      if (should && !running) {
        running = true;
        lastTms = 0;
        raf = requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    // Immediate first size, then debounce trailing resize storms.
    let resizeTimer: number | undefined;
    let sizedOnce = false;
    const ro = new ResizeObserver(() => {
      if (!sizedOnce) {
        sizedOnce = true;
        surface.resize();
        return;
      }
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => surface.resize(), 120);
    });
    ro.observe(container);

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        inView = entry?.isIntersecting ?? false;
        governor.setRatio(inView ? Math.max(entry?.intersectionRatio ?? 0, 0.01) : 0);
        sync();
      },
      { rootMargin: "120px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    io.observe(container);

    const onVis = () => sync();
    document.addEventListener("visibilitychange", onVis);

    // Rebuild once on loss; a second loss demotes to null permanently
    // (the effect cleanup disposes everything when `failed` flips).
    const onContextLost = () => {
      lost = true;
      lossCount += 1;
      if (lossCount >= 2) {
        setFailed(true);
        return;
      }
      sync();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    // Pointer warp target — scoped to the parent section, passive.
    // Desktop-only surface, so a fine pointer is guaranteed here.
    const host = canvas.closest("section") ?? container;
    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      pointer.tx = (e.clientX - rect.left) / rect.width;
      pointer.ty = 1 - (e.clientY - rect.top) / rect.height;
    };
    host.addEventListener("pointermove", onMove, { passive: true });

    sync();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      host.removeEventListener("pointermove", onMove);
      governor.release();
      surface.dispose();
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
