import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={cn("max-w-3xl", centered && "mx-auto text-center")}>
      <Reveal>
        <p className="text-eyebrow uppercase text-azure">{eyebrow}</p>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="mt-4 text-headline text-balance">{title}</h2>
      </Reveal>
      {lead ? (
        <Reveal delay={0.16}>
          <p className="mt-5 text-lead text-ink-mid text-pretty">{lead}</p>
        </Reveal>
      ) : null}
    </div>
  );
}
