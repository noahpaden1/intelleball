"use client";

/**
 * STRIP CHART — a rolling window of one channel of the stream.
 *
 * Oscilloscope roll mode: the newest sample sits at the right edge and the
 * trace scrolls left as simulated time advances, so the time axis is
 * static ("−1.5 s … now") and only the path changes. Each frame, the
 * visible slice of the precomputed sample array is written to one
 * MotionValue<string> bound to a motion.path `d`; every sample's y pixel
 * is precomputed once (toStripSeries), so a frame costs ~150 short string
 * concatenations per chart and no allocation beyond the string itself.
 *
 * One series per chart, so no legend — the title names the channel. Marks
 * follow the dataviz specs: 2 px round-joined line, ≥ 8 px end-marker with
 * a 2 px surface ring, hairline solid gridlines, clean tick values, and a
 * single direct label on the trace's extreme (the impact spike).
 */

import { motion, useTransform, type MotionValue } from "framer-motion";
import { REPLAY, type StripChartSpec } from "@/content/demos/telemetry";

/* ── Chart geometry (viewBox px) ───────────────────────────────────────── */

const VB_W = 300;
const VB_H = 132;
const PLOT_X = 36; //  gutter for the y-axis labels
const PLOT_W = 250; //  right edge at 286 leaves room for the end-marker's ring
const PLOT_Y = 10;
const PLOT_H = 84;
const RIGHT = PLOT_X + PLOT_W;
const BASE = PLOT_Y + PLOT_H;
const AXIS_Y = BASE + 22;

const WINDOW = REPLAY.windowSec;

/** Time-axis ticks in seconds before "now": −W, −2W/3, −W/3, 0. */
const TIME_TICKS = Array.from({ length: 4 }, (_, i) => -WINDOW + (i * WINDOW) / 3);

/** Simulated seconds the spike label takes to fade in, and to fade out before it scrolls off. */
const PEAK_FADE = 0.05;
const PEAK_EXIT = 0.3;

/* ── Series precomputation ─────────────────────────────────────────────── */

export interface StripSeries {
  /** Sample period, s */
  dt: number;
  /** Y pixel of every sample, clamped to the chart's domain, rounded to 0.1 */
  yPx: number[];
  /** Direct label on the trace's extreme, when the spec asks for one */
  peak?: { index: number; label: string };
}

/** Precompute a channel's pixel geometry once — call at module scope. */
export function toStripSeries(values: number[], dt: number, spec: StripChartSpec): StripSeries {
  const [lo, hi] = spec.domain;
  const yPx = values.map((v) => {
    const clamped = Math.min(Math.max(v, lo), hi);
    return Math.round((BASE - ((clamped - lo) / (hi - lo)) * PLOT_H) * 10) / 10;
  });

  let peak: StripSeries["peak"];
  if (spec.peakDecimals !== undefined) {
    let index = 0;
    for (let i = 1; i < values.length; i++) if (values[i] > values[index]) index = i;
    peak = { index, label: `${values[index].toFixed(spec.peakDecimals)} ${spec.unit}` };
  }

  return { dt, yPx, peak };
}

/** Path through the samples inside the window that ends at simulated time t. */
function windowPath(series: StripSeries, t: number): string {
  const { dt, yPx } = series;
  const tStart = t - WINDOW;
  const first = Math.max(0, Math.ceil(tStart / dt - 1e-9));
  const last = Math.min(yPx.length - 1, Math.floor(t / dt + 1e-9));
  if (last < first) return "";
  let d = "";
  for (let i = first; i <= last; i++) {
    const x = PLOT_X + ((i * dt - tStart) / WINDOW) * PLOT_W;
    d += `${i === first ? "M" : "L"}${x.toFixed(1)} ${yPx[i]} `;
  }
  return d;
}

/** Y pixel at simulated time t, interpolated between samples. */
function yAt(series: StripSeries, t: number): number {
  const { dt, yPx } = series;
  const end = yPx.length - 1;
  const k = Math.min(Math.max(t / dt, 0), end);
  const i = Math.floor(k);
  const f = k - i;
  const a = yPx[i];
  const y = f === 0 ? a : a + (yPx[Math.min(i + 1, end)] - a) * f;
  return Math.round(y * 10) / 10;
}

/* ── Component ─────────────────────────────────────────────────────────── */

