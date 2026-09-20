/**
 * Flight-analysis showcase — every line of copy, every parameter, every
 * threshold. The components under components/showcase/flight render from
 * this file, and the pure math beside them (drift.ts, projectile.ts) reads
 * its constants from here; nothing is hard-coded in a component.
 *
 * Numbers policy: the sample rate is the fused-output rate the site quotes
 * for the BNO055 (100 Hz). Noise, the bias range, the stillness threshold
 * and the kick profile are model parameters chosen to be plausible for a
 * kicked soccer ball; the copy words them as a model, never a measurement.
 * The pitch numbers (crossbar 2.44 m, ball radius 0.11 m) are the laws of
 * the game. Where a sentence quotes a parameter (1.6 s, 6 s, 0.15 m/s²) it
 * is interpolated from the model objects below, so it cannot drift.
 */

import { site, type Metric } from "@/content/site";

/* ── Section ─────────────────────────────────────────────────────────── */

export const FLIGHT_SECTION = {
  id: "flight-analysis",
  eyebrow: "Flight analysis · Drift-bounded stats",
  /** Two staggered headline segments; the second is tinted violet. */
  headline: ["From raw motion", "to a number you can coach."],
  lead: "Position is two integrations away from what the accelerometer reports, and each one turns a small, constant sensor bias into an error that grows with time. Six seconds of naive integration can put the ball metres from where it is. The pipeline only ever integrates across one kick, checks itself against every stop, and takes spin straight from the gyroscope, where no integration is needed.",
  /** One-line honesty note under the stat chips. */
  modelNote:
    "Both models omit drag and Magnus lift, and on a soccer ball at shooting speed neither is small: a real shot lands shorter and steeper than the drag-free arcs drawn here, and a curled one bends sideways, which a side view cannot show. The drift figures describe a simulated sensor, not a bench measurement.",
} as const;

/** Closing stat chips: the Flight-analysis project card's own metrics. */
const flightProject = site.projects.find((project) => project.id === FLIGHT_SECTION.id);
export const STAT_CHIPS: readonly Metric[] = flightProject?.metrics ?? [];

/* ── The drift problem ───────────────────────────────────────────────── */

export type DriftMode = "naive" | "pipeline" | "both";

export interface DriftModeOption {
  value: DriftMode;
  label: string;
}

export const DRIFT_MODEL = {
  /** Samples per second — the fused-output rate quoted for the IMU. */
  sampleRateHz: 100,
  /** Length of the simulated recording, seconds. */
  windowS: 6,
  /**
   * The one kick inside the recording, seconds: a sin² kick pulse that
   * brings the ball to speed, free flight along the launch axis, and a
   * sin² landing pulse that stops it (the bounce and roll-out collapsed
   * into one stop). The three sum to 1.6 s.
   */
  kick: { startS: 2.0, kickPulseS: 0.02, flightS: 1.53, landingPulseS: 0.05 },
  /** State at the foot for the simulated kick — the release explorer's defaults. */
  ballSpeedMs: 20,
  launchAngleDeg: 22,
  gravityMs2: 9.81,
  /** Accelerometer white noise, 1σ per sample, m/s². */
  noiseSigmaMs2: 0.15,
  /** mulberry32 seed for that noise — fixed, so server and client render identical curves. */
  noiseSeed: 0x1b4a11,
  /** Stillness detector: mean |a| under the threshold across a full window → v := 0. */
  stillness: { thresholdMs2: 0.35, windowS: 0.1 },
  /** Bias slider, m/s². The 0.05 default is ≈5 mg — a few milli-g of post-calibration offset. */
  bias: { min: 0, max: 0.2, step: 0.01, default: 0.05 },
} as const;

/** Length of the kick window, s — quoted in the copy below. */
const KICK_S =
  DRIFT_MODEL.kick.kickPulseS + DRIFT_MODEL.kick.flightS + DRIFT_MODEL.kick.landingPulseS;
const KICK_S_TEXT = KICK_S.toFixed(1);

