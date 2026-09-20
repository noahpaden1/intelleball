import { CardArt } from "@/components/art";
import { AmbientDrift } from "@/components/art/AmbientDrift";
import { Reveal } from "@/components/motion/Reveal";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TelemetryShowcase } from "@/components/showcase/telemetry/TelemetryShowcase";
import { FlightShowcase } from "@/components/showcase/flight/FlightShowcase";
import { HardwareShowcase } from "@/components/showcase/hardware/HardwareShowcase";
import { site, type Project } from "@/content/site";

const STATUS_LABEL: Record<Project["status"], string> = {
  active: "In development",
  shipped: "Shipped",
  "in-planning": "Planned",
};

export function Work() {
  const byId = new Map(site.projects.map((p) => [p.id, p]));
  const more = site.projects.filter((p) => !p.featured);

  return (
    <section id="work" className="scroll-mt-16">
      <div className="relative px-6 pt-28 md:pt-36">
        {/* mask-b: feather the layer out before the strip's bare bottom
            boundary with the showcase below — the azure blob is
            bottom-anchored and would otherwise hard-clip mid-glow. */}
        <AmbientDrift variant="b" className="mask-b-from-75%" />
        <div className="relative mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="How it works"
            title="Sense it. Send it. Understand it."
            lead="Three systems, one soccer ball. Each one below is explorable: replay a kick as the sensor sees it, watch integration drift get bounded instead of ignored, and open the ball up layer by layer."
          />
        </div>
      </div>

      {/* Flagship showcases — each is a self-contained scroll experience */}
      <TelemetryShowcase />
      <ProjectMeta project={byId.get("live-telemetry")} />

      <FlightShowcase />
      <ProjectMeta project={byId.get("flight-analysis")} />

      <HardwareShowcase />
      <ProjectMeta project={byId.get("sensor-core")} />

      {/* Secondary projects */}
      <div className="relative px-6 pb-28 pt-20 md:pb-36">
        <AmbientDrift variant="c" />
        <div className="relative mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {more.map((project, i) => (
            <Reveal key={project.id} delay={i * 0.08}>
              <SecondaryCard project={project} seed={i + 11} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Slim "spec strip" between showcases: the project's tech tags plus its
 * repository link, so the deep-dive sections keep their cinematic focus.
 */
function ProjectMeta({ project }: { project?: Project }) {
  if (!project) return null;
  return (
    <div className="border-y border-line bg-surface/40 px-6 py-5">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-pill border border-line bg-raised px-3 py-1 text-caption text-ink-mid"
            >
              {tag}
            </span>
          ))}
        </div>
        {project.github ? (
          <a
            href={project.github}
            target="_blank"
            rel="noopener noreferrer"
            className="group text-caption text-azure"
          >
            View on GitHub
            <span className="inline-block transition-transform duration-300 ease-glide group-hover:translate-x-1">
              {" "}
              ↗
            </span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

function SecondaryCard({ project, seed }: { project: Project; seed: number }) {
  return (
    // Hover lift lives on the SpotlightCard wrapper so the ::before/::after
    // border ring translates WITH the card (a lift on the inner article
    // alone leaves the glowing ring 4px behind on every hover).
    <SpotlightCard
      accent={project.accent}
      className="h-full rounded-card transition-transform duration-500 ease-glide hover:-translate-y-1"
    >
      <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface p-7 transition-all duration-500 ease-glide hover:border-ink-dim/50">
        <div aria-hidden className="absolute inset-0">
          <CardArt
            accent={project.accent}
            seed={seed}
            className="h-full w-full"
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ backgroundImage: `var(--gradient-card-${project.accent})` }}
        />
        <div className="relative flex flex-1 flex-col">
          <div className="flex items-center justify-between gap-3">
            <p className="text-caption text-ink-dim">{project.kicker}</p>
            <span className="flex items-center gap-1.5 text-caption text-ink-dim">
              <span
                aria-hidden
                className={
                  project.status === "shipped"
                    ? "h-1.5 w-1.5 rounded-full bg-mint"
                    : project.status === "active"
                      ? "h-1.5 w-1.5 rounded-full bg-azure"
                      : "h-1.5 w-1.5 rounded-full bg-ink-dim"
                }
              />
              {STATUS_LABEL[project.status]}
            </span>
          </div>
          <h3 className="mt-2 text-title">{project.title}</h3>
          <p className="mt-3 text-body text-ink-mid text-pretty">
            {project.summary}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {project.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-pill border border-line bg-raised px-3 py-1 text-caption text-ink-mid"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-auto flex items-baseline justify-between gap-4 pt-6">
            <p className="text-caption text-ink-dim">
              <span className="font-semibold text-ink">{project.heroStat.value}</span>{" "}
              {project.heroStat.label}
            </p>
            {project.github ? (
              <a
                href={project.github}
                target="_blank"
                rel="noopener noreferrer"
                className="group/link shrink-0 text-caption text-azure"
              >
                Source
                <span className="inline-block transition-transform duration-300 ease-glide group-hover/link:translate-x-0.5">
                  {" "}
                  ↗
                </span>
              </a>
            ) : null}
          </div>
        </div>
      </article>
    </SpotlightCard>
  );
}
