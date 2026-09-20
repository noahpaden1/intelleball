/**
 * Drift simulation for the Drift Explorer — pure math, no React, no DOM.
 *
 * One recording of DRIFT_MODEL.windowS seconds at DRIFT_MODEL.sampleRateHz:
 * the ball is still, gets kicked once, and is still again. Two pipelines
 * turn the same simulated accelerometer into position and are compared
 * against the true motion. Every value is deterministic from a fixed seed
 * (mulberry32 — no Math.random anywhere), so the server and the client
 * render identical curves.
 *
 * Truth is one-dimensional, along the launch axis. Free flight is not
 * "coasting" on that axis: the BNO055's linear-acceleration output is
 * gravity-compensated, so a ball in free fall reports its real
 * acceleration — g — and the component along a 22° launch axis is
 * −g·sin 22° ≈ −3.7 m/s². That is also what keeps the stillness detector
 * from mistaking flight for rest. The accelerometer here is ideal apart
 * from noise and bias: no ±16 g ceiling, so the kick pulse (hundreds of g)
 * integrates exactly — the telemetry section is where clipping is shown.
 */

import { DRIFT_MODEL } from "@/content/demos/flight";

export interface DriftResult {
  /** Sample times, seconds. */
  time: readonly number[];
  /** Naive double integration from t = 0: position error vs truth, metres. */
  naive: number[];
  /** Intelleball pipeline: position error vs truth, metres. */
  pipeline: number[];
}

/* ── Sampling ─────────────────────────────────────────────────────────── */

const DT = 1 / DRIFT_MODEL.sampleRateHz;
/** Sample count, inclusive of t = 0 and t = windowS. */
const N = Math.round(DRIFT_MODEL.windowS * DRIFT_MODEL.sampleRateHz) + 1;
/** Stillness window in samples. */
const STILL_SAMPLES = Math.max(
  1,
  Math.round(DRIFT_MODEL.stillness.windowS * DRIFT_MODEL.sampleRateHz)
);

/* ── Ground truth ─────────────────────────────────────────────────────── */

const { startS, kickPulseS, flightS, landingPulseS } = DRIFT_MODEL.kick;
const RELEASE_S = startS + kickPulseS;
const LANDING_S = RELEASE_S + flightS;
const REST_S = LANDING_S + landingPulseS;

/** The kick as the chart shades it: first movement to last. */
export const KICK_WINDOW = { startS, endS: REST_S } as const;

/** Gravity's component along the launch axis — negative: it slows the ball. */
const G_ALONG =
  -DRIFT_MODEL.gravityMs2 * Math.sin((DRIFT_MODEL.launchAngleDeg * Math.PI) / 180);
/** Amplitude of a sin² pulse of length τ with a given area: ∫₀^τ A·sin²(πt/τ) dt = A·τ/2. */
const pulseAmplitude = (area: number, tau: number) => (2 * area) / tau;
const A_KICK = pulseAmplitude(DRIFT_MODEL.ballSpeedMs, kickPulseS);
/** Speed left when the landing begins, after gravity has worked on the ball. */
const V_AT_LANDING = DRIFT_MODEL.ballSpeedMs + G_ALONG * flightS;
const A_LANDING = -pulseAmplitude(V_AT_LANDING, landingPulseS);

/** sin²(πt/τ) — written as a product, not `**`, so no engine reaches for pow. */
const halfSineSquared = (t: number, tau: number) => {
  const s = Math.sin((Math.PI * t) / tau);
  return s * s;
};

/** True acceleration along the launch axis at time t, m/s². */
export function trueAcceleration(t: number): number {
  if (t < startS || t >= REST_S) return 0;
  if (t < RELEASE_S) return A_KICK * halfSineSquared(t - startS, kickPulseS);
  if (t < LANDING_S) return G_ALONG;
  return A_LANDING * halfSineSquared(t - LANDING_S, landingPulseS);
}

/* ── Deterministic sensor noise ───────────────────────────────────────── */

/** Tiny seeded PRNG (mulberry32) — deterministic generative content. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n samples of N(0, σ²) from the seeded PRNG (Box–Muller). */
function gaussianSeries(seed: number, n: number, sigma: number): number[] {
  const rand = mulberry32(seed);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i += 2) {
    const radius = Math.sqrt(-2 * Math.log(1 - rand())); // 1 − u ∈ (0, 1] keeps the log finite
    const angle = 2 * Math.PI * rand();
    out[i] = sigma * radius * Math.cos(angle);
    if (i + 1 < n) out[i + 1] = sigma * radius * Math.sin(angle);
  }
  return out;
}

/* ── Integration ──────────────────────────────────────────────────────── */

