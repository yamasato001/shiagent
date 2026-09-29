import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyAlpha, backgroundAlpha, estimateBackground, fillBackground, hexToRgb,
  outputFormat, outputName, processBackground, rgbToHex
} from "../assets/js/background-remover-core.js";

// 7x7 white image, black ring (x/y 1..5) enclosing a white 3x3 center.
function ringImage() {
  const width = 7;
  const height = 7;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 1; y <= 5; y += 1) {
    for (let x = 1; x <= 5; x += 1) {
      if (x === 1 || x === 5 || y === 1 || y === 5) {
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
  return { data, width, height };
}

const alphaAt = (data, width, x, y) => data[(y * width + x) * 4 + 3];

test("estimates the dominant border color", () => {
  const { data, width, height } = ringImage();
  const result = estimateBackground(data, width, height);
  assert.deepEqual(result.color, [255, 255, 255]);
  assert.equal(result.transparent, false);
  assert.equal(result.coverage, 1);
});

test("reports already transparent borders", () => {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  assert.equal(estimateBackground(data, 4, 4).transparent, true);
});

test("connected mode keeps enclosed background, global mode removes it", () => {
  const { data, width, height } = ringImage();
  const options = { color: [255, 255, 255], tolerance: 5, softness: 5 };
  const connected = backgroundAlpha(data, width, height, { ...options, mode: "connected" });
  assert.equal(connected[0], 0);
  assert.equal(connected[3 * width + 3], 255, "center stays");
  assert.equal(connected[1 * width + 1], 255, "line stays");
  const global = backgroundAlpha(data, width, height, { ...options, mode: "global" });
  assert.equal(global[3 * width + 3], 0, "center removed");
  assert.equal(global[1 * width + 1], 255);
});

test("none mode removes nothing", () => {
  const { data, width, height } = ringImage();
  const alpha = backgroundAlpha(data, width, height, { color: [255, 255, 255], tolerance: 5, softness: 5, mode: "none" });
  assert.ok(alpha.every(value => value === 255));
});

test("soft edges fade and have the background color unmixed", () => {
  // 50% gray pixel over white background should become semi-transparent black.
  const data = new Uint8ClampedArray([128, 128, 128, 255]);
  const removal = new Uint8Array([128]);
  const output = applyAlpha(data, removal, [255, 255, 255]);
  assert.equal(output[3], 128);
  assert.ok(output[0] <= 2, `expected near-black, got ${output[0]}`);
});

test("fills transparency with an opaque color", () => {
  const data = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 128]);
  const output = fillBackground(data, [255, 0, 0]);
  assert.deepEqual([...output.slice(0, 4)], [255, 0, 0, 255]);
  assert.deepEqual([...output.slice(4, 8)], [0, 0, 0, 255]);
  assert.equal(output[11], 255);
  assert.equal(fillBackground(data, null), data);
});

test("processBackground removes the outer background and can refill it", () => {
  const { data, width, height } = ringImage();
  const cutout = processBackground(data, width, height, { removal: "connected" });
  assert.equal(alphaAt(cutout.data, width, 0, 0), 0);
  assert.equal(alphaAt(cutout.data, width, 3, 3), 255);
  assert.deepEqual(cutout.keyColor, [255, 255, 255]);
  assert.ok(cutout.removedRatio > 0.4);
  const filled = processBackground(data, width, height, { removal: "connected", fill: [0, 0, 255] });
  assert.deepEqual([...filled.data.slice(0, 4)], [0, 0, 255, 255]);
});

test("manual key color overrides detection", () => {
  const { data, width, height } = ringImage();
  const result = processBackground(data, width, height, { removal: "global", keyColor: [0, 0, 0], tolerance: 5 });
  assert.equal(alphaAt(result.data, width, 1, 1), 0);
  assert.equal(alphaAt(result.data, width, 0, 0), 255);
});

test("output helpers", () => {
  assert.deepEqual(hexToRgb("#10ff00"), [16, 255, 0]);
  assert.equal(hexToRgb("nope"), null);
  assert.equal(rgbToHex([16, 255, 0]), "#10ff00");
  assert.equal(outputFormat("jpeg", null), "png");
  assert.equal(outputFormat("jpeg", [255, 255, 255]), "jpeg");
  assert.equal(outputName("photo.HEIC", "png", false), "photo-nobg.png");
  assert.equal(outputName("a.b.jpg", "jpeg", true), "a.b-bg.jpg");
});

test("background remover page exposes removal, fill and format options", async () => {
  const html = await readFile(new URL("../ja/background-remover/index.html", import.meta.url), "utf8");
  for (const value of ["connected", "global", "none"]) assert.match(html, new RegExp(`name="removal" value="${value}"`));
  for (const value of ["transparent", "white", "black", "custom"]) assert.match(html, new RegExp(`name="fill" value="${value}"`));
  assert.match(html, /image\/jpeg/);
  assert.match(html, /image\/webp/);
  assert.match(html, /\.heic/);
  assert.match(html, /workflow-handoff\.js/);
});
