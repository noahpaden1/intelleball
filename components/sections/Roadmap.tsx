"use client";

import { motion } from "framer-motion";
import { AmbientDrift } from "@/components/art/AmbientDrift";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/utils";
import { dur, ease, reveal, spring } from "@/lib/motion";
import { site, type MilestoneStatus } from "@/content/site";

/** Node colour + pill per milestone status. */
const STATUS: Record<MilestoneStatus, { label: string; dot: string; node: string; text: string }> = {
  shipped: {
    label: "Shipped",
    dot: "bg-mint",
    node: "bg-mint shadow-[0_0_12px_rgba(48,209,88,0.8)]",
    text: "text-mint",
  },
  "in-progress": {
    label: "In progress",
    dot: "bg-azure",
    node: "bg-azure shadow-[0_0_12px_rgba(41,151,255,0.8)]",
    text: "text-azure",
  },
  planned: {
    label: "Planned",
    dot: "bg-ink-dim",
    node: "bg-ink-dim",
    text: "text-ink-dim",
  },
};

export function Roadmap() {
  return (
    <section
      id="roadmap"
      className="relative scroll-mt-16 px-6 py-28 md:py-36"
    >
      <AmbientDrift variant="b" />
      {/* Masked cross-hatch behind the timeline column (clear of dates).
          The section is full-bleed while the 180px date column + 40px gap
          live inside the centered max-w-5xl (1024px) container, so the
          backdrop's left edge is anchored to the CONTAINER: 50% − 512px
          (container left) + 220px = calc(50% − 292px), clamped to 220px on
          narrow viewports where the container hugs the px-6 padding. */}
      <div
        aria-hidden
        className="grid-lines absolute inset-y-0 right-0 left-[max(220px,calc(50%-292px))] hidden opacity-75 md:block"
        style={{
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 120px)",
          maskImage: "linear-gradient(90deg, transparent, #000 120px)",
        }}
      />

      <div className="relative mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Roadmap"
          title="From the bench to the game."
          lead="What is built, what is being built, and what comes next. Dates are targets; the status pills are honest."
        />

        <div className="mt-16 space-y-14">
          {site.timeline.map((item, i) => {
            const status = STATUS[item.status];
            return (
              <Reveal key={item.id} delay={i * 0.08}>
                <article className="grid gap-4 md:grid-cols-[180px_1fr] md:gap-10">
                  <div className="md:pt-1 md:text-right">
                    <p className="text-caption text-ink-dim">{item.dates}</p>
                    <p className={cn("mt-1 flex items-center gap-1.5 text-caption md:justify-end", status.text)}>
                      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                      {status.label}
                    </p>
                  </div>

                  {/* Timeline rail: hairline base + accent draw-in + node dot */}
                  <div className="relative pl-6 md:pl-10">
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-px bg-line"
                    />
                    <motion.span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 w-px origin-top bg-gradient-to-b to-transparent",
                        item.status === "shipped"
                          ? "from-mint via-mint/40"
                          : item.status === "in-progress"
                            ? "from-azure via-azure/40"
                            : "from-ink-dim via-ink-dim/40"
                      )}
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true, margin: reveal.viewportMargin }}
                      transition={{ duration: dur.slow, ease: ease.glide }}
                    />
                    <motion.span
                      aria-hidden
                      className={cn("absolute top-[7px] -left-[3.5px] h-2 w-2 rounded-full", status.node)}
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true, margin: reveal.viewportMargin }}
                      transition={{ ...spring.snappy, delay: 0.15 }}
                    />

                    <h3 className="text-title">{item.title}</h3>
                    <p className={cn("mt-1 text-body", item.status === "planned" ? "text-ink-mid" : status.text)}>
                      {item.subtitle}
                    </p>
                    <p className="mt-3 text-body text-ink-mid text-pretty">
                      {item.description}
                    </p>
                    <ul className="mt-4 space-y-2">
                      {item.outcomes.map((o) => (
                        <li key={o} className="flex gap-3 text-caption text-ink-mid">
                          <span aria-hidden className={status.text}>
                            +
                          </span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        {/* Under the hood — 5-dot maturity meters, staggered fill on scroll */}
        <div className="mt-24">
          <Reveal>
            <p className="text-eyebrow uppercase text-azure">Under the hood</p>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-3 max-w-2xl text-body text-ink-mid text-pretty">
              Maturity of each part of the stack in the current build, on a five-dot scale. Five means it ships today.
            </p>
          </Reveal>
        </div>
        <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {site.stack.map((group, gi) => (
            <Reveal key={group.group} delay={gi * 0.08}>
              <div>
                <h3 className="text-eyebrow uppercase text-ink-dim">
                  {group.group}
                </h3>
                <ul className="mt-5 space-y-3">
                  {group.items.map((skill, si) => (
                    <li
                      key={skill.name}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-caption text-ink-mid">
                        {skill.name}
                      </span>
                      <span
                        className="flex shrink-0 gap-1"
                        role="img"
                        aria-label={`maturity ${skill.level} of 5`}
                      >
                        {Array.from({ length: 5 }, (_, d) => (
                          <motion.span
                            key={d}
                            className={
                              d < skill.level
                                ? "h-1.5 w-1.5 rounded-full bg-azure"
                                : "h-1.5 w-1.5 rounded-full bg-raised"
                            }
                            initial={{ opacity: 0, scale: 0.4 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true, margin: reveal.viewportMargin }}
                            transition={{
                              duration: dur.fast,
                              ease: ease.glide,
                              delay: si * 0.05 + d * 0.05,
                            }}
                          />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
