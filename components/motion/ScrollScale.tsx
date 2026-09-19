"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScrollScaleProps {
  children: React.ReactNode;
  className?: string;
  /** Scale reached once the element has scrolled fully past */
  to?: number;
  /** Opacity reached once the element has scrolled fully past */
  fadeTo?: number;
}

/**
 * The Apple product-hero move: content sits at full scale, then
 * gently recedes — scaling down and dimming — as you scroll past it.
 */
export function ScrollScale({
  children,
  className,
  to = 0.94,
  fadeTo = 0.25,
}: ScrollScaleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [1, to]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, fadeTo]);
  const y = useTransform(scrollYProgress, [0, 1], [0, -40]);

  return (
    <div ref={ref} className={cn(className)}>
      <motion.div style={reduced ? undefined : { scale, opacity, y }}>
        {children}
      </motion.div>
    </div>
  );
}
