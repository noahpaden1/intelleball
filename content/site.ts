/**
 * All site copy and product data. Components render from this file —
 * to change what the site says, edit here, not in components/.
 *
 * Numbers policy: hardware figures (BNO055 ranges, sample rates, radio
 * specs) are datasheet values. Anything that is a design target rather than
 * a measurement is worded as one. Roadmap entries carry an explicit status.
 */

export type Accent = "azure" | "violet" | "rose";

export interface Metric {
  value: string;
  label: string;
}

export interface Project {
  id: string;
  kicker: string; //  context line above the title (category)
  title: string;
  summary: string;
  heroStat: Metric; //  the one number shown large on the card visual
  metrics: Metric[];
  tags: string[];
  accent: Accent;
  github?: string;
  status: "active" | "shipped" | "in-planning";
  featured: boolean;
}

export type MilestoneStatus = "shipped" | "in-progress" | "planned";

export interface Milestone {
  id: string;
  dates: string;
  title: string;
  subtitle: string;
  description: string;
  outcomes: string[];
  status: MilestoneStatus;
}

export interface SkillGroup {
  group: string;
  /** level: maturity in the current build on a 5-dot scale (5 = shipped) */
  items: { name: string; level: number }[];
}

export const site = {
  name: "Intelleball",
  shortName: "Intelleball",
  tagline: "The ball that measures itself.",
  // TODO: replace with the production domain once deployed.
  domain: "https://intelleball.vercel.app",
  // TODO: swap for the team inbox.
  email: "pranavpothap@gmail.com",
  github: "https://github.com/noahpaden1/intelleball",
  org: "Virginia Tech",
  team: ["Noah Paden", "Zachary Bezanson", "Pranav Pothapragada"],

  nav: [
    { label: "Work", href: "#work" },
    { label: "Story", href: "#about" },
    { label: "Roadmap", href: "#roadmap" },
    { label: "Principles", href: "#principles" },
    { label: "Contact", href: "#contact" },
  ],

  hero: {
    eyebrow: "Smart-ball telemetry · Virginia Tech",
    // Rendered as two staggered segments; the second gets gradient text.
    headline: ["Every throw,", "measured in flight."],
    lead: "A nine-axis inertial core and a Wi-Fi radio, sealed at the center of the ball. Spin, release velocity, arc and impact, sampled at 100 Hz and on your dashboard before the ball stops rolling.",
    primaryCta: { label: "See how it works", href: "#work" },
    secondaryCta: { label: "Open the dashboard", href: "/login" },
  },

  // The pinned scroll-story section under the hero: the thesis in three beats.
  pillars: [
    {
      eyebrow: "01 · Sense",
      title: "An instrument where the ball's center is.",
      body: "A Bosch BNO055 fuses accelerometer, gyroscope and magnetometer on-chip, so orientation and linear acceleration arrive clean at 100 Hz, from inside the ball itself.",
    },
    {
      eyebrow: "02 · Transmit",
      title: "Off the ball before it lands.",
      body: "An ESP32 streams every sample over Wi-Fi, WPA2-Enterprise included, so it works on a campus network with no phone tethered to the ball.",
    },
    {
      eyebrow: "03 · Understand",
      title: "Numbers a coach can use.",
      body: "Raw motion becomes spin rate, release velocity, arc and impact force: per-throw stats on a dashboard, with the drift math handled so the numbers hold up.",
    },
  ],

  projects: [
    {
      id: "live-telemetry",
      kicker: "Flagship · Sensing",
      title: "Live telemetry",
      summary:
        "Every sample the BNO055 produces, linear acceleration, angular rate and orientation, leaves the ball over Wi-Fi as it happens. Below: one throw, replayed sample by sample.",
      heroStat: { value: "100 Hz", label: "fused sensor output from the IMU" },
      metrics: [
        { value: "9-axis", label: "accelerometer + gyroscope + magnetometer" },
        { value: "±16 g", label: "accelerometer range" },
        { value: "±2000 °/s", label: "gyroscope range" },
      ],
      tags: ["BNO055", "ESP32", "I²C", "Sensor fusion", "Wi-Fi"],
      accent: "azure",
      github: "https://github.com/noahpaden1/intelleball",
      status: "active",
      featured: true,
    },
    {
      id: "flight-analysis",
      kicker: "Flagship · Analysis",
      title: "Flight analysis",
      summary:
        "Raw motion is not a stat. Between release and impact the pipeline turns acceleration and spin into numbers a coach can act on, with the integration drift bounded instead of ignored.",
      heroStat: { value: "2×", label: "integrations from acceleration to position, where drift lives" },
      metrics: [
        { value: "5", label: "stats per throw: spin, release speed, launch angle, apex, hang time" },
        { value: "0 m/s", label: "velocity pinned at every detected stillness (zero-velocity update)" },
        { value: "100 Hz", label: "sample rate the model runs at" },
      ],
      tags: ["Projectile model", "ZUPT", "Drift correction", "TypeScript"],
      accent: "violet",
      status: "active",
      featured: true,
    },
    {
      id: "sensor-core",
      kicker: "Flagship · Hardware",
      title: "The sensor core",
      summary:
        "A Seeed XIAO ESP32 and a Bosch BNO055 on one I²C bus, with a LiPo cell and a charging coil, balanced at the ball's center of mass. Scroll to open it up.",
      heroStat: { value: "1", label: "I²C bus between the radio and the sensor" },
      metrics: [
        { value: "2", label: "boards: XIAO ESP32 + BNO055 breakout" },
        { value: "115200", label: "baud serial debug link" },
        { value: "2.4 GHz", label: "Wi-Fi radio, WPA2-Enterprise capable" },
      ],
      tags: ["XIAO ESP32", "BNO055", "LiPo", "Wireless charging", "Arduino"],
      accent: "rose",
      github: "https://github.com/noahpaden1/intelleball/tree/master/seeed_firmware",
      status: "active",
      featured: true,
    },
    {
      id: "firmware",
      kicker: "Firmware",
      title: "Bring-up & campus Wi-Fi",
      summary:
        "v0.0.1 firmware: BNO055 bring-up over I²C with a first double-integration prototype, and a WPA2-Enterprise (PEAP) bench test that gets the ESP32 onto eduroam and logs IP, gateway and RSSI.",
      heroStat: { value: "v0.0.1", label: "in the repo today" },
      metrics: [
        { value: "PEAP", label: "WPA2-Enterprise auth on eduroam" },
        { value: "10 ms", label: "loop period of the IMU sketch" },
      ],
      tags: ["Arduino", "ESP32", "WPA2-Enterprise", "BNO055"],
      accent: "azure",
      github: "https://github.com/noahpaden1/intelleball/tree/master/seeed_firmware",
      status: "shipped",
      featured: false,
    },
    {
      id: "dashboard",
      kicker: "Software",
      title: "Coach dashboard",
      summary:
        "Accounts, per-throw history and live device status in the browser. Auth runs fully client-side today (PBKDF2-hashed, stored locally), ready to swap for a real backend when the telemetry link lands.",
      heroStat: { value: "0", label: "servers required to try it" },
      metrics: [
        { value: "PBKDF2", label: "password hashing, 100k iterations" },
        { value: "Local", label: "storage: your data never leaves the browser" },
      ],
      tags: ["Next.js", "TypeScript", "WebGL", "Framer Motion"],
      accent: "violet",
      status: "active",
      featured: false,
    },
  ] satisfies Project[],

  about: {
    heading: "Make the ball tell the truth.",
    paragraphs: [
      "Intelleball started with a simple frustration: the only feedback most players get on a throw is the outcome. Made or missed, in or out. Everything that happened between the hand and the target, the spin, the release, the arc, is invisible unless a camera and a coach are both watching.",
      "So we put the instrument inside the ball. A nine-axis IMU at the center of mass, an ESP32 to fuse and stream, and enough battery to last a session. Version 0.0.1 is on the bench today: the sensor talks, the radio joins a campus network, and the first motion prototype is running.",
      "The hard part is not reading a sensor. It is trusting it. Integrate acceleration twice and the position wanders off within seconds. The whole pipeline is built around bounding that error: integrating only between moments the ball is provably still, correcting velocity against every known stop, and taking spin straight from the gyroscope, where no integration is needed.",
      "Next is the link from ball to browser: batched telemetry over Wi-Fi, a dashboard that shows every throw as it happens, and validation against high-speed video with real players. This site is the front door. The dashboard behind it is already live to try.",
    ],
    portraitCaption: "Built at Virginia Tech",
    portraitSub: "Noah Paden · Zachary Bezanson · Pranav Pothapragada",
  },

  timeline: [
    {
      id: "firmware-v0",
      dates: "Sep 2026",
      title: "Firmware v0.0.1",
      subtitle: "Bench bring-up",
      description: "First code in the repo: the IMU talks, the radio joins the campus network.",
      outcomes: [
        "BNO055 linear acceleration read over I²C every 10 ms",
        "First velocity and position integration prototype with a stillness gate",
        "WPA2-Enterprise (PEAP) bench test on eduroam, logging IP, gateway and RSSI",
      ],
      status: "shipped",
    },
    {
      id: "motion-pipeline",
      dates: "Fall 2026",
      title: "Motion pipeline",
      subtitle: "Drift-bounded stats",
      description: "Turn raw samples into per-throw numbers that hold up.",
      outcomes: [
        "Stillness detection on accelerometer + gyroscope (zero-velocity updates)",
        "Per-throw windows with post-hoc velocity correction",
        "Spin rate and spin axis straight from the gyroscope",
      ],
      status: "in-progress",
    },
    {
      id: "telemetry-link",
      dates: "Winter 2026",
      title: "Telemetry link",
      subtitle: "Ball → browser",
      description: "Get every sample off the ball without a phone in the loop.",
      outcomes: [
        "Timestamped, batched samples over Wi-Fi",
        "WebSocket ingest behind the dashboard",
        "Session recording and replay",
      ],
      status: "planned",
    },
    {
      id: "field-testing",
      dates: "2027",
      title: "Field testing",
      subtitle: "Real players, real throws",
      description: "Validate the numbers against a camera, then tune.",
      outcomes: [
        "Side-by-side validation against high-speed video",
        "Battery, balance and durability trials",
        "Coach feedback on which stats actually matter",
      ],
      status: "planned",
    },
  ] satisfies Milestone[],

  stack: [
    {
      group: "Sensing",
      items: [
        { name: "BNO055 9-axis IMU", level: 4 },
        { name: "On-chip sensor fusion", level: 3 },
        { name: "Zero-velocity updates", level: 2 },
        { name: "Spin from gyroscope", level: 2 },
      ],
    },
    {
      group: "Compute",
      items: [
        { name: "Seeed XIAO ESP32", level: 4 },
        { name: "Arduino / C++", level: 4 },
        { name: "I²C bus", level: 4 },
        { name: "FreeRTOS tasks", level: 2 },
      ],
    },
    {
      group: "Connectivity",
      items: [
        { name: "Wi-Fi WPA2-Enterprise", level: 3 },
        { name: "Batched telemetry", level: 2 },
        { name: "WebSocket streaming", level: 1 },
      ],
    },
    {
      group: "Software",
      items: [
        { name: "Next.js / TypeScript", level: 4 },
        { name: "WebGL surfaces", level: 3 },
        { name: "Client-side auth", level: 3 },
        { name: "Telemetry dashboard", level: 3 },
      ],
    },
  ] satisfies SkillGroup[],

  principles: {
    heading: "How we build.",
    tenets: [
      {
        index: "01",
        title: "Measure, don't guess.",
        body: "A coach's eye is a great instrument with terrible logging. The ball should carry its own sensor, keep its own record, and report what actually happened on every throw.",
      },
      {
        index: "02",
        title: "Bounded error beats false precision.",
        body: "Integrating acceleration twice drifts without limit. We only publish numbers we can bound: short windows between stillness, velocity corrected against known stops, spin read straight from the gyro.",
      },
      {
        index: "03",
        title: "The ball should disappear.",
        body: "If the electronics change how it flies, the data describes the wrong ball. Center-mounted, balanced, sealed, and light enough that nobody playing with it remembers it is there.",
      },
    ],
  },

  contact: {
    heading: "Want one in your hands?",
    body: "Intelleball is in active development at Virginia Tech. If you coach, train, or build hardware, we would like to hear from you. The firmware and this site are open source.",
  },

  // Client-side accounts (lib/auth.ts). The demo account is seeded on first
  // visit so the dashboard can be tried without creating anything.
  auth: {
    demo: {
      name: "Demo Coach",
      email: "demo@intelleball.app",
      password: "intelleball",
    },
    signIn: {
      eyebrow: "Welcome back",
      title: "Sign in to your dashboard.",
      lead: "Your throws, your device, your session history.",
    },
    signUp: {
      eyebrow: "Get started",
      title: "Create your account.",
      lead: "Accounts live in this browser only. No server, no email, nothing leaves the page.",
    },
    footnote:
      "Auth is handled entirely in your browser: passwords are PBKDF2-hashed and stored locally. It is a working prototype of the real flow, not a production account system.",
  },

  dashboard: {
    device: {
      name: "Intelleball #001",
      firmware: "v0.0.1",
      board: "XIAO ESP32 + BNO055",
      network: "eduroam",
    },
  },
};

export type Site = typeof site;
