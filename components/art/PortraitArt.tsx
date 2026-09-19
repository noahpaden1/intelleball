"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface PortraitArtProps {
  className?: string;
  /** Letters ghosted into the field lines (default: the Intelleball monogram). */
  monogram?: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   Electromagnetic portrait — tuning constants

   Field lines flow between four point charges (with a gentle solenoidal
   swirl), rendered additively in azure/violet. The monogram is not
   stamped on top — it modulates the brightness of the field lines that
   pass through it, so the letters emerge from the physics.
═══════════════════════════════════════════════════════════════════════ */

const MAX_DPR = 4;
const TAU = Math.PI * 2;
const SEED = 0x50f0; // fixed → the portrait is the same on every visit

type RGB = readonly [number, number, number];
const AZURE: RGB = [41, 151, 255];
const VIOLET: RGB = [191, 90, 242];
const LAVENDER: RGB = [214, 210, 255]; // occasional white-ish strand

/** Charges in unit space (x/y relative to width/height). q>0 emits lines. */
const SOURCES = [
  { x: 0.36, y: 0.4, q: 1.0, rgb: AZURE },
  { x: 0.64, y: 0.6, q: 1.0, rgb: VIOLET },
  { x: 0.82, y: 0.16, q: -1.25, rgb: VIOLET },
  { x: 0.18, y: 0.84, q: -1.25, rgb: AZURE },
] as const;

const LINES_PER_SOURCE = 110;
const STEP = 0.006; //      integration step, fraction of min-dimension
const MAX_STEPS = 760;
const SWIRL = 0.55; //      solenoidal term — bends lines into flow
const LINE_ALPHA = 0.055; // base strand opacity (additive)
const LINE_WIDTH = 0.7;
const CHUNK = 7; //         steps per stroke chunk (mask sampled per chunk)
const MONOGRAM_GAIN = 3.2; // brightness boost where a strand crosses "PP"
const GHOST_ALPHA = 0.06; // direct wash of the blurred monogram
const SHIMMER_ALPHA = 0.028; // drifting highlight (glacial, optional)

type Rand = () => number;

function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(rgb: RGB, a: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}

function paintRadial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: RGB,
  alpha: number
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(rgb, alpha));
  g.addColorStop(0.5, rgba(rgb, alpha * 0.3));
  g.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Combined field: point charges + a gentle swirl about the frame center. */
function fieldAt(px: number, py: number, w: number, h: number, s: number): [number, number] {
  let fx = 0;
  let fy = 0;
  for (const src of SOURCES) {
    const dx = (px - src.x * w) / s;
    const dy = (py - src.y * h) / s;
    const d2 = dx * dx + dy * dy + 0.002;
    const f = src.q / d2;
    fx += dx * f;
    fy += dy * f;
  }
  const ux = (px - w * 0.5) / s;
  const uy = (py - h * 0.52) / s;
  const r2 = ux * ux + uy * uy + 0.08;
  fx += (-uy / r2) * SWIRL;
  fy += (ux / r2) * SWIRL;
  return [fx, fy];
}

/**
 * Soft monogram mask: "PP" drawn tiny, then upscaled — the resampling is a
 * cheap, dependency-free blur. Returns a sampler in canvas coordinates plus
 * the mid-res canvas for the direct ghost wash.
 */
function buildMonogramMask(w: number, h: number, family: string, text: string) {
  const mw = Math.max(8, Math.round(w / 4));
  const mh = Math.max(8, Math.round(h / 4));
  const tw = Math.max(4, Math.round(mw / 5));
  const th = Math.max(4, Math.round(mh / 5));

  const tiny = document.createElement("canvas");
  tiny.width = tw;
  tiny.height = th;
  const tctx = tiny.getContext("2d");

  const mid = document.createElement("canvas");
  mid.width = mw;
  mid.height = mh;
  const mctx = mid.getContext("2d");

  if (tctx && mctx) {
    tctx.fillStyle = rgba(LAVENDER, 1);
    tctx.font = `600 ${Math.max(4, Math.round(th * 0.56))}px ${family}`;
    tctx.textAlign = "center";
    tctx.textBaseline = "middle";
    tctx.fillText(text, tw / 2, th * 0.54);
    mctx.imageSmoothingEnabled = true;
    mctx.imageSmoothingQuality = "high";
    mctx.drawImage(tiny, 0, 0, mw, mh);
  }

  const data = mctx ? mctx.getImageData(0, 0, mw, mh).data : new Uint8ClampedArray(0);
  const sample = (x: number, y: number): number => {
    if (data.length === 0) return 0;
    const mx = Math.min(mw - 1, Math.max(0, Math.round((x * mw) / w)));
    const my = Math.min(mh - 1, Math.max(0, Math.round((y * mh) / h)));
    return data[(my * mw + mx) * 4 + 3] / 255;
  };
  return { sample, mid };
}

