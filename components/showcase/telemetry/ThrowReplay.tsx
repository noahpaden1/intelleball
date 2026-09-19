"use client";

/**
 * THROW REPLAY — one simulated throw, sample by sample.
 *
 * A side-view stage (vector SVG, crisp at any DPI) flies the ball along
 * its projectile arc while three strip charts scroll the raw stream the
 * IMU would produce — |a|, ω and height — at the sensor's real 100 Hz
 * sample rate, replayed at half speed. A hand-rolled rAF loop drives a
 * single MotionValue of simulated seconds; every visual — ball position,
 * seam rotation, flown arc, traces, readouts, phase chips — derives from
 * it via useTransform, so there is zero per-frame React state. The loop
 * pauses when the stage is offscreen or the tab is hidden, and
 * reduced-motion users get the completed end state: ball at rest, impact
 * spike on the chart, stillness gate re-engaged.
 *
 * The recording is computed once at module scope (see simulate.ts) and is
 * deterministic, so the server-rendered t = 0 frame hydrates cleanly.
 * Every word and number comes from content/demos/telemetry.ts.
 */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { dur } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import {
  CHARTS,
  PHASES,
  READOUTS,
  REPLAY,
  STAGE,
  srSummary,
  type ChartId,
  type PhaseAccent,
  type ReadoutId,
} from "@/content/demos/telemetry";
import { simulateThrow, type PhaseSpan, type Sample } from "./simulate";
import { StripChart, toStripSeries } from "./StripChart";

/* ── The recording (module scope, fully deterministic) ─────────────────── */

const REC = simulateThrow();
const SAMPLES = REC.samples;
const DT = REC.dt;
const LAST = SAMPLES.length - 1;
const END = REC.end;
const MS_PER_SIM_SEC = 1000 / REPLAY.playbackRate; //  0.5× → 1 simulated s plays over 2 s

/** One channel at simulated time t, interpolated between samples. */
function interp(t: number, pick: (s: Sample) => number): number {
  const k = Math.min(Math.max(t / DT, 0), LAST);
  const i = Math.floor(k);
  const f = k - i;
  const a = pick(SAMPLES[i]);
  return f === 0 ? a : a + (pick(SAMPLES[Math.min(i + 1, LAST)]) - a) * f;
}

/** Rounding for bound attributes: short strings, identical on every engine. */
const px = (v: number) => Math.round(v * 100) / 100;
const frac = (v: number) => Math.round(v * 1e4) / 1e4;

/* ── Stage geometry (side view; metres → viewBox px, equal scale on both axes) ── */

const VB_W = 920;
const VB_H = 460;
const PX_PER_M = 95;
const ORIGIN_X = 100; //  stage x of the release point (x = 0 m)
const GROUND_Y = 400;
const BALL_R = 14;
/** Height of the ground line, m: the resting ball's centre sits one radius above it. */
const GROUND_H = SAMPLES[LAST].h - BALL_R / PX_PER_M;

const sx = (x: number) => ORIGIN_X + x * PX_PER_M;
const sy = (h: number) => GROUND_Y - (h - GROUND_H) * PX_PER_M;

const RELEASE_I = Math.round(REC.release / DT);
const IMPACT_I = Math.round(REC.impact / DT);
const RELEASE_PT = { x: sx(SAMPLES[RELEASE_I].x), y: sy(SAMPLES[RELEASE_I].h) };
const IMPACT_PT = { x: sx(SAMPLES[IMPACT_I].x), y: sy(SAMPLES[IMPACT_I].h) };
const APEX_PT = { x: sx(interp(REC.apex, (s) => s.x)), y: sy(REC.stats.apexM) };

/** The flight arc, release → impact, through every sample. */
const ARC = SAMPLES.slice(RELEASE_I, IMPACT_I + 1);
const ARC_D = ARC.map(
  (s, i) => `${i === 0 ? "M" : "L"}${sx(s.x).toFixed(1)} ${sy(s.h).toFixed(1)}`
).join(" ");

/** Cumulative arc length per vertex: the flown portion follows the ball, not the clock. */
const ARC_CUM: number[] = [0];
for (let i = 1; i < ARC.length; i++) {
  const a = ARC[i - 1];
  const b = ARC[i];
  ARC_CUM.push(ARC_CUM[i - 1] + Math.hypot(sx(b.x) - sx(a.x), sy(b.h) - sy(a.h)));
}
const ARC_LEN = ARC_CUM[ARC_CUM.length - 1];

