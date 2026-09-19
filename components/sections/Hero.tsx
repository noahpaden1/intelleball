"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { BallScanHero } from "@/components/art";
import { Magnetic } from "@/components/motion/Magnetic";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";
import { useDeckCovered } from "@/components/motion/SectionDeck";
import { LiquidButton } from "@/components/ui/LiquidButton";
import { dur, ease } from "@/lib/motion";
import { site } from "@/content/site";

export function Hero() {
  const { hero } = site;
  const cueRef = useRef<HTMLDivElement>(null);
  const cueInView = useInView(cueRef);
  const reduced = useReducedMotion();
  // covered gates the pulse too: while Deck A's Over hides the hero with
  // visibility:hidden, the cue stays geometrically in-viewport (sticky at
  // top:0) and IntersectionObserver still reports it intersecting — the
  // infinite tween would otherwise run invisibly through the whole
  // PillarsStory runway. Safe in plain flow: the hook returns false.
  const covered = useDeckCovered();
  const pulsing = cueInView && !reduced && !covered;

  return (
    <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6">
      {/* The ball under its IMU scan, gimbal rings orbiting */}
      <BallScanHero />

      {/* Contrast scrim over the canvas, under the content */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{ backgroundImage: "var(--gradient-scan-scrim)" }}
      />

      {/* Deck A's SectionDeck owns the recede — no ScrollScale here */}
      <div className="relative w-full">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <Reveal y={16}>
            <p className="font-mono text-eyebrow uppercase text-ink-mid">
              {hero.eyebrow}
            </p>
          </Reveal>

          <TextReveal
            as="h1"
            delay={0.15}
            className="mt-6 text-display text-balance"
            segments={[
              { text: hero.headline[0] },
              { text: hero.headline[1], className: "gradient-text" },
            ]}
          />

          <Reveal delay={0.55}>
            <p className="mt-7 max-w-2xl text-lead text-ink-mid text-pretty">
              {hero.lead}
            </p>
          </Reveal>

          <Reveal delay={0.7}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
              <Magnetic>
                <LiquidButton
                  href={hero.primaryCta.href}
                  variant="primary"
                  size="lg"
                >
                  {hero.primaryCta.label}
                </LiquidButton>
              </Magnetic>
              <Link
                href={hero.secondaryCta.href}
                className="group text-[15px] text-azure"
              >
                {hero.secondaryCta.label}
                <span className="inline-block transition-transform duration-300 ease-glide group-hover:translate-x-1">
                  {" "}
                  →
                </span>
              </Link>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Scroll cue — pulse only while visible and motion is welcome */}
      <motion.div
        ref={cueRef}
        aria-hidden
        className="absolute bottom-8 flex flex-col items-center gap-2 text-ink-dim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: dur.slow, ease: ease.glide }}
      >
        <span className="font-mono text-caption">Scroll</span>
        <motion.span
          className="block h-8 w-px bg-gradient-to-b from-ink-dim to-transparent"
          animate={pulsing ? { scaleY: [1, 0.4, 1], opacity: [1, 0.4, 1] } : { scaleY: 1, opacity: 1 }}
          transition={
            pulsing
              ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
              : { duration: dur.fast }
          }
          style={{ transformOrigin: "top" }}
        />
      </motion.div>
    </section>
  );
}
