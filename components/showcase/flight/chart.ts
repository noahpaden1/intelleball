/**
 * Small SVG chart helpers shared by the two explorers — nice ticks,
 * extents, path strings and number formatting. No React, no DOM.
 */

export interface NiceScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/**
 * Round a derived coordinate to two decimals before it becomes an SVG
 * attribute. Transcendental Math results (sin, log, pow) can differ by an
 * ulp between the server's V8 and the browser's, and React flags even a
 * last-digit difference as a hydration mismatch; two decimals is finer
 * than any screen and identical on both sides.
 */
export function px(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Exact decimal power of ten via string parsing — no Math.pow, no ulp drift. */
function powerOfTen(exponent: number): number {
  return Number(`1e${exponent}`);
}

/** d3-style nice step (1 / 2 / 5 × 10ⁿ) so that ~count ticks span the range. */
export function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  // Math.log10 may land an ulp either side of an exact power of ten; settle
  // the exponent with exact comparisons so every engine agrees.
  let exponent = Math.floor(Math.log10(raw));
  if (powerOfTen(exponent) > raw) exponent -= 1;
  else if (powerOfTen(exponent + 1) <= raw) exponent += 1;
  const magnitude = powerOfTen(exponent);
  const normalised = raw / magnitude;
  const factor =
    normalised >= Math.sqrt(50)
      ? 10
      : normalised >= Math.sqrt(10)
        ? 5
        : normalised >= Math.sqrt(2)
          ? 2
          : 1;
  return factor * magnitude;
}

/** Expand [min, max] outward to whole nice steps and list the ticks on them. */
export function niceScale(min: number, max: number, count = 4): NiceScale {
  const step = niceStep(Math.max(max - min, Number.EPSILON), count);
  const lo = Math.floor(min / step + 1e-9) * step;
  let hi = Math.ceil(max / step - 1e-9) * step;
  if (hi <= lo) hi = lo + step;
  const n = Math.round((hi - lo) / step);
  const ticks = Array.from({ length: n + 1 }, (_, i) => lo + i * step);
  return { min: lo, max: hi, step, ticks };
}

/** Decimal places needed to print a tick on this step without float noise. */
export function tickDecimals(step: number): number {
  return Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
}

export function extent(values: readonly number[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/** SVG path through the points; two-decimal coordinates keep the string small. */
export function linePath(xs: readonly number[], ys: readonly number[]): string {
  let d = "";
  for (let i = 0; i < xs.length; i++) {
    d += `${i === 0 ? "M" : "L"}${xs[i].toFixed(2)} ${ys[i].toFixed(2)}`;
  }
  return d;
}

/** toFixed with a typographic minus, and no sign on a value that rounds to zero. */
export function fixed(value: number, decimals: number): string {
  const text = value.toFixed(decimals);
  if (/^-0(\.0+)?$/.test(text)) return text.slice(1);
  return text.replace("-", "−");
}

/** Distance for readouts: metres to two places, centimetres to one below 1 m. */
export function formatDistance(metres: number): string {
  return Math.abs(metres) >= 1 ? `${fixed(metres, 2)} m` : `${fixed(metres * 100, 1)} cm`;
}

/** "48°" but "7.5 m/s": a degree sign hugs its number, every other unit gets a space. */
export function withUnit(text: string, unit: string): string {
  return unit === "°" ? `${text}${unit}` : `${text} ${unit}`;
}
