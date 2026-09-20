/**
 * Drag-free projectile model for the Release Explorer — pure math, no
 * React, no DOM. Flight starts with the ball's centre one radius above the
 * ground (a kick off the turf) and ends where it comes back down to that
 * height; the goal-line readout is where the arc crosses a vertical line a
 * chosen distance out, or undefined when the ball lands before it.
 */

import { RELEASE_MODEL, type GoalVerdict } from "@/content/demos/flight";

export interface GoalLineSolution {
  /** Height of the ball's centre as it crosses the goal line, metres. */
  heightM: number;
  /** Seconds from the kick to that crossing. */
  timeS: number;
}

export interface ReleaseSolution {
  /** Apex height above the ground, metres. */
  apexM: number;
  /** Horizontal distance to the apex, metres. */
  apexRangeM: number;
  /** Seconds from the kick to the landing. */
  hangTimeS: number;
  /** Horizontal distance to the landing, metres. */
  rangeM: number;
  /** Defined only when the ball is still in the air at the goal line. */
  goalLine: GoalLineSolution | null;
  verdict: GoalVerdict;
}

export interface ArcPoint {
  x: number;
  y: number;
}

const DEG = Math.PI / 180;

/** Closed-form flight for a launch angle (degrees), ball speed (m/s) and goal-line distance (m). */
export function solveRelease(angleDeg: number, speedMs: number, goalLineM: number): ReleaseSolution {
  const g = RELEASE_MODEL.gravityMs2;
  const h0 = RELEASE_MODEL.ballRadiusM;
  const vx = speedMs * Math.cos(angleDeg * DEG);
  const vy = speedMs * Math.sin(angleDeg * DEG);

  const apexM = h0 + (vy * vy) / (2 * g);
  const apexRangeM = (vx * vy) / g;

  // Back down to the launch height: ½g·t² − vy·t = 0, the non-zero root.
  const hangTimeS = (2 * vy) / g;
  const rangeM = vx * hangTimeS;

  if (goalLineM > rangeM) {
    return { apexM, apexRangeM, hangTimeS, rangeM, goalLine: null, verdict: "short" };
  }

  // The readout is the centre's height; the verdict is about the whole ball,
  // one radius either side of it, against the underside of the bar.
  const timeS = goalLineM / vx;
  const heightM = h0 + vy * timeS - 0.5 * g * timeS * timeS;
  const bar = RELEASE_MODEL.crossbarHeightM;
  const verdict: GoalVerdict =
    heightM - h0 > bar ? "over" : heightM + h0 < bar ? "under" : "bar";
  return { apexM, apexRangeM, hangTimeS, rangeM, goalLine: { heightM, timeS }, verdict };
}

/** The arc from the kick to `endTimeS`, sampled evenly in time, in world metres. */
export function arcPoints(
  angleDeg: number,
  speedMs: number,
  endTimeS: number,
  samples: number
): ArcPoint[] {
  const g = RELEASE_MODEL.gravityMs2;
  const vx = speedMs * Math.cos(angleDeg * DEG);
  const vy = speedMs * Math.sin(angleDeg * DEG);
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = (endTimeS * i) / samples;
    return { x: vx * t, y: RELEASE_MODEL.ballRadiusM + vy * t - 0.5 * g * t * t };
  });
}
