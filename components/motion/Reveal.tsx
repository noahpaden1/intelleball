"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { dur, ease, reveal } from "@/lib/motion";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds to wait before animating — stagger siblings with i * reveal.stagger */
  delay?: number;
  /** Pixels of upward drift; defaults to the global reveal distance */
  y?: number;
  once?: boolean;
}

/**
 * The workhorse scroll-triggered reveal: fade + rise as the element
 * enters the viewport, on the signature deceleration curve.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = reveal.distance,
  once = true,
}: RevealProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: reveal.viewportMargin }}
      transition={{ duration: dur.base, ease: ease.glide, delay }}
    >
      {children}
    </motion.div>
  );
}
