"use client";

/**
 * THE RELEASE EXPLORER — "Release explorer"
 *
 * Three range sliders (launch angle, ball speed, goal-line distance) drive
 * a to-scale, drag-free side view of a kick off the ground: the arc runs
 * from the foot back down to the turf, a dashed line marks the crossbar,
 * and a post stands on the goal line, where the readouts say how high the
 * ball crosses — or that it lands short. The world extents are fixed, so
 * the arc keeps one scale while the sliders move; a kick that leaves the
 * frame is clipped and its numbers still show in the readouts. Closed-form
 * projectile equations live in projectile.ts. Entirely user-driven: no
 * animation, plain state → SVG.
 */

import { useId, useState } from "react";
import { RELEASE_COPY, RELEASE_MODEL } from "@/content/demos/flight";
import { fixed, linePath, px } from "./chart";
import { arcPoints, solveRelease } from "./projectile";
import { RangeSlider } from "./RangeSlider";

/* ── Stage geometry (viewBox units, module scope, deterministic) ─────── */

/** viewBox units per metre. */
const SCALE = 20;
const PAD = { l: 56, r: 24, t: 28, b: 46 };
const WORLD = RELEASE_MODEL.world;
const PLOT_W = WORLD.widthM * SCALE;
const PLOT_H = WORLD.heightM * SCALE;
const VB_W = PAD.l + PLOT_W + PAD.r;
const VB_H = PAD.t + PLOT_H + PAD.b;
/** Gridline pitch, metres, both axes. */
const TICK_M = 3;
const X_TICKS = Array.from({ length: Math.floor(WORLD.widthM / TICK_M) + 1 }, (_, i) => i * TICK_M);
const Y_TICKS = Array.from({ length: Math.floor(WORLD.heightM / TICK_M) + 1 }, (_, i) => i * TICK_M);

const sx = (metres: number) => px(PAD.l + metres * SCALE);
const sy = (metres: number) => px(PAD.t + (WORLD.heightM - metres) * SCALE);

const KICK_X = sx(0);
const KICK_Y = sy(RELEASE_MODEL.ballRadiusM);
const CROSSBAR_Y = sy(RELEASE_MODEL.crossbarHeightM);
const GROUND_Y = sy(0);
/** Labels flip to the left of their anchor this close to the plot's right edge. */
const LABEL_FLIP_PX = 110;
/** The kick label sits this far above its marker; an apex this close to it lifts its own label clear. */
const KICK_LABEL_UP = 12;
const APEX_CLEAR_PX = 24;

/** Whether a world point lies inside the drawn plot — markers outside it are skipped. */
const inPlot = (xM: number, yM: number) =>
  xM >= 0 && xM <= WORLD.widthM && yM >= 0 && yM <= WORLD.heightM;

/* ── Readout cell ──────────────────────────────────────────────────────── */

interface ReadoutProps {
  label: string;
  value: string;
  /** Dims the value when it is undefined for this kick. */
  muted?: boolean;
}

