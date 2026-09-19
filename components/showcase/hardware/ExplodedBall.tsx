"use client";

import { useId } from "react";
import { piecewise } from "@/lib/scrub";
import { cn } from "@/lib/utils";
import { stageLabels } from "@/content/demos/hardware";
import { stepFadeAt, stepScrubAt } from "./step-progress";

interface ExplodedBallProps {
  /** Section progress 0 → 1 — the one state-mirrored value (lib/scrub.ts). */
  t: number;
  className?: string;
}

/**
 * The ball, exploded. Three concentric layers — shell, cushion, core —
 * drawn as pure vector around a shared origin, sliding apart along an
 * up-right diagonal as the walkthrough scrolls. Each layer lights on its
 * own step; on the last, the I²C bus between the two boards wakes, a
 * sample runs sensor → radio, and the antenna fans out toward a
 * dashboard glyph in the top-right corner.
 *
 * Every position and opacity is a plain number derived from `t` via
 * piecewise()/stepFadeAt()/stepScrubAt(), rendered as transform/opacity
 * attributes — no MotionValue is ever bound to a scrubbed style, so no
 * layer can strand on top of another (see lib/scrub.ts). Entirely
 * decorative (aria-hidden): the captions beside it carry the meaning.
 */

/* ─── Geometry (viewBox units) ────────────────────────────────────────── */

const VB = 640;

/** Where the assembled ball sits; the explosion spreads from here. */
const ORIGIN = { x: 312, y: 340 };

/** Unit vector of the explode axis — up and to the right. */
const AXIS = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };

const R = { shell: 116, cushionOuter: 92, cushionInner: 68, core: 62 };

/** Travel along AXIS at full explosion: shell up-right, core down-left,
 *  the cushion holding the middle. */
const TRAVEL = 160;

/** Extra drift while the link step pulls the outer layers away. */
const PULL = { shell: 28, cushion: 12 };

/** Layer opacity off-focus, and once backgrounded behind the link. */
const DIM = 0.35;
const GHOST = 0.15;

/** The closed ball is drawn this much larger about ORIGIN; the "camera"
 *  pulls back to 1 as the layers separate, so the assembled ball has
 *  presence and the exploded spread still fits the box. */
const ZOOM = 1.22;

/** Where the core comes to rest — the link-step overlay is drawn there. */
const CORE_END = {
  x: ORIGIN.x - AXIS.x * TRAVEL,
  y: ORIGIN.y - AXIS.y * TRAVEL,
};

// Puck layout, core-local (0,0 = puck center).
const ESP = { x: -48, y: -38, w: 34, h: 28 }; //  XIAO ESP32, upper-left
const BNO = { x: 14, y: -38, w: 34, h: 28 }; //   BNO055 breakout, upper-right
const CELL = { x: -46, y: 2, w: 50, h: 22 }; //   LiPo, lower-left
const COIL = { x: 30, y: 14 }; //                 charging coil, lower-right
/** The two I²C traces between the boards — SCL above SDA. */
const BUS = { x1: ESP.x + ESP.w, x2: BNO.x, scl: -30, sda: -22 };
/** Antenna feed on the ESP32's top edge; the radio fans out from here. */
const ANT = { x: -22, y: -40 };
const ANTENNA_TRACE =
  "M -43 -32 h3 v-3 h3 v3 h3 v-3 h3 v3 h3 v-3 h3 v3 h3 V -40";
const RADIO_RADII = [22, 34, 46];

/** Dashboard glyph, top-right — clear of the shell at full pull. */
const DASH = { x: 560, y: 66 };

/** The wireless path: from just past the radio arcs to the dashboard's
 *  lower-left, threading the cushion's hole. Static — by the time it
 *  shows, the core has stopped moving. */
const SIGNAL = {
  x1: CORE_END.x + ANT.x + 54 * Math.cos((-50 * Math.PI) / 180),
  y1: CORE_END.y + ANT.y + 54 * Math.sin((-50 * Math.PI) / 180),
  x2: DASH.x - 32,
  y2: DASH.y + 24,
};

