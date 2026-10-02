import { applyPaletteSync, buildPaletteSync, utils } from "image-q";
import initOxiPng, { optimise, optimise_raw as optimiseRaw } from "@jsquash/oxipng/codec/pkg/squoosh_oxipng.js";
import { COLOR_GUARD_LIMIT, PALETTE_REDUCTION_LIMIT, PALETTE_STEPS, processPixels, visibleColorChange } from "../assets/js/png-core.js";
import createImagequantModule from "../node_modules/@squoosh-kit/imagequant/dist/wasm/imagequant/imagequant.js";

// Fetch the module explicitly before initialising it. This avoids browsers
// leaving instantiateStreaming pending in a module worker on some local and
// static servers, while keeping the deployed WASM path stable.
const ready = fetch("/assets/dist/squoosh_oxipng_bg.wasm")
  .then(response => {
    if (!response.ok) throw new Error(`OxiPNG WASM could not be loaded (${response.status})`);
    return response.arrayBuffer();
  })
  .then(bytes => initOxiPng(bytes));
const MAX_PALETTE_PIXELS = 2_000_000;
const LARGE_PALETTE_SAMPLE_PIXELS = 200_000;
let imagequantReady;

function getImagequantModule() {
  imagequantReady ||= fetch("/assets/dist/imagequant.wasm")
    .then(response => {
      if (!response.ok) throw new Error(`ImageQuant WASM could not be loaded (${response.status})`);
      return response.arrayBuffer();
    })
    .then(wasmBinary => createImagequantModule({ noInitialRun: true, wasmBinary }));
  return imagequantReady;
}

// Smallest palette that keeps colors (Auto and Balanced). Returns null when even
// 256 colors visibly change the image (photos, smooth gradients): the caller
// then keeps every color losslessly.
async function colorSafePalette(pixels, width, height) {
  const module = await getImagequantModule();
  // A fresh copy each time so a quantizer can never see altered input.
  const quantizeTo = colors => new Uint8ClampedArray(module.quantize(new Uint8Array(pixels), width, height, colors, 0));
  const full = quantizeTo(256);
  if (visibleColorChange(pixels, full) > COLOR_GUARD_LIMIT) return null;
  for (const colors of PALETTE_STEPS) {
    const candidate = quantizeTo(colors);
    if (visibleColorChange(pixels, candidate) <= PALETTE_REDUCTION_LIMIT) return { pixels: candidate, colors };
  }
  return { pixels: full, colors: 256 };
}

function quantizeWithPalette(pixels, width, height, {
  colors = 256,
  colorDistanceFormula = "pngquant",
  paletteQuantization = "wuquant",
  imageQuantization = "nearest"
} = {}) {
  const source = utils.PointContainer.fromUint8Array(pixels, width, height);
  const palette = buildPaletteSync([source], {
    colorDistanceFormula,
    paletteQuantization,
    colors
  });
  return new Uint8ClampedArray(applyPaletteSync(source, palette, {
    colorDistanceFormula,
    imageQuantization
  }).toUint8Array());
}

