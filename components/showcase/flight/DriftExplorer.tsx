"use client";

/**
 * THE DRIFT EXPLORER — "The drift problem"
 *
 * One 6 s recording with a single 1.2 s throw in it, integrated two ways
 * from the same simulated accelerometer: naively from t = 0 (rose), and
 * through the Intelleball pipeline of stillness detection, per-throw
 * windows and post-hoc velocity correction (azure). The chart plots each
 * pipeline's position error against the true motion. Rose/azure is the
 * CVD-safe pair on the dark surface; mint is reserved for the stillness
 * markers, the state the pipeline trusts.
 *
 * The bias slider recomputes both curves synchronously — 601 samples of
 * plain React state, cheap. Lines draw in once on first view via
 * pathLength; reduced motion renders them complete. A pointer crosshair
 * reads both curves at the hovered time and is driven imperatively
 * (setAttribute / textContent — no React state per pointer move). All
 * math is deterministic from a fixed seed (drift.ts), so the server and
 * the client agree on every pixel.
 */

import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { motion } from "framer-motion";
import { dur, ease, reveal } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { DRIFT_COPY, DRIFT_MODEL, type DriftMode } from "@/content/demos/flight";
import { simulateDrift, THROW_WINDOW } from "./drift";
import {
  extent,
  fixed,
  formatDistance,
  linePath,
  niceScale,
  px,
  tickDecimals,
  type NiceScale,
} from "./chart";
import { RangeSlider } from "./RangeSlider";
import { SegmentedControl } from "./SegmentedControl";

/* ── Chart geometry (viewBox units, module scope, deterministic) ─────── */

const VB_W = 720;
const VB_H = 340;
/** Right pad leaves room for the direct end-labels. */
const PAD = { l: 60, r: 84, t: 40, b: 46 };
const PLOT_W = VB_W - PAD.l - PAD.r;
const PLOT_H = VB_H - PAD.t - PAD.b;
const T_MAX = DRIFT_MODEL.windowS;
const X_TICKS = Array.from({ length: T_MAX + 1 }, (_, i) => i);

const xOf = (t: number) => px(PAD.l + (t / T_MAX) * PLOT_W);

const BAND_X0 = xOf(THROW_WINDOW.startS);
const BAND_X1 = xOf(THROW_WINDOW.endS);
const THROW_SECONDS = fixed(THROW_WINDOW.endS - THROW_WINDOW.startS, 1);

/* ── Y scales — fixed per mode so the slider visibly grows the curve ──── */

/**
 * The naive error is affine in bias (e = e₀ + bias·t²/2), so its extent
 * over the whole slider is spanned by the two ends: zero bias (the noise
 * walk alone) and max bias. The pipeline's error is nearly bias-
 * independent — a constant bias is cancelled exactly — so the same two
 * ends bound it too; a little headroom covers the detector's edge jitter.
 */
const AT_MIN = simulateDrift(DRIFT_MODEL.bias.min);
const AT_MAX = simulateDrift(DRIFT_MODEL.bias.max);
/** Sample x positions — the time base never changes. */
const X_PX = AT_MIN.time.map(xOf);
const HEADROOM = 1.05;
/** Never zoom tighter than ±1 cm, however good the pipeline gets. */
const Y_FLOOR_M = 0.01;

interface YScale {
  /** Display unit: centimetres when everything fits under a metre. */
  cm: boolean;
  scale: NiceScale;
}

function yScaleFor(series: readonly number[]): YScale {
  const { min, max } = extent(series);
  const cm = Math.max(Math.abs(min), Math.abs(max), Y_FLOOR_M) < 1;
  const k = (cm ? 100 : 1) * HEADROOM;
  return {
    cm,
    scale: niceScale(Math.min(0, min * k), Math.max(Y_FLOOR_M * k, max * k), 4),
  };
}

const Y_SCALES: Record<DriftMode, YScale> = {
  naive: yScaleFor([...AT_MIN.naive, ...AT_MAX.naive]),
  pipeline: yScaleFor([...AT_MIN.pipeline, ...AT_MAX.pipeline]),
  both: yScaleFor([...AT_MIN.naive, ...AT_MAX.naive, ...AT_MIN.pipeline, ...AT_MAX.pipeline]),
};

const SERIES_COLOR = {
  naive: "var(--color-rose)",
  pipeline: "var(--color-azure)",
} as const;

/** Minimum vertical gap between the two end-labels, viewBox units. */
const LABEL_GAP = 14;

/** Push two label baselines apart to LABEL_GAP around their midpoint when they collide. */
function spread(a: number, b: number): [number, number] {
  if (Math.abs(a - b) >= LABEL_GAP) return [a, b];
  const mid = (a + b) / 2;
  return a <= b
    ? [mid - LABEL_GAP / 2, mid + LABEL_GAP / 2]
    : [mid + LABEL_GAP / 2, mid - LABEL_GAP / 2];
}

