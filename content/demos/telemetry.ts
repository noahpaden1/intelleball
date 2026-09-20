/**
 * Live Telemetry showcase — copy, physics parameters, thresholds and labels.
 *
 * Every word and number the section renders lives here; the components in
 * components/showcase/telemetry/ never hardcode copy. To change what the
 * section says, or what the simulated kick does, edit this file.
 *
 * Numbers policy (same as content/site.ts): sensor facts are BNO055
 * datasheet values — 100 Hz fused output, ±16 g, ±2000 °/s. The kick
 * itself is SIMULATED: a projectile model sampled at the sensor's real rate
 * with seeded measurement noise, and the copy says so. Nothing here is a
 * field recording. Drag and Magnus lift are left out, and for a soccer
 * ball they are not small — the attribution says so.
 */

// ─── Types ────────────────────────────────────────────────────────────────

/** Phases the motion pipeline reports, in timeline order. */
export type PhaseId = "still" | "kick" | "flight" | "bounce" | "roll" | "rest";

/** mint = stillness gate satisfied · azure = the kick and the flight · rose = ground contact */
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
  /** Note appended to that label when the extreme sits on the sensor's ceiling */
  peakClippedNote?: string;
}

export type ReadoutId = "time" | "spin" | "speed" | "height";

export interface ReadoutSpec {
  id: ReadoutId;
  label: string;
  unit: string;
  decimals: number;
}

/** Headline numbers derived from the simulated recording (see simulate.ts). */
export interface KickStats {
  ballSpeedMps: number;
  launchAngleDeg: number;
  spinRpm: number;
  /** Peak of the kick impulse the model actually applies, g — far above the ceiling */
  kickPeakG: number;
  /** What the accelerometer reports at most, g (its widest ±16 g full-scale setting) */
  ceilingG: number;
  /** How long the reading sits on that ceiling, ms */
  kickMs: number;
  /** Foot → ground contact, s */
  flightSec: number;
  apexM: number;
  /** Horizontal distance from the kick to the bounce, m */
  rangeM: number;
  landingSpeedMps: number;
  bouncePeakG: number;
  bounceMs: number;
  /** Bounce → stillness gate re-engaged, s, and how far the ball rolled in that time, m */
  rollSec: number;
  rollM: number;
}

// ─── Section copy ─────────────────────────────────────────────────────────

/** The closing stat chips come from this project's metrics in content/site.ts. */
export const PROJECT_ID = "live-telemetry";

export const INTRO = {
  eyebrow: "Live telemetry · BNO055 at 100 Hz",
  /** Two TextReveal segments; the second is set in azure. */
  headline: ["One kick,", "sample by sample."],
  lead: "Every 10 ms the IMU at the ball's centre reports linear acceleration, angular rate and orientation, fused on-chip and pushed over Wi-Fi as it happens. Below, one simulated kick replayed at half speed: the raw stream, and the phases the pipeline reads out of it.",
} as const;

// ─── The simulated kick ───────────────────────────────────────────────────

/** Projectile model inputs. Edit these and the whole replay follows. */
export const PHYSICS = {
  /** BNO055 fused output rate, Hz (datasheet) */
  sampleHz: 100,
  g: 9.81,
  /** Ball radius, m: the centre of a ball on the ground sits this high */
  ballRadiusM: 0.11,
  /** A driven shot: speed off the foot, launch angle, backspin */
  ballSpeedMps: 20,
  launchAngleDeg: 22,
  spinRpm: 300,
  /** Spin decay time constant in flight, s — about 5 % lost over the flight */
  spinDecayTauSec: 27,
  /**
   * Accelerometer full scale at its widest ±16 g setting, g (datasheet) —
   * the range the ball will run at; the current firmware leaves the
   * power-on ±4 g default. Every reading is clipped here.
   */
  accelCeilingG: 16,
  /**
   * The kick: a half-sine push along the launch direction that takes the
   * ball from rest to `ballSpeedMps`. Foot contact is ~10 ms in reality;
   * two samples at 100 Hz is the shortest event that draws a flat top, and
   * the sensor's output filter smears a hit across neighbouring samples
   * anyway. Its true peak is hundreds of g — the reading pins at the ceiling.
   */
  kickDurationSec: 0.02,
  /** The ball waits on the ground this long before the kick */
  stillSec: 0.4,
  /**
   * The bounce: a half-sine pulse whose peak sits just under the ceiling
   * (a harder landing clips exactly like the kick). Coming off it the ball
   * keeps this fraction of its landing speed and rolls; the second hop a
   * real ball would take is folded into the roll-out.
   */
  bounce: { peakG: 15, durationSec: 0.03, speedFraction: 0.1 },
  /**
   * The roll-out: a rolling ball decelerates gently and steadily (grass),
   * and turns at v / r — which is what keeps the gyro, not the
   * accelerometer, holding the stillness gate open until it really stops.
   */
  roll: { decelG: 0.12 },
  /** Samples of confirmed stillness kept after the gate re-engages, s */
  holdSec: 0.1,
} as const;

