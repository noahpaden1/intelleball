"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { dur, ease } from "@/lib/motion";
import { formatClock, type ThrowRecord } from "@/lib/demoData";

/* ═══════════════════════════════════════════════════════════════════════
   Spin per throw — one series, so no legend (the title names it); a 2px
   azure line with 8px markers ringed in the surface colour, recessive
   gridlines, four y ticks, and a crosshair + tooltip on hover. Rendered at
   real pixel size (ResizeObserver) so type never scales with the viewBox.
   The throw table beneath it is the accessible table view.
═══════════════════════════════════════════════════════════════════════ */

const HEIGHT = 240;
const PAD = { top: 18, right: 18, bottom: 34, left: 46 };
const TICKS = 4;

interface SessionChartProps {
  throws: ThrowRecord[];
}

function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** Nice step for `n` ticks across [lo, hi]. */
function niceTicks(lo: number, hi: number, n: number): number[] {
  const raw = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 0.5; v += step) ticks.push(v);
  return ticks;
}

export function SessionChart({ throws }: SessionChartProps) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    const spins = throws.map((t) => t.spinRpm);
    const lo = Math.min(...spins);
    const hi = Math.max(...spins);
    const padY = Math.max(10, (hi - lo) * 0.25);
    const ticks = niceTicks(lo - padY, hi + padY, TICKS);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const innerW = Math.max(0, width - PAD.left - PAD.right);
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) =>
      PAD.left + (throws.length > 1 ? (i / (throws.length - 1)) * innerW : innerW / 2);
    const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
    const points = throws.map((t, i) => ({ x: x(i), y: y(t.spinRpm), t }));
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    // Label every k-th x so labels never collide (~72px apiece).
    const every = Math.max(1, Math.ceil(72 / Math.max(1, innerW / Math.max(1, throws.length - 1))));
    return { ticks, y, points, path, innerW, innerH, every };
  }, [throws, width]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    geom.points.forEach((p, i) => {
      const d = Math.abs(p.x - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const active = hover !== null ? geom.points[hover] : null;
  const summary = `Spin rate per kick, ${throws.length} kicks, from ${Math.min(
    ...throws.map((t) => t.spinRpm)
  )} to ${Math.max(...throws.map((t) => t.spinRpm))} rpm.`;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 ? (
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={summary}
          className="block overflow-visible"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* Recessive grid + y ticks */}
          {geom.ticks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={geom.y(v)}
                y2={geom.y(v)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={geom.y(v) + 4}
                textAnchor="end"
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--color-ink-dim)"
              >
                {v}
              </text>
            </g>
          ))}
          <text
            x={PAD.left - 10}
            y={PAD.top - 6}
            textAnchor="end"
            fontSize={10}
            fill="var(--color-ink-dim)"
          >
            rpm
          </text>

          {/* x labels — clock time, thinned to avoid collisions */}
          {geom.points.map((p, i) =>
            i % geom.every === 0 || i === geom.points.length - 1 ? (
              <text
                key={p.t.id}
                x={p.x}
                y={HEIGHT - PAD.bottom + 20}
                textAnchor={i === 0 ? "start" : i === geom.points.length - 1 ? "end" : "middle"}
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--color-ink-dim)"
              >
                {formatClock(p.t.at)}
              </text>
            ) : null
          )}

          {/* Crosshair */}
          {active ? (
            <line
              x1={active.x}
              x2={active.x}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="var(--color-ink-dim)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ) : null}

          {/* Series: line draws in once, markers ringed in the surface colour */}
          <motion.path
            d={geom.path}
            fill="none"
            stroke="var(--color-azure)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: dur.slow, ease: ease.glide }}
          />
          {geom.points.map((p, i) => (
            <circle
              key={p.t.id}
              cx={p.x}
              cy={p.y}
              r={hover === i ? 5.5 : 4}
              fill="var(--color-azure)"
              stroke="var(--color-surface)"
              strokeWidth={2}
              className="transition-[r] duration-200"
            />
          ))}
        </svg>
      ) : (
        <div style={{ height: HEIGHT }} />
      )}

      {/* Tooltip — HTML so it can use the text tokens; anchored to the point */}
      {active ? (
        <div
          role="status"
          className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 rounded-panel border border-line bg-raised/95 px-3 py-2 text-caption shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
          style={{
            left: Math.min(Math.max(active.x, 90), Math.max(90, width - 90)),
            top: Math.max(0, active.y - 92),
          }}
        >
          <p className="font-mono text-ink-dim">
            Kick {active.t.id} · {formatClock(active.t.at)}
          </p>
          <p className="mt-1 flex items-baseline justify-between text-ink">
            <span>Spin</span>
            <span className="font-mono tabular-nums">{active.t.spinRpm} rpm</span>
          </p>
          <p className="flex items-baseline justify-between text-ink-mid">
            <span>Ball speed</span>
            <span className="font-mono tabular-nums">{active.t.releaseMps.toFixed(1)} m/s</span>
          </p>
          <p className="flex items-baseline justify-between text-ink-mid">
            <span>Angle</span>
            <span className="font-mono tabular-nums">{active.t.angleDeg.toFixed(1)}°</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