/** Renders the full portrait once into an offscreen canvas (backing res). */
function buildArt(
  w: number,
  h: number,
  dpr: number,
  family: string,
  text: string
): HTMLCanvasElement | null {
  const art = document.createElement("canvas");
  art.width = Math.round(w * dpr);
  art.height = Math.round(h * dpr);
  const ctx = art.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const s = Math.min(w, h);
  const { sample, mid } = buildMonogramMask(w, h, family, text);
  const rand = mulberry32(SEED);

  ctx.globalCompositeOperation = "lighter";

  // Soft source glows — the "lamps" of the portrait
  for (const src of SOURCES) {
    paintRadial(
      ctx,
      src.x * w,
      src.y * h,
      (src.q > 0 ? 0.38 : 0.22) * s,
      src.rgb,
      src.q > 0 ? 0.11 : 0.05
    );
    if (src.q > 0) {
      // tight luminous core so emitters read as points of light, not holes
      paintRadial(ctx, src.x * w, src.y * h, 0.045 * s, src.rgb, 0.3);
      ctx.fillStyle = "rgba(235, 240, 255, 0.55)";
      ctx.beginPath();
      ctx.arc(src.x * w, src.y * h, 1.4, 0, TAU);
      ctx.fill();
    }
  }

  // Equipotential rings — faint interference structure around each charge
  ctx.lineWidth = 0.6;
  for (const src of SOURCES) {
    const rings = src.q > 0 ? 5 : 3;
    for (let k = 0; k < rings; k++) {
      ctx.strokeStyle = rgba(src.rgb, 0.03 * (1 - k / (rings + 1)));
      ctx.beginPath();
      ctx.arc(src.x * w, src.y * h, (0.055 + k * 0.048) * s, 0, TAU);
      ctx.stroke();
    }
  }

  // Field lines — integrated from each positive charge, brightness
  // modulated by the monogram mask so the letters emerge inside the field.
  const step = STEP * s;
  const margin = 0.1 * s;
  const stopR2 = Math.pow(0.022 * s, 2);
  ctx.lineCap = "round";
  ctx.lineWidth = LINE_WIDTH;

  for (const src of SOURCES) {
    if (src.q <= 0) continue;
    for (let i = 0; i < LINES_PER_SOURCE; i++) {
      const ang = (i / LINES_PER_SOURCE) * TAU + (rand() - 0.5) * 0.05;
      let px = src.x * w + Math.cos(ang) * 0.008 * s;
      let py = src.y * h + Math.sin(ang) * 0.008 * s;
      const pts: number[] = [px, py];

      for (let n = 0; n < MAX_STEPS; n++) {
        const [fx, fy] = fieldAt(px, py, w, h, s);
        const mag = Math.hypot(fx, fy);
        if (mag < 1e-6) break;
        px += (fx / mag) * step;
        py += (fy / mag) * step;
        pts.push(px, py);
        if (px < -margin || px > w + margin || py < -margin || py > h + margin) break;
        let sunk = false;
        for (const neg of SOURCES) {
          if (neg.q >= 0) continue;
          const ddx = px - neg.x * w;
          const ddy = py - neg.y * h;
          if (ddx * ddx + ddy * ddy < stopR2) {
            sunk = true;
            break;
          }
        }
        if (sunk) break;
      }

      const rgb = i % 5 === 4 ? LAVENDER : src.rgb;
      const baseA = i % 5 === 4 ? LINE_ALPHA * 0.7 : LINE_ALPHA;
      const count = pts.length / 2;
      for (let c0 = 0; c0 < count - 1; c0 += CHUNK) {
        const c1 = Math.min(c0 + CHUNK, count - 1);
        const midIdx = (c0 + c1) >> 1;
        const m = sample(pts[midIdx * 2], pts[midIdx * 2 + 1]);
        ctx.strokeStyle = rgba(rgb, Math.min(baseA * (0.7 + m * MONOGRAM_GAIN), 0.26));
        ctx.beginPath();
        ctx.moveTo(pts[c0 * 2], pts[c0 * 2 + 1]);
        for (let c = c0 + 1; c <= c1; c++) ctx.lineTo(pts[c * 2], pts[c * 2 + 1]);
        ctx.stroke();
      }
    }
  }

  // Ghost wash — the blurred monogram breathed directly into the field
  ctx.globalAlpha = GHOST_ALPHA;
  ctx.drawImage(mid, 0, 0, w, h);
  ctx.globalAlpha = 1;

  // Vignette — pull the edges back to black so it reads as a print
  ctx.globalCompositeOperation = "source-over";
  const v = ctx.createRadialGradient(
    w * 0.5,
    h * 0.46,
    s * 0.25,
    w * 0.5,
    h * 0.46,
    Math.max(w, h) * 0.72
  );
  v.addColorStop(0, "rgba(0, 0, 0, 0)");
  v.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);

  return art;
}

