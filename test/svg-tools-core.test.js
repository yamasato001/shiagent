import test from "node:test";
import assert from "node:assert/strict";
import { compactNumericText } from "../assets/js/svg-cleaner-core.js";
import { closedRegionMask, maskToPath } from "../assets/js/svg-white-fill-core.js";

test("SVG cleaner compacts decimal precision without rewriting integer tokens", () => {
  assert.equal(compactNumericText("M 0.00000, 1.23456 L 10 20.5000"), "M 0,1.235 L 10 20.5");
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

