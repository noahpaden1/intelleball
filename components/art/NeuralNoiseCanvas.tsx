"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { createGLSurface, GLSL_PALETTE } from "@/lib/glHarness";
import { registerSurface } from "@/lib/glGovernor";

export interface NeuralNoiseCanvasProps {
  className?: string;
  /** In-shader brightness multiplier — NOT a CSS opacity stack. Default 1. */
  intensity?: number;
}

/* ═══════════════════════════════════════════════════════════════════════
   Neural noise — tuning constants

   The iterated rotated-sine "neuro" fractal (the reference the user loves),
   kept structurally identical in GLSL and re-plumbed through glHarness:
   violet→azure tint from the locked palette, an edge-weighted ring mask so
   the field calms exactly under the Contact headline, and brightness owned
   by uIntensity in-shader (canvas opacity stays a single 0.85 in Contact).
═══════════════════════════════════════════════════════════════════════ */

const SURFACE_ID = "neural-noise";

// DPR 1.5 + sub-native internal scale: the fractal is soft, so compositor
// upscale is invisible, and the adaptive governor can still step down.
const MAX_DPR = 1.5;
const SCALE_DESKTOP = 0.75;
const SCALE_MOBILE = 0.6;
const ITERS_DESKTOP = 15;
const ITERS_MOBILE = 10;

// uTime is ACCUMULATED clamped dt in ms — never raw performance.now(), which
// drifts visibly once a mediump float eats a five-minute-old timestamp. The
// shader scales by 0.001, so wrapping at 2π·1000 keeps every sin/cos phase
// continuous across the wrap.
const MAX_DT_MS = 64;
const TIME_WRAP_MS = 6283;

// Reference-matched per-frame pointer lerp.
const POINTER_SMOOTH = 0.2;

// Fixed timestamp for the reduced-motion still — mid-bloom, visibly alive.
const STILL_TIME_MS = 1250;

/**
 * Fragment source. Iteration count must be a GLSL compile-time constant, so
 * it is injected per-device (15 desktop / 10 mobile). The fractal loop is
 * byte-for-byte the reference's; only tint, mask, and intensity differ.
 */
