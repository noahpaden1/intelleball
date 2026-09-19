"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { ensureDemoAccount, getSession, subscribe, type Session } from "@/lib/auth";
import { site } from "@/content/site";

interface AuthState {
  /** The signed-in session, or null. Always null on the server and during hydration. */
  session: Session | null;
  /**
   * False on the server and for the hydration render, true immediately
   * after — guards (redirects, "signed in as…" chrome) wait for it so the
   * server markup and the first client render never disagree.
   */
  hydrated: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, hydrated: false });

// A store that never changes: server snapshot false, client snapshot true —
// the standard "am I past hydration?" primitive.
const subscribeNever = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;

/**
 * Exposes the client-side session (lib/auth.ts) to the tree and seeds the
 * demo account on first visit. Mount once, inside the motion Providers.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(subscribe, getSession, () => null);
  const hydrated = useSyncExternalStore(subscribeNever, clientTrue, serverFalse);

  useEffect(() => {
    void ensureDemoAccount(site.auth.demo);
  }, []);

  const value = useMemo<AuthState>(() => ({ session, hydrated }), [session, hydrated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
