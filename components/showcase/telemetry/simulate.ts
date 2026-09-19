/**
 * The simulated recording behind the throw replay.
 *
 * One throw, sampled at the BNO055's real 100 Hz output rate: held still,
 * a wind-up, a drag-free projectile flight from the release state, a
 * half-sine impact pulse, and an exponential settle back to rest. What the
 * sensor would report is derived from that motion — linear acceleration
 * excludes gravity (a held ball reads 0 g, a ball in free flight reads
 * 1 g), angular rate is the backspin — with seeded Gaussian measurement
 * noise on both.
 *
 * Pure and deterministic. Every constant comes from content/demos/telemetry.ts
 * and the noise generator is arithmetic-only (mulberry32 + a sum of twelve
 * uniforms), so the recording is bit-identical on the server and in every
 * browser: the server-rendered t = 0 frame hydrates without a mismatch.
 */

import {
  DETECTOR,
  NOISE,
  PHYSICS,
  type PhaseId,
  type ThrowStats,
} from "@/content/demos/telemetry";

export interface Sample {
  /** Sample time, s */
  t: number;
  /** Horizontal position, m — 0 at the release point */
  x: number;
  /** Height of the ball's centre, m */
  h: number;
  /** Measured |linear acceleration|, g — gravity excluded, noise included */
  accelG: number;
  /** Measured spin rate, rpm — noise included */
  gyroRpm: number;
  /** Noise-free spin rate, rpm — drives the seam and the readout */
  spinRpm: number;
  /** Accumulated spin angle, degrees — the seam's rotation */
  spinDeg: number;
  /** Speed of the ball, m/s */
  speedMps: number;
  /** Phase the pipeline reports for this sample */
  phase: PhaseId;
}

export interface PhaseSpan {
  id: PhaseId;
  /** Start time, s (inclusive) */
  start: number;
  /** End time, s (exclusive) */
  end: number;
}

export interface Recording {
  /** Sample period, s */
  dt: number;
  samples: Sample[];
  /** Contiguous phase intervals, in timeline order */
  phases: PhaseSpan[];
  /** Event times, s */
  release: number;
  apex: number;
  impact: number;
  /** When the stillness gate re-engages after impact */
  still: number;
  /** Time of the last sample */
  end: number;
  stats: ThrowStats;
}

/* ── Seeded noise ─────────────────────────────────────────────────────── */

/** mulberry32: a 32-bit seeded PRNG, uniform in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard normal via the sum of twelve uniforms (Irwin–Hall): mean 0,
 * variance 1, and no transcendental functions — the samples come out
 * bit-identical on every JS engine, unlike Box–Muller.
 */
function gaussian(uniform: () => number): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += uniform();
  return sum - 6;
}

/* ── The model ─────────────────────────────────────────────────────────── */

/** Smoothstep 0 → 1 over `rise` seconds, then held at 1. */
function windupShape(t: number, rise: number): number {
  const u = Math.min(t / rise, 1);
  return u * u * (3 - 2 * u);
}

