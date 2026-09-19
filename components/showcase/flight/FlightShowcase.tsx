/**
 * Flight-analysis showcase — from raw IMU motion to per-throw stats, and
 * the drift math that makes those stats trustworthy.
 *
 * Self-contained full-bleed section: intro (eyebrow / headline / lead),
 * the Drift Explorer, the Release Explorer, closing stat chips and a
 * one-line model note. Accent: violet. All copy and parameters come from
 * content/demos/flight.ts.
 *
 * Server component — the interactives are client components underneath.
 */

import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";
import { reveal } from "@/lib/motion";
import { FLIGHT_SECTION, STAT_CHIPS } from "@/content/demos/flight";
import { DriftExplorer } from "./DriftExplorer";
import { ReleaseExplorer } from "./ReleaseExplorer";

export function FlightShowcase() {
  const [headlineStart, headlineEnd] = FLIGHT_SECTION.headline;

  return (
    <section
      id={FLIGHT_SECTION.id}
      className="relative scroll-mt-16 overflow-hidden px-6 py-28 md:py-40"
    >
      {/* Ambient violet wash behind the intro. The glow blooms around the
          heading and is masked at the top so it eases in from transparent —
          the section blends seamlessly out of the black stretch above it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[48rem]"
        style={{
          backgroundImage:
            "radial-gradient(100% 80% at 26% 44%, rgba(191, 90, 242, 0.20), transparent 66%)",
          maskImage: "linear-gradient(to bottom, transparent, #000 22%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 22%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl">
        {/* ── Intro ── */}
        <Reveal y={16}>
          <p className="text-eyebrow uppercase text-violet">{FLIGHT_SECTION.eyebrow}</p>
        </Reveal>

        <TextReveal
          as="h2"
          delay={0.1}
          className="mt-5 max-w-3xl text-headline text-balance"
          segments={[{ text: headlineStart }, { text: headlineEnd, className: "text-violet" }]}
        />

        <Reveal delay={0.35}>
          <p className="mt-6 max-w-2xl text-lead text-ink-mid text-pretty">{FLIGHT_SECTION.lead}</p>
        </Reveal>

        {/* ── Interactive (a): the drift problem ── */}
        <Reveal className="mt-20 md:mt-28">
          <div className="relative overflow-hidden rounded-card border border-line bg-surface p-6 md:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: "var(--gradient-panel-sheen)" }}
            />
            <div className="relative">
              <DriftExplorer />
            </div>
          </div>
        </Reveal>

        {/* ── Interactive (b): the release explorer ── */}
        <Reveal className="mt-16 md:mt-24">
          <div className="relative overflow-hidden rounded-card border border-line bg-surface p-6 md:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: "var(--gradient-panel-sheen)" }}
            />
            <div className="relative">
              <ReleaseExplorer />
            </div>
          </div>
        </Reveal>

        {/* ── Closing stat chips ── */}
        <div className="mt-20 grid gap-4 sm:grid-cols-3 md:mt-28">
          {STAT_CHIPS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * reveal.stagger}>
              <div className="h-full rounded-panel border border-line bg-surface px-6 py-5">
                <p className="text-title tracking-tight text-ink">
                  <CountUp value={stat.value} />
                </p>
                <p className="mt-1 text-caption text-ink-dim">{stat.label}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* ── Model note ── */}
        <Reveal delay={0.2}>
          <p className="mt-10 text-caption text-ink-dim">{FLIGHT_SECTION.modelNote}</p>
        </Reveal>
      </div>
    </section>
  );
}
