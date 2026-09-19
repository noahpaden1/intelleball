"use client";

import { useEffect, useRef } from "react";

/**
 * 1px spectrum-gradient page-progress hairline for the navbar's top edge.
 *
 * Self-contained: a passive scroll listener coalesced through rAF writes
 * `transform: scaleX(p)` directly on the node — no React state and no
 * framer scroll binding (immune to the prod-freeze class of bugs). The
 * denominator is re-read from the live document on every update, so resize
 * and content growth need no bookkeeping beyond a resize listener that
 * schedules the same update. Under reduced motion it still tracks — it is
 * feedback, not decoration (and there is no transition to suppress).
 */
export function ScrollProgressHairline() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      // Lazy denominator: current document values, every frame.
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      node.style.transform = `scaleX(${p})`;
    };

    const schedule = () => {
      if (rafId === null) rafId = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    schedule(); // initial position (e.g. reload mid-page, anchor arrival)

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="absolute inset-x-0 top-0 h-px origin-left"
      style={{
        background: "var(--gradient-spectrum)",
        transform: "scaleX(0)",
      }}
    />
  );
}
