"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  animate,
  useInView,
  useReducedMotion,
  type UseInViewOptions,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { dur, ease, reveal } from "@/lib/motion";

interface CountUpProps {
  /** Stat string, e.g. "<1 ms", "15.8M", "~2,850", "99.95%", "0.285 → 0.015" */
  value: string;
  className?: string;
  /** Seconds for the count; defaults to the slow hero duration */
  duration?: number;
}

interface ParsedValue {
  prefix: string;
  raw: string; //  the matched number, exactly as written
  suffix: string;
  target: number;
  decimals: number;
  grouped: boolean; //  had thousands separators
}

/** Find the LAST number in the string (handles "0.285 → 0.015"). */
function parseValue(value: string): ParsedValue | null {
  const re = /(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/g;
  let match: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) match = m;
  if (!match) return null;
  const raw = match[0];
  return {
    prefix: value.slice(0, match.index),
    raw,
    suffix: value.slice(match.index + raw.length),
    target: parseFloat(raw.replace(/,/g, "")),
    decimals: match[2] ? match[2].length - 1 : 0,
    grouped: match[1].includes(","),
  };
}

/** Format to the same decimals / thousands separators as the input. */
function formatNumber(v: number, decimals: number, grouped: boolean): string {
  const fixed = v.toFixed(decimals);
  if (!grouped) return fixed;
  const [int, dec] = fixed.split(".");
  const sep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec ? `${sep}.${dec}` : sep;
}

/**
 * In-view stat animation: counts the numeric part of `value` from 0 to its
 * target on the signature glide curve, once, when scrolled into view.
 * SSR-safe — the server renders the final string; the animation starts from
 * a client effect and writes textContent directly (no per-frame setState).
 * Reduced motion renders the final string immediately.
 */
export function CountUp({
  value,
  className,
  duration = dur.slow,
}: CountUpProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(rootRef, {
    once: true,
    margin: reveal.viewportMargin as UseInViewOptions["margin"],
  });
  const parsed = useMemo(() => parseValue(value), [value]);

  useEffect(() => {
    if (!parsed || !inView || reduced) return;
    const node = numRef.current;
    if (!node) return;
    const controls = animate(0, parsed.target, {
      duration,
      ease: ease.glide,
      onUpdate: (v) => {
        node.textContent = formatNumber(v, parsed.decimals, parsed.grouped);
      },
    });
    return () => controls.stop();
  }, [parsed, inView, reduced, duration]);

  if (!parsed) {
    return <span className={cn(className)}>{value}</span>;
  }

  return (
    <span ref={rootRef} className={cn("tabular-nums", className)}>
      {parsed.prefix}
      <span ref={numRef}>{parsed.raw}</span>
      {parsed.suffix}
    </span>
  );
}
