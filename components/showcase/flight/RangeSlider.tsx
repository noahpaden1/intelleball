"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { fixed, withUnit } from "./chart";

interface RangeSliderProps {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Decimal places for the live value. */
  decimals: number;
  onChange: (value: number) => void;
  className?: string;
}

/**
 * Native range input with a visible label, a live value and end-stops.
 * Keyboard-operable for free; the thumb takes the violet accent token.
 */
export function RangeSlider({
  label,
  unit,
  min,
  max,
  step,
  value,
  decimals,
  onChange,
  className,
}: RangeSliderProps) {
  const id = useId();
  const current = withUnit(fixed(value, decimals), unit);

  return (
    <div className={cn(className)}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-caption font-medium text-ink">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-caption tabular-nums text-ink-mid">
          {current}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={current}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 block w-full cursor-pointer accent-violet"
      />
      <div className="mt-1 flex justify-between text-caption text-ink-dim">
        <span>{withUnit(String(min), unit)}</span>
        <span>{withUnit(String(max), unit)}</span>
      </div>
    </div>
  );
}
