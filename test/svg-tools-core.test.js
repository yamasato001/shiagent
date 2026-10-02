import test from "node:test";
import assert from "node:assert/strict";
import { compactNumericText } from "../assets/js/svg-cleaner-core.js";
import { closedRegionMask, excludeMaskRegions, hasWhiteFillPixels, maskToPath, newlyClosedRegionMask, normalizeSvgRasterViewport } from "../assets/js/svg-white-fill-core.js";

test("SVG cleaner compacts decimal precision without rewriting integer tokens", () => {
  assert.equal(compactNumericText("M 0.00000, 1.23456 L 10 20.5000"), "M 0,1.235 L 10 20.5");
});

test("SVG raster previews use the viewBox aspect ratio without changing the saved source", () => {
  const attributes = new Map([["width", "1000"], ["height", "1000"]]);
  const root = { setAttribute(name, value) { attributes.set(name, value); } };
  normalizeSvgRasterViewport(root, [0, 0, 2000, 1000]);
  assert.equal(attributes.get("width"), "2000");
  assert.equal(attributes.get("height"), "1000");
});

test("white fill detects only regions enclosed by an alpha barrier", () => {
  const width = 5, height = 5;
  const alpha = new Uint8ClampedArray(width * height);
  for (let x = 1; x <= 3; x += 1) { alpha[width + x] = 255; alpha[3 * width + x] = 255; }
  for (let y = 1; y <= 3; y += 1) { alpha[y * width + 1] = 255; alpha[y * width + 3] = 255; }
  const mask = closedRegionMask(alpha, width, height, { closeRadius: 0, inset: 0, minArea: 1 });
  assert.equal(mask[2 * width + 2], 1);
  assert.equal(mask[0], 0);
  assert.match(maskToPath(mask, width, height, [0, 0, 100, 100]), /^M/);
});

test("detects an existing white fill but ignores a thin white stroke", () => {
  const width = 9, height = 9;
  const empty = new Uint8ClampedArray(width * height * 4);
  assert.equal(hasWhiteFillPixels(empty, width, height), false);

  const stroke = new Uint8ClampedArray(empty);
  for (let y = 0; y < height; y += 1) {
    const offset = (y * width + 4) * 4;
    stroke.fill(255, offset, offset + 4);
  }
  assert.equal(hasWhiteFillPixels(stroke, width, height), false);

  const fill = new Uint8ClampedArray(empty);
  for (let y = 2; y <= 6; y += 1) for (let x = 2; x <= 6; x += 1) {
    const offset = (y * width + x) * 4;
    fill.fill(255, offset, offset + 4);
  }
  assert.equal(hasWhiteFillPixels(fill, width, height), true);
});

test("mixed SVGs add only regions closed by a manual guide line", () => {
  const original = new Uint8Array([0, 1, 1, 0, 0, 0]);
  const edited = new Uint8Array([1, 1, 1, 0, 1, 0]);
  assert.deepEqual([...newlyClosedRegionMask(edited, original)], [1, 0, 0, 0, 1, 0]);
});

test("manual exclusion removes a region from a preserved white-fill mask", () => {
  const width = 7, height = 7;
  const existing = new Uint8Array(width * height);
  for (let y = 1; y <= 5; y += 1) for (let x = 1; x <= 5; x += 1) existing[y * width + x] = 1;
  const output = excludeMaskRegions(existing, width, height, [[.5, .5]]);
  assert.equal(output[3 * width + 3], 0);
  assert.ok(output.every(value => value === 0));
});

test("manual exclusion removes the selected closed region", () => {
  const width = 5, height = 5;
  const alpha = new Uint8ClampedArray(width * height);
  for (let x = 1; x <= 3; x += 1) { alpha[width + x] = 255; alpha[3 * width + x] = 255; }
  for (let y = 1; y <= 3; y += 1) { alpha[y * width + 1] = 255; alpha[y * width + 3] = 255; }
  const mask = closedRegionMask(alpha, width, height, { closeRadius: 0, inset: 0, minArea: 1 }, { excludedPoints: [[.5, .5]] });
  assert.equal(mask[2 * width + 2], 0);
});

test("manual exclusion finds a nearby region when clicked on its boundary", () => {
  const width = 9, height = 9;
  const alpha = new Uint8ClampedArray(width * height);
  for (let x = 2; x <= 6; x += 1) { alpha[2 * width + x] = 255; alpha[6 * width + x] = 255; }
  for (let y = 2; y <= 6; y += 1) { alpha[y * width + 2] = 255; alpha[y * width + 6] = 255; }
  const mask = closedRegionMask(alpha, width, height, { closeRadius: 0, inset: 0, minArea: 1 }, { excludedPoints: [[.25, .5]] });
  assert.equal(mask[4 * width + 4], 0);
});

