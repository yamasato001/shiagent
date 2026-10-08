import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const statusSources = [
  "assets/js/i18n/canvas-padding.js",
  "assets/js/i18n/color-tool.js",
  "assets/js/i18n/favicon-generator.js",
  "assets/js/i18n/image-converter.js",
  "assets/js/i18n/image-cropper.js",
  "assets/js/i18n/image-joiner.js",
  "assets/js/i18n/image-metadata-cleaner.js",
  "assets/js/i18n/image-resizer.js",
  "assets/js/i18n/line-art-svg-workflow.js",
  "assets/js/i18n/material-normalizer-workflow.js",
  "assets/js/i18n/phone-photo-workflow.js",
  "assets/js/i18n/svg-rasterizer.js",
  "src/pdf-page-order-workflow.js"
];

test("all queued file statuses use the same Ready label as image compression", async () => {
  const files = await Promise.all(statusSources.map(path => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  for (let index = 0; index < files.length; index += 1) {
    assert.doesNotMatch(files[index], /待機中|Ready to generate/, statusSources[index]);
    assert.match(files[index], /ready:\s*"Ready"/, statusSources[index]);
  }
});