/** Fraction of the arc flown at simulated time t. */
function flownFraction(t: number): number {
  const k = Math.min(Math.max((t - REC.release) / DT, 0), ARC.length - 1);
  const i = Math.floor(k);
  const f = k - i;
  const a = ARC_CUM[i];
  const b = ARC_CUM[Math.min(i + 1, ARC.length - 1)];
  return (a + (b - a) * f) / ARC_LEN;
}

/** Ground ticks every metre from the release point to the impact. */
const GROUND_TICKS = Array.from({ length: Math.ceil(REC.stats.rangeM) + 1 }, (_, m) => m);

/** Simulated seconds each annotation and phase chip takes to fade in/out. */
const REVEAL = 0.08;
const CHIP_RAMP = 0.05;

/* ── Strip-chart series and phase spans (module scope) ─────────────────── */

const CHANNEL: Record<ChartId, (s: Sample) => number> = {
  accel: (s) => s.accelG,
  gyro: (s) => s.gyroRpm,
  height: (s) => s.h,
};

const SERIES = CHARTS.map((spec) => ({
  spec,
  series: toStripSeries(SAMPLES.map(CHANNEL[spec.id]), DT, spec),
}));

const SPANS = PHASES.map((chip) => {
  const span = REC.phases.find((p) => p.id === chip.id);
  if (!span) throw new Error(`telemetry: the recording has no "${chip.id}" phase for its chip`);
  return { chip, span };
});

const DECIMALS = Object.fromEntries(
  READOUTS.map((r) => [r.id, r.decimals])
) as Record<ReadoutId, number>;

/* ── Phase chip ────────────────────────────────────────────────────────── */

const CHIP = "inline-flex items-center rounded-pill border px-3 py-1.5 text-eyebrow uppercase";

/** Static class strings so Tailwind's scanner sees every accent. */
const CHIP_LIT: Record<PhaseAccent, string> = {
  mint: "border-mint/50 bg-mint/10 text-mint",
  azure: "border-azure/50 bg-azure/10 text-azure",
  rose: "border-rose/50 bg-rose/10 text-rose",
};

interface PhaseChipProps {
  elapsed: MotionValue<number>;
  label: string;
  accent: PhaseAccent;
  span: PhaseSpan;
}

/** A timeline chip: dim by default, its accent overlay lit while the phase is active. */
function PhaseChip({ elapsed, label, accent, span }: PhaseChipProps) {
  const lit = useTransform(
    elapsed,
    [span.start - CHIP_RAMP, span.start, span.end, span.end + CHIP_RAMP],
    [0, 1, 1, 0]
  );
  return (
    <span className="relative inline-flex">
      <span className={cn(CHIP, "border-line text-ink-dim")}>{label}</span>
      <motion.span className={cn(CHIP, "absolute inset-0", CHIP_LIT[accent])} style={{ opacity: lit }}>
        {label}
      </motion.span>
    </span>
  );
}

/* ── Component ─────────────────────────────────────────────────────────── */

type ReplayStatus = "idle" | "running" | "done";

