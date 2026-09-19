import { cn } from "@/lib/utils";

export interface SeamPulseProps {
  className?: string;
}

/**
 * Energized section seam: a hairline with a single 160px chip of light
 * traveling left → right on a 12s loop. Replaces `border-t border-line`
 * at non-deck seams and the footer.
 *
 * Pure CSS, no JS: the `seam-slide` keyframes plus the reduced-motion
 * `animation: none` override live in globals.css (integration §3.3) — until
 * they land, this renders as a plain static hairline. Offscreen the browser
 * auto-throttles the animation; reduced motion gets the static hairline.
 */
export function SeamPulse({ className }: SeamPulseProps) {
  return (
    <div
      aria-hidden
      className={cn("relative h-px overflow-hidden bg-line", className)}
    >
      <div
        className="seam-chip absolute top-0 h-px w-40"
        style={{ background: "var(--gradient-seam-pulse)" }}
      />
    </div>
  );
}