interface StripChartProps {
  /** Simulated seconds — the single source of truth, owned by ThrowReplay */
  elapsed: MotionValue<number>;
  spec: StripChartSpec;
  series: StripSeries;
}

export function StripChart({ elapsed, spec, series }: StripChartProps) {
  const [lo, hi] = spec.domain;
  const yOf = (v: number) => BASE - ((v - lo) / (hi - lo)) * PLOT_H;

  /* ── Derived visuals (no per-frame setState anywhere) ── */

  const d = useTransform(elapsed, (t) => windowPath(series, t));
  const endY = useTransform(elapsed, (t) => yAt(series, t));

  // The spike label rides its sample: in from the right, out before it
  // reaches the axis gutter. Hooks run unconditionally; the peak may not exist.
  const peakT = series.peak ? series.peak.index * series.dt : 0;
  const peakX = useTransform(
    elapsed,
    (t) => Math.round((PLOT_X + ((peakT - (t - WINDOW)) / WINDOW) * PLOT_W) * 10) / 10
  );
  const peakOpacity = useTransform(
    elapsed,
    [peakT, peakT + PEAK_FADE, peakT + WINDOW - PEAK_EXIT, peakT + WINDOW - PEAK_EXIT / 2],
    [0, 1, 1, 0]
  );

  /* ── Render ── */

  return (
    <div>
      <p className="flex items-baseline justify-between gap-3 text-caption">
        <span className="text-ink-mid">
          <span className="font-mono text-ink">{spec.symbol}</span>
          {` ${spec.label}`}
        </span>
        <span className="font-mono text-ink-dim">{spec.unit}</span>
      </p>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="mt-2 h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        {/* Plot surface + recessive hairline grid at the clean tick values */}
        <rect x={PLOT_X} y={PLOT_Y} width={PLOT_W} height={PLOT_H} rx={4} fill="var(--color-raised)" />
        {spec.ticks.map((v) => (
          <g key={`y-${v}`}>
            <line x1={PLOT_X} x2={RIGHT} y1={yOf(v)} y2={yOf(v)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PLOT_X - 8} y={yOf(v) + 4} textAnchor="end" fontSize={12} fill="var(--color-ink-dim)">
              {v}
            </text>
          </g>
        ))}

        {/* Time axis: seconds before the right edge, which is always "now" */}
        {TIME_TICKS.map((s, i) => {
          const x = RIGHT + (s / WINDOW) * PLOT_W;
          const isLast = i === TIME_TICKS.length - 1;
          const label = isLast
            ? REPLAY.nowLabel
            : `${s.toFixed(1).replace("-", "−")}${i === 0 ? " s" : ""}`;
          return (
            <g key={`t-${i}`}>
              <line x1={x} x2={x} y1={BASE} y2={BASE + 5} stroke="var(--color-line)" strokeWidth={1} />
              <text
                x={x}
                y={AXIS_Y}
                textAnchor={i === 0 ? "start" : isLast ? "end" : "middle"}
                fontSize={12}
                fill="var(--color-ink-dim)"
              >
                {label}
              </text>
            </g>
          );
        })}
        <line x1={RIGHT} x2={RIGHT} y1={PLOT_Y} y2={BASE} stroke="var(--color-line)" strokeWidth={1} />

        {/* The trace — the visible slice of the recording, rebuilt per frame */}
        <motion.path
          d={d}
          fill="none"
          stroke="var(--color-azure)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Direct label on the extreme (impact spike): rose event marker, ink text */}
        {series.peak ? (
          <motion.g style={{ x: peakX, opacity: peakOpacity }}>
            <circle
              cy={series.yPx[series.peak.index]}
              r={3.5}
              fill="var(--color-rose)"
              stroke="var(--color-raised)"
              strokeWidth={2}
            />
            <text
              x={-8}
              y={series.yPx[series.peak.index] + 4}
              textAnchor="end"
              fontSize={12}
              fontWeight={500}
              fill="var(--color-ink)"
            >
              {series.peak.label}
            </text>
          </motion.g>
        ) : null}

        {/* End-marker at "now", ringed in the surface colour */}
        <motion.circle
          cx={RIGHT}
          cy={endY}
          r={4}
          fill="var(--color-azure)"
          stroke="var(--color-raised)"
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}
