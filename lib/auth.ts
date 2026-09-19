/**
 * Client-side accounts for the dashboard prototype.
 *
 * The brief: a login that is handled entirely on the front end but still
 * functional. So — users live in localStorage under one key; passwords are
 * never stored, only a per-user random salt plus a PBKDF2-SHA256 hash
 * (100k iterations, WebCrypto). The signed-in session is a second key.
 *
 * A tiny external store (subscribe / getSession) lets React read the
 * session through useSyncExternalStore with a `null` server snapshot, so
 * server render and hydration never disagree; the `storage` event re-emits
 * so a sign-out in one tab is seen by the others.
 *
 * Honest scope: this is a working prototype of the real flow, not an
 * account system. Everything in localStorage is readable by its owner, and
 * there is no server to trust. Swap the four exported verbs for API calls
 * when the telemetry backend lands — nothing in the UI needs to change.
 *
 * SSR-safe: no browser API is touched at module scope.
 */

const USERS_KEY = "intelleball:users:v1";
const SESSION_KEY = "intelleball:session:v1";
const PBKDF2_ITERATIONS = 100_000;
const MIN_PASSWORD_LENGTH = 8;

const INSECURE_CONTEXT =
  "Sign-in needs a secure context (https or localhost) so the browser can hash your password.";
const STORAGE_BLOCKED =
  "This browser is blocking local storage, so accounts can't be saved here.";
const NO_MATCH = "That email and password don't match.";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface StoredUser extends User {
  salt: string; // base64, 16 random bytes
  hash: string; // base64, PBKDF2-SHA256 / 256 bits
}

export interface Session {
  user: User;
  issuedAt: string;
}

export type AuthField = "name" | "email" | "password";

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; error: string; field?: AuthField };

export interface Credentials {
  email: string;
  password: string;
}

export interface SignUpInput extends Credentials {
  name: string;
}

/* ── Storage plumbing ─────────────────────────────────────────────────── */

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do — a blocked store has nothing to remove.
  }
}

/**
 * Stored users, first entry per email winning. Reads are deduped so a
 * concurrent double-seed (StrictMode's doubled effects, or two tabs
 * opening at once) can never produce two accounts for one address.
 */
function users(): StoredUser[] {
  const seen = new Set<string>();
  return (readJson<StoredUser[]>(USERS_KEY) ?? []).filter((u) => {
    if (seen.has(u.email)) return false;
    seen.add(u.email);
    return true;
  });
}

/* ── Session store (useSyncExternalStore contract) ───────────────────── */

const listeners = new Set<() => void>();
let cached: Session | null = null;
let cacheValid = false;
let storageBound = false;

function emit() {
  for (const listener of listeners) listener();
}

function bindStorageEvents() {
  if (storageBound) return;
  storageBound = true;
  window.addEventListener("storage", (e) => {
    // key === null means the whole store was cleared.
    if (e.key === SESSION_KEY || e.key === null) {
      cacheValid = false;
      emit();
    }
  });
}

/**
 * Current session, or null. Returns a stable reference between changes
 * (useSyncExternalStore requires it) and always null on the server.
 */
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  if (!cacheValid) {
    cached = readJson<Session>(SESSION_KEY);
    cacheValid = true;
  }
  return cached;
}

export function subscribe(listener: () => void): () => void {
  bindStorageEvents();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setSession(session: Session | null) {
  if (session) writeJson(SESSION_KEY, session);
  else removeKey(SESSION_KEY);
  cached = session;
  cacheValid = true;
  emit();
}

/* ── Hashing ──────────────────────────────────────────────────────────── */

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function subtle(): SubtleCrypto | null {
  return typeof crypto !== "undefined" && crypto.subtle ? crypto.subtle : null;
}

async function deriveHash(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const s = subtle();
  if (!s) throw new Error(INSECURE_CONTEXT);
  const key = await s.importKey(
    "raw",
    new TextEncoder().encode(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await s.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return toBase64(new Uint8Array(bits));
}

/** Length-guarded constant-time string compare (no early exit on mismatch). */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Something went wrong. Try again.";
}

/* ── Validation (shared by the form and the verbs) ───────────────────── */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateName(name: string): string | null {
  return name.trim().length >= 2 ? null : "Tell us what to call you (2+ characters).";
}

export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))
    ? null
    : "Enter a valid email address.";
}

export function validatePassword(password: string): string | null {
  return password.length >= MIN_PASSWORD_LENGTH
    ? null
    : `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
}

/* ── The four verbs ───────────────────────────────────────────────────── */

async function createUser(input: SignUpInput): Promise<StoredUser> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(input.password, salt);
  return {
    id: newId(),
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    createdAt: new Date().toISOString(),
    salt: toBase64(salt),
    hash,
  };
}

function openSession(stored: StoredUser): Session {
  const user: User = {
    id: stored.id,
    name: stored.name,
    email: stored.email,
    createdAt: stored.createdAt,
  };
  const session: Session = { user, issuedAt: new Date().toISOString() };
  setSession(session);
  return session;
}

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const nameError = validateName(input.name);
  if (nameError) return { ok: false, error: nameError, field: "name" };
  const emailError = validateEmail(input.email);
  if (emailError) return { ok: false, error: emailError, field: "email" };
  const passwordError = validatePassword(input.password);
  if (passwordError) return { ok: false, error: passwordError, field: "password" };

  const email = normalizeEmail(input.email);
  const list = users();
  if (list.some((u) => u.email === email)) {
    return {
      ok: false,
      error: "An account with that email already exists in this browser. Sign in instead.",
      field: "email",
    };
  }

  try {
    const user = await createUser(input);
    if (!writeJson(USERS_KEY, [...list, user])) {
      return { ok: false, error: STORAGE_BLOCKED };
    }
    return { ok: true, session: openSession(user) };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

export async function signIn(input: Credentials): Promise<AuthResult> {
  const emailError = validateEmail(input.email);
  if (emailError) return { ok: false, error: emailError, field: "email" };
  if (!input.password) return { ok: false, error: "Enter your password.", field: "password" };

  const email = normalizeEmail(input.email);
  const stored = users().find((u) => u.email === email);
  // One generic message for both "no such user" and "wrong password" —
  // the form must not confirm which emails have accounts.
  if (!stored) return { ok: false, error: NO_MATCH };

  try {
    const hash = await deriveHash(input.password, fromBase64(stored.salt));
    if (!constantTimeEqual(hash, stored.hash)) return { ok: false, error: NO_MATCH };
    return { ok: true, session: openSession(stored) };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

export function signOut() {
  setSession(null);
}

/**
 * Seed the demo account once per browser so the dashboard can be tried
 * without creating anything. Idempotent; silently no-ops where hashing or
 * storage is unavailable (the form reports those cases on submit).
 */
let seeding: Promise<void> | null = null;

export function ensureDemoAccount(demo: SignUpInput): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const email = normalizeEmail(demo.email);
  if (users().some((u) => u.email === email)) return Promise.resolve();
  // Coalesce concurrent callers (StrictMode runs the mounting effect twice)
  // onto one hashing pass, and re-check right before writing so a second
  // tab that won the race is not duplicated.
  if (!seeding) {
    seeding = (async () => {
      try {
        const user = await createUser(demo);
        const list = users();
        if (list.some((u) => u.email === email)) return;
        writeJson(USERS_KEY, [...list, user]);
      } catch {
        // No secure context / no storage — nothing to seed.
      } finally {
        seeding = null;
      }
    })();
  }
  return seeding;
}
