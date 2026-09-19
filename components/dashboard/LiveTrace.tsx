"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

/* ═══════════════════════════════════════════════════════════════════════
   Live IMU strip — |a| of a ball resting on the bench: near-zero noise at
   100 Hz with an occasional nudge. A hand-rolled rAF loop advances a ring
   buffer by elapsed time and writes ONE path string into a MotionValue
   (no per-frame React state), pauses offscreen / tab-hidden, and renders a
   frozen buffer under reduced motion.
═══════════════════════════════════════════════════════════════════════ */

const W = 260;
const H = 56;
const SAMPLES = 150; //   1.5 s window at 100 Hz
const HZ = 100;
const G_SCALE = 0.35; //  full height = 0.35 g

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One resting-ball sample (g): sensor noise plus a rare soft bump. */
function makeSampler(seed: number) {
  const rand = mulberry32(seed);
  let bump = 0;
  return () => {
    if (rand() < 0.004) bump = 0.12 + rand() * 0.1;
    bump *= 0.9;
    return Math.abs(0.012 * (rand() - 0.5) * 2 + bump * Math.sin(rand() * Math.PI));
  };
}

function toPath(buf: Float32Array, head: number): string {
  let d = "";
  for (let i = 0; i < SAMPLES; i++) {
    const v = buf[(head + i) % SAMPLES];
    const x = (i / (SAMPLES - 1)) * W;
    const y = H - 3 - Math.min(v / G_SCALE, 1) * (H - 6);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

export function LiveTrace({ seed = 7 }: { seed?: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);
  const reduced = usePrefersReducedMotion();
  const path = useMotionValue("");

  useEffect(() => {
    const sample = makeSampler(seed);
    const buf = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) buf[i] = sample();
    let head = 0;
    path.set(toPath(buf, head));
    if (reduced) return;

    let raf: number | null = null;
    let last: number | null = null;
    let carry = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (last === null) {
        last = now;
        return;
      }
      carry += Math.min(now - last, 64);
      last = now;
      const step = 1000 / HZ;
      while (carry >= step) {
        buf[head] = sample();
        head = (head + 1) % SAMPLES;
        carry -= step;
      }
      path.set(toPath(buf, head));
    };

    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      last = null;
    };
    const sync = () => {
      const active = inView && !document.hidden;
      if (active && raf === null) raf = requestAnimationFrame(frame);
      else if (!active) stop();
    };

    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      document.removeEventListener("visibilitychange", sync);
      stop();
    };
  }, [inView, reduced, seed, path]);

  return (
    <div ref={rootRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-14 w-full"
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="none"
      >
        <line x1={0} x2={W} y1={H - 3} y2={H - 3} stroke="var(--color-line)" strokeWidth={1} />
        <motion.path
          d={path}
          fill="none"
          stroke="var(--color-mint)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="sr-only">Live acceleration magnitude of the ball at rest: near zero.</p>
    </div>
  );
}
