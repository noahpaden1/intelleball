"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { createGLSurface, GLSL_PALETTE, type GLSurface } from "@/lib/glHarness";
import { registerSurface } from "@/lib/glGovernor";
import { useDeckCovered } from "@/components/motion/SectionDeck";

export interface BallScanHeroProps {
  className?: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   Ball-scan hero — tuning constants

   The product motif: a matte ball with a sensor lattice on its skin, a
   tilted scan plane sweeping through it, and three gimbal rings in the
   tri-accent orbiting it (the IMU's three axes). Everything is analytic —
   no textures — so the shader and the 2D preview share the same handful
   of numbers below.
═══════════════════════════════════════════════════════════════════════ */

const SPHERE_R = 0.33; //     radius in viewport-height units, desktop
const RING_RADII = [1.22, 1.36, 1.5] as const; // × sphere radius
const SCAN_DELAY = 1.2; //    s after fade-in start before the first sweep
const SCAN_RAMP = 0.8; //     s for the uScanIn 0→1 ramp
const SCAN_RATE = 0.7; //     rad/s → ~9 s round trip
const FADE_RATE = 2; //       uFade exp-lerp rate
const POINTER_RATE = 3; //    parallax exp-smoothing rate
// Every angular rate in the shader is a multiple of 0.01 rad/s, so wrapping
// the clock at 200π leaves every angle continuous across the wrap (and the
// value small enough for mediump devices).
const TIME_WRAP = Math.PI * 200;
const STILL_TIME = 2.0; //    reduced-motion composition
const STILL_SCAN = 0.42;
const LOSS_WINDOW_MS = 10000; // 2nd context loss inside this → permanent 2D demote

/** Sphere radius for a given aspect: shrinks on portrait so the ball fits the width. */
function radiusFor(aspect: number): number {
  return SPHERE_R * Math.min(Math.max(aspect * 0.75, 0.55), 1);
}

/* ── Fragment shader (GLSL ES 1.0) ────────────────────────────────────── */

const FRAG = /* glsl */ `
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uScan;
uniform float uScanIn;
uniform float uFade;
uniform float uAspect;
uniform float uRadius;
uniform float uTime;
varying vec2 vUv;
${GLSL_PALETTE}
mat3 rotX(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0,  0.0, c, s,  0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s,  0.0, 1.0, 0.0,  s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a); float s = sin(a); return mat3(c, s, 0.0,  -s, c, 0.0,  0.0, 0.0, 1.0); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// Screen-space distance to the orthographic projection of a 3D circle of
// radius rr in the plane spanned by M·x, M·y. First-order |f| / |grad f| —
// exact enough at a 2 px line. depth (-1..1) comes back for occlusion.
float ringDist(vec2 p, mat3 M, float rr, out float depth) {
  vec3 u = M * vec3(1.0, 0.0, 0.0);
  vec3 v = M * vec3(0.0, 1.0, 0.0);
  float det = u.x * v.y - u.y * v.x;
  det = (det < 0.0 ? -1.0 : 1.0) * max(abs(det), 0.03);   // edge-on guard
  vec2 q = p / rr;
  float c = ( v.y * q.x - v.x * q.y) / det;
  float s = (-u.y * q.x + u.x * q.y) / det;
  vec2 gc = vec2( v.y, -v.x) / (det * rr);
  vec2 gs = vec2(-u.y,  u.x) / (det * rr);
  vec2 g = 2.0 * (c * gc + s * gs);
  depth = clamp(c * u.z + s * v.z, -1.0, 1.0);
  return abs(c * c + s * s - 1.0) / max(length(g), 1e-4);
}
void main() {
  float R = uRadius;
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float r2 = dot(p, p);
  float rr2 = R * R;
  // backdrop: azure bloom behind the ball, a violet answer lower-right
  vec3 col = AZURE * 0.055 * exp(-r2 / (rr2 * 3.0));
  vec2 pv = p - vec2(0.42 * uAspect, -0.28);
  col += VIOLET * 0.03 * exp(-dot(pv, pv) * 7.0);
  // sphere: view-space normal, then the ball's own frame (tilt + spin + pointer)
  float z = sqrt(max(rr2 - r2, 0.0));
  vec3 n = vec3(p, z) / R;
  mat3 M = rotY(uTime * 0.22 + uPointer.x * 0.3) * rotX(-0.42 + uPointer.y * 0.14);
  vec3 q = M * n;
  float lat = asin(clamp(q.y, -1.0, 1.0));
  float lon = atan(q.x, q.z);
  float gx = abs(fract(lon * 3.8197186) - 0.5);        // 24 meridians
  float gy = abs(fract(lat * 3.8197186 + 0.5) - 0.5);  // 12 parallels
  float fore = pow(max(n.z, 0.0), 0.7) * (1.0 - pow(abs(q.y), 10.0));
  float grid = (1.0 - smoothstep(0.0, 0.04, min(gx, gy))) * fore;
  float seam = 1.0 - smoothstep(0.0, 0.03, min(abs(q.x), abs(dot(q, vec3(0.0, 0.6, 0.8)))));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
  float key = max(dot(n, L), 0.0);
  float fres = pow(1.0 - max(n.z, 0.0), 3.0);
  vec3 sph = vec3(0.045, 0.05, 0.065) * (0.35 + key * 1.1);
  sph *= 1.0 - seam * 0.55;
  sph += AZURE * grid * (0.08 + key * 0.14);
  sph += mix(AZURE, VIOLET, smoothstep(-R, R, p.x)) * fres * 0.5;
  sph += INK * pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0) * 0.22;
  // scan: a tilted plane sweeping the ball; its trace on the surface is an
  // ellipse (reads as 3D). Dot-matrix flow + violet echo, like the chip scan.
  float sc = dot(n, normalize(vec3(0.3, 0.9, -0.3)));
  float scanPos = mix(-1.15, 1.15, uScan);
  float iso  = 1.0 - smoothstep(0.0, 0.035, abs(sc - scanPos));
  float echo = 1.0 - smoothstep(0.0, 0.035, abs(sc - (scanPos - 0.14)));
  vec2 tUv = vec2(vUv.x * uAspect, vUv.y);
  vec2 gcell = fract(tUv * 110.0) - 0.5;
  float dots = smoothstep(0.5, 0.44, length(gcell) * 2.0) * hash21(floor(tUv * 110.0));
  vec3 scan = (AZURE * dots * iso * 3.0 + VIOLET * dots * echo) * uScanIn;
  scan += AZURE * (1.0 - smoothstep(0.0, 0.2, abs(sc - scanPos))) * 0.12 * uScanIn;
  sph = sph + scan - sph * scan;                              // screen blend
  float edge = 1.0 - smoothstep(rr2 - 0.0025, rr2 + 0.0025, r2);
  col = mix(col, sph, edge);
  // gimbal rings — three great circles in the tri-accent, hidden where they
  // pass behind the ball, brighter toward the viewer
  float dep; float d; float hide; float line; float glow;
  float lw = 0.0026;
  d = ringDist(p, rotX(uTime * 0.29 + 0.6) * rotZ(0.35), R * ${RING_RADII[0]}, dep);
  hide = edge * step(dep, 0.0);
  line = (1.0 - smoothstep(0.0, lw, d)) * (1.0 - hide);
  glow = (1.0 - smoothstep(0.0, lw * 7.0, d)) * (1.0 - hide);
  col += AZURE * (line * (0.45 + 0.4 * dep) + glow * 0.07);
  d = ringDist(p, rotY(uTime * 0.21 + 1.3) * rotX(1.15), R * ${RING_RADII[1]}, dep);
  hide = edge * step(dep, 0.0);
  line = (1.0 - smoothstep(0.0, lw, d)) * (1.0 - hide);
  glow = (1.0 - smoothstep(0.0, lw * 7.0, d)) * (1.0 - hide);
  col += VIOLET * (line * (0.42 + 0.38 * dep) + glow * 0.06);
  d = ringDist(p, rotZ(uTime * 0.16) * rotY(0.95) * rotX(0.5), R * ${RING_RADII[2]}, dep);
  hide = edge * step(dep, 0.0);
  line = (1.0 - smoothstep(0.0, lw, d)) * (1.0 - hide);
  glow = (1.0 - smoothstep(0.0, lw * 7.0, d)) * (1.0 - hide);
  col += ROSE * (line * (0.38 + 0.34 * dep) + glow * 0.05);
  // vignette + grain
  col *= 1.0 - 0.32 * smoothstep(0.55, 1.0, length(vUv - 0.5));
  col += (hash21(vUv + uTime * 0.01) - 0.5) * 0.02;
  // Headline legibility ceiling: hue-preserving luminance cap inside a
  // soft-edged mask over the headline zone (same zone + 0.34 cap as the
  // reference chip hero) — outside it the rings and scan stay overdriven.
  float zoneM = smoothstep(0.07, 0.14, vUv.x) * smoothstep(0.93, 0.86, vUv.x)
              * smoothstep(0.30, 0.37, vUv.y) * smoothstep(0.78, 0.71, vUv.y);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= mix(1.0, min(1.0, 0.34 / max(lum, 1e-4)), zoneM);
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

/* ── 2D preview (first frame · no-WebGL fallback · demote target) ─────── */

type Vec3 = [number, number, number];
const TAU = Math.PI * 2;

const rotX = ([x, y, z]: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x, c * y - s * z, s * y + c * z];
};
const rotY = ([x, y, z]: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * x + s * z, y, -s * x + c * z];
};
const rotZ = ([x, y, z]: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * x - s * y, s * x + c * y, z];
};

/** The three ring frames at clock t — MUST mirror the shader's matrices. */
function ringBasis(i: number, t: number): { u: Vec3; v: Vec3 } {
  const X: Vec3 = [1, 0, 0];
  const Y: Vec3 = [0, 1, 0];
  const apply = (e: Vec3): Vec3 => {
    if (i === 0) return rotX(rotZ(e, 0.35), t * 0.29 + 0.6);
    if (i === 1) return rotY(rotX(e, 1.15), t * 0.21 + 1.3);
    return rotZ(rotY(rotX(e, 0.5), 0.95), t * 0.16);
  };
  return { u: apply(X), v: apply(Y) };
}

const RING_RGB = ["41, 151, 255", "191, 90, 242", "255, 55, 95"] as const;

function paintRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  h: number,
  t: number,
  front: boolean
) {
  const SEGS = 96;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.5, h * 0.0035);
  for (let i = 0; i < 3; i++) {
    const { u, v } = ringBasis(i, t);
    const rr = R * RING_RADII[i];
    const base = i === 0 ? 0.45 : i === 1 ? 0.42 : 0.38;
    let prev: { x: number; y: number; d: number } | null = null;
    for (let k = 0; k <= SEGS; k++) {
      const th = (k / SEGS) * TAU;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const x = rr * (c * u[0] + s * v[0]);
      const y = rr * (c * u[1] + s * v[1]);
      const d = c * u[2] + s * v[2];
      const pt = { x: cx + x, y: cy - y, d };
      if (prev) {
        const depth = (prev.d + d) / 2;
        const isFront = depth >= 0;
        const midX = (prev.x + pt.x) / 2 - cx;
        const midY = (prev.y + pt.y) / 2 - cy;
        const overDisc = Math.hypot(midX, midY) < R;
        if (isFront === front && !(overDisc && !isFront)) {
          ctx.strokeStyle = `rgba(${RING_RGB[i]}, ${base + 0.4 * depth})`;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
        }
      }
      prev = pt;
    }
  }
}

/** Same composition as the shader's t = 0 frame, in Canvas 2D. */
function paintBallPreview(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const R = radiusFor(w / Math.max(1, h)) * h;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.2);
  bloom.addColorStop(0, "rgba(41, 151, 255, 0.11)");
  bloom.addColorStop(1, "rgba(41, 151, 255, 0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);

  paintRings(ctx, cx, cy, R, h, 0, false);

  const shade = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.08, cx, cy, R);
  shade.addColorStop(0, "rgb(54, 58, 74)");
  shade.addColorStop(0.55, "rgb(18, 20, 28)");
  shade.addColorStop(1, "rgb(8, 9, 13)");
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(41, 151, 255, 0.35)";
  ctx.lineWidth = Math.max(1.5, h * 0.003);
  ctx.stroke();

  paintRings(ctx, cx, cy, R, h, 0, true);

  const vignette = ctx.createRadialGradient(cx, cy, h * 0.35, cx, cy, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

/* ═══════════════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════════════ */

/**
 * WebGL surface #1 — the hero background: the ball under an IMU scan, with
 * its three gimbal rings orbiting. Pure decoration: aria-hidden,
 * pointer-events-none.
 *
 * Choreography: 2D preview painted in the first rAF after mount; GL init
 * deferred to idle; exp fade-in; first scan sweep delayed 1.2 s (after the
 * headline lands). Render gate: IO(120px) ∧ !document.hidden ∧ !reduced ∧
 * !covered ∧ governor ∧ !contextLost. Reduced motion → ONE composed frame,
 * no RAF. Context loss → restore once; a second loss within 10 s demotes
 * permanently to the 2D preview.
 */
export function BallScanHero({ className }: BallScanHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const reduced = !!useReducedMotion();
  const covered = useDeckCovered();

  // Live values readable from inside the long-lived effect without restarts.
  const coveredRef = useRef(covered);
  const syncRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const previewCanvas = previewRef.current;
    const glCanvas = glRef.current;
    if (!container || !previewCanvas || !glCanvas) return;
    const previewCtx = previewCanvas.getContext("2d");

    // Each run starts un-revealed (an inline opacity "1" would otherwise
    // persist across effect re-runs and composite a dead GL canvas above
    // the freshly painted preview if the new init fails).
    glCanvas.style.opacity = "0";

    let disposed = false;
    let running = false;
    let demoted = false;
    let revealed = false;
    let inView = true;
    let glReady = false;
    let lastLossAt = 0;
    let lastMs = 0;
    let tAcc = 0;
    let fade = 0;
    let lastW = 0;
    let lastH = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    let surface: GLSurface | null = null;

    const governor = registerSurface("ball-hero");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const maxDpr = finePointer ? 2 : 1.75;

    /* ── 2D preview ─────────────────────────────────────────────── */

    const paintPreview = () => {
      if (!previewCtx) return;
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      previewCanvas.width = Math.round(w * dpr);
      previewCanvas.height = Math.round(h * dpr);
      previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintBallPreview(previewCtx, w, h);
      lastW = w;
      lastH = h;
    };

    /** Free the preview's backing store while the opaque GL canvas covers it. */
    const releasePreview = () => {
      previewCanvas.width = 0;
      previewCanvas.height = 0;
      lastW = 0;
      lastH = 0;
    };

    /* ── GL plumbing ────────────────────────────────────────────── */

    const setStaticUniforms = () => {
      if (!surface) return;
      const aspect = container.clientWidth / Math.max(1, container.clientHeight);
      surface.setUniform("uAspect", aspect);
      surface.setUniform("uRadius", radiusFor(aspect));
      surface.setUniform("uPointer", 0, 0);
      surface.setUniform("uScan", 0.5);
      surface.setUniform("uScanIn", 0);
      surface.setUniform("uFade", 0);
      surface.setUniform("uTime", 0);
    };

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      glCanvas.style.opacity = "1";
      window.setTimeout(() => {
        if (!disposed && revealed && !demoted && surface && !surface.isContextLost()) {
          releasePreview();
        }
      }, 700);
    };

    /** Reduced motion: exactly ONE composed frame, no RAF ever. */
    const composeStill = () => {
      if (!surface || surface.isContextLost()) return;
      setStaticUniforms();
      surface.setUniform("uTime", STILL_TIME);
      surface.setUniform("uScan", STILL_SCAN);
      surface.setUniform("uScanIn", 1);
      surface.setUniform("uFade", 1);
      surface.draw();
      reveal();
    };

    /* ── RAF loop ───────────────────────────────────────────────── */

    const frame = (tms: number) => {
      if (!running) {
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
      const s = surface;
      if (!s) return;
      if (s.isContextLost()) {
        sync();
        return;
      }
      const dt = Math.min(Math.max((tms - lastMs) / 1000, 0), 0.064);
      lastMs = tms;
      if (!governor.requestActive()) return;

      tAcc += dt;
      fade = 1 - (1 - fade) * Math.exp(-dt * FADE_RATE);
      const k = 1 - Math.exp(-dt * POINTER_RATE);
      pointer.x += (pointer.tx - pointer.x) * k;
      pointer.y += (pointer.ty - pointer.y) * k;

      const tScan = tAcc - SCAN_DELAY;
      const scanIn = Math.min(Math.max(tScan / SCAN_RAMP, 0), 1);
      const scan = 0.5 + 0.5 * Math.sin(Math.max(tScan, 0) * SCAN_RATE);

      s.setUniform("uTime", tAcc % TIME_WRAP);
      s.setUniform("uFade", fade);
      s.setUniform("uScan", scan);
      s.setUniform("uScanIn", scanIn);
      s.setUniform("uPointer", pointer.x, pointer.y);
      s.draw();
      s.noteFrame(dt * 1000);
      reveal();
    };

    /** The house render gate — the ONLY place the loop starts or stops. */
    const sync = () => {
      const should =
        glReady &&
        !demoted &&
        !reduced &&
        surface !== null &&
        !surface.isContextLost() &&
        inView &&
        !document.hidden &&
        !coveredRef.current;
      if (should && !running) {
        running = true;
        lastMs = performance.now();
        rafRef.current = requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    syncRef.current = sync;

    /* ── Context loss policy ────────────────────────────────────── */

    const demote = () => {
      demoted = true;
      sync();
      paintPreview();
      glCanvas.style.opacity = "0";
      revealed = false;
      governor.release();
      if (surface) {
        surface.dispose();
        surface = null;
      }
    };

    const onContextLost = () => {
      const now = performance.now();
      if (revealed && previewCanvas.width === 0) paintPreview();
      if (lastLossAt !== 0 && now - lastLossAt <= LOSS_WINDOW_MS) {
        demote();
        return;
      }
      lastLossAt = now;
      sync();
    };
    glCanvas.addEventListener("webglcontextlost", onContextLost);

    /* ── Deferred GL init (idle, after the first-rAF preview) ───── */

    const initGL = () => {
      if (disposed || demoted) return;
      surface = createGLSurface(glCanvas, {
        frag: FRAG,
        maxDpr,
        onContextRestored: () => {
          if (disposed || demoted) return;
          setStaticUniforms();
          if (reduced) composeStill();
          else {
            fade = 0;
            sync();
          }
        },
      });
      if (!surface) return; // no WebGL → the 2D preview is the hero, permanently
      surface.resize();
      setStaticUniforms();
      glReady = true;
      if (reduced) {
        composeStill();
        return;
      }
      sync();
    };

    let idleHandle = 0;
    let idleIsTimeout = false;
    const prePaintRaf = requestAnimationFrame(() => {
      paintPreview();
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(initGL, { timeout: 300 });
      } else {
        idleIsTimeout = true;
        idleHandle = window.setTimeout(initGL, 120);
      }
    });

    /* ── Observers + listeners ──────────────────────────────────── */

    const doResize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if ((!revealed || demoted) && (w !== lastW || h !== lastH)) paintPreview();
      if (surface && !surface.isContextLost()) {
        surface.resize();
        const aspect = w / Math.max(1, h);
        surface.setUniform("uAspect", aspect);
        surface.setUniform("uRadius", radiusFor(aspect));
        if (reduced) composeStill();
        else if (!running && glReady && !demoted) surface.draw();
      }
    };

    let buildTimer: number | undefined;
    let sizedOnce = false;
    const ro = new ResizeObserver(() => {
      if (!sizedOnce) {
        sizedOnce = true;
        doResize();
        return;
      }
      window.clearTimeout(buildTimer);
      buildTimer = window.setTimeout(doResize, 120);
    });
    ro.observe(container);

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        inView = e?.isIntersecting ?? true;
        governor.setRatio(e?.intersectionRatio ?? 0);
        sync();
      },
      { rootMargin: "120px", threshold: [0, 0.15, 0.3, 0.5, 0.75, 1] }
    );
    io.observe(container);

    const onVis = () => sync();
    document.addEventListener("visibilitychange", onVis);

    // Pointer parallax — fine pointers only, never under reduced motion.
    const sectionEl = container.closest("section");
    const onMove = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (finePointer && !reduced && sectionEl) {
      sectionEl.addEventListener("pointermove", onMove, { passive: true });
    }

    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(prePaintRaf);
      if (idleHandle) {
        if (idleIsTimeout) window.clearTimeout(idleHandle);
        else window.cancelIdleCallback(idleHandle);
      }
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      window.clearTimeout(buildTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      sectionEl?.removeEventListener("pointermove", onMove);
      glCanvas.removeEventListener("webglcontextlost", onContextLost);
      governor.release();
      syncRef.current = null;
      if (surface) {
        surface.dispose();
        surface = null;
      }
    };
  }, [reduced]);

  // Deck-cover gate: re-run the render gate when the covered signal flips.
  useEffect(() => {
    coveredRef.current = covered;
    syncRef.current?.();
  }, [covered]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {/* 2D preview — first frame, no-WebGL fallback, demote target */}
      <canvas ref={previewRef} className="absolute inset-0 block h-full w-full" />
      {/* WebGL surface — crossfades over the preview once the first frame lands */}
      <canvas
        ref={glRef}
        className="absolute inset-0 block h-full w-full opacity-0 transition-opacity duration-500 ease-glide"
      />
    </div>
  );
}
