/**
 * Flight-analysis showcase — every line of copy, every parameter, every
 * threshold. The components under components/showcase/flight render from
 * this file, and the pure math beside them (drift.ts, projectile.ts) reads
 * its constants from here; nothing is hard-coded in a component.
 *
 * Numbers policy: the sample rate is the fused-output rate the site quotes
 * for the BNO055 (100 Hz). Noise, the bias range, the stillness threshold
 * and the throw profile are model parameters chosen to be plausible for a
 * hand-thrown ball; the copy words them as a model, never a measurement.
 * Where a sentence quotes a parameter (1.2 s, 6 s, 0.15 m/s²) it must be
 * kept in step with the model objects below.
 */

import { site, type Metric } from "@/content/site";

/* ── Section ─────────────────────────────────────────────────────────── */

export const FLIGHT_SECTION = {
  id: "flight-analysis",
  eyebrow: "Flight analysis · Drift-bounded stats",
  /** Two staggered headline segments; the second is tinted violet. */
  headline: ["From raw motion", "to a number you can coach."],
  lead: "Position is two integrations away from what the accelerometer reports, and each one turns a small, constant sensor bias into an error that grows with time. Six seconds of naive integration can put the ball metres from where it is. The pipeline only ever integrates across one throw, checks itself against every stop, and takes spin straight from the gyroscope, where no integration is needed.",
  /** One-line honesty note under the stat chips. */
  modelNote:
    "Both models omit drag and Magnus lift, so real arcs land a little shorter and steeper than the drag-free ones drawn here, and the drift figures describe a simulated sensor, not a bench measurement.",
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
   * The one throw inside the recording, seconds: a sin² launch pulse that
   * brings the ball to release speed, free flight along the launch axis,
   * and a sin² catch pulse that stops it. The three sum to 1.2 s.
   */
  throw: { startS: 2.0, launchPulseS: 0.25, flightS: 0.75, catchPulseS: 0.2 },
  /** Release conditions of the simulated throw — the release explorer's defaults. */
  releaseSpeedMs: 7.5,
  launchAngleDeg: 48,
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

export const DRIFT_COPY = {
  title: "The drift problem",
  description:
    "One 1.2 s throw inside a 6 s recording, still before and after. Both traces integrate the same simulated accelerometer, 100 Hz with 0.15 m/s² of noise plus the bias you set, and what is plotted is how far each answer sits from the true position.",
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
  /** Band over the throw; takes its length in seconds. */
  throwBand: (seconds: string) => `throw · ${seconds} s`,
  stillLabel: "still",
  /** Readout label; takes the recording length in seconds. */
  readout: (seconds: string) => `error at ${seconds} s`,
  /** Crosshair time prefix. */
  hoverTime: "t",
  why: "Why the pipeline wins: a constant bias integrates into a velocity ramp and then a position parabola, so the naive error grows with the square of the time since velocity was last known. The pipeline never lets that clock run past one throw: every detected stillness is a free, exact velocity measurement of 0 m/s, and subtracting the residual velocity linearly across the window cancels a constant bias outright. What survives is the noise's random walk over 1.2 s: centimetres, not metres.",
  /** Screen-reader outcome; takes the bias and both formatted errors. */
  summary: (bias: string, naive: string, pipeline: string) =>
    `With an accelerometer bias of ${bias} m/s², integrating the recording naively puts the ball ${naive} from where it really is after 6 seconds. The Intelleball pipeline, which pins velocity to zero at every detected stillness and corrects each throw window against its known stop, is off by ${pipeline}.`,
};

/* ── Release explorer ────────────────────────────────────────────────── */

export const RELEASE_MODEL = {
  angle: { min: 20, max: 70, step: 1, default: 48 },
  speed: { min: 4, max: 12, step: 0.1, default: 7.5 },
  /** Height of the ball at release, metres above the ground. */
  releaseHeightM: 2.0,
  /**
   * Height the flight is measured to, metres. 3.05 m is a regulation
   * basketball rim by default; the UI only ever calls it "target height",
   * so changing it here re-targets the whole explorer.
   */
  targetHeightM: 3.05,
  gravityMs2: 9.81,
  /**
   * Fixed extents of the to-scale side view, metres, so the arc keeps one
   * scale while the sliders move. Sized to the fastest, highest throw the
   * sliders allow (≈13.5 m to the target, ≈8.5 m apex).
   */
  world: { widthM: 15, heightM: 9 },
  /** Polyline resolution of the drawn arc. */
  arcSamples: 72,
} as const;

export const RELEASE_COPY = {
  title: "Release explorer",
  description:
    "Release speed and launch angle are what the pipeline reads at the instant the ball leaves the hand. Set them and the projectile model fills in the rest of the throw: apex, hang time, range and entry angle, measured to where the arc comes back down through the target height.",
  angle: { label: "Launch angle", unit: "°" },
  speed: { label: "Release speed", unit: "m/s" },
  marks: { release: "release", apex: "apex", target: "target height", ground: "ground" },
  axes: { x: "distance (m)", y: "height (m)" },
  readouts: { apex: "Apex height", hangTime: "Hang time", range: "Range", entryAngle: "Entry angle" },
  /** Shown when the apex is below the target height; takes the shortfall in metres. */
  unreachable: (shortfall: string) =>
    `The arc peaks ${shortfall} m below the target height, so it never gets there: hang time, range and entry angle are undefined for this throw.`,
  /** Screen-reader outcome for a throw that reaches the target height. */
  summary: (angle: string, speed: string, apex: string, hangTime: string, range: string, entry: string) =>
    `At ${angle}° and ${speed} m/s from a ${RELEASE_MODEL.releaseHeightM.toFixed(1)} m release, the ball peaks at ${apex} m and comes back down through the ${RELEASE_MODEL.targetHeightM.toFixed(2)} m target height after ${hangTime} s, ${range} m downrange, entering at ${entry}°.`,
  /** Screen-reader outcome for a throw that never reaches the target height. */
  summaryUnreachable: (angle: string, speed: string, apex: string) =>
    `At ${angle}° and ${speed} m/s from a ${RELEASE_MODEL.releaseHeightM.toFixed(1)} m release, the ball peaks at ${apex} m, below the ${RELEASE_MODEL.targetHeightM.toFixed(2)} m target height, so it never reaches it.`,
};