/* ── Marks ─────────────────────────────────────────────────────────────── */

interface TraceProps {
  d: string;
  color: string;
  reduced: boolean;
}

/** One series line: 2px, round joins; draws in once on first view unless motion is reduced. */
function Trace({ d, color, reduced }: TraceProps) {
  const shared = {
    d,
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinejoin: "round",
    strokeLinecap: "round",
  } as const;
  if (reduced) return <path {...shared} />;
  return (
    <motion.path
      {...shared}
      initial={{ pathLength: 0 }}
      whileInView={{ pathLength: 1 }}
      viewport={{ once: true, margin: reveal.viewportMargin }}
      transition={{ duration: dur.slow, ease: ease.glide }}
    />
  );
}

interface EndMarkProps {
  x: number;
  y: number;
  /** Baseline of the direct label — `y` unless it was spread away from a collision. */
  labelY: number;
  color: string;
  text: string;
  reduced: boolean;
}

/**
 * End marker (surface ring) plus the series' direct label in text ink,
 * with a hairline leader when the label had to move off the line's end.
 * Fades in once the line has finished drawing.
 */
function EndMark({ x, y, labelY, color, text, reduced }: EndMarkProps) {
  const content = (
    <>
      {Math.abs(labelY - y) > 1 ? (
        <line
          x1={x + 6}
          y1={y}
          x2={x + 14}
          y2={labelY}
          stroke="var(--color-ink-dim)"
          strokeOpacity={0.6}
          strokeWidth={1}
        />
      ) : null}
      <circle cx={x} cy={y} r={4} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
      <text x={x + 16} y={labelY + 4} fontSize={11} fill="var(--color-ink-mid)">
        {text}
      </text>
    </>
  );
  if (reduced) return <g>{content}</g>;
  return (
    <motion.g
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: reveal.viewportMargin }}
      transition={{ delay: dur.slow, duration: dur.fast, ease: ease.glide }}
    >
      {content}
    </motion.g>
  );
}

/* ── Component ─────────────────────────────────────────────────────────── */

