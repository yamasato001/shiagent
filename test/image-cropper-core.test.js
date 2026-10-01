import test from "node:test";
import assert from "node:assert/strict";
import { contentBounds, isFullImage, paddedBounds, normalizePlacement } from "../assets/js/image-cropper-core.js";

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

// Builds an RGBA image from a function returning [r, g, b] per pixel.
const image = (width, height, color) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    [data[i], data[i + 1], data[i + 2]] = color(x, y);
    data[i + 3] = 255;
  }
  return data;
};

test("auto background still trims a real margin", () => {
  const data = image(10, 10, (x, y) => x >= 3 && x <= 6 && y >= 2 && y <= 7 ? [30, 60, 90] : [255, 255, 255]);
  assert.deepEqual(contentBounds(data, 10, 10, { background: "auto", tolerance: 8 }), { x: 3, y: 2, width: 4, height: 6 });
});

test("auto background keeps an image with no margin whole", () => {
  // A photo-like image: every pixel differs, so no single border color dominates.
  const data = image(12, 8, (x, y) => [x * 20, y * 30, (x * 7 + y * 13) % 256]);
  const bounds = contentBounds(data, 12, 8, { background: "auto", tolerance: 8 });
  assert.deepEqual(bounds, { x: 0, y: 0, width: 12, height: 8 });
  assert.equal(isFullImage(paddedBounds(bounds, 12, 8, { safeEdge: 3, padding: 5 }), 12, 8), true);
});

test("auto background does not trim a sky band along one edge", () => {
  // Uniform sky over the top rows, varied scenery below and on the other edges.
  const data = image(10, 10, (x, y) => y < 3 ? [120, 180, 240] : [x * 25, 40 + y * 20, (x * y * 9) % 256]);
  assert.deepEqual(contentBounds(data, 10, 10, { background: "auto", tolerance: 8 }), { x: 0, y: 0, width: 10, height: 10 });
});

test("explicit white background is not overridden by the no-margin rule", () => {
  const data = image(10, 10, (x, y) => y < 2 ? [255, 255, 255] : [x * 25, y * 25, 100]);
  assert.deepEqual(contentBounds(data, 10, 10, { background: "white", tolerance: 8 }), { x: 0, y: 2, width: 10, height: 8 });
});

test("isFullImage only matches bounds that cover the whole image", () => {
  assert.equal(isFullImage({ x: 0, y: 0, width: 10, height: 10 }, 10, 10), true);
  assert.equal(isFullImage({ x: 0, y: 1, width: 10, height: 9 }, 10, 10), false);
});
