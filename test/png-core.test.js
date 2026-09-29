import test from "node:test";
import assert from "node:assert/strict";
import { analyzePixels, createZip, crc32, detectRasterFormat, formatBytes, jpegQuality, outputName, processPixels, savedPercent } from "../assets/js/png-core.js";

test("PNG and JPEG are detected from file signatures", () => {
  assert.equal(detectRasterFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(detectRasterFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "jpeg");
  assert.equal(detectRasterFormat(new TextEncoder().encode("RIFF1234WEBP")), "webp");
  assert.equal(detectRasterFormat(new Uint8Array([0x47, 0x49, 0x46, 0x38])), null);
});

test("output names and JPEG quality preserve the detected format", () => {
  assert.equal(outputName("photo.JPEG", "jpeg"), "photo-compressed.jpg");
  assert.equal(outputName("drawing.png", "png", "-2"), "drawing-compressed-2.png");
  assert.equal(outputName("photo.webp", "webp"), "photo-compressed.webp");
  assert.equal(jpegQuality("smallest"), 0.68);
  assert.equal(jpegQuality("auto", "careful", "lineart"), 0.96);
});

test("line art images are detected from white backgrounds and dark edges", () => {
  const width = 20;
  const height = 20;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y += 1) {
    const i = (y * width + 10) * 4;
    data[i] = data[i + 1] = data[i + 2] = 0;
  }
  const analysis = analyzePixels(data, width, height);
  assert.equal(analysis.kind, "lineart");
  assert.equal(analysis.preset, "lineart");
});

test("flat illustrations use the smallest palette preset", () => {
  const width = 20;
  const height = 20;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const i = pixel * 4;
    const color = pixel % 3;
    data[i] = color === 0 ? 240 : 20;
    data[i + 1] = color === 1 ? 180 : 40;
    data[i + 2] = color === 2 ? 220 : 60;
    data[i + 3] = 255;
  }
  const analysis = analyzePixels(data, width, height);
  assert.equal(analysis.kind, "illustration");
  assert.equal(analysis.preset, "smallest");
});

test("continuous-tone images use the balanced preset", () => {
  const width = 40;
  const height = 40;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = (x * 5 + y * 2) % 256;
      data[i + 1] = (x * 2 + y * 5) % 256;
      data[i + 2] = (x * 3 + y * 3) % 256;
      data[i + 3] = 255;
    }
  }
  const analysis = analyzePixels(data, width, height);
  assert.equal(analysis.kind, "photo");
  assert.equal(analysis.preset, "balanced");
});

test("exact processing preserves every channel", () => {
  const source = new Uint8ClampedArray([12, 34, 56, 78, 200, 210, 220, 230]);
  assert.deepEqual(processPixels(source, "exact"), source);
});

test("smallest processing reduces channel precision and preserves valid range", () => {
  const result = processPixels(new Uint8ClampedArray([13, 47, 254, 129]), "smallest");
  assert.deepEqual([...result], [24, 48, 255, 120]);
});

test("line art processing preserves alpha and colored accents", () => {
  const source = new Uint8ClampedArray([
    252, 251, 252, 255,
    126, 128, 127, 180,
    220, 20, 40, 90
  ]);
  const result = processPixels(source, "lineart");
  assert.deepEqual([...result], [
    255, 255, 255, 255,
    128, 128, 128, 180,
    220, 20, 40, 90
  ]);
});

test("size helpers format and calculate savings", () => {
  assert.equal(formatBytes(1024, "en-US"), "1 KB");
  assert.equal(savedPercent(1000, 650), 35);
});

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("ZIP output contains valid local, central and end signatures", async () => {
  const zip = createZip([{ name: "sample.png", data: new Uint8Array([1, 2, 3]) }], new Date(2026, 0, 1));
  const bytes = new Uint8Array(await zip.arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.ok(bytes.includes(0x50));
});
