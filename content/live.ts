/**
 * Live sensor feed — every word the dashboard's live panel renders.
 *
 * The panel (components/dashboard/LiveSensorPanel.tsx) reads the ball's
 * Supabase table — the ingest path will write IMU samples into it; today
 * it is populated by hand for testing — and shows the newest row verbatim;
 * nothing here is simulated. Units are the firmware's convention: position
 * in metres, velocity in m/s, acceleration in m/s². To change what the
 * panel says, edit here, not in components/.
 */

import type { SensorAxis } from "@/lib/supabase";
import type { FeedStatus } from "@/lib/useSensorFeed";

// ─── Types ────────────────────────────────────────────────────────────────

export type GroupId = "position" | "velocity" | "acceleration";

export interface AxisSpec {
  key: SensorAxis;
  /** Short axis name shown under the value, e.g. "x" or "vₓ" */
  label: string;
}

export interface GroupSpec {
  id: GroupId;
  label: string;
  unit: string;
  axes: [AxisSpec, AxisSpec, AxisSpec];
}

export interface StatusCopy {
  /** Pill text */
  label: string;
  /** One line under the header (the raw error message goes in its title) */
  note: string;
}

// ─── Copy ─────────────────────────────────────────────────────────────────

export const live = {
  eyebrow: "Live feed",
  title: "Ball telemetry",
  /** Rendered wherever a sensor field is null or no row exists yet. */
  nullValue: "—",

  groups: [
    {
      id: "position",
      label: "Position",
      unit: "m",
      axes: [
        { key: "x", label: "x" },
        { key: "y", label: "y" },
        { key: "z", label: "z" },
      ],
    },
    {
      id: "velocity",
      label: "Velocity",
      unit: "m/s",
      axes: [
        { key: "vx", label: "vx" },
        { key: "vy", label: "vy" },
        { key: "vz", label: "vz" },
      ],
    },
    {
      id: "acceleration",
      label: "Acceleration",
      unit: "m/s²",
      axes: [
        { key: "ax", label: "ax" },
        { key: "ay", label: "ay" },
        { key: "az", label: "az" },
      ],
    },
  ] satisfies GroupSpec[],

  /** Derived magnitudes shown under the three groups. */
  magnitudes: {
    speed: { symbol: "|v|", label: "speed", unit: "m/s" },
    accel: { symbol: "|a|", label: "acceleration", unit: "m/s²" },
  },

  status: {
    connecting: { label: "Connecting", note: "Reaching the ball's feed." },
    live: { label: "Live", note: "The ball is reporting." },
    stale: { label: "Stale", note: "The newest sample is more than 10 s old." },
    empty: { label: "Waiting for data", note: "Waiting for the ball to send its first sample." },
    error: { label: "Offline", note: "The last read failed." },
  } satisfies Record<FeedStatus, StatusCopy>,

  /** Mono meta line under the title: "row #28 · 16:39:09.326 · 1.2s ago" */
  meta: {
    row: "row #",
    ago: " ago",
    /** Age units, appended to the number: 1.2s · 3m · 2h · 3d */
    units: { s: "s", m: "m", h: "h", d: "d" },
    /** Shown in place of the meta line before any row has arrived */
    none: "no row yet",
  },

  sparkline: {
    label: "|a| history",
    unit: "m/s²",
    caption: "last 120 rows",
    /** Tooltip line: "row #28 · 16:39:09" */
    tooltipRow: "row #",
  },

  /**
   * Screen-reader summary of the whole panel; keeps the SVG out of the
   * tree. Null magnitudes are spoken as "unavailable", never as the glyph.
   */
  srSummary: (s: {
    status: string;
    speed: number | null;
    accel: number | null;
    rowId: number | null;
  }) => {
    if (s.rowId === null) return `Live ball telemetry, status ${s.status}. No sample yet.`;
    const speed =
      s.speed === null ? "speed unavailable" : `speed ${s.speed.toFixed(2)} metres per second`;
    const accel =
      s.accel === null
        ? "acceleration unavailable"
        : `acceleration ${s.accel.toFixed(2)} metres per second squared`;
    return `Live ball telemetry, status ${s.status}. From row ${s.rowId}: ${speed}, ${accel}.`;
  },

  footnote: "Reads new rows of sensor_data every 0.5 s.",

  /** Device-card and greeting-pill states that follow the feed. */
  device: {
    connected: "Connected",
    connecting: "Connecting",
    /** Feed is reachable but the newest row is old: the ball is resting. */
    idle: "Idle",
    noSignal: "No signal",
    signalLabel: "Signal",
    lastSyncLabel: "Last sync",
    sampleRateLabel: "Sample rate",
    /** The firmware's loop target, not a measured rate. */
    sampleRate: "100 Hz · firmware target",
    simulatedNote:
      "Battery, RSSI and sample rate are nominal until the firmware reports them.",
  },
};

export type LiveCopy = typeof live;
