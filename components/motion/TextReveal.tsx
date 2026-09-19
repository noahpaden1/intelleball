"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { dur, ease, reveal } from "@/lib/motion";

interface Segment {
  text: string;
  className?: string;
}

interface TextRevealProps {
  /** Ordered text segments; give a segment `className: "gradient-text"` to highlight it */
  segments: Segment[];
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  delay?: number;
}

/**
 * Apple-style headline reveal: each word rises and fades in with a
 * per-word stagger. Screen readers get the plain, unsplit text.
 */
export function TextReveal({
  segments,
  as: Tag = "h1",
  className,
  delay = 0,
}: TextRevealProps) {
  const words = segments.flatMap((seg) =>
    seg.text
      .split(" ")
      .filter(Boolean)
      .map((word) => ({ word, className: seg.className }))
  );
  const plain = segments.map((s) => s.text).join(" ");

  return (
    <Tag className={cn(className)}>
      <span className="sr-only">{plain}</span>
      <motion.span
        aria-hidden
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: reveal.viewportMargin }}
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: 0.055, delayChildren: delay },
          },
        }}
      >
        {words.map(({ word, className: wordClass }, i) => (
          <span key={i} className="inline-block whitespace-pre">
            <motion.span
              className={cn("inline-block", wordClass)}
              variants={{
                hidden: { opacity: 0, y: "0.6em", filter: "blur(6px)" },
                visible: {
                  opacity: 1,
                  y: "0em",
                  filter: "blur(0px)",
                  transition: { duration: dur.base, ease: ease.glide },
                },
              }}
            >
              {word}
            </motion.span>
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}
