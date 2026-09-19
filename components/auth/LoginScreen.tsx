"use client";

import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AmbientDrift } from "@/components/art/AmbientDrift";
import { Reveal } from "@/components/motion/Reveal";
import { LiquidButton } from "@/components/ui/LiquidButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { signIn, signOut, signUp, type AuthField } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { site } from "@/content/site";

type Mode = "signin" | "signup";
type Errors = Partial<Record<AuthField | "form", string>>;

const MODE_LABEL: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create account",
};

/**
 * The /login screen: a glass card over the ambient field. Sign-in and
 * create-account share one form; the verbs in lib/auth.ts do the
 * validation and hand back a field to highlight. Already signed in →
 * a short "you're in" card instead of the form.
 */
export function LoginScreen() {
  const router = useRouter();
  const { session, hydrated } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const copy = mode === "signin" ? site.auth.signIn : site.auth.signUp;
  const signedIn = hydrated && session !== null;

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
  };

  const useDemo = () => {
    switchMode("signin");
    setEmail(site.auth.demo.email);
    setPassword(site.auth.demo.password);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    const result =
      mode === "signin"
        ? await signIn({ email, password })
        : await signUp({ name, email, password });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.field ? { [result.field]: result.error } : { form: result.error });
      return;
    }
    router.push("/dashboard");
  };

  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-canvas">
      <AmbientDrift variant="a" />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="font-display text-sm font-semibold tracking-tight transition-colors duration-300 hover:text-azure"
        >
          {site.shortName}
        </Link>
        <Link href="/" className="group text-caption text-ink-mid transition-colors hover:text-ink">
          <span className="inline-block transition-transform duration-300 ease-glide group-hover:-translate-x-1">
            ←{" "}
          </span>
          Back to the site
        </Link>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-20 pt-6">
        <div className="w-full max-w-md">
          <Reveal y={20}>
            <div className="relative overflow-hidden rounded-card border border-line bg-surface/85 p-7 shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:p-9">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ backgroundImage: "var(--gradient-panel-sheen)" }}
              />

              {signedIn ? (
                <div className="relative">
                  <p className="text-eyebrow uppercase text-mint">Signed in</p>
                  <h1 className="mt-4 text-title text-balance">
                    You&apos;re in, {session.user.name.split(" ")[0]}.
                  </h1>
                  <p className="mt-3 text-caption text-ink-mid">
                    Signed in as {session.user.email} on this browser.
                  </p>
                  <div className="mt-7 flex flex-wrap items-center gap-4">
                    <LiquidButton href="/dashboard" variant="primary" size="lg">
                      Go to dashboard
                    </LiquidButton>
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="text-caption text-ink-mid transition-colors hover:text-ink"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <p className="text-eyebrow uppercase text-azure">{copy.eyebrow}</p>
                  <h1 className="mt-4 text-title text-balance">{copy.title}</h1>
                  <p className="mt-3 text-caption text-ink-mid text-pretty">{copy.lead}</p>

                  {/* Mode toggle */}
                  <div
                    role="radiogroup"
                    aria-label="Sign in or create an account"
                    className="mt-6 grid grid-cols-2 rounded-pill border border-line bg-raised p-1"
                  >
                    {(["signin", "signup"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={mode === m}
                        onClick={() => switchMode(m)}
                        className={cn(
                          "rounded-pill py-2 text-caption font-medium transition-all duration-300 ease-glide",
                          mode === m
                            ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
                            : "text-ink-mid hover:text-ink"
                        )}
                      >
                        {MODE_LABEL[m]}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={submit} noValidate className="mt-6 space-y-4">
                    {mode === "signup" ? (
                      <Field
                        id="name"
                        label="Name"
                        autoComplete="name"
                        placeholder="Coach Taylor"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={errors.name}
                      />
                    ) : null}
                    <Field
                      id="email"
                      label="Email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      error={errors.email}
                    />
                    <Field
                      id="password"
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      error={errors.password}
                      trailing={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-pressed={showPassword}
                          className="rounded-pill px-2 py-1 text-caption text-ink-dim transition-colors hover:text-ink"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      }
                    />

                    {errors.form ? (
                      <p role="alert" className="text-caption text-rose">
                        {errors.form}
                      </p>
                    ) : null}

                    <LiquidButton
                      type="submit"
                      variant="primary"
                      size="lg"
                      disabled={busy}
                      className="w-full disabled:cursor-default disabled:opacity-60"
                    >
                      {busy
                        ? mode === "signin"
                          ? "Signing in…"
                          : "Creating account…"
                        : MODE_LABEL[mode]}
                    </LiquidButton>
                  </form>

                  {/* Demo account */}
                  <div className="mt-5 flex items-center justify-between gap-3 rounded-panel border border-line bg-raised/60 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-caption text-ink">Try the demo account</p>
                      <p className="truncate font-mono text-caption text-ink-dim">
                        {site.auth.demo.email} · {site.auth.demo.password}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={useDemo}
                      className="shrink-0 rounded-pill border border-line px-3 py-1 text-caption text-azure transition-colors duration-300 hover:border-azure/50"
                    >
                      Use demo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mx-auto mt-6 max-w-sm text-center text-caption text-ink-dim text-pretty">
              {site.auth.footnote}
            </p>
          </Reveal>
        </div>
      </div>
    </main>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  trailing?: ReactNode;
}

function Field({ id, label, error, trailing, className, ...input }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-caption text-ink-mid">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "w-full rounded-panel border bg-raised px-4 py-3 text-[15px] text-ink outline-none transition-colors duration-300 placeholder:text-ink-dim focus:border-azure/60 focus:ring-2 focus:ring-azure/25",
            error ? "border-rose/60" : "border-line",
            trailing && "pr-16",
            className
          )}
          {...input}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-caption text-rose">
          {error}
        </p>
      ) : null}
    </div>
  );
}
