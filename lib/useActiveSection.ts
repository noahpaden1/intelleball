"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Tracks which section currently occupies the viewport's middle band.
 *
 * One IntersectionObserver with rootMargin "-45% 0px -45% 0px" (a 10%-tall
 * band at the viewport's center) over the given element ids; whichever
 * section intersects that band last wins. Returns null on the server and
 * before the first observation. Re-observes when the ids array identity
 * changes; disconnects fully on cleanup.
 *
 * Consumed by the Navbar for aria-current + the accent dot.
 */
export function useActiveSection(ids: string[]): string | null {
  // The Navbar lives in a persistent layout: after a client-side route
  // change the section elements are brand-new nodes (or absent), so the
  // observer must re-attach to the current DOM — and drop its strong
  // references to the previous page's detached subtree. The active id is
  // keyed by pathname so a stale section never survives a route change.
  const pathname = usePathname();
  const [state, setState] = useState<{ key: string; active: string | null }>({
    key: pathname,
    active: null,
  });
  const active = state.key === pathname ? state.active : null;

  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        // Last-writer-wins: the most recent section to enter the band.
        for (const entry of entries) {
          if (entry.isIntersecting) setState({ key: pathname, active: entry.target.id });
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    for (const el of els) io.observe(el);

    return () => io.disconnect();
  }, [ids, pathname]);

  return active;
}