function fragmentSource(iterations: number): string {
  return `
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;      // accumulated clamped ms, wrapped mod 6283
uniform vec2 uPointer;    // smoothed, vUv space
uniform float uIntensity; // in-shader brightness (prop)
${GLSL_PALETTE}
vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float neuroShape(vec2 uv, float t, float p) {
  vec2 sineAcc = vec2(0.0);
  vec2 res = vec2(0.0);
  float scale = 8.0;
  for (int j = 0; j < ${iterations}; j++) {
    uv = rotate(uv, 1.0);
    sineAcc = rotate(sineAcc, 1.0);
    vec2 layer = uv * scale + float(j) + sineAcc - t;
    sineAcc += sin(layer) + 2.4 * p;
    res += (0.5 + 0.5 * cos(layer)) / scale;
    scale *= 1.2;
  }
  return res.x + res.y;
}

void main() {
  float ratio = uResolution.x / uResolution.y;
  vec2 uv = 0.5 * vUv;
  uv.x *= ratio;
  vec2 pointer = vUv - uPointer;
  pointer.x *= ratio;
  float p = clamp(length(pointer), 0.0, 1.0);
  p = 0.5 * pow(1.0 - p, 2.0);
  float t = 0.001 * uTime;
  float noise = neuroShape(uv, t, p);
  noise = 1.2 * pow(noise, 3.0);
  noise += pow(noise, 10.0);
  noise = max(0.0, noise - 0.5);
  // Edge-weighted ring mask (replaces the reference's center-weighted
  // vignette): calm directly under the headline/CTA, alive toward the edges.
  noise *= smoothstep(0.15, 0.55, length(vUv - vec2(0.5, 0.45)));
  // Violet-led palette tint — no hue rotation, ever.
  vec3 col = mix(VIOLET, AZURE, vUv.y * 0.6) * noise * uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;
}

/* ═══════════════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════════════ */

/**
 * Contact's ambient field — the synaptic fractal that closes the page.
 * Pure decoration: aria-hidden, pointer-events-none. Pointer reactivity is
 * scoped to the parent <section>. Reduced motion → one composed still, no
 * rAF. No WebGL → null (Contact's mirrored hero-glow remains beneath).
 * Context loss → rebuild once; a second loss demotes to null permanently.
 */
export function NeuralNoiseCanvas({ className, intensity = 1 }: NeuralNoiseCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = !!useReducedMotion();
  const [failed, setFailed] = useState(false);
  const intensityRef = useRef(intensity);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    if (failed) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const mobile = window.matchMedia("(max-width: 767px)").matches;

    let raf = 0;
    let running = false;
    let inView = false;
    let lost = false;
    let lossCount = 0;
    let timeMs = 0;
    let lastTms = 0;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    const surface = createGLSurface(canvas, {
      frag: fragmentSource(mobile ? ITERS_MOBILE : ITERS_DESKTOP),
      maxDpr: MAX_DPR,
      internalScale: mobile ? SCALE_MOBILE : SCALE_DESKTOP,
      onContextRestored: () => {
        // Harness has rebuilt program/buffers (no textures to re-upload);
        // re-derive uResolution, then resume — or re-compose the still.
        lost = false;
        surface?.resize();
        if (reduced) renderStill();
        else sync();
      },
    });
    if (!surface) {
      setFailed(true);
      return;
    }

    const governor = registerSurface(SURFACE_ID);

    const setFrameUniforms = () => {
      surface.setUniform("uTime", timeMs);
      surface.setUniform("uPointer", pointer.x, pointer.y);
      surface.setUniform("uIntensity", intensityRef.current);
    };

    const frame = (tms: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = lastTms === 0 ? 16 : tms - lastTms;
      lastTms = tms;
      if (lost || surface.isContextLost()) return;
      if (!governor.requestActive()) return;
      surface.noteFrame(dt);
      timeMs = (timeMs + Math.min(dt, MAX_DT_MS)) % TIME_WRAP_MS;
      pointer.x += (pointer.tx - pointer.x) * POINTER_SMOOTH;
      pointer.y += (pointer.ty - pointer.y) * POINTER_SMOOTH;
      setFrameUniforms();
      surface.draw();
    };

    const sync = () => {
      const should = inView && !document.hidden && !reduced && !lost;
      if (should && !running) {
        running = true;
        lastTms = 0;
        raf = requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    /** Reduced-motion fallback: one considered frame, pointer centered. */
    const renderStill = () => {
      if (lost || surface.isContextLost()) return;
      timeMs = STILL_TIME_MS;
      setFrameUniforms();
      surface.draw();
    };

    // Immediate first size, then debounce trailing resize storms.
    let resizeTimer: number | undefined;
    let sizedOnce = false;
    const applyResize = () => {
      surface.resize();
      if (reduced) renderStill();
    };
    const ro = new ResizeObserver(() => {
      if (!sizedOnce) {
        sizedOnce = true;
        applyResize();
        return;
      }
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(applyResize, 120);
    });
    ro.observe(container);

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        inView = entry?.isIntersecting ?? false;
        governor.setRatio(inView ? Math.max(entry?.intersectionRatio ?? 0, 0.01) : 0);
        sync();
      },
      { rootMargin: "200px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    io.observe(container);

    const onVis = () => sync();
    document.addEventListener("visibilitychange", onVis);

    // Rebuild once on loss; a second loss demotes permanently (the effect
    // cleanup below disposes everything when `failed` flips).
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

    // Pointer reactivity — scoped to the parent section, passive, never
    // under reduced motion, and fine pointers ONLY (spec §5.3: touch gets
    // ambient animation with no pointer reactivity — matches the hero's
    // parallax gate). Targets are container-relative vUv coords.
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const host = canvas.closest("section") ?? container;
    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      pointer.tx = (e.clientX - rect.left) / rect.width;
      pointer.ty = 1 - (e.clientY - rect.top) / rect.height;
    };
    if (!reduced && finePointer) {
      host.addEventListener("pointermove", onMove, { passive: true });
    }

    if (reduced) {
      surface.resize();
      renderStill();
    }
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
  }, [reduced, failed]);

  if (failed) return null;

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
