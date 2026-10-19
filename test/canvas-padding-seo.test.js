import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("Canvas Padding publishes a reproducible before and after example", async () => {
  const before = await readFile(new URL("assets/examples/canvas-padding-before.png", root));
  const after = await readFile(new URL("assets/examples/canvas-padding-after.png", root));
  const generator = await readFile(new URL("scripts/generate-canvas-padding-example.mjs", root), "utf8");

  assert.deepEqual(pngDimensions(before), { width: 160, height: 120 });
  assert.deepEqual(pngDimensions(after), { width: 192, height: 144 });
  assert.match(generator, /relativePaddingPlacement/);
  assert.match(generator, /padding: 10, unit: "percent"/);
  assert.match(generator, /background: "transparent"/);
});

test("Canvas Padding pages explain the verified result and route related intents", async () => {
  const expectations = [
    {
      page: "ja/canvas-padding/index.html",
      h1: "画像に余白を追加",
      result: "192×144 PNG",
      links: ["/ja/image-cropper/", "/ja/image-resizer/", "/ja/workflows/asset-normalizer/"],
    },
    {
      page: "canvas-padding/index.html",
      h1: "Canvas Padding",
      result: "192 × 144 PNG",
      links: ["/image-cropper/", "/image-resizer/", "/workflows/asset-normalizer/"],
    },
  ];

  for (const expectation of expectations) {
    const html = await readFile(new URL(expectation.page, root), "utf8");
    assert.match(html, new RegExp(`<h1>${expectation.h1}`));
    assert.match(html, /class="content-section tool-proof"/);
    assert.ok(html.includes(expectation.result));
    assert.match(html, /canvas-padding-before\.png/);
    assert.match(html, /canvas-padding-after\.png/);
    for (const link of expectation.links) assert.ok(html.includes(`href="${link}"`), `${expectation.page} needs ${link}`);
  }
});

test("verified example collapses to one column on mobile", async () => {
  const css = await readFile(new URL("assets/css/site.css", root), "utf8");
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.tool-proof-grid, \.tool-proof-cases, \.svg-proof-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.tool-proof-facts \{ grid-template-columns: 1fr;/);
});
