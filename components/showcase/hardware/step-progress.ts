import { useTransform, type MotionValue } from "framer-motion";
import { piecewise } from "@/lib/scrub";

/**
 * Shared scrub math for the four-step walkthrough: the 0→1 section
 * progress is divided into equal quarters, with a short crossfade
 * window at each boundary (screens + captions fade in sync) and a
 * padded inner window that drives each step's micro-animation.
 *
 * Crossfades are exposed as plain functions of a numeric progress value
 * (stepFadeAt) so all layers derive from one state-mirrored source and
 * can never desync (see lib/scrub.ts). The MotionValue variant
 * (useStepScrub) remains for the phones' micro-animations — a frozen
 * binding there degrades one screen's animation but cannot overlap.
 */

export const STEP_COUNT = 4;

/** Fraction of total progress spent crossfading at each step boundary. */
const FADE = 0.09;

function stepWindow(index: number) {
  const start = index / STEP_COUNT;
  const end = (index + 1) / STEP_COUNT;
  const isFirst = index === 0;
  const isLast = index === STEP_COUNT - 1;
  const input = isFirst
    ? [0, end - FADE, end]
    : isLast
      ? [start, start + FADE, 1]
      : [start, start + FADE, end - FADE, end];
  return { input, isFirst, isLast };
}

/** Crossfade opacity + drift for step `index` at progress `t`. First step
 *  is visible on entry; the last holds until the section unpins. */
export function stepFadeAt(t: number, index: number) {
  const { input, isFirst, isLast } = stepWindow(index);
  return {
    opacity: piecewise(
      input,
      isFirst ? [1, 1, 0] : isLast ? [0, 1, 1] : [0, 1, 1, 0],
      t
    ),
    y: piecewise(
      input,
      isFirst ? [0, 0, -20] : isLast ? [20, 0, 0] : [20, 0, 0, -20],
      t
    ),
  };
}

/** Local 0→1 sub-progress for step `index` at progress `t`, padded so the
 *  step's micro-animation plays while its screen is fully visible. */
export function stepScrubAt(t: number, index: number) {
  const start = index / STEP_COUNT;
  const end = (index + 1) / STEP_COUNT;
  return piecewise([start + FADE * 0.7, end - FADE * 0.7], [0, 1], t);
}

/** MotionValue variant of stepScrubAt — drives the phones' internal
 *  micro-animations (counters, rings, chat streaming). */
export function useStepScrub(progress: MotionValue<number>, index: number) {
  const start = index / STEP_COUNT;
  const end = (index + 1) / STEP_COUNT;
  return useTransform(
    progress,
    [start + FADE * 0.7, end - FADE * 0.7],
    [0, 1]
  );
}

/** 154 → "2:34" — for the scrub-driven session and rest clocks. */
export function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