/** Twelve foam spokes across the cushion's annulus. */
const SPOKES = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  return {
    x1: Math.cos(a) * (R.cushionInner + 3),
    y1: Math.sin(a) * (R.cushionInner + 3),
    x2: Math.cos(a) * (R.cushionOuter - 3),
    y2: Math.sin(a) * (R.cushionOuter - 3),
  };
});

/* ─── Helpers ─────────────────────────────────────────────────────────── */

const r2 = (n: number) => Math.round(n * 100) / 100;
const tr = (x: number, y: number) => `translate(${r2(x)} ${r2(y)})`;

/** Staggered entry inside a step's scrub: item i rises over
 *  [i·gap, i·gap + span]. */
function stagger(scrub: number, i: number, gap = 0.1, span = 0.28) {
  return piecewise([i * gap, i * gap + span], [0, 1], scrub);
}

/** Arc of radius r about the origin, clockwise from straight up to −15°:
 *  a fan pointing up-right, toward the dashboard. */
function radioArc(r: number) {
  const a = (-15 * Math.PI) / 180;
  return `M 0 ${-r} A ${r} ${r} 0 0 1 ${r2(r * Math.cos(a))} ${r2(r * Math.sin(a))}`;
}

/** Flat charging coil: half-turns of growing radius, center outward. */
function coilPath(cx: number, cy: number, turns = 5, step = 3) {
  let d = `M ${cx - step} ${cy}`;
  for (let i = 1; i <= turns; i++) {
    const r = step * i;
    const dir = i % 2 === 1 ? 1 : -1;
    d += ` a ${r} ${r} 0 1 1 ${2 * r * dir} 0`;
  }
  return d;
}

/* ─── Stage ───────────────────────────────────────────────────────────── */

