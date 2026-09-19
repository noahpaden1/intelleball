"use client";

/**
 * THE RELEASE EXPLORER — "Release explorer"
 *
 * Two range sliders (launch angle, release speed) drive a to-scale,
 * drag-free side view of the throw from a fixed release height, ending
 * where the arc comes back down through the target height — or, when the
 * apex never gets that high, at the ground, with the target readouts
 * declared undefined. The world extents are fixed, so the arc keeps one
 * scale while the sliders move. Closed-form projectile equations live in
 * projectile.ts. Entirely user-driven: no animation, plain state → SVG.
 */

import { useState } from "react";
import { RELEASE_COPY, RELEASE_MODEL } from "@/content/demos/flight";
import { fixed, linePath, px, withUnit } from "./chart";
import { arcPoints, solveRelease } from "./projectile";
import { RangeSlider } from "./RangeSlider";

/* ── Stage geometry (viewBox units, module scope, deterministic) ─────── */

/** viewBox units per metre. */
const SCALE = 40;
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

const RELEASE_X = sx(0);
const RELEASE_Y = sy(RELEASE_MODEL.releaseHeightM);
const TARGET_Y = sy(RELEASE_MODEL.targetHeightM);
const GROUND_Y = sy(0);

/* ── Readout cell ──────────────────────────────────────────────────────── */

interface ReadoutProps {
  label: string;
  value: string;
  /** Dims the value when it is undefined for this throw. */
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

  const flight = solveRelease(angle, speed);
  const arc = arcPoints(angle, speed, flight.endTimeS, RELEASE_MODEL.arcSamples);
  const arcD = linePath(
    arc.map((p) => sx(p.x)),
    arc.map((p) => sy(p.y))
  );

  const apexX = sx(flight.apexRangeM);
  const apexY = sy(flight.apexM);
  // Keep the apex label inside the plot: flip it to the left near the right edge.
  const apexLabelRight = apexX < PAD.l + PLOT_W - 110;

  const angleText = fixed(angle, 0);
  const speedText = fixed(speed, 1);
  const apexText = fixed(flight.apexM, 2);
  const summary = flight.target
    ? RELEASE_COPY.summary(
        angleText,
        speedText,
        apexText,
        fixed(flight.target.hangTimeS, 2),
        fixed(flight.target.rangeM, 2),
        fixed(flight.target.entryAngleDeg, 1)
      )
    : RELEASE_COPY.summaryUnreachable(angleText, speedText, apexText);

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

      {/* Controls — side by side from sm, stacked on phones */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
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
      </div>

      {/* Side view — to scale, pure vector.
          Horizontal scroll on narrow phones keeps the annotations legible. */}
      <div className="-mx-2 mt-8 overflow-x-auto px-2">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full min-w-[540px]"
          aria-hidden="true"
          focusable="false"
        >
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
          <text x={PAD.l + 6} y={GROUND_Y - 6} fontSize={11} fill="var(--color-ink-dim)">
            {RELEASE_COPY.marks.ground}
          </text>

          {/* Target height — the one dashed line: a threshold, not a gridline */}
          <line
            x1={PAD.l}
            x2={PAD.l + PLOT_W}
            y1={TARGET_Y}
            y2={TARGET_Y}
            stroke="var(--color-ink-mid)"
            strokeOpacity={0.7}
            strokeWidth={1}
            strokeDasharray="4 5"
          />
          <text
            x={PAD.l + PLOT_W - 4}
            y={TARGET_Y + 15}
            textAnchor="end"
            fontSize={11}
            fill="var(--color-ink-mid)"
          >
            {RELEASE_COPY.marks.target} · {fixed(RELEASE_MODEL.targetHeightM, 2)} m
          </text>

          {/* The arc */}
          <path
            d={arcD}
            fill="none"
            stroke="var(--color-violet)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Release point */}
          <circle
            cx={RELEASE_X}
            cy={RELEASE_Y}
            r={5}
            fill="var(--color-violet)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
          <text x={RELEASE_X + 10} y={RELEASE_Y + 16} fontSize={11} fill="var(--color-ink-mid)">
            {RELEASE_COPY.marks.release} · {fixed(RELEASE_MODEL.releaseHeightM, 1)} m
          </text>

          {/* Apex */}
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
            y={apexY - 8}
            textAnchor={apexLabelRight ? "start" : "end"}
            fontSize={11}
            fill="var(--color-ink-mid)"
            className="tabular-nums"
          >
            {RELEASE_COPY.marks.apex} · {apexText} m
          </text>

          {/* Where the flight ends: on the target line, or on the ground */}
          <circle
            cx={sx(flight.endRangeM)}
            cy={sy(flight.endHeightM)}
            r={5}
            fill="var(--color-violet)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
        </svg>
      </div>

      {/* Outcome for screen readers */}
      <p className="sr-only">{summary}</p>

      {/* Readouts — update instantly with the sliders */}
      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Readout label={RELEASE_COPY.readouts.apex} value={`${apexText} m`} />
        <Readout
          label={RELEASE_COPY.readouts.hangTime}
          value={flight.target ? `${fixed(flight.target.hangTimeS, 2)} s` : "—"}
          muted={!flight.target}
        />
        <Readout
          label={RELEASE_COPY.readouts.range}
          value={flight.target ? `${fixed(flight.target.rangeM, 2)} m` : "—"}
          muted={!flight.target}
        />
        <Readout
          label={RELEASE_COPY.readouts.entryAngle}
          value={
            flight.target
              ? withUnit(fixed(flight.target.entryAngleDeg, 1), RELEASE_COPY.angle.unit)
              : "—"
          }
          muted={!flight.target}
        />
      </dl>
      {flight.target ? null : (
        <p className="mt-4 max-w-2xl text-caption text-ink-mid text-pretty">
          {RELEASE_COPY.unreachable(fixed(RELEASE_MODEL.targetHeightM - flight.apexM, 2))}
        </p>
      )}
    </div>
  );
}
