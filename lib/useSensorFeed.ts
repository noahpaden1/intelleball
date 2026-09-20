"use client";

import { useEffect, useState } from "react";
import { fetchNewSamples, type SensorRow } from "@/lib/supabase";

/**
 * Live feed from the ball: polls sensor_data every 0.5 s for rows newer
 * than the last one seen (the first poll takes the newest 120), so the
 * history really is the table's last 120 rows and nothing is re-read.
 *
 * A setTimeout chain rather than setInterval, so a slow request can never
 * overlap the next one. Pauses while the tab is hidden and resumes the
 * moment it returns; aborts the in-flight request on hide and on unmount.
 * Consecutive failures back off 0.5 s → 1 → 2 → 4 → 8 s and reset on the
 * next success, and the last good row stays on screen through an outage.
 *
 * Live vs stale is judged on the SERVER's clock (the response's Date
 * header), not the viewer's: a laptop a few seconds off after sleep would
 * otherwise flag every fresh row as stale. The same offset is exposed so
 * the age display can correct itself too.
 *
 * Every setState happens inside a fetch callback or timer — never
 * synchronously in the effect body — and nothing reads a ref during render,
 * so the hook is clean under the React Compiler lint rules. "Age" is not
 * computed here on purpose: it changes every frame, and the component that
 * shows it owns that tick.
 */

export const POLL_MS = 500;
const MAX_BACKOFF_MS = 8_000;
/** A row newer than this at poll time counts as live; older is stale. */
const LIVE_WINDOW_MS = 10_000;
/** Rows kept for the sparkline (distinct ids, oldest → newest). */
export const HISTORY_LENGTH = 120;

export type FeedStatus = "connecting" | "live" | "stale" | "empty" | "error";

export interface SensorFeed {
  latest: SensorRow | null;
  history: SensorRow[];
  status: FeedStatus;
  /** Message of the last failed poll; null once a poll succeeds again. */
  error: string | null;
  /** Unix ms of the last successful poll, on the viewer's clock. */
  lastFetchedAt: number | null;
  /** Server clock minus viewer clock, ms; 0 until the server has said. */
  clockOffsetMs: number;
}

const INITIAL: SensorFeed = {
  latest: null,
  history: [],
  status: "connecting",
  error: null,
  lastFetchedAt: null,
  clockOffsetMs: 0,
};

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "The request failed.";
}

/** Fold one successful poll into the feed state. */
function onBatch(
  prev: SensorFeed,
  rows: SensorRow[],
  serverNow: number | null,
  now: number
): SensorFeed {
  const clockOffsetMs = serverNow === null ? prev.clockOffsetMs : serverNow - now;
  const history = rows.length > 0 ? [...prev.history, ...rows].slice(-HISTORY_LENGTH) : prev.history;
  const latest = history.length > 0 ? history[history.length - 1] : null;
  if (!latest) {
    return { ...prev, latest, history, status: "empty", error: null, lastFetchedAt: now, clockOffsetMs };
  }
  const age = now + clockOffsetMs - Date.parse(latest.created_at);
  const status: FeedStatus = Number.isFinite(age) && age < LIVE_WINDOW_MS ? "live" : "stale";
  return { latest, history, status, error: null, lastFetchedAt: now, clockOffsetMs };
}

export function useSensorFeed(): SensorFeed {
  const [feed, setFeed] = useState<SensorFeed>(INITIAL);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let delay = POLL_MS;
    // Newest id folded in so far; the next poll asks only for rows above it.
    let lastId: number | null = null;

    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const schedule = (ms: number) => {
      if (disposed || document.hidden) return;
      timer = setTimeout(tick, ms);
    };

    const tick = async () => {
      timer = null;
      const own = new AbortController();
      controller = own;
      const { signal } = own;
      let wait = delay;
      try {
        const { rows, serverNow } = await fetchNewSamples(lastId, HISTORY_LENGTH, signal);
        if (disposed || signal.aborted) return;
        if (rows.length > 0) lastId = rows[rows.length - 1].id;
        delay = POLL_MS;
        wait = delay;
        const now = Date.now();
        setFeed((prev) => onBatch(prev, rows, serverNow, now));
      } catch (err) {
        // An abort is ours (hide / unmount), not a failure — no backoff.
        if (disposed || signal.aborted) return;
        // Retry after the current delay, then double it for the next miss.
        delay = Math.min(delay * 2, MAX_BACKOFF_MS);
        const error = messageOf(err);
        setFeed((prev) => ({ ...prev, status: "error", error }));
      } finally {
        // Only clear our own controller: a visibility flip may already have
        // started a newer tick.
        if (controller === own) controller = null;
      }
      schedule(wait);
    };

    const onVisibility = () => {
      if (document.hidden) {
        clearTimer();
        controller?.abort();
      } else if (timer === null && controller === null) {
        void tick();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    // The first poll runs even in a background tab, so the panel opens on
    // the last known row rather than "Connecting"; only the follow-ups pause.
    void tick();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimer();
      controller?.abort();
    };
  }, []);

  return feed;
}
