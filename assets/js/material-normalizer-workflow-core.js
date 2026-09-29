import { sanitizeStem } from "./batch-rename-core.js";
import { OUTPUT_FORMATS } from "./image-converter-core.js";

export const MAX_OUTPUT_PIXELS = 24_000_000;

const positiveInteger = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
};

export function validCanvasSize(width, height) {
  const resolvedWidth = positiveInteger(width);
  const resolvedHeight = positiveInteger(height);
  if (!resolvedWidth || !resolvedHeight || resolvedWidth > 8192 || resolvedHeight > 8192) return null;
  if (resolvedWidth * resolvedHeight > MAX_OUTPUT_PIXELS) return null;
  return { width: resolvedWidth, height: resolvedHeight };
}

export function validPadding(value, unit = "percent") {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  const max = unit === "px" ? 4096 : 200;
  return number <= max ? number : null;
}

export function validOccupancy(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 && number <= 100 ? number : null;
}

export function workflowPlacement(bounds, targetWidth, targetHeight, padding = 10, unit = "percent") {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) throw new Error("Invalid content bounds");
  const target = validCanvasSize(targetWidth, targetHeight);
  const amount = validPadding(padding, unit);
  if (!target || amount === null) throw new Error("Invalid workflow settings");
  const pad = unit === "px" ? amount : Math.max(bounds.width, bounds.height) * amount / 100;
  const paddedWidth = bounds.width + pad * 2;
  const paddedHeight = bounds.height + pad * 2;
  const scale = Math.min(target.width / paddedWidth, target.height / paddedHeight);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  return {
    canvasWidth: target.width,
    canvasHeight: target.height,
    x: Math.round((target.width - paddedWidth * scale) / 2 + pad * scale),
    y: Math.round((target.height - paddedHeight * scale) / 2 + pad * scale),
    width,
    height,
    scale
  };
}

export function assetNormalizerPlacement(bounds, targetWidth, targetHeight, occupancy = 80, padding = 10, unit = "percent") {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) throw new Error("Invalid content bounds");
  const target = validCanvasSize(targetWidth, targetHeight);
  const objectSize = validOccupancy(occupancy);
  const amount = validPadding(padding, unit);
  if (!target || objectSize === null || amount === null) throw new Error("Invalid workflow settings");

  const occupancyScale = Math.min(
    target.width * objectSize / 100 / bounds.width,
    target.height * objectSize / 100 / bounds.height
  );
  const horizontalPadding = unit === "px" ? amount : target.width * amount / 100;
  const verticalPadding = unit === "px" ? amount : target.height * amount / 100;
  const paddedWidth = Math.max(1, target.width - horizontalPadding * 2);
  const paddedHeight = Math.max(1, target.height - verticalPadding * 2);
  const paddingScale = Math.min(paddedWidth / bounds.width, paddedHeight / bounds.height);
  const scale = Math.min(occupancyScale, paddingScale);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  return {
    canvasWidth: target.width,
    canvasHeight: target.height,
    x: Math.round((target.width - width) / 2),
    y: Math.round((target.height - height) / 2),
    width,
    height,
    scale
  };
}

export function materialNames(count, baseName = "asset", start = 1, outputFormat = "png") {
  const definition = OUTPUT_FORMATS[outputFormat];
  if (!definition) throw new Error("Unsupported output format");
  const base = sanitizeStem(baseName) || "asset";
  const first = Math.max(1, Math.min(999999, Math.round(Number(start) || 1)));
  const digits = Math.max(2, String(first + Math.max(0, count - 1)).length);
  return Array.from({ length: count }, (_, index) => `${base}_${String(first + index).padStart(digits, "0")}.${definition.extension}`);
}

export function assetNormalizerNames(count, baseName = "asset", start = 1, outputFormat = "png") {
  const definition = OUTPUT_FORMATS[outputFormat];
  if (!definition) throw new Error("Unsupported output format");
  const base = sanitizeStem(baseName) || "asset";
  const first = Math.max(1, Math.min(999999, Math.round(Number(start) || 1)));
  const digits = Math.max(3, String(first + Math.max(0, count - 1)).length);
  return Array.from({ length: count }, (_, index) => `${base}-${String(first + index).padStart(digits, "0")}.${definition.extension}`);
}