export function ExplodedBall({ t, className }: ExplodedBallProps) {
  // Gradient ids must be unique per instance (the static grid mounts four).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const shellFill = `${uid}-shell`;
  const specFill = `${uid}-spec`;

  // Caption envelopes (1 while a step's caption is fully up, crossfading
  // at its edges) and each step's padded 0→1 sub-progress.
  const f0 = stepFadeAt(t, 0).opacity;
  const f1 = stepFadeAt(t, 1).opacity;
  const f2 = stepFadeAt(t, 2).opacity;
  const f3 = stepFadeAt(t, 3).opacity;
  const s1 = stepScrubAt(t, 1);
  const s2 = stepScrubAt(t, 2);
  const s3 = stepScrubAt(t, 3);

  // The explosion plays through the cushion step and holds; the link step
  // then nudges the outer layers further out.
  const shellD = TRAVEL * s1 + PULL.shell * s3;
  const cushionD = PULL.cushion * s3;
  const coreD = -TRAVEL * s1;
  const zoom = piecewise([0, 1], [ZOOM, 1], s1);

  // Focus: each layer lights on its own step, and shell + cushion ghost
  // behind the link. The core stays lit from step 3 on — s2 (held at 1
  // once played) bridges the caption crossfade so it never blinks.
  const shellA = DIM + (1 - DIM) * f0 - (DIM - GHOST) * f3;
  const cushionA = DIM + (1 - DIM) * f1 - (DIM - GHOST) * f3;
  const coreA = DIM + (1 - DIM) * Math.max(f2, f3, s2);

  // Step 3: callouts enter staggered. The power parts leave with the
  // caption; the two boards keep their names for the link step.
  const espLabelA = stagger(s2, 0);
  const bnoLabelA = stagger(s2, 1);
  const cellLabelA = stagger(s2, 2) * f2;
  const coilLabelA = stagger(s2, 3) * f2;

  // Step 4: the bus lights, a sample runs BNO055 → ESP32, the radio fans
  // out, the dashboard lands.
  const busA = piecewise([0, 0.3], [0, 1], s3);
  const pulseX = piecewise([0.25, 0.7], [BUS.x2, BUS.x1], s3);
  const pulseA = piecewise([0.2, 0.3, 0.65, 0.75], [0, 1, 1, 0], s3);
  const radioA = RADIO_RADII.map((_, i) =>
    piecewise([0.3 + i * 0.12, 0.5 + i * 0.12], [0, 1], s3)
  );
  const radioK = piecewise([0.3, 0.86], [0.7, 1], s3);
  const dashA = piecewise([0.62, 0.92], [0, 1], s3);
  const dashLift = 10 * (1 - dashA);

  const L = stageLabels;

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      aria-hidden="true"
      focusable="false"
      className={cn(
        "pointer-events-none h-auto w-full max-w-[520px] select-none",
        className
      )}
    >
      <defs>
        <radialGradient id={shellFill} cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="0.55" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.02)" />
        </radialGradient>
        <radialGradient id={specFill}>
          <stop offset="0" stopColor="rgba(255,255,255,0.42)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* The three layers share one root: the pull-back zoom about ORIGIN */}
      <g transform={`${tr(ORIGIN.x, ORIGIN.y)} scale(${r2(zoom)}) ${tr(-ORIGIN.x, -ORIGIN.y)}`}>
        {/* ── Core: the puck, drawn first so the layers above x-ray over it ── */}
        <g transform={tr(ORIGIN.x + AXIS.x * coreD, ORIGIN.y + AXIS.y * coreD)} opacity={coreA}>
          <circle r={R.core} fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.25)" strokeWidth={1.25} />
          <circle r={R.core - 5} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

          {/* XIAO ESP32 — board, module, antenna meander up to the feed */}
          <rect x={ESP.x} y={ESP.y} width={ESP.w} height={ESP.h} rx={4} fill="rgba(41,151,255,0.12)" stroke="var(--color-azure)" strokeWidth={1.25} />
          <rect x={ESP.x + 9} y={ESP.y + 13} width={16} height={11} rx={1.5} fill="rgba(41,151,255,0.35)" />
          <path d={ANTENNA_TRACE} fill="none" stroke="var(--color-azure)" strokeWidth={1} strokeLinejoin="round" />

          {/* BNO055 breakout — board + axis triad */}
          <rect x={BNO.x} y={BNO.y} width={BNO.w} height={BNO.h} rx={4} fill="rgba(191,90,242,0.12)" stroke="var(--color-violet)" strokeWidth={1.25} />
          <AxisTriad x={BNO.x + 13} y={BNO.y + 20} />

          {/* LiPo cell — body + terminal */}
          <rect x={CELL.x} y={CELL.y} width={CELL.w} height={CELL.h} rx={5} fill="rgba(48,209,88,0.12)" stroke="var(--color-mint)" strokeWidth={1.25} />
          <rect x={CELL.x + CELL.w} y={CELL.y + 6} width={4} height={10} rx={1} fill="var(--color-mint)" />

          {/* Charging coil */}
          <path d={coilPath(COIL.x, COIL.y)} fill="none" stroke="var(--color-rose)" strokeWidth={1.4} strokeLinecap="round" />

          {/* I²C bus — resting traces, then the lit pair and a traveling sample */}
          <line x1={BUS.x1} y1={BUS.scl} x2={BUS.x2} y2={BUS.scl} stroke="rgba(255,255,255,0.3)" strokeWidth={1.25} />
          <line x1={BUS.x1} y1={BUS.sda} x2={BUS.x2} y2={BUS.sda} stroke="rgba(255,255,255,0.3)" strokeWidth={1.25} />
          <g opacity={busA}>
            <line x1={BUS.x1} y1={BUS.scl} x2={BUS.x2} y2={BUS.scl} stroke="var(--color-azure)" strokeWidth={1.5} />
            <line x1={BUS.x1} y1={BUS.sda} x2={BUS.x2} y2={BUS.sda} stroke="var(--color-azure)" strokeWidth={1.5} />
          </g>
          <circle r={2.4} fill="var(--color-azure)" transform={tr(pulseX, BUS.sda)} opacity={pulseA} />

          {/* Radio — three arcs fanning up-right from the antenna feed */}
          <g transform={`${tr(ANT.x, ANT.y)} scale(${r2(radioK)})`}>
            {RADIO_RADII.map((r, i) => (
              <path key={r} d={radioArc(r)} fill="none" stroke="var(--color-azure)" strokeWidth={1.6} strokeLinecap="round" opacity={radioA[i]} />
            ))}
          </g>
          <text x={-26} y={-92} textAnchor="end" fontSize={11} fill="var(--color-azure)" opacity={radioA[2]}>
            {L.radio}
          </text>

          {/* Step-3 callouts */}
          <Callout from={{ x: ESP.x, y: -22 }} elbow={{ x: -62, y: -36 }} side="end" accent="var(--color-azure)" opacity={espLabelA} {...L.parts.esp32} />
          <Callout from={{ x: BNO.x + BNO.w, y: -14 }} elbow={{ x: 64, y: 2 }} side="start" accent="var(--color-violet)" opacity={bnoLabelA} {...L.parts.bno055} />
          <Callout from={{ x: -36, y: CELL.y + CELL.h }} elbow={{ x: -52, y: 40 }} side="end" accent="var(--color-mint)" opacity={cellLabelA} {...L.parts.lipo} />
          <Callout from={{ x: 40, y: 27 }} elbow={{ x: 56, y: 43 }} side="start" accent="var(--color-rose)" opacity={coilLabelA} {...L.parts.coil} />

          {/* Step-4 bus callout — taps SDA, drops between cell and coil, lands under the puck */}
          <g opacity={busA}>
            <polyline points="0,-22 8,-14 8,66" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeLinejoin="round" />
            <circle cx={0} cy={-22} r={2} fill="var(--color-azure)" />
            <text x={8} y={82} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--color-ink)">{L.bus.name}</text>
            <text x={8} y={97} textAnchor="middle" fontSize={11} fill="var(--color-ink-dim)">{L.bus.sda}</text>
            <text x={8} y={111} textAnchor="middle" fontSize={11} fill="var(--color-ink-dim)">{L.bus.scl}</text>
          </g>

          <LayerTag r={R.core} label={L.layers.core} opacity={f2} />
        </g>

        {/* ── Cushion: dashed annulus with foam spokes ── */}
        <g transform={tr(ORIGIN.x + AXIS.x * cushionD, ORIGIN.y + AXIS.y * cushionD)} opacity={cushionA}>
          <circle r={(R.cushionOuter + R.cushionInner) / 2} fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth={R.cushionOuter - R.cushionInner} />
          <circle r={R.cushionOuter} fill="none" stroke="var(--color-ink-dim)" strokeWidth={1.5} strokeDasharray="7 5" />
          <circle r={R.cushionInner} fill="none" stroke="var(--color-ink-dim)" strokeWidth={1} strokeDasharray="3 5" />
          {SPOKES.map((s, i) => (
            <line key={i} x1={r2(s.x1)} y1={r2(s.y1)} x2={r2(s.x2)} y2={r2(s.y2)} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
          ))}
          <LayerTag r={R.cushionOuter} label={L.layers.cushion} opacity={f1} />
        </g>

        {/* ── Shell: translucent sphere, two seams, a specular ── */}
        <g transform={tr(ORIGIN.x + AXIS.x * shellD, ORIGIN.y + AXIS.y * shellD)} opacity={shellA}>
          <circle r={R.shell} fill={`url(#${shellFill})`} stroke="rgba(255,255,255,0.32)" strokeWidth={1.5} />
          <ellipse rx={R.shell} ry={R.shell * 0.4} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.25} />
          <ellipse rx={R.shell * 0.4} ry={R.shell} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.25} />
          <ellipse cx={-46} cy={-54} rx={34} ry={20} transform="rotate(-38 -46 -54)" fill={`url(#${specFill})`} />
          <LayerTag r={R.shell} label={L.layers.shell} opacity={f0} />
        </g>
      </g>

      {/* ── Link: the wireless path and the dashboard it lands on ── */}
      <line x1={r2(SIGNAL.x1)} y1={r2(SIGNAL.y1)} x2={SIGNAL.x2} y2={SIGNAL.y2} stroke="var(--color-azure)" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="0.1 8" opacity={dashA * 0.8} />
      <g transform={tr(DASH.x, DASH.y + dashLift)} opacity={dashA}>
        <rect x={-30} y={-21} width={60} height={42} rx={6} fill="rgba(41,151,255,0.08)" stroke="var(--color-azure)" strokeWidth={1.25} />
        <polyline points="-22,8 -14,2 -6,10 2,-6 10,0 18,-10" fill="none" stroke="var(--color-azure)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={22} cy={-13} r={2.2} fill="var(--color-mint)" />
        <text x={0} y={36} textAnchor="middle" fontSize={11} fill="var(--color-ink-dim)">{L.dashboard}</text>
      </g>
    </svg>
  );
}

