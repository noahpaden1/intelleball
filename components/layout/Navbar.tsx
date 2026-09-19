"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { Magnetic } from "@/components/motion/Magnetic";
import { LiquidButton } from "@/components/ui/LiquidButton";
import { ScrollProgressHairline } from "@/components/ui/ScrollProgressHairline";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { dur, ease, nav, spring } from "@/lib/motion";
import { useActiveSection } from "@/lib/useActiveSection";
import { site } from "@/content/site";

const SECTION_IDS = site.nav.map((item) => item.href.slice(1));

/**
 * Apple-style navigation: transparent over the hero, then frosted glass
 * (blur + saturation) once scrolled. Hides on scroll-down, returns on
 * scroll-up. Mobile gets a full-screen glass overlay with staggered links.
 * The chip is auth-aware: "Sign in" until a client session exists, then
 * "Dashboard" (the server always renders "Sign in" — the store's server
 * snapshot is null — and the client corrects it right after hydration).
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const active = useActiveSection(SECTION_IDS);
  const pathname = usePathname();
  const { session } = useAuth();

  // Section anchors resolve on the home page; elsewhere they route home first.
  const hrefFor = (hash: string) => (pathname === "/" ? hash : `/${hash}`);
  const chip = session
    ? { label: "Dashboard", href: "/dashboard" }
    : { label: "Sign in", href: "/login" };

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > nav.glassAt);
    setHidden(y > prev && y > nav.hideAfter && !open);
  });

  // Mobile menu keyboard support: Escape closes (returning focus to the
  // toggle), Tab cycles within menu links + toggle, body scroll locks.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const links = [
      ...(overlayRef.current?.querySelectorAll<HTMLElement>("a") ?? []),
    ];
    links[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || links.length === 0) return;
      const active = document.activeElement;
      const first = links[0];
      const last = links[links.length - 1];
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        toggleRef.current?.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        toggleRef.current?.focus();
      } else if (active === toggleRef.current) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <motion.header
      initial={false}
      animate={hidden ? "hidden" : "visible"}
      variants={{ hidden: { y: "-100%" }, visible: { y: 0 } }}
      transition={spring.gentle}
      // Keyboard focus into the hidden bar slides it back into view
      onFocusCapture={() => setHidden(false)}
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-500",
        scrolled || open ? "border-line" : "border-transparent"
      )}
    >
      {/* Glass lives on a sibling layer, not the header itself: an
          ancestor with backdrop-filter becomes the backdrop root for the
          LiquidButton chip's frost/refraction layers and blinds them to
          the page (they'd re-filter a flat slab). */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 -bottom-px -z-10 transition-colors duration-500",
          scrolled || open ? "glass" : "bg-transparent"
        )}
      />
      <ScrollProgressHairline />

      <nav className="mx-auto flex h-13 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-display text-sm font-semibold tracking-tight transition-colors duration-300 hover:text-azure"
          onClick={() => setOpen(false)}
        >
          {site.shortName}
        </Link>

        {/* Desktop links — active section gets aria-current + accent dot */}
        <ul className="hidden items-center gap-8 md:flex">
          {site.nav.map((item) => {
            const isActive = active === item.href.slice(1);
            return (
              <li key={item.href} className="relative">
                <Link
                  href={hrefFor(item.href)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "text-[13px] transition-colors duration-300 hover:text-ink",
                    isActive ? "text-ink" : "text-ink-mid"
                  )}
                >
                  {item.label}
                </Link>
                <span
                  aria-hidden
                  className={cn(
                    "absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-azure transition-all duration-[250ms] ease-glide",
                    isActive ? "opacity-100" : "translate-y-1 opacity-0"
                  )}
                />
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-4">
          <Magnetic className="hidden md:block" strength={5}>
            <LiquidButton href={chip.href} variant="ghost" size="sm">
              {chip.label}
            </LiquidButton>
          </Magnetic>

          {/* Mobile menu button */}
          <button
            ref={toggleRef}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="relative flex h-8 w-8 items-center justify-center md:hidden"
          >
            <span
              className={cn(
                "absolute h-px w-5 bg-ink transition-transform duration-300 ease-soft",
                open ? "rotate-45" : "-translate-y-[3.5px]"
              )}
            />
            <span
              className={cn(
                "absolute h-px w-5 bg-ink transition-transform duration-300 ease-soft",
                open ? "-rotate-45" : "translate-y-[3.5px]"
              )}
            />
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.fast, ease: ease.soft }}
            className="glass-heavy fixed inset-x-0 top-13 bottom-0 md:hidden"
          >
            <motion.ul
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.06 } },
              }}
              className="flex flex-col gap-2 px-8 pt-10"
            >
              {[...site.nav.map((item) => ({ label: item.label, href: hrefFor(item.href) })), chip].map(
                (item) => (
                  <motion.li
                    key={item.href}
                    variants={{
                      hidden: { opacity: 0, y: 16 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: dur.base, ease: ease.glide },
                      },
                    }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block py-3 text-title transition-colors hover:text-azure",
                        item.href === chip.href ? "text-azure" : "text-ink"
                      )}
                    >
                      {item.label}
                    </Link>
                  </motion.li>
                )
              )}
            </motion.ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
