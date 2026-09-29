import test from "node:test";
import assert from "node:assert/strict";
import { colorOutputName, matchesColor, parseCssColor, processColorPixels, transformCssText } from "../assets/js/color-tool-core.js";

test("parses common SVG and CSS colors", () => {
  assert.deepEqual(parseCssColor("#fff"), { r: 255, g: 255, b: 255, a: 255 });
  assert.deepEqual(parseCssColor("rgb(10, 20, 30)"), { r: 10, g: 20, b: 30, a: 255 });
  assert.deepEqual(parseCssColor("rgba(10,20,30,0.5)"), { r: 10, g: 20, b: 30, a: 128 });
});

test("matches RGB channels using plus or minus tolerance", () => {
  assert.equal(matchesColor({ r: 250, g: 248, b: 255 }, { r: 255, g: 255, b: 255 }, 10), true);
  assert.equal(matchesColor({ r: 244, g: 255, b: 255 }, { r: 255, g: 255, b: 255 }, 10), false);
});

test("makes matching raster pixels transparent", () => {
  const result = processColorPixels(Uint8ClampedArray.from([250, 250, 250, 255, 20, 20, 20, 255]), { mode: "transparent", target: "#ffffff", tolerance: 10 });
  assert.deepEqual([...result], [250, 250, 250, 0, 20, 20, 20, 255]);
});

test("converts pixels to grayscale and monochrome", () => {
  const gray = processColorPixels(Uint8ClampedArray.from([255, 0, 0, 255]), { mode: "grayscale" });
  assert.deepEqual([...gray], [54, 54, 54, 255]);
  const mono = processColorPixels(Uint8ClampedArray.from([220, 220, 220, 255]), { mode: "monochrome", threshold: 128 });
  assert.deepEqual([...mono], [255, 255, 255, 255]);
});

test("transforms SVG style colors and creates output names", () => {
  assert.equal(transformCssText("fill:#fff;stroke:rgb(0, 0, 0)", { mode: "replace", target: "#000000", replacement: "#ff0000", tolerance: 0 }), "fill:#ffffff;stroke:#ff0000");
  assert.equal(colorOutputName("drawing.svg", "svg"), "drawing-color.svg");
  assert.equal(colorOutputName("photo.jpg", "webp"), "photo-color.webp");
});
