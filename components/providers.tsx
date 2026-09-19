"use client";

import { MotionConfig } from "framer-motion";

/**
 * Global client providers. MotionConfig honors the user's OS-level
 * prefers-reduced-motion setting across every animation on the site.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
