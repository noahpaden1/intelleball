"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AmbientDrift } from "@/components/art/AmbientDrift";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import { LiquidButton } from "@/components/ui/LiquidButton";
import { SeamPulse } from "@/components/ui/SeamPulse";
import { useAuth } from "@/components/auth/AuthProvider";
import { signOut, type Session } from "@/lib/auth";
import {
  buildDemoSession,
  formatClock,
  formatDay,
  timeOfDayGreeting,
  type DemoSession,
} from "@/lib/demoData";
import { reveal } from "@/lib/motion";
import { useSensorFeed, type FeedStatus } from "@/lib/useSensorFeed";
import { cn } from "@/lib/utils";
import { live } from "@/content/live";
import { site } from "@/content/site";
import { LiveSensorPanel } from "./LiveSensorPanel";
import { SessionChart } from "./SessionChart";

/**
 * /dashboard — the signed-in view. Client-only by nature: the session
 * lives in the browser, so the server renders the neutral shell and the
 * guard below redirects to /login once hydration reveals there is no
 * session. The live panel reads the ball's real feed (lib/useSensorFeed);
 * the per-kick session beneath it is still simulated (lib/demoData) until
 * the motion pipeline lands, and the footer says so.
 */
export function DashboardScreen() {
  const router = useRouter();
  const { session, hydrated } = useAuth();
  // Set before an explicit sign-out so the guard below does not race the
  // sign-out's own navigation (the session flips to null while this screen
  // is still mounted, and the guard would otherwise win with /login).
  const leavingRef = useRef(false);

  useEffect(() => {
    if (hydrated && !session && !leavingRef.current) router.replace("/login");
  }, [hydrated, session, router]);

  const handleSignOut = () => {
    leavingRef.current = true;
    signOut();
    router.replace("/");
  };

  if (!hydrated || !session) return <Shell />;
  return <Dashboard session={session} onSignOut={handleSignOut} />;
}

/** Neutral shell for SSR / pre-redirect: chrome only, no data. */
function Shell() {
  return (
    <main className="min-h-svh bg-canvas">
      <Chrome />
    </main>
  );
}