export function ThrowReplay() {
  // Hydration-safe: false on SSR + first client render, real value after mount
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.3 });
  const [status, setStatus] = useState<ReplayStatus>("idle");

  // Auto-play once on first scroll into view; reduced motion holds the end
  // state. Derived, not set from an effect, so leaving the viewport mid-run
  // simply pauses the loop and re-entering resumes it.
  const playing: ReplayStatus =
    reduced ? "done" : status === "idle" && inView ? "running" : status;

  /** Simulated elapsed seconds — the single source of truth. */
  const elapsed = useMotionValue(0);
  const simSec = useRef(0);
  const rafId = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);

  /* ── Derived visuals (no per-frame setState anywhere) ── */

  // The ball rides the recording; the seam turns by the accumulated spin
  // (negative = backspin, counter-clockwise for a ball flying to the right).
  const ballX = useTransform(elapsed, (t) => px(sx(interp(t, (s) => s.x))));
  const ballY = useTransform(elapsed, (t) => px(sy(interp(t, (s) => s.h))));
  const seamRotate = useTransform(elapsed, (t) => -px(interp(t, (s) => s.spinDeg)));

  // The flown part of the arc draws over the dotted prediction.
  const flown = useTransform(elapsed, (t) => frac(flownFraction(t)));

  // Event annotations reveal as the recording reaches them; impact flashes.
  const releaseOpacity = useTransform(elapsed, [REC.release, REC.release + REVEAL], [0, 1]);
  const apexOpacity = useTransform(elapsed, [REC.apex, REC.apex + REVEAL], [0, 1]);
  const impactOpacity = useTransform(elapsed, [REC.impact, REC.impact + REVEAL], [0, 1]);
  const flashOpacity = useTransform(
    elapsed,
    [REC.impact, REC.impact + 0.04, REC.impact + 0.3],
    [0, 0.55, 0]
  );
  const flashScale = useTransform(elapsed, [REC.impact, REC.impact + 0.3], [0.3, 1.8]);

  // Live readouts.
  const readout: Record<ReadoutId, MotionValue<string>> = {
    time: useTransform(elapsed, (t) => t.toFixed(DECIMALS.time)),
    spin: useTransform(elapsed, (t) => interp(t, (s) => s.spinRpm).toFixed(DECIMALS.spin)),
    speed: useTransform(elapsed, (t) => interp(t, (s) => s.speedMps).toFixed(DECIMALS.speed)),
    height: useTransform(elapsed, (t) => interp(t, (s) => s.h).toFixed(DECIMALS.height)),
  };

  /* ── Reduced motion: render the completed end state, never animate ── */

  useEffect(() => {
    if (reduced) {
      simSec.current = END;
      elapsed.jump(END);
    }
  }, [reduced, elapsed]);

  /* ── The rAF loop — runs only while playing, in view, and tab-visible ── */

  useEffect(() => {
    if (playing !== "running") return;

    const stop = () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
      lastTs.current = null;
    };

    const frame = (now: number) => {
      if (lastTs.current !== null) {
        simSec.current = Math.min(simSec.current + (now - lastTs.current) / MS_PER_SIM_SEC, END);
        elapsed.set(simSec.current);
        if (simSec.current >= END) {
          stop();
          setStatus("done");
          return;
        }
      }
      lastTs.current = now;
      rafId.current = requestAnimationFrame(frame);
    };

    const sync = () => {
      const active = inView && !document.hidden;
      if (active && rafId.current === null) rafId.current = requestAnimationFrame(frame);
      else if (!active) stop();
    };

    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      document.removeEventListener("visibilitychange", sync);
      stop();
    };
  }, [playing, inView, elapsed]);

  const replay = useCallback(() => {
    simSec.current = 0;
    elapsed.jump(0);
    setStatus("running");
  }, [elapsed]);

  /* ── Render ── */

  return (
    <div ref={rootRef}>
      {/* Heading row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-title text-balance">{REPLAY.title}</h3>
          <p className="mt-2 max-w-xl text-body text-ink-mid text-pretty">{REPLAY.body}</p>
        </div>
        {!reduced ? (
          <button
            type="button"
            onClick={replay}
            disabled={playing === "running"}
            className="rounded-pill border border-line bg-raised px-5 py-2 text-caption font-medium text-ink transition-all ease-glide hover:border-ink-dim/60 disabled:cursor-default disabled:opacity-40"
            style={{ transitionDuration: `${dur.fast}s` }}
          >
            {playing === "running" ? REPLAY.button.running : REPLAY.button.idle}
          </button>
        ) : null}
      </div>

      {/* Stage — pure vector, crisp at any resolution.
          Horizontal scroll on narrow phones keeps the annotations legible. */}
      <div className="-mx-2 mt-8 overflow-x-auto px-2">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full min-w-[540px]"
          aria-hidden="true"
          focusable="false"
        >
          <text x={VB_W - 24} y={26} textAnchor="end" fontSize={12} fill="var(--color-ink-dim)">
            {STAGE.predictedArc}
          </text>

          {/* Ground line with metre ticks from the release point */}
          <line
            x1={24}
            y1={GROUND_Y}
            x2={VB_W - 24}
            y2={GROUND_Y}
            stroke="var(--color-ink-dim)"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
          {GROUND_TICKS.map((m) => (
            <g key={`tick-${m}`}>
              <line
                x1={sx(m)}
                y1={GROUND_Y}
                x2={sx(m)}
                y2={GROUND_Y + 6}
                stroke="var(--color-ink-dim)"
                strokeOpacity={0.5}
                strokeWidth={1}
              />
              {m % 2 === 0 ? (
                <text
                  x={sx(m)}
                  y={GROUND_Y + 24}
                  textAnchor="middle"
                  fontSize={12}
                  fill="var(--color-ink-dim)"
                >
                  {`${m} ${STAGE.distanceUnit}`}
                </text>
              ) : null}
            </g>
          ))}

          {/* Predicted arc (dotted) and the portion actually flown */}
          <path
            d={ARC_D}
            fill="none"
            stroke="var(--color-azure)"
            strokeOpacity={0.4}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray="0.1 7"
          />
          <motion.path
            d={ARC_D}
            fill="none"
            stroke="var(--color-azure)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pathLength: flown }}
          />

          {/* Release point */}
          <motion.g style={{ opacity: releaseOpacity }}>
            <circle
              cx={RELEASE_PT.x}
              cy={RELEASE_PT.y}
              r={4}
              fill="none"
              stroke="var(--color-azure)"
              strokeWidth={1.5}
            />
            <text x={RELEASE_PT.x + 16} y={RELEASE_PT.y + 28} fontSize={12} fill="var(--color-azure)">
              {`${STAGE.release} · ${REC.stats.releaseSpeedMps.toFixed(1)} m/s · ${REC.stats.launchAngleDeg}°`}
            </text>
          </motion.g>

          {/* Apex */}
          <motion.g style={{ opacity: apexOpacity }}>
            <circle cx={APEX_PT.x} cy={APEX_PT.y} r={3} fill="var(--color-azure)" />
            <text
              x={APEX_PT.x}
              y={APEX_PT.y - 22}
              textAnchor="middle"
              fontSize={12}
              fill="var(--color-azure)"
            >
              {`${STAGE.apex} · ${REC.stats.apexM.toFixed(1)} m`}
            </text>
          </motion.g>

          {/* Impact: flash, then a persistent marker */}
          <motion.circle
            cx={IMPACT_PT.x}
            cy={IMPACT_PT.y}
            r={30}
            fill="var(--color-rose)"
            style={{ opacity: flashOpacity, scale: flashScale }}
          />
          <motion.g style={{ opacity: impactOpacity }}>
            <circle
              cx={IMPACT_PT.x}
              cy={IMPACT_PT.y}
              r={5}
              fill="none"
              stroke="var(--color-rose)"
              strokeWidth={1.5}
            />
            <text x={IMPACT_PT.x + 22} y={IMPACT_PT.y + 4} fontSize={12} fill="var(--color-rose)">
              {`${STAGE.impact} · ${REC.stats.impactPeakG} g`}
            </text>
          </motion.g>

          {/* The ball: glow, body, and a seam mark that turns with the spin */}
          <motion.g style={{ x: ballX, y: ballY }}>
            <circle r={BALL_R + 10} fill="var(--color-azure)" opacity={0.12} />
            <circle r={BALL_R} fill="var(--color-raised)" stroke="var(--color-azure)" strokeWidth={2} />
            <motion.g style={{ rotate: seamRotate }}>
              {/* An unpainted disc keeps this group's fill-box centred on the ball,
                  so the rotation pivots on the ball's centre, not the seam's bbox. */}
              <circle r={BALL_R} fill="none" />
              <path
                d="M -9 -6 Q 0 -13 9 -6"
                fill="none"
                stroke="var(--color-azure)"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <circle cy={-8.5} r={2} fill="var(--color-azure)" />
            </motion.g>
          </motion.g>
        </svg>
      </div>

      {/* Outcome for screen readers — the animation carries no extra meaning */}
      <p className="sr-only">{srSummary(REC.stats)}</p>

      {/* Phase timeline — the pipeline's read of the stream, lit as it happens */}
      <div className="mt-6 flex flex-wrap items-center gap-2" aria-hidden="true">
        <span className="mr-1 text-caption text-ink-dim">{REPLAY.phaseRowLabel}</span>
        {SPANS.map(({ chip, span }, i) => (
          <Fragment key={chip.id}>
            {i > 0 ? <span className="text-caption text-ink-dim">→</span> : null}
            <PhaseChip elapsed={elapsed} label={chip.label} accent={chip.accent} span={span} />
          </Fragment>
        ))}
      </div>

      {/* Live readouts — driven by MotionValues, no React state per frame */}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4" aria-hidden="true">
        {READOUTS.map((r) => (
          <div key={r.id}>
            <dt className="text-caption text-ink-dim">{r.label}</dt>
            <dd className="font-mono text-caption tabular-nums text-ink">
              <motion.span>{readout[r.id]}</motion.span>
              <span className="text-ink-dim">{` ${r.unit}`}</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* Strip charts — a rolling window of each channel */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {SERIES.map(({ spec, series }) => (
          <StripChart key={spec.id} elapsed={elapsed} spec={spec} series={series} />
        ))}
      </div>
    </div>
  );
}
