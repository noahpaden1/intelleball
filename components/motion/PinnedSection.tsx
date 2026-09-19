"use client";

import { useRef } from "react";
import { useScroll, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

interface PinnedSectionProps {
  /** Total scroll runway in viewport-heights (300 = 3 screens of story) */
  heightVh?: number;
  className?: string;
  /**
   * Extra classes for the sticky stage div (e.g. "rounded-t-card" when the
   * section is a SectionDeck.Over's first child, so the stage's own
   * overflow-hidden clips full-bleed canvases to the deck lip's radius).
   */
  stageClassName?: string;
  /** Render prop: receives scroll progress (0 → 1) through the pinned range */
  children: (progress: MotionValue<number>) => React.ReactNode;
}

/**
 * The core of Apple-style scroll storytelling: a tall scroll runway with
 * a viewport-height stage pinned inside it. Children receive a 0→1
 * MotionValue and choreograph anything against it via useTransform.
 */
export function PinnedSection({
  heightVh = 300,
  className,
  stageClassName,
  children,
}: PinnedSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  // Note: older framer-motion needed `layoutEffect: false` here to avoid
  // frozen progress in production; the option was removed in v11+. The
  // real protection is in lib/scrub.ts — crossfade layers derive from one
  // state-mirrored progress value, so they can never desync.

  return (
    <section
      ref={ref}
      className={cn("relative", className)}
      style={{ height: `${heightVh}vh` }}
    >
      <div
        className={cn(
          "sticky top-0 flex h-svh items-center overflow-hidden",
          stageClassName
        )}
      >
        {children(scrollYProgress)}
      </div>
    </section>
  );
}
