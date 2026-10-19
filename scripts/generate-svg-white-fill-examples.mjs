import { writeFile } from "node:fs/promises";
import { FILL_PRESETS, closedRegionMask, countMaskRegions, maskToPath } from "../assets/js/svg-white-fill-core.js";

const width = 120;
const height = 120;
const examples = [
  { slug: "closed", gap: 0 },
  { slug: "small-gap", gap: 2 },
  { slug: "large-gap", gap: 8 },
];

function barrierFor(gap) {
  const alpha = new Uint8ClampedArray(width * height);
  const set = (x, y) => { alpha[y * width + x] = 255; };
  for (let x = 25; x <= 95; x += 1) for (let offset = -1; offset <= 1; offset += 1) {
    if (!(gap && x >= 60 && x < 60 + gap)) set(x, 25 + offset);
    set(x, 95 + offset);
  }
  for (let y = 25; y <= 95; y += 1) for (let offset = -1; offset <= 1; offset += 1) {
    set(25 + offset, y);
    set(95 + offset, y);
  }
  return alpha;
}

function linePath(gap) {
  const top = gap
    ? `M25 25H60M${60 + gap} 25H95`
    : "M25 25H95";
  return `${top}M95 25V95H25V25`;
}

function svgFor(gap, fillPath = "") {
  const fill = fillPath
    ? `<g id="matopuri-white-fill" fill="#fff" stroke="none" fill-rule="evenodd"><path d="${fillPath}"/></g>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">${fill}<path d="${linePath(gap)}" fill="none" stroke="#111" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/></svg>\n`;
}

const summary = [];
for (const example of examples) {
  const mask = closedRegionMask(barrierFor(example.gap), width, height, FILL_PRESETS.standard);
  const path = maskToPath(mask, width, height, [0, 0, width, height]);
  const regions = countMaskRegions(mask, width, height);
  await writeFile(new URL(`../assets/examples/svg-white-fill-${example.slug}-before.svg`, import.meta.url), svgFor(example.gap));
  await writeFile(new URL(`../assets/examples/svg-white-fill-${example.slug}-after.svg`, import.meta.url), svgFor(example.gap, path));
  summary.push({ case: example.slug, detectionGapPixels: example.gap, regions });
}

console.log(JSON.stringify({ preset: "standard", examples: summary }, null, 2));
