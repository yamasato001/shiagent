import test from "node:test";
import assert from "node:assert/strict";
import { fixedCanvasPlacement, paddedName, relativePaddingPlacement } from "../assets/js/canvas-padding-core.js";

test("adds ten percent padding independently around both axes", () => {
  assert.deepEqual(relativePaddingPlacement(100, 50, { padding: 10, unit: "percent" }), {
    canvasWidth: 120, canvasHeight: 60, x: 10, y: 5, width: 100, height: 50
  });
});

test("adds the same pixel padding on every edge", () => {
  assert.deepEqual(relativePaddingPlacement(100, 50, { padding: 12, unit: "px" }), {
    canvasWidth: 124, canvasHeight: 74, x: 12, y: 12, width: 100, height: 50
  });
});

test("centers and downscales an oversized image inside a fixed canvas", () => {
  assert.deepEqual(fixedCanvasPlacement(1000, 500, 512, 512, { inset: 20 }), {
    canvasWidth: 512, canvasHeight: 512, x: 20, y: 138, width: 472, height: 236
  });
});

test("does not upscale smaller images unless requested", () => {
  assert.deepEqual(fixedCanvasPlacement(100, 50, 512, 512), {
    canvasWidth: 512, canvasHeight: 512, x: 206, y: 231, width: 100, height: 50
  });
  assert.equal(fixedCanvasPlacement(100, 50, 512, 512, { allowUpscale: true }).width, 512);
});

test("creates padded output names", () => {
  assert.equal(paddedName("photo.HEIC", "jpeg"), "photo-padded.jpg");
});
