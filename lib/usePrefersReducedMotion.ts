"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Hydration-safe prefers-reduced-motion.
 *
 * framer-motion's useReducedMotion() returns null on the server but the
 * real matchMedia value synchronously on the first client render — so
 * branching SSR-rendered *structure* on it breaks hydration for
 * reduced-motion users. This hook returns `false` for both the server
 * render and the hydration render (getServerSnapshot), then flips to the
 * real preference immediately after mount. Use it for any branch that
 * changes rendered structure; framer's hook remains fine for style-level
 * tweaks.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
