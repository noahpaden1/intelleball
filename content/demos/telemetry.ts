/**
 * Live Telemetry showcase — copy, physics parameters, thresholds and labels.
 *
 * Every word and number the section renders lives here; the components in
 * components/showcase/telemetry/ never hardcode copy. To change what the
 * section says, or what the simulated throw does, edit this file.
 *
 * Numbers policy (same as content/site.ts): sensor facts are BNO055
 * datasheet values — 100 Hz fused output, ±16 g, ±2000 °/s. The throw
 * itself is SIMULATED: a projectile model sampled at the sensor's real rate
 * with seeded measurement noise, and the copy says so. Nothing here is a
 * field recording.
 */

// ─── Types ────────────────────────────────────────────────────────────────

/** Phases the motion pipeline reports, in timeline order. */
export type PhaseId = "still" | "windup" | "release" | "flight" | "impact" | "rest";

/** mint = stillness gate satisfied · azure = the throw · rose = impact */
export type PhaseAccent = "mint" | "azure" | "rose";

export interface PhaseChip {
  id: PhaseId;
  label: string;
  accent: PhaseAccent;
}

export type ChartId = "accel" | "gyro" | "height";

export interface StripChartSpec {
  id: ChartId;
  /** Quantity symbol shown before the name, e.g. "|a|" */
  symbol: string;
  label: string;
  unit: string;
  /** Fixed y-axis range [min, max], in `unit` */
  domain: [number, number];
  /** Y-axis tick values — clean numbers inside `domain` */
  ticks: number[];
  /** Decimals for the direct label on the trace's extreme; omit for no label */
  peakDecimals?: number;
}

export type ReadoutId = "time" | "spin" | "speed" | "height";

export interface ReadoutSpec {
  id: ReadoutId;
  label: string;
  unit: string;
  decimals: number;
}

/** Headline numbers derived from the simulated recording (see simulate.ts). */
export interface ThrowStats {
  releaseSpeedMps: number;
  launchAngleDeg: number;
  backspinRpm: number;
  /** Release → impact, s */
  flightSec: number;
  apexM: number;
  /** Horizontal distance from release to impact, m */
  rangeM: number;
  impactSpeedMps: number;
  impactPeakG: number;
  impactMs: number;
  /** Impact → stillness gate re-engaged, s */
  settleSec: number;
}

// ─── Section copy ─────────────────────────────────────────────────────────

/** The closing stat chips come from this project's metrics in content/site.ts. */
export const PROJECT_ID = "live-telemetry";

export const INTRO = {
  eyebrow: "Live telemetry · BNO055 at 100 Hz",
  /** Two TextReveal segments; the second is set in azure. */
  headline: ["One throw,", "sample by sample."],
  lead: "Every 10 ms the IMU at the ball's centre reports linear acceleration, angular rate and orientation, fused on-chip and pushed over Wi-Fi as it happens. Below, one simulated throw replayed at half speed: the raw stream, and the phases the pipeline reads out of it.",
} as const;

export const REPLAY = {
  title: "Throw replay",
  body: "A ball at rest, a quarter-second wind-up, the flight, and a 6 g landing, the way the sensor would report it. Watch the acceleration: about zero while the ball is held still, exactly one g in free flight (gravity and nothing else), then a spike at impact that the stillness gate waits out.",
  button: { idle: "Replay", running: "Replaying…" },
  /** Simulated seconds per real second: half speed, so the throw plays over ~5 s. */
  playbackRate: 0.5,
  /** Width of each strip chart's scrolling window, simulated seconds. */
  windowSec: 1.5,
  phaseRowLabel: "Detected phase",
  /** Right-edge label of every strip chart's time axis */
  nowLabel: "now",
} as const;

/** Annotations drawn on the flight stage. */
export const STAGE = {
  release: "release",
  apex: "apex",
  impact: "impact",
  predictedArc: "dotted: arc predicted from the release state",
  distanceUnit: "m",
} as const;

export const ATTRIBUTION =
  "Simulated, not recorded: the replay is generated from the projectile model at the sensor's real 100 Hz output rate, with seeded measurement noise, so every replay is identical.";

