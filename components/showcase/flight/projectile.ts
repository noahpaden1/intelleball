/**
 * Drag-free projectile model for the Release Explorer — pure math, no
 * React, no DOM. Flight starts at the release height and ends where the
 * arc comes back down through the target height; when the apex never
 * reaches it, the arc is followed to the ground instead and the target
 * readouts are undefined.
 */

import { RELEASE_MODEL } from "@/content/demos/flight";

export interface TargetSolution {
  /** Seconds from release to the descending crossing of the target height. */
  hangTimeS: number;
  /** Horizontal distance to that crossing, metres. */
  rangeM: number;
  /** Angle below horizontal at the crossing, degrees. */
  entryAngleDeg: number;
}

export interface ReleaseSolution {
  /** Apex height above the ground, metres. */
  apexM: number;
  /** Horizontal distance to the apex, metres. */
  apexRangeM: number;
  /** Defined only when the apex clears the target height. */
  target: TargetSolution | null;
  /** Where the drawn arc ends: the target crossing, or the ground when out of reach. */
  endTimeS: number;
  endRangeM: number;
  endHeightM: number;
}

export interface ArcPoint {
  x: number;
  y: number;
}

const DEG = Math.PI / 180;

/** Closed-form flight for a launch angle (degrees) and release speed (m/s). */
export function solveRelease(angleDeg: number, speedMs: number): ReleaseSolution {
  const g = RELEASE_MODEL.gravityMs2;
  const h0 = RELEASE_MODEL.releaseHeightM;
  const vx = speedMs * Math.cos(angleDeg * DEG);
  const vy = speedMs * Math.sin(angleDeg * DEG);

  const apexM = h0 + (vy * vy) / (2 * g);
  const apexRangeM = (vx * vy) / g;

  // Descending crossing of height h: ½g·t² − vy·t + (h − h0) = 0, larger root.
  const descendingTime = (h: number): number | null => {
    const discriminant = vy * vy - 2 * g * (h - h0);
    return discriminant < 0 ? null : (vy + Math.sqrt(discriminant)) / g;
  };

  const tTarget = descendingTime(RELEASE_MODEL.targetHeightM);
  if (tTarget !== null) {
    const vyEnd = vy - g * tTarget; // ≤ 0 on the way down
    return {
      apexM,
      apexRangeM,
      target: {
        hangTimeS: tTarget,
        rangeM: vx * tTarget,
        entryAngleDeg: Math.atan2(-vyEnd, vx) / DEG,
      },
      endTimeS: tTarget,
      endRangeM: vx * tTarget,
      endHeightM: RELEASE_MODEL.targetHeightM,
    };
  }

  // The ground is below the release height, so this root is always real.
  const tGround = descendingTime(0) ?? 0;
  return {
    apexM,
    apexRangeM,
    target: null,
    endTimeS: tGround,
    endRangeM: vx * tGround,
    endHeightM: 0,
  };
}

/** The arc from release to `endTimeS`, sampled evenly in time, in world metres. */
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
    return { x: vx * t, y: RELEASE_MODEL.releaseHeightM + vy * t - 0.5 * g * t * t };
  });
}
