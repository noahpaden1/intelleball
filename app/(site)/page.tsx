import {
  SectionDeck,
  SectionDeckOver,
  SectionDeckUnder,
} from "@/components/motion/SectionDeck";
import { SeamPulse } from "@/components/ui/SeamPulse";
import { Hero } from "@/components/sections/Hero";
import { PillarsStory } from "@/components/sections/PillarsStory";
import { Work } from "@/components/sections/Work";
import { About } from "@/components/sections/About";
import { Roadmap } from "@/components/sections/Roadmap";
import { Principles } from "@/components/sections/Principles";
import { Contact } from "@/components/sections/Contact";

export default function Home() {
  return (
    <main>
      {/* requireFit: on short viewports (landscape phones) the hero's
          content overflows one svh — the deck's h-svh overflow-hidden
          Under would clip the CTAs unreachably, so fall back to flow. */}
      <SectionDeck variant="hero" requireFit>
        <SectionDeckUnder>
          <Hero />
        </SectionDeckUnder>
        <SectionDeckOver lip>
          <PillarsStory />
        </SectionDeckOver>
      </SectionDeck>
      <SeamPulse />
      <Work />
      <SeamPulse />
      <About />
      <SeamPulse />
      <Roadmap />
      <SeamPulse />
      {/* anchorId lives on the deck's in-flow sentinel (not the sticky
          section) so #principles lands at the deck top from any direction. */}
      <SectionDeck variant="gentle" desktopOnly requireFit anchorId="principles">
        <SectionDeckUnder>
          <Principles />
        </SectionDeckUnder>
        <SectionDeckOver lip>
          <Contact />
        </SectionDeckOver>
      </SectionDeck>
    </main>
  );
}
