"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import type { SensorRow } from "@/lib/supabase";
import type { FeedStatus, SensorFeed } from "@/lib/useSensorFeed";
import { cn } from "@/lib/utils";
import { live, type GroupSpec } from "@/content/live";
import { LiveTrace } from "./LiveTrace";

/**
 * The live panel: the newest sensor_data row, verbatim, with a status
 * pill, a mono meta line, the nine axes in three groups, the derived |v|
 * and |a|, and the |a| sparkline over the last 120 rows.
 *
 * Every state renders the same layout — "—" where a value is missing — so
 * nothing shifts when the feed connects, empties, or drops. The only thing
 * that changes between polls is text; the only thing that ticks between
 * polls is the row's age, written straight to its span (no React state) at
 * 4 Hz, or 1 Hz under reduced motion. Numbers are never ellipsised: the
 * axis cells are sized for the widest value `fmt` can produce, and the
 * groups stack below lg so three-by-three never squeezes a cell.
 */

interface LiveSensorPanelProps {
  feed: SensorFeed;
}

/**
 * At most six characters ("-99.99", "-123.4", "-1234"), or the dash for a
 * missing field — decimals give way as the magnitude grows so the widest
 * value still fits the narrowest axis cell.
 */
function fmt(v: number | null | undefined): string {
  if (typeof v !== "number") return live.nullValue;
  // Thresholds sit on the rounding boundary so -99.995 → "-100.0", not "-100.00".
  const abs = Math.abs(v);
  return v.toFixed(abs < 99.995 ? 2 : abs < 999.95 ? 1 : 0);
}

/** Vector magnitude, null if any component is missing. */
function magnitude(a: number | null, b: number | null, c: number | null): number | null {
  return a === null || b === null || c === null ? null : Math.hypot(a, b, c);
}

/** |a| for one row, for the sparkline; null-safe. */
export function accelMagnitude(row: SensorRow): number | null {
  return magnitude(row.ax, row.ay, row.az);
}