function Chrome({ session, onSignOut }: { session?: Session; onSignOut?: () => void }) {
  const initials = session
    ? session.user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  return (
    <header className="sticky top-0 z-40 border-b border-line">
      <div aria-hidden className="glass pointer-events-none absolute inset-x-0 top-0 -bottom-px -z-10" />
      <div className="mx-auto flex h-13 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-display text-sm font-semibold tracking-tight transition-colors duration-300 hover:text-azure"
          >
            {site.shortName}
          </Link>
          <span aria-hidden className="h-4 w-px bg-line" />
          <span className="text-caption text-ink-dim">Dashboard</span>
        </div>
        {session ? (
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2.5 sm:flex">
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full p-px"
                style={{ backgroundImage: "var(--gradient-spectrum)" }}
              >
                <span className="flex h-full w-full items-center justify-center rounded-full bg-canvas font-mono text-[10px] font-medium text-ink">
                  {initials}
                </span>
              </span>
              <span className="text-caption text-ink-mid">{session.user.name}</span>
            </div>
            <LiquidButton variant="ghost" size="sm" onClick={onSignOut}>
              Sign out
            </LiquidButton>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function Dashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  // Anchored once per mount: the demo session is a snapshot, not a clock.
  const [now] = useState(() => Date.now());
  const [data] = useState<DemoSession>(() => buildDemoSession(session.user.email, now));
  const firstName = session.user.name.split(" ")[0];
  const { device } = site.dashboard;
  // The real feed: polls Supabase while this screen is mounted (never on
  // the pre-session shell). The greeting pill and device card follow it.
  const feed = useSensorFeed();
  const online = feed.status === "live";
  const lastSyncMs = feed.latest ? Date.parse(feed.latest.created_at) : NaN;

  const tiles = [
    { value: `${data.throws.length}`, label: "kicks this session" },
    { value: `${data.avgSpinRpm} rpm`, label: "average spin rate" },
    { value: `${data.peakReleaseMps.toFixed(1)} m/s`, label: "peak ball speed" },
    { value: `${data.bestAngleDeg.toFixed(1)}°`, label: "best launch angle" },
  ];

  return (
    <main className="relative min-h-svh bg-canvas">
      <Chrome session={session} onSignOut={onSignOut} />
      <div className="relative overflow-hidden">
        <AmbientDrift variant="b" />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-14">
          {/* Greeting row */}
          <Reveal y={16}>
            <p className="font-mono text-eyebrow uppercase text-ink-dim">
              Session · {formatDay(now)}
            </p>
          </Reveal>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <Reveal delay={0.06}>
              <h1 className="text-headline text-balance">
                {timeOfDayGreeting(now)}, {firstName}.
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "flex items-center gap-2 rounded-pill border px-3 py-1 text-caption",
                    online
                      ? "border-mint/30 bg-mint/10 text-mint"
                      : "border-line bg-raised text-ink-dim"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-mint" : "bg-ink-dim")}
                  />
                  {signalLabel(feed.status)} · {device.network}
                </span>
                <span className="rounded-pill border border-line bg-raised px-3 py-1 font-mono text-caption text-ink-mid">
                  {device.name}
                </span>
              </div>
            </Reveal>
          </div>

          {/* Live feed — the real thing, full width */}
          <Reveal delay={0.16} className="mt-10">
            <LiveSensorPanel feed={feed} />
          </Reveal>

          {/* Stat tiles */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((tile, i) => (
              <Reveal key={tile.label} delay={i * reveal.stagger}>
                <div className="h-full rounded-panel border border-line bg-surface px-6 py-5">
                  <p className="text-title tracking-tight text-ink">
                    <CountUp value={tile.value} />
                  </p>
                  <p className="mt-1 text-caption text-ink-dim">{tile.label}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Chart + device */}
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Reveal delay={0.1}>
              <Panel title="Spin rate per kick" caption="rpm · simulated session">
                <div className="mt-5">
                  <SessionChart throws={data.throws} />
                </div>
              </Panel>
            </Reveal>

            <Reveal delay={0.16}>
              <Panel title={device.name} caption={`${device.board} · firmware ${device.firmware}`}>
                <dl className="mt-5 space-y-3">
                  <Row label={live.device.signalLabel}>
                    <span className={cn("flex items-center gap-2", online && "text-mint")}>
                      <span
                        aria-hidden
                        className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-mint" : "bg-ink-dim")}
                      />
                      {signalLabel(feed.status)}
                    </span>
                  </Row>
                  <Row label={live.device.lastSyncLabel}>
                    <span className="font-mono tabular-nums">
                      {Number.isNaN(lastSyncMs) ? live.nullValue : formatClock(lastSyncMs)}
                    </span>
                  </Row>
                  <Row label="Battery">
                    <div className="flex items-center gap-3">
                      <span className="relative h-1.5 w-24 overflow-hidden rounded-pill bg-raised">
                        <span
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-pill",
                            data.device.batteryPct > 30 ? "bg-mint" : "bg-rose"
                          )}
                          style={{ width: `${data.device.batteryPct}%` }}
                        />
                      </span>
                      <span className="font-mono tabular-nums">{data.device.batteryPct}%</span>
                    </div>
                  </Row>
                  <Row label="Wi-Fi">
                    <span className="font-mono tabular-nums">
                      {device.network} · {data.device.rssiDbm} dBm
                    </span>
                  </Row>
                  <Row label={live.device.sampleRateLabel}>
                    <span className="font-mono tabular-nums">{live.device.sampleRate}</span>
                  </Row>
                </dl>
                <p className="mt-6 text-caption text-ink-dim text-pretty">{live.device.simulatedNote}</p>
              </Panel>
            </Reveal>
          </div>

          {/* Recent kicks — the chart's table view */}
          <Reveal delay={0.1} className="mt-6">
            <Panel title="Recent kicks" caption={`${data.throws.length} kicks · newest first`}>
              <div className="-mx-6 mt-4 overflow-x-auto px-6">
                <table className="w-full min-w-[640px] border-collapse text-caption">
                  <thead>
                    <tr className="text-left text-ink-dim">
                      {["#", "Time", "Spin", "Speed", "Angle", "Apex", "Hang", "Impact"].map((h, i) => (
                        <th
                          key={h}
                          scope="col"
                          className={cn(
                            "border-b border-line py-2.5 pr-4 font-medium",
                            i >= 2 && "text-right"
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.throws].reverse().map((t) => (
                      <tr key={t.id} className="text-ink-mid transition-colors hover:bg-raised/60">
                        <td className="py-2.5 pr-4 font-mono text-ink-dim">{t.id}</td>
                        <td className="py-2.5 pr-4 font-mono">{formatClock(t.at)}</td>
                        <Num>{t.spinRpm} rpm</Num>
                        <Num>{t.releaseMps.toFixed(1)} m/s</Num>
                        <Num>{t.angleDeg.toFixed(1)}°</Num>
                        <Num>{t.apexM.toFixed(2)} m</Num>
                        <Num>{t.hangS.toFixed(2)} s</Num>
                        <Num>{t.impactG.toFixed(1)} g</Num>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-8 text-caption text-ink-dim text-pretty">
              Simulated session: the kicks, spin chart and table above are generated locally until
              the motion pipeline ships in{" "}
              {site.timeline.find((m) => m.id === "motion-pipeline")?.dates}; only the live panel
              reads the ball. Accounts and sessions live only in this browser.
            </p>
          </Reveal>
        </div>
      </div>

      <footer>
        <SeamPulse />
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-caption text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            {site.name} · {site.org}
          </p>
          <Link href="/" className="transition-colors duration-300 hover:text-ink">
            Back to the site
          </Link>
        </div>
      </footer>
    </main>
  );
}

/**
 * Greeting-pill / device-card wording for a feed status. Stale and error
 * are kept apart: a ball resting for 10 s is "Idle", a failed read is the
 * panel's own "Offline", and only an empty table is "No signal".
 */
function signalLabel(status: FeedStatus): string {
  if (status === "live") return live.device.connected;
  if (status === "connecting") return live.device.connecting;
  if (status === "stale") return live.device.idle;
  if (status === "error") return live.status.error.label;
  return live.device.noSignal;
}

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative h-full overflow-hidden rounded-card border border-line bg-surface p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--gradient-panel-sheen)" }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
          {caption ? <p className="text-caption text-ink-dim">{caption}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-caption">
      <dt className="text-ink-dim">{label}</dt>
      <dd className="text-ink-mid">{children}</dd>
    </div>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{children}</td>;
}