function Readout({ label, value, muted = false }: ReadoutProps) {
  return (
    <div>
      <dt className="text-caption text-ink-dim">{label}</dt>
      <dd
        className={
          muted
            ? "mt-1 font-mono text-title tabular-nums tracking-tight text-ink-dim"
            : "mt-1 font-mono text-title tabular-nums tracking-tight text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────────────── */

export function ReleaseExplorer() {
  const [angle, setAngle] = useState<number>(RELEASE_MODEL.angle.default);
  const [speed, setSpeed] = useState<number>(RELEASE_MODEL.speed.default);
  const [goalLine, setGoalLine] = useState<number>(RELEASE_MODEL.goalLine.default);

  const flight = solveRelease(angle, speed, goalLine);
  const arc = arcPoints(angle, speed, flight.hangTimeS, RELEASE_MODEL.arcSamples);
  const arcD = linePath(
    arc.map((p) => sx(p.x)),
    arc.map((p) => sy(p.y))
  );

  const apexX = sx(flight.apexRangeM);
  const apexY = sy(flight.apexM);
  // Keep labels inside the plot: flip them to the left near the right edge,
  // and lift a low apex's label over the kick label at the origin.
  const apexLabelRight = apexX < PAD.l + PLOT_W - LABEL_FLIP_PX;
  const apexLabelY = KICK_Y - apexY < APEX_CLEAR_PX ? KICK_Y - KICK_LABEL_UP - 14 : apexY - 8;
  const goalX = sx(goalLine);
  const goalLabelRight = goalX < PAD.l + PLOT_W - LABEL_FLIP_PX;

  const rawId = useId();
  const clipId = `flight-release-clip-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const angleText = fixed(angle, 0);
  const speedText = fixed(speed, 1);
  const apexText = fixed(flight.apexM, 2);
  const hangText = fixed(flight.hangTimeS, 2);
  const rangeText = fixed(flight.rangeM, 2);
  const goalText = fixed(goalLine, 1);
  const shortfallText = fixed(goalLine - flight.rangeM, 2);
  const verdict =
    flight.verdict === "short"
      ? RELEASE_COPY.verdictShort(shortfallText)
      : RELEASE_COPY.verdict[flight.verdict];
  const summary = flight.goalLine
    ? RELEASE_COPY.summary(
        angleText,
        speedText,
        apexText,
        hangText,
        rangeText,
        goalText,
        fixed(flight.goalLine.heightM, 2),
        verdict
      )
    : RELEASE_COPY.summaryShort(
        angleText,
        speedText,
        apexText,
        hangText,
        rangeText,
        goalText,
        shortfallText
      );

  /* ── Render ── */

  return (
    <div>
      {/* Heading */}
      <div>
        <h3 className="text-title text-balance">{RELEASE_COPY.title}</h3>
        <p className="mt-2 max-w-xl text-body text-ink-mid text-pretty">
          {RELEASE_COPY.description}
        </p>
      </div>

      {/* Controls — three across from sm, stacked on phones */}
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <RangeSlider
          label={RELEASE_COPY.angle.label}
          unit={RELEASE_COPY.angle.unit}
          min={RELEASE_MODEL.angle.min}
          max={RELEASE_MODEL.angle.max}
          step={RELEASE_MODEL.angle.step}
          value={angle}
          decimals={0}
          onChange={setAngle}
        />
        <RangeSlider
          label={RELEASE_COPY.speed.label}
          unit={RELEASE_COPY.speed.unit}
          min={RELEASE_MODEL.speed.min}
          max={RELEASE_MODEL.speed.max}
          step={RELEASE_MODEL.speed.step}
          value={speed}
          decimals={1}
          onChange={setSpeed}
        />
        <RangeSlider
          label={RELEASE_COPY.goalLine.label}
          unit={RELEASE_COPY.goalLine.unit}
          min={RELEASE_MODEL.goalLine.min}
          max={RELEASE_MODEL.goalLine.max}
          step={RELEASE_MODEL.goalLine.step}
          value={goalLine}
          decimals={1}
          onChange={setGoalLine}
        />
      </div>

      {/* Side view — to scale, pure vector.
          Horizontal scroll on narrow phones keeps the annotations legible:
          the minimum width holds the 11 px labels at 9 px or more. */}
      <div className="-mx-2 mt-8 overflow-x-auto px-2">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full min-w-[660px]"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.l} y={PAD.t} width={PLOT_W} height={PLOT_H} />
            </clipPath>
          </defs>

          {/* Grid — hairlines on both axes; a side view is a 2-D space */}
          {Y_TICKS.map((m) => (
            <g key={`y-${m}`}>
              <line
                x1={PAD.l}
                x2={PAD.l + PLOT_W}
                y1={sy(m)}
                y2={sy(m)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={PAD.l - 10}
                y={sy(m) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--color-ink-dim)"
                className="tabular-nums"
              >
                {m}
              </text>
            </g>
          ))}
          {X_TICKS.map((m) => (
            <g key={`x-${m}`}>
              <line
                x1={sx(m)}
                x2={sx(m)}
                y1={PAD.t}
                y2={GROUND_Y}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={sx(m)}
                y={GROUND_Y + 20}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-ink-dim)"
                className="tabular-nums"
              >
                {m}
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
            {RELEASE_COPY.axes.x}
          </text>
          <text
            transform={`translate(16 ${PAD.t + PLOT_H / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-ink-dim)"
            style={{ letterSpacing: "0.08em" }}
          >
            {RELEASE_COPY.axes.y}
          </text>

          {/* Ground */}
          <line
            x1={PAD.l}
            x2={PAD.l + PLOT_W}
            y1={GROUND_Y}
            y2={GROUND_Y}
            stroke="var(--color-ink-dim)"
            strokeOpacity={0.6}
            strokeWidth={1}
          />
          <text
            x={PAD.l + PLOT_W - 4}
            y={GROUND_Y - 6}
            textAnchor="end"
            fontSize={11}
            fill="var(--color-ink-dim)"
          >
            {RELEASE_COPY.marks.ground}
          </text>

          {/* Crossbar — the one dashed line: a threshold, not a gridline */}
          <line
            x1={PAD.l}
            x2={PAD.l + PLOT_W}
            y1={CROSSBAR_Y}
            y2={CROSSBAR_Y}
            stroke="var(--color-ink-mid)"
            strokeOpacity={0.7}
            strokeWidth={1}
            strokeDasharray="4 5"
          />
          <text
            x={PAD.l + PLOT_W - 4}
            y={CROSSBAR_Y - 6}
            textAnchor="end"
            fontSize={11}
            fill="var(--color-ink-mid)"
          >
            {RELEASE_COPY.marks.crossbar} · {fixed(RELEASE_MODEL.crossbarHeightM, 2)} m
          </text>

          {/* Goal line — a post from the turf up to the bar, where the slider puts it */}
          <line
            x1={goalX}
            x2={goalX}
            y1={GROUND_Y}
            y2={CROSSBAR_Y}
            stroke="var(--color-ink-mid)"
            strokeOpacity={0.9}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <text
            x={goalLabelRight ? goalX + 8 : goalX - 8}
            y={CROSSBAR_Y + 15}
            textAnchor={goalLabelRight ? "start" : "end"}
            fontSize={11}
            fill="var(--color-ink-mid)"
            className="tabular-nums"
          >
            {RELEASE_COPY.marks.goalLine} · {goalText} m
          </text>

          {/* The arc, clipped to the plot */}
          <g clipPath={`url(#${clipId})`}>
            <path
              d={arcD}
              fill="none"
              stroke="var(--color-violet)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>

          {/* The kick */}
          <circle
            cx={KICK_X}
            cy={KICK_Y}
            r={5}
            fill="var(--color-violet)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
          <text x={KICK_X + 10} y={KICK_Y - KICK_LABEL_UP} fontSize={11} fill="var(--color-ink-mid)">
            {RELEASE_COPY.marks.kick}
          </text>

          {/* Apex — when it is inside the frame */}
          {inPlot(flight.apexRangeM, flight.apexM) ? (
            <>
              <circle
                cx={apexX}
                cy={apexY}
                r={4}
                fill="var(--color-violet)"
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
              <text
                x={apexLabelRight ? apexX + 9 : apexX - 9}
                y={apexLabelY}
                textAnchor={apexLabelRight ? "start" : "end"}
                fontSize={11}
                fill="var(--color-ink-mid)"
                className="tabular-nums"
              >
                {RELEASE_COPY.marks.apex} · {apexText} m
              </text>
            </>
          ) : null}

          {/* Where the ball crosses the goal line, and where it lands */}
          {flight.goalLine && inPlot(goalLine, flight.goalLine.heightM) ? (
            <circle
              cx={goalX}
              cy={sy(flight.goalLine.heightM)}
              r={5}
              fill="var(--color-violet)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ) : null}
          {inPlot(flight.rangeM, RELEASE_MODEL.ballRadiusM) ? (
            <circle
              cx={sx(flight.rangeM)}
              cy={KICK_Y}
              r={5}
              fill="var(--color-violet)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ) : null}
        </svg>
      </div>

      {/* Outcome for screen readers */}
      <p className="sr-only">{summary}</p>

      {/* Readouts — update instantly with the sliders */}
      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Readout label={RELEASE_COPY.readouts.apex} value={`${apexText} m`} />
        <Readout label={RELEASE_COPY.readouts.hangTime} value={`${hangText} s`} />
        <Readout label={RELEASE_COPY.readouts.range} value={`${rangeText} m`} />
        <Readout
          label={RELEASE_COPY.readouts.atGoalLine}
          value={flight.goalLine ? `${fixed(flight.goalLine.heightM, 2)} m` : "—"}
          muted={!flight.goalLine}
        />
      </dl>

      {/* The verdict, in plain words — one line in every case, so the card
          never changes height as the sliders move */}
      <p className="mt-4 max-w-2xl text-body text-ink text-pretty" aria-hidden="true">
        <span className="text-ink-dim">{RELEASE_COPY.verdictLabel} · </span>
        {verdict}
      </p>
    </div>
  );
}