/** "16:39:09.326" in the visitor's locale, 24 h. */
function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return live.nullValue;
  const hms = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return `${hms}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

/**
 * Age with its unit: tenths of a second under a minute ("1.2s"), then whole
 * minutes, hours or days ("3m", "2h", "3d") — never "259200s".
 */
function formatAge(ms: number): string {
  const s = Math.max(0, ms / 1000);
  const u = live.meta.units;
  if (s < 60) return `${s.toFixed(1)}${u.s}`;
  if (s < 3600) return `${Math.floor(s / 60)}${u.m}`;
  if (s < 86_400) return `${Math.floor(s / 3600)}${u.h}`;
  return `${Math.floor(s / 86_400)}${u.d}`;
}

export function LiveSensorPanel({ feed }: LiveSensorPanelProps) {
  const reduced = usePrefersReducedMotion();
  const { latest, history, status, error, clockOffsetMs } = feed;

  const speed = latest ? magnitude(latest.vx, latest.vy, latest.vz) : null;
  const accel = latest ? magnitude(latest.ax, latest.ay, latest.az) : null;

  // Sparkline input: rows with a complete acceleration vector only.
  const trace = history.flatMap((row) => {
    const v = accelMagnitude(row);
    return v === null ? [] : [{ v, id: row.id, at: Date.parse(row.created_at) }];
  });

  // The line always carries house copy; the raw fetch/HTTP message rides
  // along as a tooltip so it is still there for whoever is debugging.
  const note = live.status[status].note;
  const noteTitle = status === "error" && error ? error : undefined;

  return (
    <section className="relative overflow-hidden rounded-card border border-line bg-surface p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--gradient-panel-sheen)" }}
      />
      <div className="relative">
        {/* Header: eyebrow + title, status pill, meta line */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div>
            <p className="font-mono text-eyebrow uppercase text-ink-dim">{live.eyebrow}</p>
            <h2 className="mt-2 text-[15px] font-semibold tracking-tight text-ink">{live.title}</h2>
          </div>
          <StatusPill status={status} />
        </div>
        <p className="mt-3 font-mono text-caption tabular-nums text-ink-dim">
          {latest ? (
            <>
              {live.meta.row}
              {latest.id} · {formatStamp(latest.created_at)} ·{" "}
              <Age createdAt={latest.created_at} offsetMs={clockOffsetMs} reduced={reduced} />
              {live.meta.ago}
            </>
          ) : (
            live.meta.none
          )}
        </p>
        <p
          title={noteTitle}
          className={cn("mt-1 text-caption", status === "error" ? "text-rose" : "text-ink-dim")}
        >
          {note}
        </p>

        {/* The nine axes — one group per row until lg, where three fit */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {live.groups.map((group) => (
            <Group key={group.id} group={group} row={latest} />
          ))}
        </div>

        {/* Derived magnitudes — stacked on phones so the eyebrow never
            becomes the card's min-content */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Magnitude
            symbol={live.magnitudes.speed.symbol}
            label={live.magnitudes.speed.label}
            unit={live.magnitudes.speed.unit}
            value={speed}
          />
          <Magnitude
            symbol={live.magnitudes.accel.symbol}
            label={live.magnitudes.accel.label}
            unit={live.magnitudes.accel.unit}
            value={accel}
          />
        </div>

        {/* |a| over the history */}
        <div className="mt-6">
          <p className="flex items-center justify-between text-caption text-ink-dim">
            <span>{live.sparkline.label}</span>
            <span className="font-mono">
              {live.sparkline.caption} · {live.sparkline.unit}
            </span>
          </p>
          <div className="mt-2 rounded-panel border border-line bg-raised/50 px-3 pb-2 pt-3">
            <LiveTrace
              samples={trace.map((p) => p.v)}
              meta={trace.map((p) => ({ id: p.id, at: p.at }))}
            />
          </div>
        </div>

        <p className="sr-only">
          {live.srSummary({
            status: live.status[status].label,
            speed,
            accel,
            rowId: latest ? latest.id : null,
          })}
        </p>
        <p className="mt-5 text-caption text-ink-dim">{live.footnote}</p>
      </div>
    </section>
  );
}

/**
 * The row's age, ticking without touching React: one interval writes
 * textContent into the span. The server/first render shows the dash; the
 * effect overwrites it immediately after mount. `offsetMs` (server clock
 * minus viewer clock, from the feed) keeps the number honest on a machine
 * whose clock is off.
 */
function Age({
  createdAt,
  offsetMs,
  reduced,
}: {
  createdAt: string;
  offsetMs: number;
  reduced: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const at = Date.parse(createdAt);
    if (Number.isNaN(at)) {
      node.textContent = live.nullValue;
      return;
    }
    const write = () => {
      node.textContent = formatAge(Date.now() + offsetMs - at);
    };
    write();
    const id = setInterval(write, reduced ? 1000 : 250);
    return () => clearInterval(id);
  }, [createdAt, offsetMs, reduced]);

  return <span ref={ref}>{live.nullValue}</span>;
}

const PILL: Record<FeedStatus, { pill: string; dot: string; pulse: boolean }> = {
  connecting: { pill: "border-line bg-raised text-ink-dim", dot: "bg-ink-dim", pulse: true },
  live: { pill: "border-mint/30 bg-mint/10 text-mint", dot: "bg-mint", pulse: true },
  stale: { pill: "border-line bg-raised text-ink-dim", dot: "bg-ink-dim", pulse: false },
  empty: { pill: "border-line bg-raised text-ink-dim", dot: "bg-ink-dim", pulse: false },
  error: { pill: "border-rose/30 bg-rose/10 text-rose", dot: "bg-rose", pulse: false },
};

function StatusPill({ status }: { status: FeedStatus }) {
  const look = PILL[status];
  return (
    <span
      className={cn(
        "flex items-center gap-2 rounded-pill border px-3 py-1 text-caption",
        look.pill
      )}
    >
      {/* Opacity-only pulse (compositor); stilled under reduced motion */}
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          look.dot,
          look.pulse && "animate-pulse motion-reduce:animate-none"
        )}
      />
      {live.status[status].label}
    </span>
  );
}

function Group({ group, row }: { group: GroupSpec; row: SensorRow | null }) {
  return (
    <div className="rounded-panel border border-line bg-raised/40 px-5 py-4">
      <p className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-eyebrow uppercase text-ink-dim">{group.label}</span>
        <span className="font-mono text-caption text-ink-dim">{group.unit}</span>
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {group.axes.map((axis) => (
          <div key={axis.key} className="min-w-0">
            {/* Six mono characters at text-body fit the narrowest cell
                (≈73 px at lg); text-lead only once the cell has room */}
            <p className="font-mono text-body tabular-nums tracking-tight text-ink xl:text-lead">
              {fmt(row ? row[axis.key] : null)}
            </p>
            <p className="mt-1 text-caption text-ink-dim">{axis.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Magnitude({
  symbol,
  label,
  unit,
  value,
}: {
  symbol: string;
  label: string;
  unit: string;
  value: number | null;
}) {
  return (
    <div className="rounded-panel border border-line bg-raised/40 px-5 py-4">
      <p className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-eyebrow uppercase text-ink-dim">
          {symbol} · {label}
        </span>
        <span className="shrink-0 font-mono text-caption text-ink-dim">{unit}</span>
      </p>
      <p className="mt-3 font-mono text-title tabular-nums tracking-tight text-ink">
        {fmt(value)}
      </p>
    </div>
  );
}