export const REPLAY = {
  title: "Kick replay",
  body: `A ball on the ground, a kick, the flight, a bounce and a roll-out, the way the sensor would report it. Watch the acceleration: about zero while the ball sits still, pinned at the sensor's widest ±${PHYSICS.accelCeilingG} g full scale for the kick itself (a ${Math.round(PHYSICS.kickDurationSec * 1000)} ms impulse in this model, well over a hundred g — more than the accelerometer can measure at any setting), exactly one g in free flight (gravity and nothing else), a second spike at the bounce, then ${PHYSICS.roll.decelG} g of rolling drag that the stillness gate waits out.`,
  button: { idle: "Replay", running: "Replaying…" },
  /** Simulated seconds per real second: half speed, so the kick plays over ~7 s. */
  playbackRate: 0.5,
  /** Width of each strip chart's scrolling window, simulated seconds. */
  windowSec: 1.5,
  phaseRowLabel: "Detected phase",
  /** Right-edge label of every strip chart's time axis */
  nowLabel: "now",
} as const;

/** Annotations drawn on the flight stage. */
export const STAGE = {
  kick: "kick",
  apex: "apex",
  bounce: "bounce",
  predictedArc: "dotted: arc predicted from the state at the foot",
  distanceUnit: "m",
} as const;

export const ATTRIBUTION =
  "Simulated, not recorded: the replay is generated from a drag-free projectile model at the sensor's real 100 Hz output rate, with seeded measurement noise, so every replay is identical. Drag and Magnus lift are omitted, and on a soccer ball at this speed they matter: a real shot lands shorter, and a curled one bends.";

/** Outcome sentence for screen readers — the animation carries no extra meaning. */
export function srSummary(s: KickStats): string {
  return (
    `In this simulated kick the ball leaves the foot at ${s.ballSpeedMps.toFixed(1)} metres per second ` +
    `and ${s.launchAngleDeg} degrees with ${s.spinRpm} rpm of backspin, peaks at ${s.apexM.toFixed(1)} metres, ` +
    `and lands ${s.rangeM.toFixed(1)} metres away after ${s.flightSec.toFixed(2)} seconds of flight ` +
    `at ${s.landingSpeedMps.toFixed(1)} metres per second. The kick itself peaks near ${Math.round(s.kickPeakG)} g, ` +
    `so the accelerometer clips at its ${s.ceilingG} g full-scale ceiling for ${s.kickMs} milliseconds; it reads about 0 g while the ball is still, ` +
    `1 g in free flight, and a ${s.bouncePeakG} g spike lasting ${s.bounceMs} milliseconds at the bounce. ` +
    `The ball then rolls ${s.rollM.toFixed(1)} metres and the stillness gate re-engages ${s.rollSec.toFixed(2)} seconds after landing.`
  );
}

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
  /** How long the kick and bounce events stay lit before the chip hands over, s */
  kickLatchSec: 0.15,
  bounceLatchSec: 0.15,
} as const;

export const PHASES: PhaseChip[] = [
  { id: "still", label: "Still", accent: "mint" },
  { id: "kick", label: "Kick", accent: "azure" },
  { id: "flight", label: "Flight", accent: "azure" },
  { id: "bounce", label: "Bounce", accent: "rose" },
  { id: "roll", label: "Roll", accent: "rose" },
  { id: "rest", label: "Still", accent: "mint" },
];

/** The three strip charts, left to right. */
export const CHARTS: StripChartSpec[] = [
  {
    id: "accel",
    symbol: "|a|",
    label: "Linear acceleration",
    unit: "g",
    domain: [0, PHYSICS.accelCeilingG],
    ticks: [0, PHYSICS.accelCeilingG / 2, PHYSICS.accelCeilingG],
    peakDecimals: 1,
    peakClippedNote: "clipped",
  },
  {
    id: "gyro",
    symbol: "ω",
    label: "Angular rate",
    unit: "rpm",
    domain: [0, 400],
    ticks: [0, 200, 400],
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
