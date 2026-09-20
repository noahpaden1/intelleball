/**
 * Deterministic demo telemetry for the dashboard.
 *
 * The real ingest path (roadmap: "Telemetry link") is not built yet, so
 * every number on the dashboard is generated here from a seed derived from
 * the signed-in user's email — stable across reloads, different per
 * account, and physically consistent: apex height and hang time follow
 * from the launch angle and ball speed through the same projectile
 * equations the Flight showcase uses. Labelled as simulated wherever it is
 * shown.
 */

/**
 * One kick. The type keeps its original name (and its `release*` field)
 * because the dashboard imports it; "release" here means the ball leaving
 * the foot.
 */
export interface ThrowRecord {
  id: number;
  /** Unix ms, anchored to the `now` passed at generation time. */
  at: number;
  spinRpm: number;
  /** Ball speed off the foot, m/s */
  releaseMps: number;
  angleDeg: number;
  apexM: number;
  hangS: number;
  /** Peak of the ground bounce, g — capped at the ±16 g full scale the ball will run at */
  impactG: number;
}

export interface DeviceStatus {
  batteryPct: number;
  rssiDbm: number;
  lastSyncMs: number;
}

export interface DemoSession {
  /** The session's kicks, oldest first — the field name is part of the dashboard's contract. */
  throws: ThrowRecord[];
  avgSpinRpm: number;
  peakReleaseMps: number;
  bestAngleDeg: number;
  device: DeviceStatus;
}

const G = 9.81;
/**
 * Height of the ball's centre at the kick, m: one ball radius, a ball
 * kicked off the ground — matches the showcases.
 */
export const RELEASE_HEIGHT_M = 0.11;
/** Height of the ball's centre when it lands back on the ground, m (the same radius). */
export const CATCH_HEIGHT_M = 0.11;
/**
 * Accelerometer ceiling, g: the BNO055's widest ±16 g setting (datasheet),
 * the range the ball will run at — the current firmware leaves the ±4 g
 * default. A demo bounce reads no higher.
 */
const ACCEL_CEILING_G = 16;
/** Launch angle a driven shot is coached toward, degrees; "best angle" is the kick closest to it. */
const TARGET_ANGLE_DEG = 20;

const TAU = Math.PI * 2;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller on the seeded stream. */
function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, decimals: number) => {
  const k = 10 ** decimals;
  return Math.round(v * k) / k;
};

/** Apex height and hang time for a kick at `angleDeg` / `speed` (no drag, no Magnus). */
export function flightStats(angleDeg: number, speed: number) {
  const vy = speed * Math.sin((angleDeg * Math.PI) / 180);
  const apexM = RELEASE_HEIGHT_M + (vy * vy) / (2 * G);
  // y(t) = h + vy·t − g·t²/2 = CATCH_HEIGHT → positive root (2·vy/g when the heights match)
  const drop = RELEASE_HEIGHT_M - CATCH_HEIGHT_M;
  const hangS = (vy + Math.sqrt(vy * vy + 2 * G * drop)) / G;
  return { apexM, hangS };
}

/**
 * Build one session of `count` kicks ending a couple of minutes before
 * `now`, spaced 60–150 s apart. Ranges are a mix of driven shots and
 * lofted passes: 12–28 m/s off the foot, 8–35° of launch, 150–550 rpm.
 */
export function buildDemoSession(key: string, now: number, count = 12): DemoSession {
  const rand = mulberry32(fnv1a(key.trim().toLowerCase()));

  const times: number[] = [];
  let t = now - 120_000;
  for (let i = 0; i < count; i++) {
    times.unshift(t);
    t -= 60_000 + rand() * 90_000;
  }

  const throws: ThrowRecord[] = times.map((at, i) => {
    const spinRpm = clamp(330 + gaussian(rand) * 90, 150, 550);
    const releaseMps = clamp(19.5 + gaussian(rand) * 3.5, 12, 28);
    const angleDeg = clamp(20 + gaussian(rand) * 6, 8, 35);
    const { apexM, hangS } = flightStats(angleDeg, releaseMps);
    return {
      id: i + 1,
      at,
      spinRpm: Math.round(spinRpm),
      releaseMps: round(releaseMps, 1),
      angleDeg: round(angleDeg, 1),
      apexM: round(apexM, 2),
      hangS: round(hangS, 2),
      // The bounce: hard enough to brush the sensor's ceiling, never above it.
      impactG: round(clamp(12.5 + gaussian(rand) * 1.8, 8, ACCEL_CEILING_G), 1),
    };
  });

  const avgSpinRpm = Math.round(throws.reduce((s, r) => s + r.spinRpm, 0) / throws.length);
  const peakReleaseMps = Math.max(...throws.map((r) => r.releaseMps));
  const bestAngleDeg = throws.reduce(
    (best, r) =>
      Math.abs(r.angleDeg - TARGET_ANGLE_DEG) < Math.abs(best - TARGET_ANGLE_DEG) ? r.angleDeg : best,
    throws[0].angleDeg
  );

  return {
    throws,
    avgSpinRpm,
    peakReleaseMps,
    bestAngleDeg,
    device: {
      batteryPct: Math.round(62 + rand() * 34),
      rssiDbm: -Math.round(45 + rand() * 25),
      lastSyncMs: now - 8_000,
    },
  };
}

/** "14:02" in the visitor's locale, 24 h where that is the convention. */
export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** "Sat, Sep 19" — session date for the greeting row. */
export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function timeOfDayGreeting(ms: number): string {
  const h = new Date(ms).getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
