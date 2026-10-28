/**
 * Renders the results card with node-canvas so the design can be verified
 * without a browser. Not part of `npm run check`; run manually:
 *   npx esbuild check/drawCard.ts --bundle --platform=node --format=esm \
 *     --outfile=/tmp/drawCard.mjs --log-level=warning && node /tmp/drawCard.mjs
 * Requires: npm i --no-save @napi-rs/canvas
 */
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { cardHeight, drawResultCard } from "../src/results-generator/drawResultCard";

GlobalFonts.registerFromPath("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVu Sans");
GlobalFonts.registerFromPath(
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "DejaVu Sans Bold"
);

const variants = [
  { name: "/tmp/rg-card-full.png", title: "Oefening met letters - resultaat", total: 312, errors: 7, speed: 156, time: "02:00", showTitle: true, showButtons: true },
  { name: "/tmp/rg-card-stats.png", title: "Resultaat van de typetest", total: 1240, errors: 61, speed: 203, time: "06:07", showTitle: false, showButtons: true },
  { name: "/tmp/rg-card-title.png", title: "Oefening met eigen tekst - resultaat", total: 89, errors: 0, speed: 74, time: "01:12", showTitle: true, showButtons: false },
] as const;

for (const v of variants) {
  const scale = 2;
  const canvas = createCanvas(600 * scale, cardHeight(v) * scale);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  drawResultCard(ctx, { ...v, title: v.title }, scale);
  writeFileSync(v.name, canvas.toBuffer("image/png"));
  console.log("wrote", v.name);
}