function quantizeLargeWithPalette(pixels, width, height, profile) {
  const totalPixels = width * height;
  const stride = Math.max(1, Math.ceil(totalPixels / LARGE_PALETTE_SAMPLE_PIXELS));
  const samplePixels = Math.ceil(totalPixels / stride);
  const sample = new Uint8ClampedArray(samplePixels * 4);
  for (let sourcePixel = 0, targetPixel = 0; sourcePixel < totalPixels; sourcePixel += stride, targetPixel += 1) {
    const sourceIndex = sourcePixel * 4;
    sample.set(pixels.subarray(sourceIndex, sourceIndex + 4), targetPixel * 4);
  }

  const sampleContainer = utils.PointContainer.fromUint8Array(sample, samplePixels, 1);
  const palette = buildPaletteSync([sampleContainer], profile);
  const colors = palette.getPointContainer().toUint8Array();
  const colorCount = colors.length / 4;
  // 5 bits per RGB channel plus 4 bits of alpha. The lookup table keeps the
  // full-image mapping bounded to about 2 MB instead of creating one object
  // for every pixel as image-q normally does.
  const lookup = new Int16Array(1 << 19);
  lookup.fill(-1);
  const output = new Uint8ClampedArray(pixels.length);

  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const a = pixels[index + 3];
    const key = (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10) | ((a >> 4) << 15);
    let paletteIndex = lookup[key];
    if (paletteIndex < 0) {
      let bestDistance = Number.POSITIVE_INFINITY;
      const alpha = a / 255;
      const premultipliedR = r * alpha;
      const premultipliedG = g * alpha;
      const premultipliedB = b * alpha;
      for (let candidate = 0; candidate < colorCount; candidate += 1) {
        const colorIndex = candidate * 4;
        const candidateAlpha = colors[colorIndex + 3] / 255;
        const dr = premultipliedR - colors[colorIndex] * candidateAlpha;
        const dg = premultipliedG - colors[colorIndex + 1] * candidateAlpha;
        const db = premultipliedB - colors[colorIndex + 2] * candidateAlpha;
        const da = a - colors[colorIndex + 3];
        const distance = dr * dr * 0.2126 + dg * dg * 0.7152 + db * db * 0.0722 + da * da * 0.5;
        if (distance < bestDistance) {
          bestDistance = distance;
          paletteIndex = candidate;
        }
      }
      lookup[key] = paletteIndex;
    }
    const paletteOffset = paletteIndex * 4;
    output[index] = colors[paletteOffset];
    output[index + 1] = colors[paletteOffset + 1];
    output[index + 2] = colors[paletteOffset + 2];
    output[index + 3] = colors[paletteOffset + 3];
  }
  return output;
}

function quantizeLineArtCompact(pixels) {
  const MAX_ACCENT_SAMPLE_PIXELS = 100_000;
  let accentPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const spread = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) -
      Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
    if (spread >= 32 && pixels[index + 3] > 0) accentPixels += 1;
  }

  let accentColors = new Uint8Array();
  if (accentPixels) {
    const stride = Math.max(1, Math.ceil(accentPixels / MAX_ACCENT_SAMPLE_PIXELS));
    const samplePixels = Math.ceil(accentPixels / stride);
    const sample = new Uint8ClampedArray(samplePixels * 4);
    for (let index = 0, seen = 0, target = 0; index < pixels.length; index += 4) {
      const spread = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) -
        Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
      if (spread < 32 || pixels[index + 3] === 0) continue;
      if (seen % stride === 0 && target < samplePixels) {
        sample.set(pixels.subarray(index, index + 4), target * 4);
        target += 1;
      }
      seen += 1;
    }
    const container = utils.PointContainer.fromUint8Array(sample, samplePixels, 1);
    const palette = buildPaletteSync([container], {
      colors: Math.min(32, samplePixels),
      colorDistanceFormula: "pngquant",
      paletteQuantization: "rgbquant"
    });
    accentColors = palette.getPointContainer().toUint8Array();
  }

  const accentLookup = new Int16Array(1 << 15);
  accentLookup.fill(-1);
  const output = new Uint8ClampedArray(pixels.length);
  const grayLevels = 64;
  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const a = pixels[index + 3];
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (spread < 32 || !accentColors.length) {
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const gray = Math.round(Math.round(luma * (grayLevels - 1) / 255) * 255 / (grayLevels - 1));
      output[index] = output[index + 1] = output[index + 2] = gray;
    } else {
      const key = (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10);
      let nearest = accentLookup[key];
      if (nearest < 0) {
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let candidate = 0; candidate < accentColors.length; candidate += 4) {
          const dr = r - accentColors[candidate];
          const dg = g - accentColors[candidate + 1];
          const db = b - accentColors[candidate + 2];
          const distance = dr * dr * 0.2126 + dg * dg * 0.7152 + db * db * 0.0722;
          if (distance < bestDistance) {
            bestDistance = distance;
            nearest = candidate / 4;
          }
        }
        accentLookup[key] = nearest;
      }
      const paletteOffset = nearest * 4;
      output[index] = accentColors[paletteOffset];
      output[index + 1] = accentColors[paletteOffset + 1];
      output[index + 2] = accentColors[paletteOffset + 2];
    }
    output[index + 3] = a;
  }
  return output;
}