/**
 * Cumulative trapezoid from zero. Truth and both pipelines share this one
 * scheme, so the integration error cancels in the difference and the
 * curves show sensor error alone.
 */
function integrate(series: readonly number[]): number[] {
  const out = new Array<number>(series.length);
  out[0] = 0;
  for (let i = 1; i < series.length; i++) {
    out[i] = out[i - 1] + 0.5 * (series[i - 1] + series[i]) * DT;
  }
  return out;
}

const TIME: readonly number[] = Array.from({ length: N }, (_, i) => i * DT);
const A_TRUE = TIME.map(trueAcceleration);
const P_TRUE = integrate(integrate(A_TRUE));
const NOISE = gaussianSeries(DRIFT_MODEL.noiseSeed, N, DRIFT_MODEL.noiseSigmaMs2);

/* ── The pipeline ─────────────────────────────────────────────────────── */

/**
 * Stillness detector. A sample is still when the mean |a| over the
 * 100 ms window centred on it stays under the threshold: the window mean
 * is what makes "sustained" robust to single noisy samples (a per-sample
 * test flickers once bias plus noise brush the threshold), and a centred
 * window is fair game for a pipeline that runs after the kick, on the
 * whole recording. Exported for tests.
 */
export function stillnessMask(aMeas: readonly number[]): boolean[] {
  const n = aMeas.length;
  const half = Math.floor(STILL_SAMPLES / 2);
  // Prefix sums of |a| → O(1) window means.
  const prefix = new Array<number>(n + 1);
  prefix[0] = 0;
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + Math.abs(aMeas[i]);
  const still = new Array<boolean>(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n, i - half + STILL_SAMPLES);
    still[i] = (prefix[hi] - prefix[lo]) / (hi - lo) < DRIFT_MODEL.stillness.thresholdMs2;
  }
  return still;
}

/**
 * Position through the Intelleball pipeline. Velocity is pinned to zero
 * and position held through every detected stillness. Each motion window
 * in between is integrated on its own from the last still sample, and —
 * because a stop follows, so the velocity at the window's end is a known
 * 0 m/s — the residual velocity found there is subtracted linearly across
 * the window before the second integration. A constant bias integrates to
 * exactly such a ramp, so the correction cancels it outright; only the
 * noise's short random walk survives. A window that runs off the end of
 * the recording has no stop to correct against and is left uncorrected.
 */
function pipelinePosition(aMeas: readonly number[], still: readonly boolean[]): number[] {
  const n = aMeas.length;
  const position = new Array<number>(n).fill(0);
  let i = 0;
  while (i < n) {
    if (still[i]) {
      const held = i > 0 ? position[i - 1] : 0;
      while (i < n && still[i]) {
        position[i] = held;
        i++;
      }
      continue;
    }
    const start = i;
    while (i < n && !still[i]) i++;
    const end = i - 1;
    // Anchor on the last still sample (v = 0, p held) — or sample 0 if the
    // recording opens in motion.
    const anchor = Math.max(start - 1, 0);
    const span = end - anchor;
    if (span === 0) continue;

    const velocity = new Array<number>(span + 1).fill(0);
    for (let k = 1; k <= span; k++) {
      const j = anchor + k;
      velocity[k] = velocity[k - 1] + 0.5 * (aMeas[j - 1] + aMeas[j]) * DT;
    }
    const bounded = end < n - 1;
    const residual = bounded ? velocity[span] : 0;

    let p = position[anchor];
    let vPrev = 0;
    for (let k = 1; k <= span; k++) {
      const v = velocity[k] - residual * (k / span);
      p += 0.5 * (vPrev + v) * DT;
      position[anchor + k] = p;
      vPrev = v;
    }
  }
  return position;
}

/**
 * Errors are quantised to a micrometre on the way out. The sin/log/cos
 * behind the truth and the noise can differ by an ulp between the
 * server's V8 and the browser's; snapping to 1e-6 m makes every number
 * the components derive from these arrays identical on both sides.
 */
const quantize = (metres: number) => Math.round(metres * 1e6) / 1e6;

/** Both pipelines for one accelerometer bias, as position error vs truth. */
export function simulateDrift(biasMs2: number): DriftResult {
  const aMeas = A_TRUE.map((a, i) => a + biasMs2 + NOISE[i]);
  const naive = integrate(integrate(aMeas));
  const pipeline = pipelinePosition(aMeas, stillnessMask(aMeas));
  return {
    time: TIME,
    naive: naive.map((p, i) => quantize(p - P_TRUE[i])),
    pipeline: pipeline.map((p, i) => quantize(p - P_TRUE[i])),
  };
}
