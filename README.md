# Intelleball

A smart soccer ball with a nine-axis inertial core (Bosch BNO055) and a Wi-Fi radio (Seeed XIAO ESP32) sealed at its center. Spin, ball speed, arc and impact, sampled at 100 Hz and streamed to a dashboard.

This repo holds two things:

| Path | What it is |
|---|---|
| `seeed_firmware/` | Arduino sketches for the ball: BNO055 bring-up over I²C and a WPA2-Enterprise (PEAP) Wi-Fi bench test for eduroam. |
| everything else | The product site: a single-page, scroll-driven Next.js app with a working front-end login and a telemetry dashboard. |

## Site

### Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. `npm run build` produces the production bundle; `npm run lint` and `npm run typecheck` do what they say.

### Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Framer Motion · hand-rolled WebGL (no three.js).

### How it is organized

- **`content/site.ts` — every word on the site.** Nav, hero, the three pinned-story beats, the projects, story paragraphs, roadmap, stack, principles, contact, and the login/dashboard copy. To change what the site says, edit here, not in `components/`. Showcase-specific copy and physics live in `content/demos/`.
- **`theme.config.mjs` — the design system.** Colors, gradients, type scale, radii and motion tokens. `npm run theme` (runs automatically before `dev` and `build`) compiles it into `app/theme.css` as Tailwind `@theme` variables; `lib/motion.ts` exposes the same tokens, typed, to Framer Motion. Never edit `app/theme.css` by hand.
- **`app/(site)/page.tsx`** — the single page, top to bottom: Hero → pinned story → Work (three explorable showcases + secondary cards) → Story → Roadmap → Principles → Contact.
- **`app/login`** and **`app/dashboard`** — the account flow (below).
- **`components/art/`** — the WebGL surfaces (`BallScanHero`, `CyberGridCanvas`, `NeuralNoiseCanvas`) on a shared harness (`lib/glHarness.ts`) with adaptive DPR, offscreen pausing, context-loss recovery and a 2D/CSS fallback for each.
- **`components/showcase/`** — the three flagship interactives: a sample-by-sample kick replay, a drift explorer, and a scroll-scrubbed exploded view of the hardware.

Every effect has a `prefers-reduced-motion` fallback, every WebGL surface has a no-WebGL fallback, and all animation is compositor-only (transform + opacity).

### Login and dashboard

The login is handled entirely in the browser and is fully functional: accounts are stored in `localStorage`, passwords are never stored (PBKDF2-SHA256, 100k iterations, per-user salt, via WebCrypto), and the session gates `/dashboard`. A demo account is seeded on first visit:

```
demo@intelleball.app / intelleball
```

`lib/auth.ts` exposes four verbs (`signUp`, `signIn`, `signOut`, `getSession`) plus a `subscribe` for `useSyncExternalStore`. Swap those for API calls when the backend lands; nothing in the UI needs to change. The live panel at the top of the dashboard reads the ball's real feed (below); the per-kick session under it (tiles, spin chart, table) is simulated (`lib/demoData.ts`, seeded per account) until the motion pipeline ships.

WebCrypto needs a secure context, so sign-in works on `localhost` and over https, not on a plain-http LAN address.

### Live sensor feed (Supabase)

The ingest path will write the ball's IMU samples into a Supabase table, `public.sensor_data`, with the columns `id`, `created_at`, `x y z` (m), `vx vy vz` (m/s) and `ax ay az` (m/s²); every sensor field is nullable. Today the table is populated by hand for testing (nothing in `seeed_firmware/` talks to Supabase yet — the sketches print to Serial). The dashboard shows the newest row live:

- **`lib/supabase.ts`** — the project URL, the anon key, the `SensorRow` type and one function, `fetchNewSamples(afterId, limit)`: a plain `fetch` of `GET /rest/v1/sensor_data?select=*&id=gt.<afterId>&order=id.desc&limit=<limit>` (no `id` filter on the first call). It also returns the response's `Date` header as the server's clock. No `@supabase/supabase-js`.
- **`lib/useSensorFeed.ts`** — a client hook that polls that read every 0.5 s on a `setTimeout` chain (a slow request never overlaps the next), asking only for rows newer than the last one seen (the first poll takes the newest 120), pauses while the tab is hidden, aborts in-flight requests on unmount, and backs off 0.5 → 1 → 2 → 4 → 8 s on errors. It exposes `latest`, the table's last 120 rows for the sparkline, a `clockOffsetMs` (server minus viewer clock, so a skewed laptop clock cannot mislabel fresh rows), and a status: `connecting` · `live` (row under 10 s old on the server's clock) · `stale` · `empty` · `error` (the previous row stays on screen).
- **`components/dashboard/LiveSensorPanel.tsx`** — the panel: status pill, `row #id · time · age`, the nine axes, derived |v| and |a|, and the |a| sparkline (`LiveTrace.tsx`). Copy lives in `content/live.ts`.

Configuration — two env vars, with the team project's values as fallbacks in `lib/supabase.ts` (see `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Both are public by design: Supabase anon keys are meant to ship in the browser bundle, and Row Level Security on the project decides what they can do. **The site is read-only** — it never inserts, updates or deletes, and nothing in the app writes to the project. Keep the RLS policy that way too: the `anon` role must be SELECT-only on `sensor_data`.

### Before deploying

- Set `domain` in `content/site.ts` to the real URL (it feeds `metadataBase`, `robots.ts` and `sitemap.ts`).
- Set `email` to the team inbox.

## Firmware

Two sketches in `seeed_firmware/`, written for the Arduino IDE with the ESP32 board package:

- `bno055_test1.ino` — reads linear acceleration from the BNO055 over I²C (`Wire.begin(21, 22)`) every 10 ms, zeroes readings under 0.5 m/s², and integrates twice to a position estimate. Needs `Adafruit BNO055` + `Adafruit Unified Sensor`.
- `benchmark_wifi_test.ino` — joins eduroam over WPA2-Enterprise (PEAP) and prints IP, gateway, subnet, RSSI and MAC, then logs connection status every 5 s. Fill in `EAP_IDENTITY` / `EAP_USERNAME` / `EAP_PASSWORD` locally; never commit real credentials.

Known limitation of the current motion sketch: double-integrating accelerometer data drifts without bound. The planned fix (see the roadmap on the site) is stillness detection with zero-velocity updates, per-kick integration windows, post-hoc velocity correction, and taking spin straight from the gyroscope.

## Team

Noah Paden · Zachary Bezanson · Pranav Pothapragada — Virginia Tech.
