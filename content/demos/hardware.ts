/**
 * Copy for the sensor-core exploded-view walkthrough
 * (components/showcase/hardware). Components render from this file —
 * nothing on the stage is hardcoded, down to the SVG's pin labels.
 *
 * Numbers policy (see content/site.ts): every figure here is read off the
 * real firmware in seeed_firmware/. `Wire.begin(21, 22)` puts I²C on
 * GPIO 21 (SDA) and GPIO 22 (SCL), Serial runs at 115200 baud, the IMU
 * sketch sleeps 10 ms per loop and reads VECTOR_LINEARACCEL (gravity
 * already removed), and the Wi-Fi bench test joins eduroam with
 * WPA2-Enterprise (PEAP). The shell and cushion carry no numbers: they
 * are design intent, worded as such — a sealed soccer-ball skin and a
 * cushion sized for kicks, not a measurement.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface DemoHeader {
  kicker: string;
  /** Headline split: [plain part, rose-accented part] */
  headline: [string, string];
  lead: string;
}

export interface DemoStep {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
}

/** Accent for a part's chip dot and its glyph on the stage. */
export type PartAccent = "azure" | "violet" | "rose" | "mint";

export interface DemoPart {
  name: string;
  role: string;
  accent: PartAccent;
}

/** Every string drawn inside the exploded-view SVG. */
export interface StageLabels {
  /** Tags that light with each layer's step. */
  layers: { shell: string; cushion: string; core: string };
  /** Callouts on the puck: name above the tick, note below it. */
  parts: Record<"esp32" | "bno055" | "lipo" | "coil", { name: string; note: string }>;
  /** BNO055 axis-triad glyph. */
  axes: [string, string, string];
  /** The I²C bus callout, shown on the link step. */
  bus: { name: string; sda: string; scl: string };
  radio: string;
  dashboard: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────

export const demoHeader: DemoHeader = {
  kicker: "The sensor core · XIAO ESP32 + BNO055",
  headline: ["Inside", "the ball."],
  lead: "A Seeed XIAO ESP32 and a Bosch BNO055 on one I²C bus, a LiPo cell and a charging coil, sealed at the soccer ball's center of mass. Scroll to take it apart, layer by layer.",
};

export const demoSteps: DemoStep[] = [
  {
    id: "shell",
    eyebrow: "Step 01 · The shell",
    title: "A soccer ball first.",
    body: "A sealed, multi-panel soccer-ball skin with nothing on the surface to give it away: no port, no seam that does not belong. If the electronics changed how it flies or bounces, the data would describe the wrong ball.",
  },
  {
    id: "cushion",
    eyebrow: "Step 02 · The cushion",
    title: "The kick stops here.",
    body: "Between skin and core, a cushion takes every kick and bounce so the electronics never do, and holds the core at the center of mass.",
  },
  {
    id: "core",
    eyebrow: "Step 03 · The core",
    title: "Four parts, one puck.",
    body: "A Seeed XIAO ESP32 for compute and Wi-Fi, a Bosch BNO055 nine-axis IMU, a LiPo cell, and a coil that charges through the shell.",
  },
  {
    id: "link",
    eyebrow: "Step 04 · The link",
    title: "Sensor to radio to coach.",
    body: "I²C on GPIO 21 and 22 carries fused motion from the BNO055 to the ESP32 every 10 ms. From there it is Wi-Fi, WPA2-Enterprise included, straight to the dashboard.",
  },
];

export const parts: DemoPart[] = [
  { name: "Seeed XIAO ESP32", role: "compute + 2.4 GHz Wi-Fi", accent: "azure" },
  { name: "Bosch BNO055", role: "9-axis IMU, fusion on-chip", accent: "violet" },
  { name: "LiPo cell", role: "power", accent: "mint" },
  { name: "Charging coil", role: "wireless charging, no port", accent: "rose" },
];

export const stageLabels: StageLabels = {
  layers: { shell: "Shell", cushion: "Cushion", core: "Core" },
  parts: {
    esp32: { name: "XIAO ESP32", note: "Wi-Fi · compute" },
    bno055: { name: "BNO055", note: "9-axis IMU" },
    lipo: { name: "LiPo cell", note: "power" },
    coil: { name: "Charging coil", note: "wireless charging" },
  },
  axes: ["x", "y", "z"],
  bus: { name: "I²C bus", sda: "SDA · GPIO 21", scl: "SCL · GPIO 22" },
  radio: "Wi-Fi 2.4 GHz",
  dashboard: "Dashboard",
};

/** Read by assistive tech in place of the decorative stage. */
export const srSummary =
  "The Intelleball hardware in four layers. The shell: a sealed, multi-panel soccer-ball skin with nothing on its surface. The cushion: a layer between skin and core that isolates the core from kicks and bounces and holds it at the center of mass. The core: a small puck carrying a Seeed XIAO ESP32 for compute and Wi-Fi, a Bosch BNO055 nine-axis IMU, a LiPo cell and a wireless charging coil. The link: an I²C bus on GPIO 21 (SDA) and GPIO 22 (SCL) between the two boards, read every 10 milliseconds, with the ESP32 streaming samples over 2.4 GHz Wi-Fi, WPA2-Enterprise included, to the dashboard.";