/* ─── Pieces ──────────────────────────────────────────────────────────── */

interface CalloutProps {
  /** Anchor on the part (core-local). */
  from: { x: number; y: number };
  /** Elbow: the leader bends here and runs level to the text. */
  elbow: { x: number; y: number };
  /** Which side the text sits on — the tick runs toward it. */
  side: "start" | "end";
  accent: string;
  name: string;
  note: string;
  opacity: number;
}

/** Leader line + anchor dot, name riding above the tick, note below it. */
function Callout({ from, elbow, side, accent, name, note, opacity }: CalloutProps) {
  const dir = side === "end" ? -1 : 1;
  const end = { x: elbow.x + dir * 18, y: elbow.y };
  const tx = end.x + dir * 5;
  return (
    <g opacity={opacity}>
      <polyline points={`${from.x},${from.y} ${elbow.x},${elbow.y} ${end.x},${end.y}`} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeLinejoin="round" />
      <circle cx={from.x} cy={from.y} r={2} fill={accent} />
      <text x={tx} y={end.y - 4} textAnchor={side} fontSize={13} fontWeight={600} fill="var(--color-ink)">{name}</text>
      <text x={tx} y={end.y + 12} textAnchor={side} fontSize={11} fill="var(--color-ink-dim)">{note}</text>
    </g>
  );
}

