/**
 * Live Telemetry showcase — Intelleball's flagship sensing story.
 *
 * Self-contained full-bleed section: intro (eyebrow / headline / lead),
 * the Throw Replay, and closing stat chips. Accent: azure. Copy and the
 * simulated throw's parameters live in content/demos/telemetry.ts; the
 * stat chips are the "live-telemetry" project's metrics in content/site.ts.
 *
 * Server component — the replay is a client component underneath.
 */

import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";
import { reveal } from "@/lib/motion";
import { site } from "@/content/site";
import { ATTRIBUTION, INTRO, PROJECT_ID } from "@/content/demos/telemetry";
import { ThrowReplay } from "./ThrowReplay";

export function TelemetryShowcase() {
  const project = site.projects.find((p) => p.id === PROJECT_ID);
  if (!project) throw new Error(`content/site.ts has no project with id "${PROJECT_ID}"`);

  return (
    <section
      id="live-telemetry"
      className="relative scroll-mt-16 overflow-hidden px-6 py-28 md:py-40"
    >
      {/* Ambient azure wash behind the intro. The glow blooms around the
          heading and is masked at the top so it eases in from transparent —
          the section blends seamlessly out of the black stretch above it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[48rem]"
        style={{
          backgroundImage:
            "radial-gradient(100% 80% at 26% 44%, rgba(41, 151, 255, 0.20), transparent 66%)",
          maskImage: "linear-gradient(to bottom, transparent, #000 22%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 22%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl">
        {/* ── Intro ── */}
        <Reveal y={16}>
          <p className="text-eyebrow uppercase text-azure">{INTRO.eyebrow}</p>
        </Reveal>

        <TextReveal
          as="h2"
          delay={0.1}
          className="mt-5 max-w-3xl text-headline text-balance"
          segments={[
            { text: INTRO.headline[0] },
            { text: INTRO.headline[1], className: "text-azure" },
          ]}
        />

        <Reveal delay={0.35}>
          <p className="mt-6 max-w-2xl text-lead text-ink-mid text-pretty">{INTRO.lead}</p>
        </Reveal>

        {/* ── Interactive: the throw replay ── */}
        <Reveal className="mt-20 md:mt-28">
          <div className="relative overflow-hidden rounded-card border border-line bg-surface p-6 md:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: "var(--gradient-panel-sheen)" }}
            />
            <div className="relative">
              <ThrowReplay />
            </div>
          </div>
        </Reveal>

        {/* ── Closing stat chips ── */}
        <div className="mt-20 grid gap-4 sm:grid-cols-3 md:mt-28">
          {project.metrics.map((stat, i) => (
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

        {/* ── Attribution ── */}
        <Reveal delay={0.2}>
          <p className="mt-10 text-caption text-ink-dim">{ATTRIBUTION}</p>
        </Reveal>
      </div>
    </section>
  );
}
