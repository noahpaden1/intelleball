"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { parallax } from "@/lib/motion";

interface ParallaxProps {
  children: React.ReactNode;
  className?: string;
  /** Total px of drift while the element crosses the viewport */
  strength?: number;
  /** Reverse the drift direction (foreground vs. background layers) */
  reverse?: boolean;
}

/**
 * Scroll-linked parallax drift. Wrap any element; it translates
 * vertically as it moves through the viewport, giving sections depth.
 */
export function Parallax({
  children,
  className,
  strength = parallax.medium,
  reverse = false,
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reverse ? [-strength, strength] : [strength, -strength]
  );

  return (
    <div ref={ref} className={cn("relative", className)}>
      <motion.div style={{ y: reduced ? 0 : y }}>{children}</motion.div>
    </div>
  );
}
