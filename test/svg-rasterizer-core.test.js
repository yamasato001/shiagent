import test from "node:test";
import assert from "node:assert/strict";
import { addPngDensity, parseSvgSize, rasterDimensions, rasterizedName, svgLengthToPx } from "../assets/js/svg-rasterizer-core.js";

test("reads SVG dimensions from units and viewBox", () => {
  assert.equal(Math.round(svgLengthToPx("25.4mm")), 96);
  assert.deepEqual(parseSvgSize('<svg viewBox="0 0 640 480"></svg>'), { width: 640, height: 480, viewBox: [0, 0, 640, 480] });
  const sized = parseSvgSize('<svg width="2in" viewBox="0 0 4 3"></svg>');
  assert.deepEqual(sized, { width: 192, height: 144, viewBox: [0, 0, 4, 3] });
});

test("calculates scale, fitted pixel and DPI output sizes", () => {
  assert.deepEqual(rasterDimensions(400, 200, { mode: "scale", scale: 150 }), { width: 600, height: 300 });
  assert.deepEqual(rasterDimensions(400, 200, { mode: "pixels", width: 300, height: 300, keepAspect: true }), { width: 300, height: 150 });
  assert.deepEqual(rasterDimensions(400, 200, { mode: "pixels", width: 300, height: 300, keepAspect: false }), { width: 300, height: 300 });
  assert.deepEqual(rasterDimensions(96, 48, { mode: "dpi", dpi: 300 }), { width: 300, height: 150 });
});

test("creates stable raster output names", () => {
  assert.equal(rasterizedName("icon.svg", "png"), "icon.png");
  assert.equal(rasterizedName("icon.SVG", "webp", "-2"), "icon-2.webp");
});

test("adds PNG physical density metadata", () => {
  const signature = [137,80,78,71,13,10,26,10];
  const chunk = (type, data = []) => Uint8Array.from([0,0,0,data.length,...Buffer.from(type),...data,0,0,0,0]);
  const png = Uint8Array.from([...signature, ...chunk("IHDR", new Array(13).fill(0)), ...chunk("IEND")]);
  const output = addPngDensity(png, 300);
  assert.equal(Buffer.from(output).includes(Buffer.from("pHYs")), true);
  const offset = Buffer.from(output).indexOf(Buffer.from("pHYs"));
  assert.equal(new DataView(output.buffer, output.byteOffset + offset + 4, 4).getUint32(0), 11811);
});
