import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found",
};

/* ── Deterministic circuit-trace ornament ──────────────────────────────
   Seeded PRNG (mulberry32) so the SVG is identical on server and client —
   no hydration mismatch, no Math.random() in render. */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VIEW_W = 720;
const VIEW_H = 280;

interface Trace {
  /** One or two subpaths — the broken trace has a gap mid-run */
  d: string;
  /** End pads (filled) */
  pads: { x: number; y: number }[];
  /** Open pads flanking the signal break, if any */
  breakPads: { x: number; y: number }[];
  broken: boolean;
}

function buildTraces(seed: number): Trace[] {
  const rand = mulberry32(seed);
  const traces: Trace[] = [];
  const lanes = 7;
  const brokenLane = 3; //  the trace with no signal

  for (let i = 0; i < lanes; i++) {
    const laneY = Math.round(28 + (i * (VIEW_H - 56)) / (lanes - 1));
    let x = 0;
    let y = laneY;
    const parts: string[] = [`M 0 ${y}`];
    const bends = 1 + Math.floor(rand() * 2);

    for (let b = 0; b < bends; b++) {
      x += Math.round(70 + rand() * 150);
      parts.push(`L ${x} ${y}`);
      //  45° jog, snapped to an 16px grid
      const dir = rand() > 0.5 ? 1 : -1;
      let rise = (16 + Math.floor(rand() * 2) * 16) * dir;
      if (y + rise < 20 || y + rise > VIEW_H - 20) rise = -rise;
      x += Math.abs(rise);
      y += rise;
      parts.push(`L ${x} ${y}`);
    }

    const endX = Math.min(x + Math.round(70 + rand() * 130), VIEW_W - 16);
    const broken = i === brokenLane;
    const breakPads: Trace["breakPads"] = [];

    if (broken && endX - x > 90) {
      //  interrupt the final run: ...— o   o —...
      const gapStart = Math.round(x + (endX - x) * 0.45);
      const gapEnd = gapStart + 26;
      parts.push(`L ${gapStart} ${y}`);
      parts.push(`M ${gapEnd} ${y}`);
      parts.push(`L ${endX} ${y}`);
      breakPads.push({ x: gapStart, y }, { x: gapEnd, y });
    } else {
      parts.push(`L ${endX} ${y}`);
    }

    traces.push({
      d: parts.join(" "),
      pads: [{ x: endX, y }],
      breakPads,
      broken,
    });
  }
  return traces;
}

function CircuitTraces({ seed = 404 }: { seed?: number }) {
  const traces = buildTraces(seed);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      fill="none"
      className="mx-auto h-auto w-full max-w-2xl"
    >
      {traces.map((t, i) => {
        const stroke = t.broken
          ? "rgba(255, 55, 95, 0.45)"
          : "rgba(41, 151, 255, 0.22)";
        return (
          <g key={i}>
            <path
              d={t.d}
              stroke={stroke}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {t.pads.map((p, j) => (
              <circle
                key={`pad-${j}`}
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill="#000000"
                stroke={stroke}
                strokeWidth={1.5}
              />
            ))}
            {t.breakPads.map((p, j) => (
              <circle
                key={`break-${j}`}
                cx={p.x}
                cy={p.y}
                r={2.5}
                fill="#000000"
                stroke={stroke}
                strokeWidth={1.5}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export default function NotFound() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      {/* Ambient glow, matching the hero */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: "var(--gradient-hero-glow)" }}
      />

      <div className="relative flex w-full flex-col items-center">
        <p className="text-eyebrow uppercase text-ink-dim">Error 404</p>
        <h1 className="gradient-text mt-6 text-display">404</h1>
        <p className="mt-4 text-lead text-ink-mid">No signal on this trace.</p>

        <div className="mt-14 w-full" aria-hidden>
          <CircuitTraces />
        </div>

        <Link
          href="/"
          className="mt-14 rounded-pill bg-azure px-7 py-3 text-[15px] font-medium text-white transition-all duration-300 hover:brightness-110 active:scale-[0.98]"
        >
          Back to the site
        </Link>
      </div>
    </main>
  );
}
