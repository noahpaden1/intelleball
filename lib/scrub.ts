"use client";

import { useState, type CSSProperties } from "react";
import { useMotionValueEvent, type MotionValue } from "framer-motion";

/**
 * Correct-by-construction scrub plumbing for the pinned scroll stories.
 *
 * The crossfade layers used to bind per-layer useTransform MotionValues
 * straight to styles. In Next production builds a scroll-linked binding
 * can silently stop updating (framer/motion#2452); a layer frozen at its
 * initial opacity (the first layer starts at 1) then sits fully visible
 * underneath the layers that still animate — overlapping steps.
 *
 * Instead, each pinned stage mirrors its section progress into React
 * state exactly once (useProgressValue) and derives every layer's
 * opacity/drift as plain numbers (piecewise) rendered as plain styles
 * (fadeStyle). All layers update from the same value — together, or not
 * at all — so one layer can never be stranded on top of another.
 */

/** Mirror a 0→1 MotionValue into React state with a single subscription. */
export function useProgressValue(progress: MotionValue<number>): number {
  const [value, setValue] = useState(() => progress.get());
  useMotionValueEvent(progress, "change", (v) => setValue(v));
  return value;
}

/**
 * The same clamped piecewise-linear interpolation contract as
 * useTransform(progress, input, output): `input` is ascending, values
 * outside it clamp to the first/last output.
 */
export function piecewise(input: number[], output: number[], t: number): number {
  if (t <= input[0]) return output[0];
  const last = input.length - 1;
  if (t >= input[last]) return output[last];
  let i = 1;
  while (input[i] < t) i++;
  const span = input[i] - input[i - 1];
  const f = span === 0 ? 0 : (t - input[i - 1]) / span;
  return output[i - 1] + (output[i] - output[i - 1]) * f;
}

/**
 * Style for a crossfade layer: numeric opacity, optional vertical drift,
 * and visibility: hidden once fully faded so an invisible layer can never
 * intercept clicks or sit "on top" in any sense.
 */
export function fadeStyle(opacity: number, y = 0): CSSProperties {
  return {
    opacity,
    transform: y === 0 ? undefined : `translateY(${y}px)`,
    visibility: opacity <= 0.001 ? "hidden" : undefined,
  };
}