/** Eyebrow-style layer name, hung off the layer's upper-left edge. */
function LayerTag({ r, label, opacity }: { r: number; label: string; opacity: number }) {
  const edge = -Math.SQRT1_2 * r;
  const end = edge - 22;
  return (
    <g opacity={opacity}>
      <line x1={r2(edge)} y1={r2(edge)} x2={r2(end)} y2={r2(end)} stroke="var(--color-rose)" strokeWidth={1} />
      <circle cx={r2(edge)} cy={r2(edge)} r={2} fill="var(--color-rose)" />
      <text x={r2(end - 6)} y={r2(end + 4)} textAnchor="end" fontSize={10.5} fontWeight={600} letterSpacing="0.14em" className="uppercase" fill="var(--color-rose)">
        {label}
      </text>
    </g>
  );
}

/** The BNO055's body-frame axes: x right, y up, z toward the viewer. */
function AxisTriad({ x, y }: { x: number; y: number }) {
  const [ax, ay, az] = stageLabels.axes;
  const stroke = "var(--color-violet)";
  return (
    <g transform={tr(x, y)} stroke={stroke} strokeWidth={1} strokeLinecap="round">
      <line x1={0} y1={0} x2={10} y2={0} />
      <line x1={0} y1={0} x2={0} y2={-10} />
      <line x1={0} y1={0} x2={-6} y2={6} />
      <circle cx={10} cy={0} r={1.1} fill={stroke} />
      <circle cx={0} cy={-10} r={1.1} fill={stroke} />
      <circle cx={-6} cy={6} r={1.1} fill={stroke} />
      <g stroke="none" fill={stroke} fontSize={6.5} fontWeight={600}>
        <text x={12.5} y={2.2}>{ax}</text>
        <text x={-2} y={-12.5}>{ay}</text>
        <text x={-11.5} y={9.5}>{az}</text>
      </g>
    </g>
  );
}
