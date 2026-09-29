import { sanitizeStem } from "./batch-rename-core.js";
import { OUTPUT_FORMATS } from "./image-converter-core.js";

export const MIN_LONG_SIDE = 16;
export const MAX_LONG_SIDE = 4096;
export const MAX_OUTPUT_PIXELS = 24_000_000;
export const MAX_START_NUMBER = 999_999;

export const WEB_IMAGE_PRESETS = Object.freeze({
  blog: Object.freeze({ resize: true, longSide: 1200, format: "webp", quality: "standard", crop: "none" }),
  thumbnail: Object.freeze({ resize: true, longSide: 640, format: "webp", quality: "compact", crop: "none" }),
  original: Object.freeze({ resize: false, longSide: null, format: "source", quality: "standard", crop: "none" })
});

export function validLongSide(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  return rounded >= MIN_LONG_SIDE && rounded <= MAX_LONG_SIDE ? rounded : null;
}

export function fitLongSide(width, height, longSide, resize = true) {
  if (!resize) return { width, height, scaled: false };
  const scale = Math.min(1, longSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: scale < 1
  };
}

export function downscaleSteps(width, height, target) {
  const steps = [];
  let current = { width, height };
  while (current.width / 2 >= target.width && current.height / 2 >= target.height) {
    current = { width: Math.round(current.width / 2), height: Math.round(current.height / 2) };
    steps.push(current);
  }
  if (!steps.length || steps.at(-1).width !== target.width || steps.at(-1).height !== target.height) steps.push({ width: target.width, height: target.height });
  return steps;
}

export function resolvedOutputFormat(sourceFormat, selectedFormat) {
  if (selectedFormat !== "source") return OUTPUT_FORMATS[selectedFormat] ? selectedFormat : "webp";
  return OUTPUT_FORMATS[sourceFormat] ? sourceFormat : "webp";
}

export function optimizedName(sourceName, outputFormat, suffix = "-web") {
  const extension = OUTPUT_FORMATS[outputFormat]?.extension || "webp";
  const stem = sanitizeStem(String(sourceName).replace(/\.(?:png|jpe?g|webp|heic|heif|avif|gif|bmp|tiff?)$/i, "")) || "image";
  return `${stem}${suffix}.${extension}`;
}

export function validStartNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  return rounded >= 1 && rounded <= MAX_START_NUMBER ? rounded : null;
}

export function renamedOutputNames(outputFormats, baseName = "web", start = 1) {
  const base = sanitizeStem(baseName) || "web";
  const first = validStartNumber(start) || 1;
  const digits = Math.max(2, String(first + Math.max(0, outputFormats.length - 1)).length);
  return outputFormats.map((format, index) => {
    const extension = OUTPUT_FORMATS[format]?.extension || "webp";
    return `${base}_${String(first + index).padStart(digits, "0")}.${extension}`;
  });
}

export function presetSettings(name) {
  return WEB_IMAGE_PRESETS[name] ? { ...WEB_IMAGE_PRESETS[name] } : null;
}