export function DriftExplorer() {
  // Hydration-safe: false on SSR + first client render, real value after mount
  const reduced = usePrefersReducedMotion();
  const [mode, setMode] = useState<DriftMode>(DRIFT_COPY.mode.default);
  const [bias, setBias] = useState<number>(DRIFT_MODEL.bias.default);
  const result = useMemo(() => simulateDrift(bias), [bias]);

  const showNaive = mode !== "pipeline";
  const showPipeline = mode !== "naive";
  const { cm, scale } = Y_SCALES[mode];
  const unit = cm ? 100 : 1;
  const yOf = (metres: number) =>
    px(PAD.t + ((scale.max - metres * unit) / (scale.max - scale.min)) * PLOT_H);
  const decimals = tickDecimals(scale.step);

  const naiveD = linePath(X_PX, result.naive.map(yOf));
  const pipelineD = linePath(X_PX, result.pipeline.map(yOf));
  const last = result.time.length - 1;
  const naiveEnd = result.naive[last];
  const pipelineEnd = result.pipeline[last];
  const naiveEndY = yOf(naiveEnd);
  const pipelineEndY = yOf(pipelineEnd);
  // Direct end-labels: spread apart (with leaders) only when both are on screen and collide.
  const [naiveLabelY, pipelineLabelY] =
    showNaive && showPipeline ? spread(naiveEndY, pipelineEndY) : [naiveEndY, pipelineEndY];

  const rawId = useId();
  const clipId = `flight-drift-clip-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  /* Crosshair — mouse/pen only (touch drags scroll the chart), written straight to the DOM. */
  const hoverRef = useRef<SVGGElement>(null);
  const hoverLineRef = useRef<SVGLineElement>(null);
  const hoverTextRef = useRef<SVGTextElement>(null);
  const hoverNaiveRef = useRef<SVGCircleElement>(null);
  const hoverPipelineRef = useRef<SVGCircleElement>(null);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch") return;
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const vx = ((event.clientX - box.left) / box.width) * VB_W;
    const t = Math.min(Math.max((vx - PAD.l) / PLOT_W, 0), 1) * T_MAX;
    const i = Math.round(t * DRIFT_MODEL.sampleRateHz);
    const x = X_PX[i];
    const right = x > PAD.l + PLOT_W / 2;

    hoverRef.current?.removeAttribute("display");
    hoverLineRef.current?.setAttribute("x1", String(x));
    hoverLineRef.current?.setAttribute("x2", String(x));
    hoverNaiveRef.current?.setAttribute("cx", String(x));
    hoverNaiveRef.current?.setAttribute("cy", String(yOf(result.naive[i])));
    hoverPipelineRef.current?.setAttribute("cx", String(x));
    hoverPipelineRef.current?.setAttribute("cy", String(yOf(result.pipeline[i])));

    const text = hoverTextRef.current;
    if (text) {
      const parts = [`${DRIFT_COPY.hoverTime} ${fixed(result.time[i], 2)} s`];
      if (showNaive) parts.push(`${DRIFT_COPY.series.naive.short} ${formatDistance(result.naive[i])}`);
      if (showPipeline) {
        parts.push(`${DRIFT_COPY.series.pipeline.short} ${formatDistance(result.pipeline[i])}`);
      }
      text.setAttribute("x", String(right ? x - 8 : x + 8));
      text.setAttribute("text-anchor", right ? "end" : "start");
      text.textContent = parts.join(" · ");
    }
  };

  const onPointerLeave = () => hoverRef.current?.setAttribute("display", "none");

  /* ── Render ── */

  return (
    <div>
      {/* Heading */}
      <div>
        <h3 className="text-title text-balance">{DRIFT_COPY.title}</h3>
        <p className="mt-2 max-w-xl text-body text-ink-mid text-pretty">{DRIFT_COPY.description}</p>
      </div>

      {/* Controls — trace picker + bias slider; stacked on phones */}
      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-caption font-medium text-ink">{DRIFT_COPY.mode.label}</p>
          <SegmentedControl
            className="mt-2"
            name="flight-drift-mode"
            label={DRIFT_COPY.mode.label}
            options={DRIFT_COPY.mode.options}
            value={mode}
            onChange={setMode}
          />
        </div>
        <RangeSlider
          className="w-full sm:max-w-xs"
          label={DRIFT_COPY.bias.label}
          unit={DRIFT_COPY.bias.unit}
          min={DRIFT_MODEL.bias.min}
          max={DRIFT_MODEL.bias.max}
          step={DRIFT_MODEL.bias.step}
          value={bias}
          decimals={2}
          onChange={setBias}
        />
      </div>

      {/* Legend — line keys in text ink; only the traces on screen */}
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {showNaive ? (
          <li className="flex items-center gap-2 text-caption text-ink-mid">
            <span aria-hidden className="h-0.5 w-4 rounded-pill bg-rose" />
            {DRIFT_COPY.series.naive.label}
          </li>
        ) : null}
        {showPipeline ? (
          <li className="flex items-center gap-2 text-caption text-ink-mid">
            <span aria-hidden className="h-0.5 w-4 rounded-pill bg-azure" />
            {DRIFT_COPY.series.pipeline.label}
          </li>
        ) : null}
      </ul>

      {/* Chart — pure vector, crisp at any resolution.
          Horizontal scroll on narrow phones keeps the annotations legible. */}
      <div className="-mx-2 mt-4 overflow-x-auto px-2">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full min-w-[540px]"
          aria-hidden="true"
          focusable="false"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.l} y={PAD.t} width={PLOT_W} height={PLOT_H} />
            </clipPath>
          </defs>

          {/* Throw window — violet wash with hairline edges, labelled inside */}
          <rect
            x={BAND_X0}
            y={PAD.t}
            width={BAND_X1 - BAND_X0}
            height={PLOT_H}
            fill="rgba(191, 90, 242, 0.10)"
          />
          {[BAND_X0, BAND_X1].map((x) => (
            <line
              key={x}
              x1={x}
              x2={x}
              y1={PAD.t}
              y2={PAD.t + PLOT_H}
              stroke="rgba(191, 90, 242, 0.45)"
              strokeWidth={1}
            />
          ))}
          <text
            x={(BAND_X0 + BAND_X1) / 2}
            y={PAD.t + 18}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-ink-mid)"
            style={{ letterSpacing: "0.06em" }}
          >
            {DRIFT_COPY.throwBand(THROW_SECONDS)}
          </text>
          {/* Stillness markers — mint, the site's "trusted state" colour */}
          {[THROW_WINDOW.startS / 2, (THROW_WINDOW.endS + T_MAX) / 2].map((t) => (
            <text
              key={t}
              x={xOf(t)}
              y={PAD.t + PLOT_H - 10}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-mint)"
              fillOpacity={0.85}
              style={{ letterSpacing: "0.06em" }}
            >
              {DRIFT_COPY.stillLabel}
            </text>
          ))}

          {/* Gridlines + y ticks — hairlines, the zero line a shade stronger */}
          {scale.ticks.map((v) => {
            const y = px(PAD.t + ((scale.max - v) / (scale.max - scale.min)) * PLOT_H);
            const zero = Math.abs(v) < scale.step / 1e6;
            return (
              <g key={v}>
                <line
                  x1={PAD.l}
                  x2={PAD.l + PLOT_W}
                  y1={y}
                  y2={y}
                  stroke={zero ? "var(--color-ink-dim)" : "var(--color-line)"}
                  strokeOpacity={zero ? 0.5 : 1}
                  strokeWidth={1}
                />
                <text
                  x={PAD.l - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--color-ink-dim)"
                  className="tabular-nums"
                >
                  {fixed(v, decimals)}
                </text>
              </g>
            );
          })}

          {/* x ticks */}
          {X_TICKS.map((t) => (
            <g key={t}>
              <line
                x1={xOf(t)}
                x2={xOf(t)}
                y1={PAD.t + PLOT_H}
                y2={PAD.t + PLOT_H + 5}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={xOf(t)}
                y={PAD.t + PLOT_H + 20}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-ink-dim)"
                className="tabular-nums"
              >
                {t}
              </text>
            </g>
          ))}

          {/* Axis titles */}
          <text
            x={PAD.l + PLOT_W / 2}
            y={VB_H - 8}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-ink-dim)"
            style={{ letterSpacing: "0.08em" }}
          >
            {DRIFT_COPY.axes.x}
          </text>
          <text
            transform={`translate(16 ${PAD.t + PLOT_H / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-ink-dim)"
            style={{ letterSpacing: "0.08em" }}
          >
            {DRIFT_COPY.axes.y(cm ? "cm" : "m")}
          </text>

          {/* Traces, clipped to the plot */}
          <g clipPath={`url(#${clipId})`}>
            {showNaive ? (
              <Trace key="naive" d={naiveD} color={SERIES_COLOR.naive} reduced={reduced} />
            ) : null}
            {showPipeline ? (
              <Trace key="pipeline" d={pipelineD} color={SERIES_COLOR.pipeline} reduced={reduced} />
            ) : null}
          </g>

          {/* End markers + direct labels — the readouts below carry the values */}
          {showNaive ? (
            <EndMark
              key="naive-end"
              x={X_PX[last]}
              y={naiveEndY}
              labelY={naiveLabelY}
              color={SERIES_COLOR.naive}
              text={DRIFT_COPY.series.naive.short}
              reduced={reduced}
            />
          ) : null}
          {showPipeline ? (
            <EndMark
              key="pipeline-end"
              x={X_PX[last]}
              y={pipelineEndY}
              labelY={pipelineLabelY}
              color={SERIES_COLOR.pipeline}
              text={DRIFT_COPY.series.pipeline.short}
              reduced={reduced}
            />
          ) : null}

          {/* Crosshair — hidden until the pointer moves over the chart */}
          <g ref={hoverRef} display="none">
            <line
              ref={hoverLineRef}
              y1={PAD.t}
              y2={PAD.t + PLOT_H}
              stroke="var(--color-ink-dim)"
              strokeOpacity={0.6}
              strokeWidth={1}
            />
            {showNaive ? (
              <circle
                ref={hoverNaiveRef}
                r={4}
                fill={SERIES_COLOR.naive}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            ) : null}
            {showPipeline ? (
              <circle
                ref={hoverPipelineRef}
                r={4}
                fill={SERIES_COLOR.pipeline}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            ) : null}
            <text
              ref={hoverTextRef}
              y={PAD.t - 14}
              fontSize={11}
              fill="var(--color-ink-mid)"
              className="font-mono tabular-nums"
            />
          </g>
        </svg>
      </div>

      {/* Outcome for screen readers — the chart carries no extra meaning */}
      <p className="sr-only">
        {DRIFT_COPY.summary(fixed(bias, 2), formatDistance(naiveEnd), formatDistance(pipelineEnd))}
      </p>

      {/* Readouts — error at the end of the recording, one per pipeline */}
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="flex items-center gap-2 text-caption text-ink-dim">
            <span aria-hidden className="h-0.5 w-4 rounded-pill bg-rose" />
            {DRIFT_COPY.series.naive.label} · {DRIFT_COPY.readout(String(T_MAX))}
          </dt>
          <dd className="mt-1 font-mono text-title tabular-nums tracking-tight text-rose">
            {formatDistance(naiveEnd)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-caption text-ink-dim">
            <span aria-hidden className="h-0.5 w-4 rounded-pill bg-azure" />
            {DRIFT_COPY.series.pipeline.label} · {DRIFT_COPY.readout(String(T_MAX))}
          </dt>
          <dd className="mt-1 font-mono text-title tabular-nums tracking-tight text-azure">
            {formatDistance(pipelineEnd)}
          </dd>
        </div>
      </dl>

      {/* Why the pipeline wins */}
      <p className="mt-6 max-w-3xl border-t border-line pt-5 text-caption text-ink-dim text-pretty">
        {DRIFT_COPY.why}
      </p>
    </div>
  );
}
