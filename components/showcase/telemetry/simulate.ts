/**
 * The simulated recording behind the kick replay.
 *
 * One kick, sampled at the BNO055's real 100 Hz output rate: a ball still
 * on the ground, a half-sine kick impulse, a drag-free projectile flight
 * from the state at the foot, a half-sine bounce pulse, a steady roll-out
 * and rest. What the sensor would report is derived from that motion —
 * linear acceleration excludes gravity (a ball on the ground reads 0 g, a
 * ball in free flight reads 1 g) and is clipped at the accelerometer's
 * widest ±16 g setting, so the kick's hundreds of g read as a flat top at
 * the ceiling; angular rate is the spin (backspin in flight, then the forward
 * roll after the bounce) — with seeded Gaussian measurement noise on both.
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
  type KickStats,
  type PhaseId,
} from "@/content/demos/telemetry";

export interface Sample {
  /** Sample time, s */
  t: number;
  /** Horizontal position, m — 0 where the ball leaves the foot */
  x: number;
  /** Height of the ball's centre, m */
  h: number;
  /** Measured |linear acceleration|, g — gravity excluded, noise included, clipped at the ceiling */
  accelG: number;
  /** Measured spin rate, rpm — noise included */
  gyroRpm: number;
  /** Noise-free spin rate, rpm — drives the readout */
  spinRpm: number;
  /** Accumulated spin angle, degrees — the seam's rotation (positive = backspin) */
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
  kick: number;
  /** When the ball leaves the foot */
  release: number;
  apex: number;
  /** When the ball meets the ground */
  bounce: number;
  /** When the stillness gate re-engages after the roll-out */
  still: number;
  /** Time of the last sample */
  end: number;
  stats: KickStats;
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

/** Half-sine pulse shape over `samples` samples, evaluated at sample i's midpoint. */
function halfSine(i: number, samples: number): number {
  return Math.sin((Math.PI * (i + 0.5)) / samples);
}

