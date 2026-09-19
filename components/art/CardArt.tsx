"use client";

import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface CardArtProps {
  accent: "azure" | "violet" | "rose";
  /** Vary per card so sibling cards get distinct compositions. */
  seed?: number;
  className?: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   Circuit-fragment card backdrop — deterministic generative SVG.

   Everything derives from mulberry32(seed ⊕ accent): a focal glow in one
   corner, a small cluster of pads opposite it, a few Manhattan traces with
   45° bevels, and one long "focal" trace reaching toward the light.
   Opacities are capped low so card copy always dominates. SSR-safe —
   no Math.random, no effects, pure render.
═══════════════════════════════════════════════════════════════════════ */

const VB_W = 420;
const VB_H = 320;
const CELL = 18; //   pad grid pitch
const BEVEL = 9; //   45° corner cut on traces

const ACCENTS = {
  azure: "#2997ff",
  violet: "#bf5af2",
  rose: "#ff375f",
} as const;

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

const f = (n: number) => String(Math.round(n * 10) / 10);

/** Manhattan route with a 45° bevel at the single corner. */
function route(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  horizontalFirst: boolean
): string {
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
    return `M ${f(ax)} ${f(ay)} L ${f(bx)} ${f(by)}`;
  }
  const bev = Math.min(BEVEL, Math.abs(dx) / 2, Math.abs(dy) / 2);
  const sx = dx > 0 ? 1 : -1;
  const sy = dy > 0 ? 1 : -1;
  if (horizontalFirst) {
    // corner at (bx, ay)
    return [
      `M ${f(ax)} ${f(ay)}`,
      `L ${f(bx - sx * bev)} ${f(ay)}`,
      `L ${f(bx)} ${f(ay + sy * bev)}`,
      `L ${f(bx)} ${f(by)}`,
    ].join(" ");
  }
  // corner at (ax, by)
  return [
    `M ${f(ax)} ${f(ay)}`,
    `L ${f(ax)} ${f(by - sy * bev)}`,
    `L ${f(ax + sx * bev)} ${f(by)}`,
    `L ${f(bx)} ${f(by)}`,
  ].join(" ");
}

interface Pad {
  x: number;
  y: number;
  square: boolean;
  size: number;
  filled: boolean;
}

interface Composition {
  glow: { x: number; y: number };
  pads: Pad[];
  traces: string[]; //  routed paths between pads
  focal: string; //     the long trace reaching toward the glow
  focalEnd: { x: number; y: number };
  vias: { x: number; y: number }[];
}

function compose(seed: number, accent: keyof typeof ACCENTS): Composition {
  const accentIdx = accent === "azure" ? 1 : accent === "violet" ? 2 : 3;
  const rand = mulberry32(
    (Math.imul(seed + 1, 0x9e3779b1) ^ Math.imul(accentIdx, 0x85ebca6b)) >>> 0
  );

  // Focal glow claims one corner…
  const glowLeft = rand() < 0.5;
  const glowTop = rand() < 0.6;
  const glow = {
    x: glowLeft ? VB_W * 0.18 : VB_W * 0.82,
    y: glowTop ? VB_H * 0.06 : VB_H * 0.92,
  };

  // …the pad cluster settles into the opposite one (8×6 cells).
  const jitter = () => Math.floor(rand() * 2) * CELL;
  const ox = (glowLeft ? VB_W - 60 - 7 * CELL : 60) + (glowLeft ? -jitter() : jitter());
  const oy = (glowTop ? VB_H - 54 - 5 * CELL : 54) + (glowTop ? -jitter() : jitter());

  const padCount = 5 + Math.floor(rand() * 3);
  const cells = new Set<string>();
  const pads: Pad[] = [];
  let guard = 0;
  while (pads.length < padCount && guard++ < 48) {
    const col = Math.floor(rand() * 8);
    const row = Math.floor(rand() * 6);
    const key = `${col},${row}`;
    if (cells.has(key)) continue;
    cells.add(key);
    pads.push({
      x: ox + col * CELL,
      y: oy + row * CELL,
      square: rand() < 0.55,
      size: 7 + rand() * 3.5,
      filled: rand() < 0.4,
    });
  }

  // Short routes stitch the cluster together. (Fisher–Yates with the seeded
  // PRNG — engine-independent, unlike a random sort comparator, so server
  // and client always render identical markup.)
  const order = pads.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const traces: string[] = [];
  for (let r = 0; r < 3 && r + 1 < order.length; r++) {
    const a = pads[order[r]];
    const b = pads[order[(r + 1) % order.length]];
    if (a === b) continue;
    traces.push(route(a.x, a.y, b.x, b.y, rand() < 0.5));
  }

  // One long focal trace reaches from the cluster toward the light.
  const start = pads[order[0]];
  const focalEnd = {
    x: Math.min(VB_W - 24, Math.max(24, glow.x + (glowLeft ? 52 : -52))),
    y: Math.min(VB_H - 24, Math.max(24, glow.y + (glowTop ? 46 : -46))),
  };
  const focal = route(start.x, start.y, focalEnd.x, focalEnd.y, rand() < 0.5);

  // A few stray vias give the substrate life without clutter.
  const vias: { x: number; y: number }[] = [];
  for (let i = 0; i < 3; i++) {
    vias.push({
      x: ox + Math.floor(rand() * 9) * CELL - CELL,
      y: oy + Math.floor(rand() * 7) * CELL - CELL,
    });
  }

  return { glow, pads, traces, focal, focalEnd, vias };
}

