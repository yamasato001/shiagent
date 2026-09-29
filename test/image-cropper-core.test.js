import test from "node:test";
import assert from "node:assert/strict";
import { contentBounds, paddedBounds, normalizePlacement } from "../assets/js/image-cropper-core.js";

test("detects non-white content bounds with tolerance", () => {
  const data = new Uint8ClampedArray(5 * 4 * 4).fill(255);
  for (let y = 1; y <= 2; y++) for (let x = 2; x <= 3; x++) { const i = (y * 5 + x) * 4; data[i] = data[i + 1] = data[i + 2] = 20; }
  assert.deepEqual(contentBounds(data, 5, 4, { background: "white", tolerance: 5 }), { x: 2, y: 1, width: 2, height: 2 });
});

test("adds safe edge and padding without leaving the image", () => {
  assert.deepEqual(paddedBounds({ x: 3, y: 3, width: 4, height: 4 }, 10, 10, { safeEdge: 2, padding: 1 }), { x: 0, y: 0, width: 10, height: 10 });
});

test("normalizes content to a centered occupancy", () => {
  assert.deepEqual(normalizePlacement(100, 50, 500, 500, 80), { x: 50, y: 150, width: 400, height: 200 });
});