/* ═══════════════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════════════ */

/**
 * Generative portrait for the About section: an electromagnetic field study
 * in azure/violet with a monogram ghosted into the strands. Fills its
 * parent (the parent supplies the aspect ratio). Essentially static — the
 * art renders once per resize; a whisper highlight drifts across it at
 * glacial speed unless reduced motion is set.
 */
export function PortraitArt({ className, monogram = "IB" }: PortraitArtProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = !!useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let s = 0;
    let art: HTMLCanvasElement | null = null;
    let raf = 0;
    let running = false;
    let inView = true;
    let cancelled = false;

    const present = () => {
      ctx.clearRect(0, 0, w, h);
      if (art) ctx.drawImage(art, 0, 0, w, h);
    };

    const frame = (tms: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const t = tms / 1000;
      present();
      // Glacial shimmer: one drifting highlight, whisper-quiet
      ctx.globalCompositeOperation = "lighter";
      const hx = w * (0.5 + 0.2 * Math.sin((t * TAU) / 41));
      const hy = h * (0.46 + 0.16 * Math.sin((t * TAU) / 59 + 1.8));
      paintRadial(ctx, hx, hy, s * 0.5, LAVENDER, SHIMMER_ALPHA);
      ctx.globalCompositeOperation = "source-over";
    };

    const sync = () => {
      const should = inView && !document.hidden && !reduced;
      if (should && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    const rebuild = () => {
      const rect = container.getBoundingClientRect();
      // display:none (mobile) or unlaid-out — nothing visible to paint
      if (rect.width < 2 || rect.height < 2) return;
      if (typeof document.fonts !== "undefined" && document.fonts.status !== "loaded") {
        builtBeforeFonts = true;
      }
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      s = Math.min(w, h);
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const family = getComputedStyle(canvas).fontFamily || "sans-serif";
      art = buildArt(w, h, dpr, family, monogram);
      present();
    };

    // The art pass costs ~tens of ms on the main thread, so it is lazy:
    // the IntersectionObserver (generous rootMargin) triggers the first
    // build shortly before the section scrolls into view; resizes after
    // that are debounced. On mobile the container is display:none — the
    // observer never intersects and no work happens at all.
    let buildTimer: number | undefined;
    let built = false;
    let builtBeforeFonts = false;
    const ro = new ResizeObserver(() => {
      if (!built) return; // first build is viewport-gated below
      window.clearTimeout(buildTimer);
      buildTimer = window.setTimeout(rebuild, 120);
    });
    ro.observe(container);

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? true;
        if (inView && !built) {
          built = true;
          rebuild();
        }
        sync();
      },
      { rootMargin: "600px" }
    );
    io.observe(container);

    const onVis = () => sync();
    document.addEventListener("visibilitychange", onVis);

    // The monogram uses the site font — repaint once webfonts resolve, but
    // only if the art was already built against fallback fonts.
    if (typeof document.fonts !== "undefined") {
      document.fonts.ready.then(() => {
        if (!cancelled && builtBeforeFonts) rebuild();
      });
    }

    sync();

    return () => {
      cancelled = true;
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(buildTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced, monogram]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn("pointer-events-none relative h-full w-full overflow-hidden", className)}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}