/**
 * Generative circuit backdrop for project cards. Deterministic per
 * (accent, seed) — safe to server-render. Sits behind card copy at low
 * opacity; strokes stay hairline at any rendered size via
 * vector-effect="non-scaling-stroke".
 */
export function CardArt({ accent, seed = 7, className }: CardArtProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const glowId = `ca-glow-${uid}`;
  const dotsId = `ca-dots-${uid}`;
  const color = ACCENTS[accent];
  const c = useMemo(() => compose(seed, accent), [seed, accent]);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none h-full w-full", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="55%" stopColor={color} stopOpacity="0.05" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <pattern id={dotsId} width="21" height="21" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.7" fill="#ffffff" opacity="0.04" />
        </pattern>
      </defs>

      {/* Substrate dot grid */}
      <rect width={VB_W} height={VB_H} fill={`url(#${dotsId})`} />

      {/* Focal glow */}
      <circle cx={f(c.glow.x)} cy={f(c.glow.y)} r="180" fill={`url(#${glowId})`} />

      {/* Cluster traces */}
      {c.traces.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.14"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Focal trace + its terminal via */}
      <path
        d={c.focal}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.2"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={f(c.focalEnd.x)}
        cy={f(c.focalEnd.y)}
        r="2.6"
        fill="none"
        stroke={color}
        strokeWidth="1"
        opacity="0.28"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={f(c.focalEnd.x)} cy={f(c.focalEnd.y)} r="0.9" fill={color} opacity="0.3" />

      {/* Pads */}
      {c.pads.map((p, i) =>
        p.square ? (
          <rect
            key={i}
            x={f(p.x - p.size / 2)}
            y={f(p.y - p.size / 2)}
            width={f(p.size)}
            height={f(p.size)}
            rx="2"
            fill={p.filled ? color : "none"}
            fillOpacity={p.filled ? 0.07 : undefined}
            stroke={color}
            strokeWidth="1"
            opacity="0.2"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <circle
            key={i}
            cx={f(p.x)}
            cy={f(p.y)}
            r={f(p.size / 2.4)}
            fill={p.filled ? color : "none"}
            fillOpacity={p.filled ? 0.07 : undefined}
            stroke={color}
            strokeWidth="1"
            opacity="0.2"
            vectorEffect="non-scaling-stroke"
          />
        )
      )}

      {/* Stray vias */}
      {c.vias.map((v, i) => (
        <circle
          key={i}
          cx={f(v.x)}
          cy={f(v.y)}
          r="1.4"
          fill="none"
          stroke={color}
          strokeWidth="1"
          opacity="0.12"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
