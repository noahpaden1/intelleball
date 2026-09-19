"use client";

import { cn } from "@/lib/utils";

interface CursorGlowProps {
  children: React.ReactNode;
  className?: string;
  /** Center color of the glow; default is a soft azure-tinted white */
  color?: string;
}

/**
 * Card hover glow: a soft radial light that follows the cursor across the
 * wrapper, fading in on hover. Pointer position is written straight into
 * CSS custom properties (no setState), and the glow layer clips to the
 * wrapper's border radius via rounded-[inherit] — give the wrapper the
 * same rounding as the card it wraps (e.g. className="rounded-card").
 */
export function CursorGlow({
  children,
  className,
  color = "rgba(163, 204, 255, 0.10)",
}: CursorGlowProps) {
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      className={cn("group/glow relative", className)}
      onPointerMove={handleMove}
    >
      {children}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 ease-glide group-hover/glow:opacity-100"
        style={{
          background: `radial-gradient(500px circle at var(--glow-x, 50%) var(--glow-y, 50%), ${color}, transparent 70%)`,
        }}
      />
    </div>
  );
}
