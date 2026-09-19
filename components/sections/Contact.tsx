import { NeuralNoiseCanvas } from "@/components/art";
import { Magnetic } from "@/components/motion/Magnetic";
import { Reveal } from "@/components/motion/Reveal";
import { LiquidButton } from "@/components/ui/LiquidButton";
import { site } from "@/content/site";

export function Contact() {
  const { contact } = site;

  return (
    // min-h-svh + flex centering: as Deck B's Over, Contact needs at least
    // one full viewport of height — otherwise the cover progress (Over top
    // → viewport top) can never reach 1 and the deck strands mid-transition
    // at max scroll (SectionDeck's runway gate double-checks this).
    <section
      id="contact"
      className="relative flex min-h-svh scroll-mt-16 flex-col justify-center overflow-hidden px-6 py-32 md:py-44"
    >
      {/* Neural-noise field — the fractal that closes the page */}
      <NeuralNoiseCanvas className="absolute inset-0 opacity-85" />

      <div
        aria-hidden
        className="absolute inset-0 rotate-180"
        style={{ backgroundImage: "var(--gradient-hero-glow)" }}
      />

      {/* Text scrim — calm zone directly under the headline/CTA */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 45% at 50% 45%, rgba(0,0,0,0.45), transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <Reveal>
          <p className="text-eyebrow uppercase text-azure">Get in touch</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="mt-4 text-headline text-balance">{contact.heading}</h2>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-5 max-w-xl text-lead text-ink-mid text-pretty">
            {contact.body}
          </p>
        </Reveal>
        <Reveal delay={0.24}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
            <Magnetic>
              <LiquidButton
                href={`mailto:${site.email}`}
                variant="primary"
                size="lg"
              >
                {site.email}
              </LiquidButton>
            </Magnetic>
            <a
              href={site.github}
              target="_blank"
              rel="noopener noreferrer"
              className="group text-[15px] text-azure"
            >
              Source on GitHub
              <span className="inline-block transition-transform duration-300 ease-glide group-hover:translate-x-1">
                {" "}
                ↗
              </span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
