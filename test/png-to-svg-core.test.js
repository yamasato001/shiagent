import test from "node:test";
import assert from "node:assert/strict";
import {
  OUTPUT_SIZES,
  QUALITY_PRESETS,
  SPLIT_PRESETS,
  compositeOnWhite,
  contentSizeForCanvas,
  foregroundMask,
  preprocessRgba,
  projectionSplit,
  safeBaseName
} from "../assets/js/png-to-svg-core.js";

test("quality presets match the Matopuri desktop values", () => {
  assert.deepEqual(QUALITY_PRESETS.smooth, {
    name: "なめらか", upscale: 2, blurKernel: 5, threshold: 235,
    closeIterations: 1, openIterations: 0, minComponentArea: 0,
    turdsize: 5, alphamax: 1.1, opttolerance: 0.35
  });
});

test("output sizes preserve the canvas margin ratio", () => {
  assert.deepEqual(OUTPUT_SIZES, [256, 512, 1024]);
  assert.equal(contentSizeForCanvas(256), 210);
  assert.equal(contentSizeForCanvas(512), 420);
  assert.equal(contentSizeForCanvas(1024), 840);
  assert.throws(() => contentSizeForCanvas(300), /出力サイズ/);
});

test("transparent pixels are composited on white", () => {
  assert.deepEqual([...compositeOnWhite(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]))], [255, 255, 255, 0, 0, 0]);
});

test("projection splitting follows whitespace and reading order", () => {
  const width = 30;
  const height = 12;
  const mask = new Uint8Array(width * height);
  for (let y = 2; y < 10; y += 1) {
    for (let x = 1; x < 8; x += 1) mask[y * width + x] = 1;
    for (let x = 20; x < 28; x += 1) mask[y * width + x] = 1;
  }
  const boxes = projectionSplit(mask, width, height, { minGap: 6, minForeground: 20 });
  assert.deepEqual(boxes, [[1, 2, 8, 10], [20, 2, 28, 10]]);
});

test("preprocessing creates an upscaled binary image", () => {
  const rgba = new Uint8ClampedArray([
    0, 0, 0, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255
  ]);
  const result = preprocessRgba(rgba, 2, 2, QUALITY_PRESETS.standard);
  assert.equal(result.width, 4);
  assert.equal(result.height, 4);
  assert.ok([...result.data].every(value => value === 0 || value === 255));
});

test("foreground mask and output names match tool expectations", () => {
  assert.deepEqual([...foregroundMask(new Uint8ClampedArray([244, 244, 244, 245, 245, 245]))], [1, 0]);
  assert.equal(safeBaseName('  apple:line.png'), "appleline");
  assert.equal(SPLIT_PRESETS.grouped.minGap, 20);
});
