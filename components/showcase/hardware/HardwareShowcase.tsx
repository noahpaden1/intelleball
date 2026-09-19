"use client";

import { type MotionValue } from "framer-motion";
import { fadeStyle, useProgressValue } from "@/lib/scrub";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/motion/CountUp";
import { PinnedSection } from "@/components/motion/PinnedSection";
import { Reveal } from "@/components/motion/Reveal";
import { reveal } from "@/lib/motion";
import { site } from "@/content/site";
import {
  demoHeader,
  demoSteps,
  parts,
  srSummary,
  type DemoStep,
  type PartAccent,
} from "@/content/demos/hardware";
import { STEP_COUNT, stepFadeAt, stepScrubAt } from "./step-progress";
import { ExplodedBall } from "./ExplodedBall";

/** Closing stats come straight from the project card's metrics. */
const statChips =
  site.projects.find((project) => project.id === "sensor-core")?.metrics ?? [];

const ACCENT_DOT: Record<PartAccent, string> = {
  azure: "bg-azure",
  violet: "bg-violet",
  rose: "bg-rose",
  mint: "bg-mint",
};

/**
 * Sensor-core showcase — an Apple-style scroll-scrubbed exploded view of
 * the ball's hardware. A 400vh runway pins the stage; the shell, cushion
 * and core slide apart along a diagonal in sync with four crossfading
 * captions, and every within-stage micro-animation (callouts, the I²C
 * pulse, the radio fan) is keyed to scroll, so scrubbing backwards
 * reassembles the ball.
 *
 * Reduced motion: a static 2×2 grid of the four frames with captions —
 * full information, zero scrubbing.
 */
export function HardwareShowcase() {
  // Hydration-safe: false on SSR + first client render, real value after mount
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section id="sensor-core" className="relative overflow-x-clip bg-canvas scroll-mt-16">
      {/* Intro */}
      <div className="px-6 pt-28 md:pt-36">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="text-eyebrow uppercase text-rose">{demoHeader.kicker}</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 text-headline text-balance">
              {demoHeader.headline[0]}{" "}
              <span className="text-rose">{demoHeader.headline[1]}</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mx-auto mt-5 max-w-2xl text-lead text-ink-mid text-pretty">
              {demoHeader.lead}
            </p>
          </Reveal>
        </div>
      </div>

      {/* The stage is decorative; this is what assistive tech reads instead. */}
      <p className="sr-only">{srSummary}</p>

      {/* Walkthrough */}
      {reducedMotion ? (
        <StaticWalkthrough />
      ) : (
        <PinnedSection heightVh={400}>
          {(progress) => <Stage progress={progress} />}
        </PinnedSection>
      )}

      {/* Closing stat chips + the parts list */}
      <div className="px-6 pb-28 pt-6 md:pb-36">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
          {statChips.map((chip, i) => (
            <Reveal key={chip.value} delay={i * reveal.stagger}>
              <div className="flex items-baseline gap-2 rounded-pill border border-line bg-surface px-5 py-2.5">
                <span className="text-[15px] font-semibold tracking-tight text-ink">
                  <CountUp value={chip.value} />
                </span>
                <span className="text-caption text-ink-dim">{chip.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-center gap-2">
          {parts.map((part, i) => (
            <Reveal key={part.name} delay={(statChips.length + i) * reveal.stagger}>
              <div className="flex items-center gap-2 rounded-pill border border-line bg-raised px-3.5 py-1.5">
                <span aria-hidden className={cn("h-1.5 w-1.5 rounded-pill", ACCENT_DOT[part.accent])} />
                <span className="text-caption text-ink">{part.name}</span>
                <span className="text-caption text-ink-dim">{part.role}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pinned stage ────────────────────────────────────────────────────── */

function Stage({ progress }: { progress: MotionValue<number> }) {
  // Single state-mirrored progress drives every layer, so the captions
  // and the SVG update together (or not at all) — overlap is impossible.
  const t = useProgressValue(progress);

  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-y-8 px-6 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-14 lg:gap-x-20">
      {/* Captions — above the ball on mobile, left column on desktop */}
      <div className="flex flex-col items-center md:items-start">
        <div className="relative h-48 w-full max-w-md sm:h-44 md:h-64">
          {demoSteps.map((step, i) => (
            <StepCaption key={step.id} t={t} index={i} step={step} />
          ))}
        </div>
        <StepRail t={t} />
      </div>

      {/* The ball */}
      <div className="relative justify-self-center">
        <div
          aria-hidden
          className="absolute -inset-[18%] -z-10"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(255,55,95,0.13), transparent 70%)",
          }}
        />
        <ExplodedBall
          t={t}
          className="w-[min(88vw,520px,50svh)] md:w-[min(520px,64svh)]"
        />
      </div>
    </div>
  );
}

/** One caption, crossfading in the same window as its stage step. */
function StepCaption({
  t,
  index,
  step,
}: {
  t: number;
  index: number;
  step: DemoStep;
}) {
  const { opacity, y } = stepFadeAt(t, index);
  return (
    <div
      style={fadeStyle(opacity, y)}
      className="absolute inset-0 flex flex-col justify-center text-center md:text-left"
    >
      <p className="text-eyebrow uppercase text-rose">{step.eyebrow}</p>
      <h3 className="mt-3 text-title text-balance">{step.title}</h3>
      <p className="mt-3 text-body text-ink-mid text-pretty">{step.body}</p>
    </div>
  );
}

/** Four-segment progress rail — each segment fills with its step's scrub. */
function StepRail({ t }: { t: number }) {
  return (
    <div aria-hidden className="mt-6 flex items-center gap-2">
      {demoSteps.map((step, i) => (
        <RailSegment key={step.id} t={t} index={i} />
      ))}
    </div>
  );
}

function RailSegment({ t, index }: { t: number; index: number }) {
  const fill = stepScrubAt(t, index);
  return (
    <div className="h-[3px] w-9 overflow-hidden rounded-pill bg-raised">
      <div
        className="h-full w-full bg-rose"
        style={{ transform: `scaleX(${fill})`, transformOrigin: "left" }}
      />
    </div>
  );
}

/* ─── Reduced-motion fallback ─────────────────────────────────────────── */

/** Mirrors FADE in step-progress.ts: the last progress at which a step's
 *  caption is still fully up (its scrub has played ~80% by then), so each
 *  frozen frame shows the step lit and mostly played. */
const HOLD_EDGE = 0.09;

function stepFrameAt(index: number) {
  return index === STEP_COUNT - 1 ? 1 : (index + 1) / STEP_COUNT - HOLD_EDGE;
}

/**
 * Static, information-equivalent walkthrough: the ball frozen at each
 * step's most legible frame in a 2×2 grid (stacked on mobile), each with
 * its full caption. No pinning, no scrubbing.
 */
function StaticWalkthrough() {
  return (
    <div className="mx-auto grid max-w-5xl gap-x-8 gap-y-16 px-6 py-20 sm:grid-cols-2 md:py-24">
      {demoSteps.map((step, i) => (
        <figure key={step.id} className="flex flex-col items-center">
          <ExplodedBall t={stepFrameAt(i)} className="w-[min(72vw,360px)]" />
          <figcaption className="mt-6 max-w-sm text-center">
            <p className="text-eyebrow uppercase text-rose">{step.eyebrow}</p>
            <h3 className="mt-2 text-title">{step.title}</h3>
            <p className="mt-2 text-body text-ink-mid text-pretty">{step.body}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
