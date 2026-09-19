import { PortraitArt } from "@/components/art";
import { AmbientDrift } from "@/components/art/AmbientDrift";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { parallax } from "@/lib/motion";
import { site } from "@/content/site";

export function About() {
  const { about } = site;

  return (
    <section id="about" className="relative scroll-mt-16 px-6 py-28 md:py-36">
      <AmbientDrift variant="a" />
      <div className="relative mx-auto grid max-w-5xl gap-14 md:grid-cols-[1fr_320px] md:gap-20">
        <div>
          <SectionHeading eyebrow="The story" title={about.heading} />
          <div className="mt-10 space-y-6">
            {about.paragraphs.map((p, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <p className="text-body text-ink-mid text-pretty">{p}</p>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Generative field portrait — swap for a product photo anytime */}
        <Parallax strength={parallax.subtle} className="hidden md:block">
          <div className="sticky top-28 aspect-[3/4] overflow-hidden rounded-card border border-line bg-surface">
            <PortraitArt monogram="IB" />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/75 to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 p-7 text-caption">
              <p className="text-ink-mid">{about.portraitCaption}</p>
              <p className="mt-1 text-ink-dim">{about.portraitSub}</p>
            </div>
          </div>
        </Parallax>
      </div>
    </section>
  );
}
