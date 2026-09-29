import test from "node:test";
import assert from "node:assert/strict";
import { linkedDimension, resizeDimensions, resizedName, resolvedOutputFormat } from "../assets/js/image-resizer-core.js";

test("resizes images by percentage", () => {
  assert.deepEqual(resizeDimensions(1600, 900, { mode: "percent", percent: 50 }), { width: 800, height: 450 });
  assert.deepEqual(resizeDimensions(3, 3, { mode: "percent", percent: 10 }), { width: 1, height: 1 });
});

test("fits images inside a pixel box while preserving aspect ratio", () => {
  assert.deepEqual(resizeDimensions(1600, 900, { mode: "pixels", width: 800, height: 800, keepAspect: true }), { width: 800, height: 450 });
  assert.deepEqual(resizeDimensions(800, 1200, { mode: "pixels", width: 400, height: "", keepAspect: true }), { width: 400, height: 600 });
});

test("supports exact pixel dimensions when aspect ratio is unlocked", () => {
  assert.deepEqual(resizeDimensions(1600, 900, { mode: "pixels", width: 500, height: 500, keepAspect: false }), { width: 500, height: 500 });
  assert.throws(() => resizeDimensions(1600, 900, { mode: "pixels", width: 500, height: "", keepAspect: false }));
});

test("links width and height inputs using the source aspect ratio", () => {
  assert.equal(linkedDimension(1600, 900, "width", 800), 450);
  assert.equal(linkedDimension(1600, 900, "height", 450), 800);
  assert.equal(linkedDimension(800, 1200, "width", 400), 600);
});

test("keeps browser-encodable formats and falls back to JPEG", () => {
  assert.equal(resolvedOutputFormat("png"), "png");
  assert.equal(resolvedOutputFormat("webp"), "webp");
  assert.equal(resolvedOutputFormat("heic"), "jpeg");
  assert.equal(resolvedOutputFormat("png", "jpeg"), "jpeg");
  assert.equal(resizedName("photo.HEIC", "jpeg"), "photo-resized.jpg");
});