self.addEventListener("message", async event => {
  const { id, type = "optimise", buffer, width, height, mode, level = 3, optimiseAlpha = false, colorGuard = false, requestedColors = null } = event.data || {};
  try {
    await ready;
    let output;
    // false, or how the color guard changed the result: "palette" / "lossless".
    let colorGuarded = false;
    // Number of palette colors chosen by the color-safe search, when it ran.
    let paletteColors = null;
    const fullPaletteMode = type === "quantize" && (mode === "balanced" || mode === "illustration");
    if (type === "optimise") {
      output = optimise(new Uint8Array(buffer), level, false, optimiseAlpha);
    } else if (colorGuard && fullPaletteMode) {
      // Auto (illustration / photo) and Balanced: the smallest palette that keeps colors.
      const pixels = new Uint8ClampedArray(buffer);
      const safe = await colorSafePalette(pixels, width, height);
      if (!safe) colorGuarded = "lossless";
      paletteColors = safe?.colors ?? null;
      output = optimiseRaw(safe ? safe.pixels : pixels, width, height, level, false, optimiseAlpha);
    } else {
      const pixels = new Uint8ClampedArray(buffer);
      let processed;
      if (type === "quantize" && requestedColors) {
        const module = await getImagequantModule();
        processed = new Uint8ClampedArray(module.quantize(new Uint8Array(buffer), width, height, requestedColors, 0));
        paletteColors = requestedColors;
      } else if (fullPaletteMode) {
        const module = await getImagequantModule();
        processed = new Uint8ClampedArray(module.quantize(new Uint8Array(buffer), width, height, 256, 0));
      } else if (type === "quantize" && width * height > MAX_PALETTE_PIXELS) {
        const profile = {
          colors: mode === "smallest" ? 64 : 256,
          colorDistanceFormula: "pngquant",
          paletteQuantization: "wuquant"
        };
        processed = quantizeLargeWithPalette(pixels, width, height, profile);
      } else if (type === "quantize") {
        processed = quantizeWithPalette(pixels, width, height, {
          colors: mode === "smallest" ? 64 : 256,
          colorDistanceFormula: "pngquant",
          paletteQuantization: "wuquant",
          imageQuantization: "nearest"
        });
      } else if (type === "lineart-compact") {
        processed = quantizeLineArtCompact(pixels);
      } else {
        // Copy: the original pixels are still needed for the color guard.
        processed = processPixels(new Uint8ClampedArray(pixels), "lineart");
      }
      // Auto line art: the Line Art palette grays out pale colors (e.g. the
      // pastel boxes of a draw.io diagram). When that is visible, use the
      // smallest color-safe palette instead (86% smaller on such a diagram),
      // or keep every color if no palette can hold them.
      if (colorGuard && visibleColorChange(pixels, processed) > COLOR_GUARD_LIMIT) {
        const safe = await colorSafePalette(pixels, width, height);
        processed = safe ? safe.pixels : pixels;
        paletteColors = safe?.colors ?? null;
        colorGuarded = safe ? "palette" : "lossless";
      }
      output = optimiseRaw(processed, width, height, level, false, optimiseAlpha);
    }
    const result = output.byteOffset === 0 && output.byteLength === output.buffer.byteLength
      ? output.buffer
      : output.slice().buffer;
    self.postMessage({ id, result, colorGuarded, paletteColors }, [result]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
