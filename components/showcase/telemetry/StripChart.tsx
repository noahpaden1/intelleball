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
 * Once the replay has ended (or from the start under reduced motion) the
 * `full` MotionValue flips to 1 and the chart shows the whole recording
 * compressed to the plot width instead — the rolling window is shorter
 * than the gap between the kick and the bounce, so the end state would
 * otherwise show only the roll-out. The time axis relabels itself from
 * "−1.5 s … now" to "0.0 s … end" through MotionValue<string> children,
 * so the switch, like everything else here, never sets React state.
 *
 * One series per chart, so no legend — the title names the channel. Marks
 * follow the dataviz specs: 2 px round-joined line, ≥ 8 px end-marker with
 * a 2 px surface ring, hairline solid gridlines, clean tick values, and a
 * single direct label on the trace's extreme (the kick's clipped spike).
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

/** Time-axis ticks, evenly spaced across the plot in both views. */
const TICK_COUNT = 4;
const TICK_X = Array.from(
  { length: TICK_COUNT },
  (_, i) => PLOT_X + (i / (TICK_COUNT - 1)) * PLOT_W
);
/** Rolling-view tick labels, seconds before "now": −W, −2W/3, −W/3, now. */
const ROLL_LABELS = Array.from({ length: TICK_COUNT }, (_, i) => {
  if (i === TICK_COUNT - 1) return REPLAY.nowLabel;
  const s = -WINDOW + (i * WINDOW) / (TICK_COUNT - 1);
  return `${s.toFixed(1).replace("-", "−")}${i === 0 ? " s" : ""}`;
});

/** Simulated seconds the spike label takes to fade in, and to fade out. */
const PEAK_FADE = 0.05;
/** Gap between the spike marker and its label, and the advance of one 12 px glyph (viewBox px). */
const LABEL_GAP = 8;
const LABEL_CHAR_PX = 6.5;

/* ── Series precomputation ─────────────────────────────────────────────── */

export interface StripSeries {
  /** Sample period, s */
  dt: number;
  /** Y pixel of every sample, clamped to the chart's domain, rounded to 0.1 */
  yPx: number[];
  /** Length of the recording, s (time of the last sample) */
  totalSec: number;
  /** The whole recording compressed to the plot width — the end-state path */
  fullPath: string;
  /** Direct label on the trace's extreme, when the spec asks for one */
  peak?: {
    index: number;
    label: string;
    /** Simulated seconds before the sample scrolls off at which the label would cross the axis gutter */
    exitSec: number;
  };
}

/** X pixel of sample i when the whole recording spans the plot. */
function fullX(i: number, dt: number, totalSec: number): number {
  return Math.round((PLOT_X + ((i * dt) / totalSec) * PLOT_W) * 10) / 10;
}