export function simulateKick(): Recording {
  const P = PHYSICS;
  const dt = 1 / P.sampleHz;
  const g = P.g;
  const R = P.ballRadiusM;
  const angle = (P.launchAngleDeg * Math.PI) / 180;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);

  const uniform = mulberry32(NOISE.seed);
  const accelSigmaG = NOISE.accelSigmaMps2 / g;
  const gyroSigmaRpm = NOISE.gyroSigmaDps / 6; //  °/s → rpm

  /** A rolling ball turns at v / r: m/s → rpm. */
  const rollRpm = (speedMps: number) => (speedMps / (2 * Math.PI * R)) * 60;

  const samples: Sample[] = [];
  let t = 0;
  let spinDeg = 0;

  /**
   * Append one sample: measured values from the true ones, spin integrated.
   * `signedSpinRpm` is positive for backspin and negative for the forward
   * roll; the sensor and the readout only ever see its magnitude.
   */
  const push = (
    x: number,
    h: number,
    accelMps2: number,
    signedSpinRpm: number,
    speedMps: number,
    phase: PhaseId
  ) => {
    spinDeg += signedSpinRpm * 6 * dt; //  rpm → °/s, integrated
    const spinRpm = Math.abs(signedSpinRpm);
    samples.push({
      t,
      x,
      h,
      accelG: Math.min(P.accelCeilingG, Math.max(0, accelMps2 / g + accelSigmaG * gaussian(uniform))),
      gyroRpm: spinRpm + gyroSigmaRpm * gaussian(uniform),
      spinRpm,
      spinDeg,
      speedMps,
      phase,
    });
    t += dt;
  };

  /* The kick: the foot pushes the ball along the launch direction with a
     half-sine acceleration. Its peak is scaled so the discrete integral
     (the same midpoint sum the loop below uses) lands exactly on the ball
     speed. Integrating it backwards fixes where the ball starts, so the
     still phase can be placed before the kick. The centre cannot go below
     one radius, so the kick's short travel runs along the ground. */
  const kickSamples = Math.round(P.kickDurationSec * P.sampleHz);
  let shapeIntegral = 0;
  for (let i = 0; i < kickSamples; i++) shapeIntegral += halfSine(i, kickSamples) * dt;
  const pushPeak = P.ballSpeedMps / shapeIntegral;

  const kickSpeed: number[] = [];
  const kickTravel: number[] = [];
  let v = 0;
  let s = 0;
  for (let i = 0; i < kickSamples; i++) {
    v += pushPeak * halfSine(i, kickSamples) * dt;
    s += v * dt;
    kickSpeed.push(v);
    kickTravel.push(s);
  }
  const startX = -s * ux;

  /* Still: the ball sits on the ground. */
  const stillSamples = Math.round(P.stillSec * P.sampleHz);
  for (let i = 0; i < stillSamples; i++) push(startX, R, 0, 0, 0, "still");

  /* Kick: spin is imparted in proportion to the speed the foot has built. */
  const kick = t;
  for (let i = 0; i < kickSamples; i++) {
    push(
      startX + kickTravel[i] * ux,
      R,
      pushPeak * halfSine(i, kickSamples),
      P.spinRpm * (kickSpeed[i] / P.ballSpeedMps),
      kickSpeed[i],
      "kick"
    );
  }

  /* Flight: closed-form projectile from the state at the foot; the fused
     linear acceleration is the 1 g of gravity, and the spin bleeds off
     slowly. The kick event stays lit for the detector's latch time. The
     landing is taken from the same closed form — touchdown falls between
     two samples, so the sampled loop only draws the samples still in the
     air and the headline numbers do not carry a sample's worth of error. */
  const release = t;
  const vx = P.ballSpeedMps * ux;
  const vy0 = P.ballSpeedMps * uy;
  const apex = release + vy0 / g;
  const apexM = R + (vy0 * vy0) / (2 * g);
  const flightSec = (2 * vy0) / g;
  const rangeM = vx * flightSec;
  const landingSpeed = Math.hypot(vx, vy0 - g * flightSec);
  for (let i = 0; i * dt < flightSec; i++) {
    const tau = i * dt;
    const h = R + vy0 * tau - 0.5 * g * tau * tau;
    const vy = vy0 - g * tau;
    push(
      vx * tau,
      h,
      g,
      P.spinRpm * Math.exp(-tau / P.spinDecayTauSec),
      Math.hypot(vx, vy),
      tau < DETECTOR.kickLatchSec ? "kick" : "flight"
    );
  }

  /* Bounce: a half-sine pulse, capped by the ceiling like everything else,
     while the speed drops to the roll-out's and the backspin reverses into
     the forward roll (friction with the ground does that in one contact).
     Its first sample sits exactly where the ball lands. */
  const bounce = t;
  const spinAtLanding = samples[samples.length - 1].spinRpm;
  const pulseSamples = Math.round(P.bounce.durationSec * P.sampleHz);
  const rollSpeed0 = landingSpeed * P.bounce.speedFraction;
  let x = rangeM;
  for (let i = 0; i < pulseSamples; i++) {
    const u = (i + 0.5) / pulseSamples;
    const speed = landingSpeed + (rollSpeed0 - landingSpeed) * u;
    push(x, R, P.bounce.peakG * g * halfSine(i, pulseSamples), spinAtLanding - (spinAtLanding + rollRpm(rollSpeed0)) * u, speed, "bounce");
    x += speed * dt;
  }

  /* Roll-out: steady deceleration until the ball stops. The accelerometer
     alone would pass the stillness gate here — rolling drag is under its
     threshold — so it is the gyro, reading the roll at v / r, that holds
     the gate open (on the true values: the noise sits an order of magnitude
     under both thresholds). Then a short hold of confirmed stillness. */
  const decel = P.roll.decelG * g;
  let still = -1;
  for (let k = 0; ; k++) {
    const speed = Math.max(0, rollSpeed0 - decel * k * dt);
    const accel = speed > 0 ? decel : 0;
    const spin = rollRpm(speed);
    const isStill = accel / g < DETECTOR.stillAccelG && spin < DETECTOR.stillGyroRpm;
    if (isStill && still < 0) still = t;
    x += speed * dt;
    push(
      x,
      R,
      accel,
      -spin,
      speed,
      t - bounce < DETECTOR.bounceLatchSec ? "bounce" : isStill ? "rest" : "roll"
    );
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
    kick,
    release,
    apex,
    bounce,
    still,
    end: samples[samples.length - 1].t,
    stats: {
      ballSpeedMps: P.ballSpeedMps,
      launchAngleDeg: P.launchAngleDeg,
      spinRpm: P.spinRpm,
      kickPeakG: pushPeak / g,
      ceilingG: P.accelCeilingG,
      kickMs: Math.round(kickSamples * dt * 1000),
      flightSec,
      apexM,
      rangeM,
      landingSpeedMps: landingSpeed,
      bouncePeakG: P.bounce.peakG,
      bounceMs: Math.round(P.bounce.durationSec * 1000),
      rollSec: still - bounce,
      rollM: x - rangeM,
    },
  };
}
