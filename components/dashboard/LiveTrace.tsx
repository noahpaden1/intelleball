"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { live } from "@/content/live";

/* ═══════════════════════════════════════════════════════════════════════
   |a| sparkline — the real acceleration-magnitude history from the ball's
   feed (lib/useSensorFeed), one row per point. Nothing is fabricated: the
   path is derived from the `samples` prop and re-renders only when a new
   row arrives (~2 Hz at most), so there is no animation loop at all.
   One series, so no legend; a 2px azure line, recessive gridlines, a
   nice-stepped y axis (three or four gridlines, the top one always above
   the padded peak) with the unit, and a crosshair + tooltip on hover. Rendered at
   real pixel size (ResizeObserver) so type never scales with the viewBox.
   An empty history draws the same frame with a placeholder range, so the
   panel never jumps when the first row lands.
═══════════════════════════════════════════════════════════════════════ */

const HEIGHT = 120;
const PAD = { top: 26, right: 10, bottom: 8, left: 40 };
/** Target number of y intervals; the nice step rounds it to 2–3. */
const TICKS = 3;
/** Y range drawn while there is nothing to plot. */
const EMPTY_DOMAIN: [number, number] = [0, 1];

export interface TracePointMeta {
  id: number;
  /** Unix ms */
  at: number;
}

interface LiveTraceProps {
  /** |a| per row, oldest → newest. */
  samples: number[];
  /** Row id + time per sample (same order), for the tooltip. Optional. */
  meta?: TracePointMeta[];
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

/**
 * Ticks on a nice step (1/2/5 × 10ⁿ, rounded UP so at most `n` intervals)
 * from `lo` to the first tick at or above `hi` — the domain always
 * contains the data, so nothing ever plots above the top gridline.
 */
function niceTicks(lo: number, hi: number, n: number): number[] {
  const raw = Math.max((hi - lo) / n, 1e-9);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  // Multiply rather than accumulate so the top tick is exact, not 0.30000000000000004.
  for (let i = 0; ; i++) {
    const v = start + i * step;
    ticks.push(v);
    if (v >= hi - step * 1e-9) break;
  }
  return ticks;
}

/** Tick label with only as many decimals as the step needs. */
function formatTick(v: number, step: number): string {
  const decimals = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
  return v.toFixed(decimals);
}

function formatStamp(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

export function LiveTrace({ samples, meta }: LiveTraceProps) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    const n = samples.length;
    const hi = n > 0 ? Math.max(...samples) : EMPTY_DOMAIN[1];
    // Magnitudes are never negative, so the floor is always zero; pad the
    // top by 15 % and let the top tick round that up, so the peak never
    // kisses the frame and always has a gridline above it.
    const ticks = niceTicks(EMPTY_DOMAIN[0], Math.max(hi, EMPTY_DOMAIN[1] * 0.1) * 1.15, TICKS);
    const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const innerW = Math.max(0, width - PAD.left - PAD.right);
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
    const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
    const points = samples.map((v, i) => ({ x: x(i), y: y(v), v }));
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    return { ticks, step, y, points, path };
  }, [samples, width]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (geom.points.length === 0) return;
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

  // A stale hover index after the history shifts is harmless: it still
  // points at a real, if different, sample.
  const active = hover !== null && hover < geom.points.length ? geom.points[hover] : null;
  const activeMeta = hover !== null && meta ? meta[hover] : undefined;
  const last = geom.points.length > 0 ? geom.points[geom.points.length - 1] : null;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 ? (
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          aria-hidden="true"
          focusable="false"
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
                x={PAD.left - 8}
                y={geom.y(v) + 4}
                textAnchor="end"
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--color-ink-dim)"
              >
                {formatTick(v, geom.step)}
              </text>
            </g>
          ))}
          <text
            x={PAD.left - 8}
            y={PAD.top - 11}
            textAnchor="end"
            fontSize={11}
            fontFamily="var(--font-mono)"
            fill="var(--color-ink-dim)"
          >
            {live.sparkline.unit}
          </text>

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

          {/* Series — the newest sample carries a marker ringed in the surface colour */}
          {geom.path ? (
            <path
              d={geom.path}
              fill="none"
              stroke="var(--color-azure)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {last ? (
            <circle
              cx={last.x}
              cy={last.y}
              r={4}
              fill="var(--color-azure)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ) : null}
          {active && active !== last ? (
            <circle
              cx={active.x}
              cy={active.y}
              r={4}
              fill="var(--color-azure)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ) : null}
        </svg>
      ) : (
        <div style={{ height: HEIGHT }} />
      )}

      {/* Tooltip — HTML so it can use the text tokens; anchored to the point.
          Hidden from assistive tech (the sr-only summary in the panel covers
          the data) so pointer moves never spam a live region. */}
      {active ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 w-40 -translate-x-1/2 rounded-panel border border-line bg-raised/95 px-3 py-2 text-caption shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
          style={{
            left: Math.min(Math.max(active.x, 80), Math.max(80, width - 80)),
            top: Math.max(0, active.y - 64),
          }}
        >
          {activeMeta ? (
            <p className="font-mono text-ink-dim">
              {live.sparkline.tooltipRow}
              {activeMeta.id} · {formatStamp(activeMeta.at)}
            </p>
          ) : null}
          <p className="mt-1 flex items-baseline justify-between text-ink">
            <span>{live.magnitudes.accel.symbol}</span>
            <span className="font-mono tabular-nums">
              {active.v.toFixed(2)} {live.sparkline.unit}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