/** Outcome sentence for screen readers — the animation carries no extra meaning. */
export function srSummary(s: ThrowStats): string {
  return (
    `In this simulated throw the ball leaves the hand at ${s.releaseSpeedMps.toFixed(1)} metres per second ` +
    `and ${s.launchAngleDeg} degrees with ${s.backspinRpm} rpm of backspin, peaks at ${s.apexM.toFixed(1)} metres, ` +
    `and lands ${s.rangeM.toFixed(1)} metres away after ${s.flightSec.toFixed(2)} seconds of flight ` +
    `at ${s.impactSpeedMps.toFixed(1)} metres per second. The accelerometer reads about 0 g while the ball is still, ` +
    `1 g in free flight, and a ${s.impactPeakG} g spike lasting ${s.impactMs} milliseconds at impact; ` +
    `the stillness gate re-engages ${s.settleSec.toFixed(2)} seconds after landing.`
  );
}

// ─── The simulated throw ──────────────────────────────────────────────────

/** Projectile model inputs. Edit these and the whole replay follows. */
export const PHYSICS = {
  /** BNO055 fused output rate, Hz (datasheet) */
  sampleHz: 100,
  g: 9.81,
  releaseSpeedMps: 7.5,
  launchAngleDeg: 48,
  releaseHeightM: 2.0,
  backspinRpm: 150,
  /** Spin decay time constant in flight, s — about 5 % lost over the throw */
  spinDecayTauSec: 27,
  /** Height of the ball's centre at which the flight ends, m */
  impactHeightM: 0.3,
  /** Half-sine impact pulse: peak in g, duration in s */
  impactPeakG: 6,
  impactDurationSec: 0.03,
  /** Pre-release timeline: held still, then the hand's push up to release */
  stillSec: 0.4,
  windupSec: 0.25,
  /** Fraction of the wind-up spent ramping up before the push plateaus */
  windupRiseFraction: 0.4,
  /** After the pulse, what is left to decay away: as fractions of g, of the spin at impact, and of the impact speed */
  settle: { accelG: 0.5, spinFraction: 0.5, speedFraction: 0.3 },
  /** Decay time constant of that settle, s */
  settleTauSec: 0.08,
  /** Samples of confirmed stillness kept after the gate re-engages, s */
  holdSec: 0.1,
} as const;

/** Seeded measurement noise, 1σ. */
export const NOISE = {
  seed: 0x1e11e,
  accelSigmaMps2: 0.15,
  gyroSigmaDps: 2,
} as const;

/** What the pipeline needs to see before it reports a phase. */
export const DETECTOR = {
  /** Stillness gate: both must hold */
  stillAccelG: 0.15,
  stillGyroRpm: 2.5,
  /** How long the release event stays lit before the chip hands over to flight, s */
  releaseLatchSec: 0.12,
} as const;

export const PHASES: PhaseChip[] = [
  { id: "still", label: "Still", accent: "mint" },
  { id: "windup", label: "Wind-up", accent: "azure" },
  { id: "release", label: "Release", accent: "azure" },
  { id: "flight", label: "Flight", accent: "azure" },
  { id: "impact", label: "Impact", accent: "rose" },
  { id: "rest", label: "Still", accent: "mint" },
];

/** The three strip charts, left to right. */
export const CHARTS: StripChartSpec[] = [
  {
    id: "accel",
    symbol: "|a|",
    label: "Linear acceleration",
    unit: "g",
    domain: [0, 8],
    ticks: [0, 4, 8],
    peakDecimals: 1,
  },
  {
    id: "gyro",
    symbol: "ω",
    label: "Angular rate",
    unit: "rpm",
    domain: [0, 200],
    ticks: [0, 100, 200],
  },
  {
    id: "height",
    symbol: "h",
    label: "Height",
    unit: "m",
    domain: [0, 4],
    ticks: [0, 2, 4],
  },
];

/** Live readouts under the stage, left to right. */
export const READOUTS: ReadoutSpec[] = [
  { id: "time", label: "t", unit: "s", decimals: 2 },
  { id: "spin", label: "spin", unit: "rpm", decimals: 0 },
  { id: "speed", label: "speed", unit: "m/s", decimals: 1 },
  { id: "height", label: "height", unit: "m", decimals: 2 },
];
