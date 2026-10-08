import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tools = [
  "image-converter", "image-resizer", "image-cropper", "canvas-padding", "image-joiner",
  "metadata-cleaner", "image-to-svg", "svg-to-image", "color-tool", "favicon-generator",
  "image-splitter", "background-remover", "svg-cleaner", "svg-white-fill"
];

test("every visual image tool loads the shared large before/after comparison", async () => {
  for (const tool of tools) {
    for (const prefix of ["", "ja/"]) {
      const html = await readFile(new URL(`../${prefix}${tool}/index.html`, import.meta.url), "utf8");
      assert.match(html, /<script type="module" src="\/assets\/js\/image-before-after\.js"><\/script>/, `${prefix}${tool}`);
    }
  }
});

test("the shared comparison supports batches, keyboard tabs and before/after panes", async () => {
  const source = await readFile(new URL("../assets/js/image-before-after.js", import.meta.url), "utf8");
  assert.match(source, /document\.addEventListener\("change"/);
  assert.match(source, /document\.addEventListener\("drop"/);
  assert.match(source, /document\.addEventListener\("shiagent:outputs"/);
  assert.match(source, /compression-comparison-tabs/);
  assert.match(source, /compression-comparison-grid/);
  assert.match(source, /\["ArrowLeft", "ArrowRight", "Home", "End"\]/);
  assert.match(source, /URL\.revokeObjectURL/);
});

test("splitter and image-to-SVG publish their generated images to the comparison", async () => {
  const [splitter, vectorizer] = await Promise.all([
    readFile(new URL("../assets/js/image-splitter.js", import.meta.url), "utf8"),
    readFile(new URL("../src/png-to-svg.js", import.meta.url), "utf8")
  ]);
  assert.match(splitter, /source: "image-splitter-result"/);
  assert.match(vectorizer, /source: "image-to-svg-result"/);
});
