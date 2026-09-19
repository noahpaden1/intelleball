/**
 * Deterministic demo telemetry for the dashboard.
 *
 * The real ingest path (roadmap: "Telemetry link") is not built yet, so
 * every number on the dashboard is generated here from a seed derived from
 * the signed-in user's email — stable across reloads, different per
 * account, and physically consistent: apex height and hang time follow
 * from the release angle and speed through the same projectile equations
 * the Flight showcase uses. Labelled as simulated wherever it is shown.
 */

export interface ThrowRecord {
  id: number;
  /** Unix ms, anchored to the `now` passed at generation time. */
  at: number;
  spinRpm: number;
  releaseMps: number;
  angleDeg: number;
  apexM: number;
  hangS: number;
  impactG: number;
}

export interface DeviceStatus {
  batteryPct: number;
  rssiDbm: number;
  lastSyncMs: number;
}

export interface DemoSession {
  throws: ThrowRecord[];
  avgSpinRpm: number;
  peakReleaseMps: number;
  bestAngleDeg: number;
  device: DeviceStatus;
}

const G = 9.81;
/** Release height above the ground (m) — matches the showcases. */
export const RELEASE_HEIGHT_M = 2.0;
/** Height at which a throw is considered caught / landed (m). */
export const CATCH_HEIGHT_M = 0.3;

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

/** Apex height and hang time for a release at `angleDeg` / `speed` (no drag). */
export function flightStats(angleDeg: number, speed: number) {
  const vy = speed * Math.sin((angleDeg * Math.PI) / 180);
  const apexM = RELEASE_HEIGHT_M + (vy * vy) / (2 * G);
  // y(t) = h + vy·t − g·t²/2 = CATCH_HEIGHT → positive root
  const drop = RELEASE_HEIGHT_M - CATCH_HEIGHT_M;
  const hangS = (vy + Math.sqrt(vy * vy + 2 * G * drop)) / G;
  return { apexM, hangS };
}

/**
 * Build one session of `count` throws ending a couple of minutes before
 * `now`, spaced 60–150 s apart.
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
    const spinRpm = clamp(150 + gaussian(rand) * 22, 90, 220);
    const releaseMps = clamp(7.5 + gaussian(rand) * 0.6, 5.5, 9.5);
    const angleDeg = clamp(48 + gaussian(rand) * 3.5, 36, 60);
    const { apexM, hangS } = flightStats(angleDeg, releaseMps);
    return {
      id: i + 1,
      at,
      spinRpm: Math.round(spinRpm),
      releaseMps: round(releaseMps, 1),
      angleDeg: round(angleDeg, 1),
      apexM: round(apexM, 2),
      hangS: round(hangS, 2),
      impactG: round(clamp(5.2 + gaussian(rand) * 0.8, 3, 8), 1),
    };
  });

  const avgSpinRpm = Math.round(throws.reduce((s, r) => s + r.spinRpm, 0) / throws.length);
  const peakReleaseMps = Math.max(...throws.map((r) => r.releaseMps));
  const bestAngleDeg = throws.reduce(
    (best, r) => (Math.abs(r.angleDeg - 48) < Math.abs(best - 48) ? r.angleDeg : best),
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
