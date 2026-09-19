"use client";

import { type MotionValue } from "framer-motion";
import { CyberGridCanvas } from "@/components/art";
import { AmbientDrift } from "@/components/art/AmbientDrift";
import { PinnedSection } from "@/components/motion/PinnedSection";
import { fadeStyle, piecewise, useProgressValue } from "@/lib/scrub";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { site } from "@/content/site";

/**
 * The signature scroll-story: three pillars — Hardware, Intelligence,
 * Physical AI — crossfade on a pinned stage while the page scrolls
 * through a 300vh runway. Crossfades render as plain numeric styles from
 * a single state-mirrored progress value (lib/scrub.ts), so a production
 * scroll-binding stall can never strand one pillar on top of another.
 * Reduced motion: the three pillars render statically stacked instead.
 */
export function PillarsStory() {
  const pillars = site.pillars;
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return (
      <section className="relative px-6 py-28 md:py-36">
        <AmbientDrift variant="a" />
        <div className="relative mx-auto flex max-w-3xl flex-col gap-20 text-center md:gap-24">
          {pillars.map((pillar) => (
            <div key={pillar.eyebrow}>
              <p className="text-eyebrow uppercase text-azure">{pillar.eyebrow}</p>
              <h2 className="mt-5 text-headline text-balance">{pillar.title}</h2>
              <p className="mx-auto mt-6 max-w-xl text-lead text-ink-mid text-pretty">
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    // rounded-t-card on the stage: as Deck A's Over-first-child the stage
    // sits flush with the Over's rounded lip, and its opaque CyberGrid
    // canvas would otherwise square off the lip's corner cutouts during
    // the seam. The stage's own overflow-hidden clips to the radius; while
    // pinned mid-runway the notches reveal the Over's bg-canvas (black) —
    // visually a no-op.
    <PinnedSection
      heightVh={pillars.length * 100 + 60}
      stageClassName="rounded-t-card"
    >
      {(progress) => <PillarsStage progress={progress} />}
    </PinnedSection>
  );
}

function PillarsStage({ progress }: { progress: MotionValue<number> }) {
  const pillars = site.pillars;
  const t = useProgressValue(progress);

  return (
    <div className="relative h-full w-full">
      {/* Instrument backdrop: ambient color wash carrying the stage on
          mobile/coarse-pointer, then CSS cross-hatch, then the living
          grid on desktop fine-pointer (self-gates; null elsewhere). The
          wash is display:none'd on exactly the media path where the grid
          mounts — the canvas backbuffer is opaque (alpha:false), so blobs
          under it would burn compositor time with zero visible output.
          (Narrow trade-off: if WebGL fails on desktop, the stage falls
          back to cross-hatch only.) */}
      <AmbientDrift variant="a" className="md:pointer-fine:hidden" />
      <div aria-hidden className="grid-lines absolute inset-0" />
      <CyberGridCanvas progress={t} className="absolute inset-0" />

      {pillars.map((pillar, i) => (
        <Pillar
          key={pillar.eyebrow}
          t={t}
          index={i}
          count={pillars.length}
          {...pillar}
        />
      ))}

      {/* Progress rail */}
      <div className="absolute top-1/2 right-6 h-36 w-px -translate-y-1/2 bg-line md:right-12">
        <div
          className="w-full bg-ink"
          style={{ height: "100%", transform: `scaleY(${t})`, transformOrigin: "top" }}
        />
      </div>
    </div>
  );
}

interface PillarProps {
  t: number;
  index: number;
  count: number;
  eyebrow: string;
  title: string;
  body: string;
}

function Pillar({ t, index, count, eyebrow, title, body }: PillarProps) {
  const start = index / count;
  const end = (index + 1) / count;
  const fade = 0.35 / count;
  const isFirst = index === 0;
  const isLast = index === count - 1;

  // First pillar is visible on entry; last stays until the section unpins.
  const input = isFirst
    ? [0, end - fade, end]
    : isLast
      ? [start, start + fade, 1]
      : [start, start + fade, end - fade, end];
  const opacity = piecewise(
    input,
    isFirst ? [1, 1, 0] : isLast ? [0, 1, 1] : [0, 1, 1, 0],
    t
  );
  const y = piecewise(
    input,
    isFirst ? [0, 0, -48] : isLast ? [48, 0, 0] : [48, 0, 0, -48],
    t
  );

  return (
    <div
      style={fadeStyle(opacity, y)}
      className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
    >
      <p className="text-eyebrow uppercase text-azure">{eyebrow}</p>
      <h2 className="mt-5 max-w-3xl text-headline text-balance">{title}</h2>
      <p className="mt-6 max-w-xl text-lead text-ink-mid text-pretty">{body}</p>
    </div>
  );
}
