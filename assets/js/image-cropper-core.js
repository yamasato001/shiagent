import { estimateBackground, hexToRgb } from "./background-remover-core.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function contentBounds(data, width, height, options = {}) {
  const mode = options.background || "auto";
  const detected = mode === "auto" ? estimateBackground(data, width, height) : null;
  const color = mode === "white" ? [255, 255, 255] : mode === "custom" ? hexToRgb(options.color) : detected?.color;
  const tolerance = clamp(Number(options.tolerance) || 0, 0, 255);
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    let foreground;
    if (mode === "transparent" || mode === "auto" && detected?.transparent) foreground = data[i + 3] > tolerance;
    else {
      const distance = Math.max(Math.abs(data[i] - color[0]), Math.abs(data[i + 1] - color[1]), Math.abs(data[i + 2] - color[2]));
      foreground = data[i + 3] > 0 && distance > tolerance;
    }
    if (!foreground) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < left ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function paddedBounds(bounds, imageWidth, imageHeight, options = {}) {
  const safe = Math.max(0, Math.round(Number(options.safeEdge) || 0));
  const basis = Math.max(bounds.width, bounds.height);
  const padding = options.paddingUnit === "percent"
    ? Math.round(basis * Math.max(0, Number(options.padding) || 0) / 100)
    : Math.max(0, Math.round(Number(options.padding) || 0));
  const amount = safe + padding;
  const x = clamp(bounds.x - amount, 0, imageWidth);
  const y = clamp(bounds.y - amount, 0, imageHeight);
  const right = clamp(bounds.x + bounds.width + amount, 0, imageWidth);
  const bottom = clamp(bounds.y + bounds.height + amount, 0, imageHeight);
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

export function normalizePlacement(contentWidth, contentHeight, canvasWidth, canvasHeight, occupancy = 80) {
  const target = clamp(Number(occupancy) || 80, 1, 100) / 100;
  const scale = Math.min(canvasWidth * target / contentWidth, canvasHeight * target / contentHeight);
  const width = Math.max(1, Math.round(contentWidth * scale));
  const height = Math.max(1, Math.round(contentHeight * scale));
  return { x: Math.round((canvasWidth - width) / 2), y: Math.round((canvasHeight - height) / 2), width, height };
}

export function cropName(name, format, suffix = "") {
  const extension = format === "jpeg" ? "jpg" : format;
  return `${name.replace(/\.[^./\\]+$/, "") || "image"}-cropped${suffix}.${extension}`;
}
