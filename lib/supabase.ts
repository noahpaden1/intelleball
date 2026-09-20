/**
 * Supabase — configuration and the one read the dashboard makes.
 *
 * The ingest path will write the ball's IMU samples into
 * `public.sensor_data` (today the table is populated by hand for testing);
 * the site only ever READS it. No client library: PostgREST is a plain GET
 * with two headers, and polling it beats a realtime subscription here
 * (zero dependencies, and it works whether or not the table is in the
 * realtime publication).
 *
 * The anon key is public by design — Supabase anon keys are meant to ship
 * in browser bundles; what the anon role may do is governed by Row Level
 * Security on the project. It should be SELECT-only on sensor_data. The
 * env vars override the documented fallbacks below (see .env.example); a
 * blank value counts as unset, hence `||` rather than `??`.
 *
 * SSR-safe: no browser API is touched at module scope.
 */

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvyzpgukzzchfbgdujmi.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2eXpwZ3VrenpjaGZiZ2R1am1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MTE5ODUsImV4cCI6MjEwNTE4Nzk4NX0.ZRf4qO4UcvnNlI3pu5EwUNNcHHa3y5fgUOm3aNfl89o";

const TABLE = "sensor_data";

/** Sensor column names, in display order. Units: m · m/s · m/s². */
export const SENSOR_AXES = ["x", "y", "z", "vx", "vy", "vz", "ax", "ay", "az"] as const;

export type SensorAxis = (typeof SENSOR_AXES)[number];

/** One row of public.sensor_data. Every sensor field is nullable. */
export interface SensorRow {
  id: number;
  /** timestamptz as an ISO string, e.g. "2026-09-19T23:39:09.326171+00:00" */
  created_at: string;
  x: number | null;
  y: number | null;
  z: number | null;
  vx: number | null;
  vy: number | null;
  vz: number | null;
  ax: number | null;
  ay: number | null;
  az: number | null;
}

/**
 * PostgREST serialises `numeric` as a JSON number, but a column cast or a
 * future schema tweak could hand back a string — accept either, and treat
 * anything non-finite (including null) as null so the UI renders "—".
 */
function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toRow(raw: Record<string, unknown>): SensorRow {
  const row = {
    id: Number(raw.id),
    created_at: String(raw.created_at ?? ""),
  } as SensorRow;
  for (const axis of SENSOR_AXES) row[axis] = toNumber(raw[axis]);
  return row;
}

/** One poll's worth of rows, plus the server's idea of "now". */
export interface SampleBatch {
  /** Rows newer than `afterId`, oldest → newest; empty when there are none. */
  rows: SensorRow[];
  /**
   * Unix ms from the response's `Date` header (Supabase exposes it to
   * browsers; 1 s resolution). Null if the header is missing or unparsable.
   */
  serverNow: number | null;
}

/**
 * Rows of sensor_data with `id` greater than `afterId` — or, when `afterId`
 * is null, simply the newest `limit` rows — so the caller can keep a
 * genuine "last N rows" history without re-reading rows it has. Throws on a
 * non-2xx response with the status in the message; an aborted request
 * rejects with the fetch's own AbortError, which callers can tell apart via
 * `signal.aborted`.
 */
export async function fetchNewSamples(
  afterId: number | null,
  limit: number,
  signal?: AbortSignal
): Promise<SampleBatch> {
  const filter = afterId === null ? "" : `&id=gt.${afterId}`;
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?select=*${filter}&order=id.desc&limit=${limit}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`Supabase responded ${res.status} ${res.statusText}`.trim());
  const dateHeader = res.headers.get("date");
  const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
  const serverNow = Number.isFinite(parsed) ? parsed : null;
  const body: unknown = await res.json();
  const rows = Array.isArray(body)
    ? body.map((raw) => toRow(raw as Record<string, unknown>)).reverse()
    : [];
  return { rows, serverNow };
}