export function simulateThrow(): Recording {
  const P = PHYSICS;
  const dt = 1 / P.sampleHz;
  const g = P.g;
  const angle = (P.launchAngleDeg * Math.PI) / 180;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);

  const uniform = mulberry32(NOISE.seed);
  const accelSigmaG = NOISE.accelSigmaMps2 / g;
  const gyroSigmaRpm = NOISE.gyroSigmaDps / 6; //  °/s → rpm

  const samples: Sample[] = [];
  let t = 0;
  let spinDeg = 0;

  /** Append one sample: measured values from the true ones, spin integrated. */
  const push = (
    x: number,
    h: number,
    accelMps2: number,
    spinRpm: number,
    speedMps: number,
    phase: PhaseId
  ) => {
    spinDeg += spinRpm * 6 * dt; //  rpm → °/s, integrated
    samples.push({
      t,
      x,
      h,
      accelG: Math.max(0, accelMps2 / g + accelSigmaG * gaussian(uniform)),
      gyroRpm: spinRpm + gyroSigmaRpm * gaussian(uniform),
      spinRpm,
      spinDeg,
      speedMps,
      phase,
    });
    t += dt;
  };

  /* Wind-up: the hand pushes the ball along the launch direction with a
     smoothstep-then-hold acceleration. Its peak is scaled so the discrete
     integral (the same midpoint sum the loop below uses) lands exactly on
     the release speed. Integrating it backwards fixes where the ball
     starts, so the still phase can be placed before the wind-up. */
  const windupSamples = Math.round(P.windupSec * P.sampleHz);
  const rise = P.windupRiseFraction * P.windupSec;
  let shapeIntegral = 0;
  for (let i = 0; i < windupSamples; i++) shapeIntegral += windupShape((i + 0.5) * dt, rise) * dt;
  const pushPeak = P.releaseSpeedMps / shapeIntegral;

  const windupSpeed: number[] = [];
  const windupTravel: number[] = [];
  let v = 0;
  let s = 0;
  for (let i = 0; i < windupSamples; i++) {
    v += pushPeak * windupShape((i + 0.5) * dt, rise) * dt;
    s += v * dt;
    windupSpeed.push(v);
    windupTravel.push(s);
  }
  const startX = -s * ux;
  const startH = P.releaseHeightM - s * uy;

  /* Still: the ball waits in the hand. */
  const stillSamples = Math.round(P.stillSec * P.sampleHz);
  for (let i = 0; i < stillSamples; i++) push(startX, startH, 0, 0, 0, "still");

  /* Wind-up: spin is imparted in proportion to the speed the hand has built. */
  for (let i = 0; i < windupSamples; i++) {
    const accel = pushPeak * windupShape((i + 0.5) * dt, rise);
    push(
      startX + windupTravel[i] * ux,
      startH + windupTravel[i] * uy,
      accel,
      P.backspinRpm * (windupSpeed[i] / P.releaseSpeedMps),
      windupSpeed[i],
      "windup"
    );
  }

  /* Flight: closed-form projectile from the release state; the fused
     linear acceleration is the 1 g of gravity, and the spin bleeds off
     slowly. The release event stays lit for the detector's latch time. */
  const release = t;
  const vx = P.releaseSpeedMps * ux;
  const vy0 = P.releaseSpeedMps * uy;
  const apex = release + vy0 / g;
  const apexM = P.releaseHeightM + (vy0 * vy0) / (2 * g);
  let tau = 0;
  for (;;) {
    const h = P.releaseHeightM + vy0 * tau - 0.5 * g * tau * tau;
    if (tau > 0 && h <= P.impactHeightM) break;
    const vy = vy0 - g * tau;
    push(
      vx * tau,
      h,
      g,
      P.backspinRpm * Math.exp(-tau / P.spinDecayTauSec),
      Math.hypot(vx, vy),
      tau < DETECTOR.releaseLatchSec ? "release" : "flight"
    );
    tau += dt;
  }

  /* Impact: a half-sine pulse while spin and speed taper to the settle residual. */
  const impact = t;
  const rangeM = vx * tau;
  const impactSpeed = Math.hypot(vx, vy0 - g * tau);
  const spinAtImpact = samples[samples.length - 1].spinRpm;
  const pulseSamples = Math.round(P.impactDurationSec * P.sampleHz);
  const residualSpin = spinAtImpact * P.settle.spinFraction;
  const residualSpeed = impactSpeed * P.settle.speedFraction;
  for (let i = 0; i < pulseSamples; i++) {
    const u = (i + 0.5) / pulseSamples;
    push(
      rangeM,
      P.impactHeightM,
      P.impactPeakG * g * Math.sin(Math.PI * u),
      spinAtImpact + (residualSpin - spinAtImpact) * u,
      impactSpeed + (residualSpeed - impactSpeed) * u,
      "impact"
    );
  }

  /* Settle: the residual decays until the stillness gate (on the true
     values — the noise sits an order of magnitude under both thresholds)
     re-engages, then a short hold of confirmed stillness. */
  let still = -1;
  for (let k = 0; ; k++) {
    const decay = Math.exp((-k * dt) / P.settleTauSec);
    const accel = P.settle.accelG * g * decay;
    const spin = residualSpin * decay;
    const isStill = accel / g < DETECTOR.stillAccelG && spin < DETECTOR.stillGyroRpm;
    if (isStill && still < 0) still = t;
    push(rangeM, P.impactHeightM, accel, spin, residualSpeed * decay, isStill ? "rest" : "impact");
    if (still >= 0 && t - still >= P.holdSec) break;
  }

  /* Phase spans and the headline numbers. */
  const phases: PhaseSpan[] = [];
  for (const sample of samples) {
    const last = phases[phases.length - 1];
    if (last && last.id === sample.phase) last.end = sample.t + dt;
    else phases.push({ id: sample.phase, start: sample.t, end: sample.t + dt });
  }

  return {
    dt,
    samples,
    phases,
    release,
    apex,
    impact,
    still,
    end: samples[samples.length - 1].t,
    stats: {
      releaseSpeedMps: P.releaseSpeedMps,
      launchAngleDeg: P.launchAngleDeg,
      backspinRpm: P.backspinRpm,
      flightSec: impact - release,
      apexM,
      rangeM,
      impactSpeedMps: impactSpeed,
      impactPeakG: P.impactPeakG,
      impactMs: Math.round(P.impactDurationSec * 1000),
      settleSec: still - impact,
    },
  };
}