export const DRIFT_COPY = {
  title: "The drift problem",
  description: `One ${KICK_S_TEXT} s kick inside a ${DRIFT_MODEL.windowS} s recording, still before and after. Both traces integrate the same simulated accelerometer, ${DRIFT_MODEL.sampleRateHz} Hz with ${DRIFT_MODEL.noiseSigmaMs2} m/s² of noise plus the bias you set and no 16 g ceiling (that is the telemetry section's problem), and what is plotted is how far each answer sits from the true position.`,
  mode: {
    label: "Traces shown",
    options: [
      { value: "naive", label: "Naive" },
      { value: "pipeline", label: "Pipeline" },
      { value: "both", label: "Both" },
    ],
    default: "both",
  } satisfies { label: string; options: DriftModeOption[]; default: DriftMode },
  bias: { label: "Accelerometer bias", unit: "m/s²" },
  series: {
    naive: { label: "Naive integration", short: "naive" },
    pipeline: { label: "Intelleball pipeline", short: "pipeline" },
  },
  axes: {
    x: "time (s)",
    /** Takes the display unit ("m" or "cm"). */
    y: (unit: string) => `position error (${unit})`,
  },
  /** Band over the kick; takes its length in seconds. */
  kickBand: (seconds: string) => `kick · ${seconds} s`,
  stillLabel: "still",
  /** Readout label; takes the recording length in seconds. */
  readout: (seconds: string) => `error at ${seconds} s`,
  /** Crosshair time prefix. */
  hoverTime: "t",
  why: `Why the pipeline wins: a constant bias integrates into a velocity ramp and then a position parabola, so the naive error grows with the square of the time since velocity was last known. The pipeline never lets that clock run past one kick: every detected stillness is a free, exact velocity measurement of 0 m/s, and subtracting the residual velocity linearly across the window cancels a constant bias outright. What survives is the noise's random walk over ${KICK_S_TEXT} s: centimetres, not metres.`,
  /** Screen-reader outcome; takes the bias and both formatted errors. */
  summary: (bias: string, naive: string, pipeline: string) =>
    `With an accelerometer bias of ${bias} m/s², integrating the recording naively puts the ball ${naive} from where it really is after ${DRIFT_MODEL.windowS} seconds. The Intelleball pipeline, which pins velocity to zero at every detected stillness and corrects each kick window against its known stop, is off by ${pipeline}.`,
};

/* ── Release explorer ────────────────────────────────────────────────── */

export const RELEASE_MODEL = {
  /** Launch angle: driven shots sit low, lofted passes up to ~45°. */
  angle: { min: 5, max: 45, step: 1, default: 22 },
  /** Ball speed off the foot: passes 8–15 m/s, shots 18–30 m/s. */
  speed: { min: 8, max: 30, step: 0.1, default: 20 },
  /** Distance from the kick to the goal line, metres — the penalty spot is 11 m, the edge of the box 16.5 m. */
  goalLine: { min: 6, max: 35, step: 0.5, default: 18 },
  /**
   * Ball radius, metres. A ball kicked off the ground starts with its
   * centre one radius up, and lands when the centre comes back down to it.
   */
  ballRadiusM: 0.11,
  /** Height of the crossbar, metres (laws of the game). */
  crossbarHeightM: 2.44,
  gravityMs2: 9.81,
  /**
   * Fixed extents of the to-scale side view, metres, so the arc keeps one
   * scale while the sliders move. Sized around the goal-line slider, not
   * the fastest, highest kick the sliders allow: that one leaves the frame
   * (the arc is clipped) and the readouts carry its numbers.
   */
  world: { widthM: 36, heightM: 12 },
  /** Polyline resolution of the drawn arc. */
  arcSamples: 72,
} as const;

/**
 * How the ball meets the goal line: the whole ball clears the bar, the whole
 * ball passes under it, some of it meets it, or it lands before the line.
 */
export type GoalVerdict = "under" | "over" | "bar" | "short";

export const RELEASE_COPY = {
  title: "Release explorer",
  description:
    "Ball speed and launch angle are what the pipeline reads at the instant the ball leaves the foot. Set them, put the goal line where you like, and the projectile model fills in the rest of the kick: apex, hang time, range, and how high the ball's centre is when it crosses the line, against the crossbar.",
  angle: { label: "Launch angle", unit: "°" },
  speed: { label: "Ball speed", unit: "m/s" },
  goalLine: { label: "Goal line", unit: "m" },
  marks: { kick: "kick", apex: "apex", crossbar: "crossbar", goalLine: "goal line", ground: "ground" },
  axes: { x: "distance (m)", y: "height (m)" },
  readouts: { apex: "Apex height", hangTime: "Hang time", range: "Range", atGoalLine: "Height at the line" },
  /** Plain-words verdict under the readouts, and its label. */
  verdictLabel: "At the line",
  verdict: {
    under: "under the bar",
    over: "over the bar",
    bar: "hits the bar",
  } satisfies Record<Exclude<GoalVerdict, "short">, string>,
  /** The verdict for a kick that lands short; takes the shortfall in metres. */
  verdictShort: (shortfall: string) => `bounces ${shortfall} m before the line`,
  /** Screen-reader outcome for a kick that reaches the goal line in the air. */
  summary: (
    angle: string,
    speed: string,
    apex: string,
    hangTime: string,
    range: string,
    goalLine: string,
    atLine: string,
    verdict: string
  ) =>
    `At ${angle}° and ${speed} m/s off the foot, kicked from the ground, the ball peaks at ${apex} m, lands ${range} m away after ${hangTime} s, and crosses the goal line ${goalLine} m out with its centre at ${atLine} m: ${verdict} (the underside of the crossbar is ${RELEASE_MODEL.crossbarHeightM.toFixed(2)} m).`,
  /** Screen-reader outcome for a kick that lands before the goal line; takes the shortfall in metres. */
  summaryShort: (
    angle: string,
    speed: string,
    apex: string,
    hangTime: string,
    range: string,
    goalLine: string,
    shortfall: string
  ) =>
    `At ${angle}° and ${speed} m/s off the foot, kicked from the ground, the ball peaks at ${apex} m and lands ${range} m away after ${hangTime} s, ${shortfall} m before the goal line ${goalLine} m out: it bounces before the line.`,
};
