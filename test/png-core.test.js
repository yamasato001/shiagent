import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { analyzePixels, COLOR_GUARD_LIMIT, createZip, crc32, detectRasterFormat, formatBytes, jpegQuality, outputName, PALETTE_REDUCTION_LIMIT, PALETTE_STEPS, pngOptimizationLevel, processPixels, savedPercent, usesColorGuard, visibleColorChange } from "../assets/js/png-core.js";

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

test("standard effort uses the fast OxiPNG level and careful spends more time", async () => {
  assert.equal(pngOptimizationLevel(), 2);
  assert.equal(pngOptimizationLevel("standard"), 2);
  assert.equal(pngOptimizationLevel("careful"), 4);
  const script = await readFile(new URL("../assets/js/png-compressor.js", import.meta.url), "utf8");
  assert.match(script, /const effortLevel = pngOptimizationLevel\(elements\.effort\.value\);/);
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

test("flat illustrations use the quality-focused illustration preset", () => {
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
  assert.equal(analysis.preset, "illustration");
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

test("smooth low-contrast photos are not mistaken for flat illustrations", () => {
  const width = 96;
  const height = 64;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const texture = ((x * 17 + y * 29) % 11) - 5;
      data[i] = 70 + Math.round(x * 1.2) + texture;
      data[i + 1] = 88 + Math.round(y * 1.1) + texture;
      data[i + 2] = 112 + Math.round((x + y) * 0.45) + texture;
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
  const bytes = createZip([{ name: "sample.png", data: new Uint8Array([1, 2, 3]) }], new Date(2026, 0, 1));
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.ok(bytes.includes(0x50));
});

test("the color guard spots visible color shifts and protects only Auto and Balanced", () => {
  const width = 200, height = 100;
  const gradient = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    gradient[i] = x; gradient[i + 1] = 60 + y; gradient[i + 2] = 200 - x / 2; gradient[i + 3] = 255;
  }
  // A coarse palette (steps of 32) bands a smooth gradient: clearly visible.
  const banded = gradient.map((value, index) => index % 4 === 3 ? value : Math.round(value / 32) * 32);
  assert.ok(visibleColorChange(gradient, banded) > 0.5);
  // A one-step rounding difference is invisible.
  const nudged = gradient.map((value, index) => index % 4 === 3 ? value : Math.min(255, value + 1));
  assert.equal(visibleColorChange(gradient, nudged), 0);
  assert.equal(visibleColorChange(gradient, gradient), 0);
  // Fully transparent pixels do not count; alpha changes do.
  const clear = new Uint8ClampedArray(8);
  assert.equal(visibleColorChange(clear, new Uint8ClampedArray([255, 0, 0, 0, 0, 255, 0, 0])), 0);
  assert.equal(visibleColorChange(new Uint8ClampedArray([10, 10, 10, 255]), new Uint8ClampedArray([10, 10, 10, 120])), 1);
  assert.ok(COLOR_GUARD_LIMIT > 0 && COLOR_GUARD_LIMIT < 0.1);

  assert.equal(usesColorGuard("auto"), true);
  assert.equal(usesColorGuard("balanced"), true);
  assert.equal(usesColorGuard("smallest"), false);
  assert.equal(usesColorGuard("lineart"), false);
  assert.equal(usesColorGuard("exact"), false);
});

// colorSafePalette lives in the worker bundle source; run it with the real
// imagequant WASM (the browser build, given a worker-like global scope).
async function loadColorSafePalette() {
  const worker = await readFile(new URL("../src/png-optimizer-worker.js", import.meta.url), "utf8");
  const start = worker.indexOf("async function colorSafePalette");
  const source = worker.slice(start, worker.indexOf("\nfunction quantizeWithPalette", start));
  globalThis.self ??= globalThis;
  globalThis.location ??= { href: "file:///test/" };
  const { default: createImagequant } = await import("../node_modules/@squoosh-kit/imagequant/dist/wasm/imagequant/imagequant.js");
  const wasmBinary = await readFile(new URL("../node_modules/@squoosh-kit/imagequant/dist/wasm/imagequant/imagequant.wasm", import.meta.url));
  const module = await createImagequant({ noInitialRun: true, wasmBinary });
  return new Function("getImagequantModule", "visibleColorChange", "COLOR_GUARD_LIMIT", "PALETTE_STEPS", "PALETTE_REDUCTION_LIMIT", `${source}; return colorSafePalette;`)(
    async () => module, visibleColorChange, COLOR_GUARD_LIMIT, PALETTE_STEPS, PALETTE_REDUCTION_LIMIT);
}

// CI runs without node_modules (no install step), so this one runs locally only.
const hasImagequant = existsSync(new URL("../node_modules/@squoosh-kit/imagequant/dist/wasm/imagequant/imagequant.wasm", import.meta.url));
test("the color-safe palette picks the fewest colors that keep the image intact", { skip: !hasImagequant && "node_modules not installed" }, async () => {
  const colorSafePalette = await loadColorSafePalette();
  const width = 240, height = 160;
  const image = paint => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data.set([...paint(x, y), 255], (y * width + x) * 4);
    return data;
  };
  // A diagram: white page, pastel boxes, dark text-like strokes.
  const boxes = [[218, 232, 252], [248, 206, 204], [225, 213, 231], [255, 242, 204], [213, 232, 212]];
  const diagram = image((x, y) => (y % 40 === 20 && x % 7 < 4) ? [20, 20, 20] : (x > 20 && x < 220 && y > 10 && y < 150) ? boxes[(x >> 5) % 5] : [255, 255, 255]);
  const reduced = await colorSafePalette(diagram, width, height);
  assert.equal(reduced.colors, 32);
  assert.ok(visibleColorChange(diagram, reduced.pixels) <= PALETTE_REDUCTION_LIMIT);
  // A photo-like image: no palette keeps it, so the caller keeps every color.
  let seed = 7;
  const noise = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const photo = image((x, y) => [120 + 90 * Math.sin(x / 9) + noise() * 20, 130 + 80 * Math.cos(y / 11) + noise() * 20, 110 + 70 * Math.sin((x + y) / 13)]);
  assert.equal(await colorSafePalette(photo, width, height), null);
  assert.deepEqual([...PALETTE_STEPS], [32, 64, 128]);
  assert.ok(PALETTE_REDUCTION_LIMIT < COLOR_GUARD_LIMIT);
});

test("the PNG worker and page use the color-safe palette for Auto and Balanced", async () => {
  const worker = await readFile(new URL("../src/png-optimizer-worker.js", import.meta.url), "utf8");
  assert.match(worker, /\} else if \(colorGuard && fullPaletteMode\) \{[\s\S]*?await colorSafePalette\(pixels, width, height\)/);
  assert.match(worker, /if \(colorGuard && visibleColorChange\(pixels, processed\) > COLOR_GUARD_LIMIT\) \{\s*const safe = await colorSafePalette\(pixels, width, height\);/);
  assert.match(worker, /self\.postMessage\(\{ id, result, colorGuarded, paletteColors \}, \[result\]\)/);
  const script = await readFile(new URL("../assets/js/png-compressor.js", import.meta.url), "utf8");
  assert.match(script, /usesColorGuard\(requestedMode\)/);
  assert.match(script, /entry\.colorGuarded === "lossless"/);
  assert.match(script, /entry\.colorGuarded === "palette"/);
  assert.match(script, /copy\.badges\.paletteN\(entry\.paletteColors\)/);
});
