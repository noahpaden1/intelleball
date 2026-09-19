import Link from "next/link";
import { SeamPulse } from "@/components/ui/SeamPulse";
import { Year } from "@/components/ui/Year";
import { site } from "@/content/site";

export function Footer() {
  return (
    <footer>
      <SeamPulse />
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-10 text-caption text-ink-dim sm:flex-row sm:items-center sm:justify-between">
        <p>
          © <Year /> {site.name} · {site.org}
        </p>
        <div className="flex gap-6">
          <a
            href={site.github}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-300 hover:text-ink"
          >
            GitHub
          </a>
          <a
            href={`mailto:${site.email}`}
            className="transition-colors duration-300 hover:text-ink"
          >
            Email
          </a>
          <Link
            href="/login"
            className="transition-colors duration-300 hover:text-ink"
          >
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
