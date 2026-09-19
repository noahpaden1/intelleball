"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

interface MagneticProps {
  children: React.ReactNode;
  className?: string;
  /** Max px the child drifts toward the pointer (default 8) */
  strength?: number;
}

// useSpring wants bare spring options, not a full Transition.
const snappy = spring.snappy as {
  stiffness: number;
  damping: number;
  mass: number;
};
const springConfig = {
  stiffness: snappy.stiffness,
  damping: snappy.damping,
  mass: snappy.mass,
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/**
 * Magnetic hover for CTAs: the child drifts a few pixels toward the
 * pointer while hovered (scale 1.02) and springs back on leave.
 * MotionValues are driven directly — zero re-renders per pointer move.
 * Inert for touch pointers and for users preferring reduced motion.
 */
export function Magnetic({ children, className, strength = 8 }: MagneticProps) {
  const reduced = useReducedMotion();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rawScale = useMotionValue(1);
  const x = useSpring(rawX, springConfig);
  const y = useSpring(rawY, springConfig);
  const scale = useSpring(rawScale, springConfig);

  const handleEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== "mouse") return;
    rawScale.set(1.02);
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = clamp(
      (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2),
      -1,
      1
    );
    const ny = clamp(
      (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2),
      -1,
      1
    );
    rawX.set(nx * strength);
    rawY.set(ny * strength);
  };

  const handleLeave = () => {
    rawX.set(0);
    rawY.set(0);
    rawScale.set(1);
  };

  return (
    <motion.div
      className={cn("inline-block", className)}
      style={reduced ? undefined : { x, y, scale }}
      onPointerEnter={handleEnter}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {children}
    </motion.div>
  );
}
