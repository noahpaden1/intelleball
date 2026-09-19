"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};
const clientYear = () => new Date().getFullYear();
const buildYear = () => 2026;

/**
 * The page is statically prerendered, so an inline new Date() would freeze
 * at build time. The server snapshot is a deterministic fallback; the
 * visitor's real year is read as an external value right after hydration.
 */
export function Year() {
  const year = useSyncExternalStore(subscribeNever, clientYear, buildYear);
  return <>{year}</>;
}
