import { AmbientDrift } from "@/components/art/AmbientDrift";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { site } from "@/content/site";

const TENET_ACCENTS = ["azure", "violet", "rose"] as const;

export function Principles() {
  const { principles } = site;

  return (
    // NOTE: the #principles anchor id lives on SectionDeck's in-flow
    // sentinel (page.tsx, anchorId="principles"), NOT here — this section
    // becomes Deck B's sticky Under, and a stuck sticky is a wrong scroll
    // target for bottom-up fragment navigation.
    <section className="relative px-6 py-28 md:py-24">
      <AmbientDrift variant="c" />
      <div className="relative mx-auto max-w-5xl">
        <SectionHeading eyebrow="Principles" title={principles.heading} align="center" />

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {principles.tenets.map((tenet, i) => (
            <Reveal key={tenet.index} delay={i * 0.1}>
              {/* Hover lift lives on the SpotlightCard wrapper so the ::before/
                  ::after border ring translates WITH the card. */}
              <SpotlightCard
                accent={TENET_ACCENTS[i % 3]}
                className="h-full rounded-card transition-transform duration-500 ease-glide hover:-translate-y-1"
              >
                <article className="group h-full rounded-card border border-line bg-surface p-8 transition-all duration-500 ease-glide hover:border-ink-dim/50">
                  <p className="gradient-text text-headline">{tenet.index}</p>
                  <h3 className="mt-6 text-title text-balance">{tenet.title}</h3>
                  <p className="mt-4 text-body text-ink-mid text-pretty">{tenet.body}</p>
                </article>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
