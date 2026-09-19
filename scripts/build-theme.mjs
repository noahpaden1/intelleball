/**
 * Compiles theme.config.mjs → app/theme.css (Tailwind v4 @theme tokens).
 * Runs automatically before `next dev` and `next build` (see package.json).
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  colors,
  gradients,
  typography,
  radii,
  motionTokens,
} from "../theme.config.mjs";

const bezier = ([a, b, c, d]) => `cubic-bezier(${a}, ${b}, ${c}, ${d})`;

const lines = [];
lines.push("/* ════════════════════════════════════════════════════════ */");
lines.push("/*  GENERATED FILE — do not edit.                            */");
lines.push("/*  Source of truth: theme.config.mjs  ·  npm run theme      */");
lines.push("/* ════════════════════════════════════════════════════════ */");
lines.push("");
lines.push("@theme {");

lines.push("  /* colors → bg-*, text-*, border-* utilities */");
for (const [name, value] of Object.entries(colors)) {
  lines.push(`  --color-${name}: ${value};`);
}

lines.push("");
lines.push("  /* radii → rounded-* utilities */");
for (const [name, value] of Object.entries(radii)) {
  lines.push(`  --radius-${name}: ${value};`);
}

lines.push("");
lines.push("  /* easings → ease-* utilities */");
for (const [name, value] of Object.entries(motionTokens.ease)) {
  lines.push(`  --ease-${name}: ${bezier(value)};`);
}

lines.push("");
lines.push("  /* type scale → text-* utilities */");
for (const [name, t] of Object.entries(typography.scale)) {
  lines.push(`  --text-${name}: ${t.size};`);
  lines.push(`  --text-${name}--line-height: ${t.lineHeight};`);
  lines.push(`  --text-${name}--letter-spacing: ${t.letterSpacing};`);
  lines.push(`  --text-${name}--font-weight: ${t.weight};`);
}

lines.push("}");
lines.push("");
lines.push(":root {");
lines.push("  /* gradients → var(--gradient-*) */");
for (const [name, value] of Object.entries(gradients)) {
  lines.push(`  --gradient-${name}: ${value};`);
}
lines.push("}");
lines.push("");

const out = fileURLToPath(new URL("../app/theme.css", import.meta.url));
writeFileSync(out, lines.join("\n"));
console.log("✓ app/theme.css generated from theme.config.mjs");
