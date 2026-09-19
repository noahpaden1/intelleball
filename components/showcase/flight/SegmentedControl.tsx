"use client";

import { useRef, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** Unique per instance — keys the shared-layout thumb. */
  name: string;
  /** Accessible label for the radio group. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Arrow-key steps for a horizontal radio group; Home/End jump to the ends. */
const ARROW_STEPS: Record<string, number | undefined> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * Apple-style segmented control with radio-group semantics: one tab stop
 * (roving tabindex), arrow keys move the selection and the focus together,
 * and a shared-layout thumb glides between options on the snappy spring —
 * instantly under reduced motion.
 */
export function SegmentedControl<T extends string>({
  name,
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const reduced = useReducedMotion();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = ARROW_STEPS[event.key];
    let target: number | undefined;
    if (step !== undefined) target = (index + step + options.length) % options.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = options.length - 1;
    if (target === undefined) return;
    event.preventDefault();
    onChange(options[target].value);
    buttons.current[target]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative z-10 inline-flex items-center gap-1 rounded-pill border border-line bg-canvas p-1",
        className
      )}
    >
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttons.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, i)}
            className={cn(
              "relative rounded-pill px-4 py-2 text-caption font-medium transition-colors duration-300 ease-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet",
              active ? "text-ink" : "text-ink-dim hover:text-ink-mid"
            )}
          >
            {active ? (
              <motion.span
                aria-hidden
                layoutId={`${name}-thumb`}
                transition={reduced ? { duration: 0 } : spring.snappy}
                className="absolute inset-0 rounded-pill border border-line bg-raised"
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
