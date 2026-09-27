import { applyPaletteSync, buildPaletteSync, utils } from "image-q";
import initOxiPng, { optimise, optimise_raw as optimiseRaw } from "@jsquash/oxipng/codec/pkg/squoosh_oxipng.js";
import { processPixels } from "../assets/js/png-core.js";

const ready = initOxiPng("/assets/dist/squoosh_oxipng_bg.wasm");
const MAX_PALETTE_PIXELS = 2_000_000;

self.addEventListener("message", async event => {
  const { id, type = "optimise", buffer, width, height, mode, level = 3, optimiseAlpha = false } = event.data || {};
  try {
    await ready;
    let output;
    if (type === "quantize") {
      const pixels = new Uint8ClampedArray(buffer);
      if (width * height > MAX_PALETTE_PIXELS) {
        // image-q represents pixels as objects. Use the bounded-memory typed
        // array path for large images so ordinary PCs do not exhaust memory.
        output = optimiseRaw(processPixels(pixels, mode), width, height, level, false, optimiseAlpha);
      } else {
        const colors = mode === "smallest" ? 64 : 256;
        const source = utils.PointContainer.fromUint8Array(pixels, width, height);
        const palette = buildPaletteSync([source], {
          colorDistanceFormula: "pngquant",
          paletteQuantization: "wuquant",
          colors
        });
        const quantized = applyPaletteSync(source, palette, {
          colorDistanceFormula: "pngquant",
          imageQuantization: mode === "smallest" ? "nearest" : "floyd-steinberg"
        });
        output = optimiseRaw(
          new Uint8ClampedArray(quantized.toUint8Array()),
          width,
          height,
          level,
          false,
          optimiseAlpha
        );
      }
    } else if (type === "lineart") {
      const processed = processPixels(new Uint8ClampedArray(buffer), "lineart");
      output = optimiseRaw(processed, width, height, level, false, optimiseAlpha);
    } else {
      output = optimise(new Uint8Array(buffer), level, false, optimiseAlpha);
    }
    const result = output.byteOffset === 0 && output.byteLength === output.buffer.byteLength
      ? output.buffer
      : output.slice().buffer;
    self.postMessage({ id, result }, [result]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
