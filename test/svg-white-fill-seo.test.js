import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FILL_PRESETS, closedRegionMask, countMaskRegions } from "../assets/js/svg-white-fill-core.js";

const root = new URL("../", import.meta.url);

function barrierWithGap(gap) {
  const width = 120;
  const height = 120;
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
  return { alpha, width, height };
}

test("Standard SVG white fill closes a tiny gap but not a large one", () => {
  const expected = [[0, 1], [2, 1], [8, 0]];
  for (const [gap, regions] of expected) {
    const sample = barrierWithGap(gap);
    const mask = closedRegionMask(sample.alpha, sample.width, sample.height, FILL_PRESETS.standard);
    assert.equal(countMaskRegions(mask, sample.width, sample.height), regions);
  }
});

test("SVG white-fill proof assets contain only verified fill results", async () => {
  for (const slug of ["closed", "small-gap", "large-gap"]) {
    const before = await readFile(new URL(`assets/examples/svg-white-fill-${slug}-before.svg`, root), "utf8");
    const after = await readFile(new URL(`assets/examples/svg-white-fill-${slug}-after.svg`, root), "utf8");
    assert.doesNotMatch(before, /matopuri-white-fill/);
    if (slug === "large-gap") assert.doesNotMatch(after, /matopuri-white-fill/);
    else assert.match(after, /id="matopuri-white-fill"[\s\S]*?<path d="M/);
  }
});

test("bilingual SVG white-fill pages publish constraints and recovery routes", async () => {
  const expectations = [
    {
      page: "ja/svg-white-fill/index.html",
      terms: ["完全な閉領域", "2px", "8px", "結果：1領域", "結果：0領域"],
      links: ["/ja/svg-white-fill/editor/", "/ja/workflows/line-art-to-svg/", "/ja/svg-cleaner/"],
    },
    {
      page: "svg-white-fill/index.html",
      terms: ["Fully closed", "2 px", "8 px", "Result: 1 region", "Result: 0 regions"],
      links: ["/svg-white-fill/editor/", "/workflows/line-art-to-svg/", "/svg-cleaner/"],
    },
  ];
  for (const expectation of expectations) {
    const html = await readFile(new URL(expectation.page, root), "utf8");
    assert.match(html, /class="svg-proof-grid"/);
    for (const term of expectation.terms) assert.ok(html.includes(term), `${expectation.page} needs ${term}`);
    for (const link of expectation.links) assert.ok(html.includes(`href="${link}"`), `${expectation.page} needs ${link}`);
  }
});

test("SVG proof cases use one column on mobile", async () => {
  const css = await readFile(new URL("assets/css/site.css", root), "utf8");
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.svg-proof-grid \{ grid-template-columns: 1fr; \}/);
});
