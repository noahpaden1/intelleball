/**
 * WebGL surface concurrency governor (design spec §2.2).
 *
 * A module-singleton arbiter that caps how many shader surfaces render per
 * frame: 2 on desktop fine-pointer viewports (only during the Deck A seam
 * do two overlap), 1 everywhere else. Belt-and-braces — page geometry
 * already keeps hero and noise non-co-visible; the governor's real job is
 * the brief hero↔grid overlap while PillarsStory covers the hero.
 *
 * SSR-safe: no browser API at module scope; `maxActive` is computed lazily
 * inside requestActive(), which is only ever called from a RAF tick.
 */

/** Per-surface handle returned by {@link registerSurface}. */
export interface GovernorHandle {
  /** Feed the latest intersectionRatio from the surface's IntersectionObserver. */
  setRatio(r: number): void;
  /** Call once per RAF tick: "may I render this frame?" */
  requestActive(): boolean;
  /** MUST be called on unmount/dispose. Idempotent. */
  release(): void;
}

interface Entry {
  ratio: number;
  order: number; // registration order — tiebreaker for equal ratios
}

const surfaces = new Map<string, Entry>();
let orderCounter = 0;

/** Concurrency cap, computed lazily per call (viewport class can't change mid-session enough to matter). */
function maxActive(): number {
  return window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 768 ? 2 : 1;
}

/**
 * Register a shader surface with the governor.
 *
 * Re-registering an existing `id` (HMR, leaked handle) replaces the stale
 * entry — the old handle goes inert rather than permanently occupying a
 * render slot — and logs a dev-mode warning.
 */
export function registerSurface(id: string): GovernorHandle {
  if (surfaces.has(id) && process.env.NODE_ENV !== "production") {
    console.warn(`glGovernor: surface "${id}" re-registered — replacing stale entry`);
  }
  const entry: Entry = { ratio: 0, order: orderCounter++ };
  surfaces.set(id, entry);
  let released = false;

  // Every method guards on `surfaces.get(id) === entry` so a stale handle
  // (replaced by a re-registration) can never mutate or win a slot.
  return {
    setRatio(r) {
      if (!released && surfaces.get(id) === entry) entry.ratio = r;
    },
    requestActive() {
      if (released || surfaces.get(id) !== entry) return false;
      const cap = maxActive();
      let rank = 0; // surfaces strictly ahead of us: higher ratio, or same ratio registered earlier
      for (const other of surfaces.values()) {
        if (other === entry) continue;
        if (other.ratio > entry.ratio || (other.ratio === entry.ratio && other.order < entry.order)) {
          rank++;
        }
      }
      return rank < cap;
    },
    release() {
      if (released) return;
      released = true;
      if (surfaces.get(id) === entry) surfaces.delete(id);
    },
  };
}
