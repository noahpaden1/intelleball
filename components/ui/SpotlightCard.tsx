"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface SpotlightCardProps {
  accent: "azure" | "violet" | "rose";
  /** false renders the layers but never activates them (static contexts). */
  interactive?: boolean;
  /** Give it the card's rounding, e.g. "rounded-card". */
  className?: string;
  children: React.ReactNode;
}

/** Cached pointer rect goes stale after this long; the next move re-reads it. */
const RECT_STALE_MS = 500;

/**
 * Solid accent colors for the no-mask-composite fallback ring (globals.css
 * @supports-not branch) — the per-accent equivalent of the gradient ring,
 * mirroring the spot-ring-* alphas in theme.config.mjs.
 */
const RING_SOLID: Record<SpotlightCardProps["accent"], string> = {
  azure: "rgba(41, 151, 255, 0.35)",
  violet: "rgba(191, 90, 242, 0.35)",
  rose: "rgba(255, 55, 95, 0.30)",
};

/**
 * Accent-keyed pointer spotlight card — supersedes CursorGlow on project /
 * tenet cards. Pointer position is written straight into the element's
 * --spot-x / --spot-y custom properties (no setState, zero re-renders), and
 * the bounding rect is cached on pointerenter — re-read only when stale —
 * so pointermove never forces layout. No background-attachment: fixed
 * anywhere (the reference component's iOS Safari bug).
 *
 * Layers:
 * 1. Background spotlight (here): var(--gradient-spot-{accent}) radial that
 *    follows the pointer, fading in over 350ms ease-glide on hover and on
 *    :focus-within (keyboard parity — --spot-x/y default to 50%, centered).
 * 2. Border glow + white core: the `spotlight-card` utility in globals.css
 *    supplies ::before / ::after (mask-composite border technique with its
 *    @supports fallback, plus the @media (hover:none) guard). The component
 *    renders fine while that utility is absent — the class is simply inert.
 *
 * Touch / no-hover devices never see the spotlight (hover activation is
 * gated behind @media (hover:hover)); existing static card washes remain.
 *
 * DOCUMENTED LIMITATION (spec §7 keyboard-parity item): both current
 * consumers (Work secondary cards, Philosophy tenets) are non-interactive
 * — they contain no focusable element (the secondary projects in the
 * frozen content/site.ts carry no links), so :focus-within cannot
 * currently activate anywhere. The path is a latent capability that goes
 * live the moment a card gains a link/button; it is kept because it costs
 * nothing and future cards are expected to be interactive.
 */
export function SpotlightCard({
  accent,
  interactive = true,
  className,
  children,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rectCache = useRef<{ rect: DOMRect; at: number } | null>(null);

  // A resize invalidates the cached rect; scroll needs nothing (the stale
  // re-read covers slow drifts, and clientX minus rect.left is viewport-
  // relative on both sides so same-frame scroll is already consistent).
  useEffect(() => {
    if (!interactive) return;
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      rectCache.current = null;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [interactive]);

  const handleEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    rectCache.current = {
      rect: e.currentTarget.getBoundingClientRect(),
      at: e.timeStamp,
    };
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    let cached = rectCache.current;
    if (!cached || e.timeStamp - cached.at > RECT_STALE_MS) {
      cached = { rect: el.getBoundingClientRect(), at: e.timeStamp };
      rectCache.current = cached;
    }
    el.style.setProperty("--spot-x", `${e.clientX - cached.rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - cached.rect.top}px`);
  };

  const handleLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    // Drop the pointer position so a later keyboard focus activates the
    // spotlight at its centered default (the gradient's 50% fallback).
    e.currentTarget.style.removeProperty("--spot-x");
    e.currentTarget.style.removeProperty("--spot-y");
  };

  return (
    <div
      ref={ref}
      className={cn(
        "group/spot relative",
        interactive && "spotlight-card",
        className
      )}
      // Per-accent ring plumbing for the spotlight-card utility: ::before
      // reads --spot-ring (pointer-anchored accent radial), the @supports
      // fallback reads --spot-ring-solid. Set on this element so the
      // pseudo-elements resolve them.
      style={
        {
          "--spot-ring": `var(--gradient-spot-ring-${accent})`,
          "--spot-ring-solid": RING_SOLID[accent],
        } as React.CSSProperties
      }
      onPointerEnter={interactive ? handleEnter : undefined}
      onPointerMove={interactive ? handleMove : undefined}
      onPointerLeave={interactive ? handleLeave : undefined}
    >
      {children}
      {/* Spotlight wash AFTER the children (CursorGlow's proven order): the
          card articles are opaque bg-surface and positioned (or promoted by
          their hover transform), so an earlier sibling would paint beneath
          them and never be visible. pointer-events-none keeps hover intact;
          at 0.10–0.12 alpha it reads as an over-card light wash. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-[350ms] ease-glide",
          interactive &&
            "[@media(hover:hover)]:group-hover/spot:opacity-100 group-focus-within/spot:opacity-100"
        )}
        style={{ backgroundImage: `var(--gradient-spot-${accent})` }}
      />
    </div>
  );
}