/** Precompute a channel's pixel geometry once — call at module scope. */
export function toStripSeries(values: number[], dt: number, spec: StripChartSpec): StripSeries {
  const [lo, hi] = spec.domain;
  const yPx = values.map((v) => {
    const clamped = Math.min(Math.max(v, lo), hi);
    return Math.round((BASE - ((clamped - lo) / (hi - lo)) * PLOT_H) * 10) / 10;
  });
  const totalSec = (values.length - 1) * dt;
  let fullPath = "";
  for (let i = 0; i < yPx.length; i++) {
    fullPath += `${i === 0 ? "M" : "L"}${fullX(i, dt, totalSec).toFixed(1)} ${yPx[i]} `;
  }

  // The first sample at the maximum: on a flat-topped (clipped) spike that
  // is the leading edge, which is where the label reads best. The label
  // rides to the left of its marker, so it must fade before its far end
  // reaches the axis gutter — that moment depends on how long it is.
  let peak: StripSeries["peak"];
  if (spec.peakDecimals !== undefined) {
    let index = 0;
    for (let i = 1; i < values.length; i++) if (values[i] > values[index]) index = i;
    const clipped = spec.peakClippedNote !== undefined && values[index] >= hi;
    const label = `${values[index].toFixed(spec.peakDecimals)} ${spec.unit}${clipped ? ` · ${spec.peakClippedNote}` : ""}`;
    const widthPx = LABEL_GAP + label.length * LABEL_CHAR_PX;
    peak = { index, label, exitSec: (widthPx / PLOT_W) * WINDOW };
  }

  return { dt, yPx, totalSec, fullPath, peak };
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

/* ── Time-axis tick ────────────────────────────────────────────────────── */

interface TimeTickProps {
  full: MotionValue<number>;
  index: number;
  /** Length of the recording, s — the full view's axis runs 0 … this */
  totalSec: number;
}

/** One tick: fixed position, label swapped between the rolling and full views. */
function TimeTick({ full, index, totalSec }: TimeTickProps) {
  const x = TICK_X[index];
  const isFirst = index === 0;
  const isLast = index === TICK_COUNT - 1;
  const fullLabel = `${((index / (TICK_COUNT - 1)) * totalSec).toFixed(1)}${isFirst || isLast ? " s" : ""}`;
  const label = useTransform(full, (f) => (f ? fullLabel : ROLL_LABELS[index]));
  return (
    <g>
      <line x1={x} x2={x} y1={BASE} y2={BASE + 5} stroke="var(--color-line)" strokeWidth={1} />
      <motion.text
        x={x}
        y={AXIS_Y}
        textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
        fontSize={12}
        fill="var(--color-ink-dim)"
      >
        {label}
      </motion.text>
    </g>
  );
}

/* ── Component ─────────────────────────────────────────────────────────── */

interface StripChartProps {
  /** Simulated seconds — the single source of truth, owned by KickReplay */
  elapsed: MotionValue<number>;
  /** 0 while the replay runs (rolling window), 1 once it has ended (whole recording) */
  full: MotionValue<number>;
  spec: StripChartSpec;
  series: StripSeries;
}

export function StripChart({ elapsed, full, spec, series }: StripChartProps) {
  const [lo, hi] = spec.domain;
  const yOf = (v: number) => BASE - ((v - lo) / (hi - lo)) * PLOT_H;

  /* ── Derived visuals (no per-frame setState anywhere) ── */

  const d = useTransform([elapsed, full], ([t, f]: number[]) =>
    f ? series.fullPath : windowPath(series, t)
  );
  const endY = useTransform(elapsed, (t) => yAt(series, t));

  // The spike label rides its sample: in from the right, out before its far
  // end reaches the axis gutter. In the full view the marker sits near the
  // left edge with no room beside it, so the label moves to the right end
  // of the ceiling line it names. Hooks run unconditionally; the peak may
  // not exist.
  const peakT = series.peak ? series.peak.index * series.dt : 0;
  const peakExit = series.peak ? series.peak.exitSec : 0;
  const peakFullX = series.peak ? fullX(series.peak.index, series.dt, series.totalSec) : 0;
  const peakX = useTransform([elapsed, full], ([t, f]: number[]) =>
    f ? peakFullX : Math.round((PLOT_X + ((peakT - (t - WINDOW)) / WINDOW) * PLOT_W) * 10) / 10
  );
  const rollingOpacity = useTransform(
    elapsed,
    [peakT, peakT + PEAK_FADE, peakT + WINDOW - peakExit - PEAK_FADE, peakT + WINDOW - peakExit],
    [0, 1, 1, 0]
  );
  const rideOpacity = useTransform([rollingOpacity, full], ([o, f]: number[]) => (f ? 0 : o));
  const markerOpacity = useTransform([rollingOpacity, full], ([o, f]: number[]) => (f ? 1 : o));

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

        {/* Time axis: seconds before the right edge (always "now") while rolling, 0 … end in the full view */}
        {TICK_X.map((_, i) => (
          <TimeTick key={`t-${i}`} full={full} index={i} totalSec={series.totalSec} />
        ))}
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

        {/* Direct label on the extreme (the clipped kick spike): rose event marker, ink text */}
        {series.peak ? (
          <>
            <motion.circle
              cy={series.yPx[series.peak.index]}
              r={3.5}
              fill="var(--color-rose)"
              stroke="var(--color-raised)"
              strokeWidth={2}
              style={{ x: peakX, opacity: markerOpacity }}
            />
            <motion.text
              x={-LABEL_GAP}
              y={series.yPx[series.peak.index] + 4}
              textAnchor="end"
              fontSize={12}
              fontWeight={500}
              fill="var(--color-ink)"
              style={{ x: peakX, opacity: rideOpacity }}
            >
              {series.peak.label}
            </motion.text>
            <motion.text
              x={RIGHT - 6}
              y={series.yPx[series.peak.index] + 4}
              textAnchor="end"
              fontSize={12}
              fontWeight={500}
              fill="var(--color-ink)"
              style={{ opacity: full }}
            >
              {series.peak.label}
            </motion.text>
          </>
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
