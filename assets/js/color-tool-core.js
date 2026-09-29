const clamp = value => Math.max(0, Math.min(255, Math.round(value)));

export function hexToRgba(value) {
  const hex = String(value).trim().replace(/^#/, "");
  if (![3, 4, 6, 8].includes(hex.length) || !/^[0-9a-f]+$/i.test(hex)) return null;
  const expanded = hex.length <= 4 ? [...hex].map(character => character + character).join("") : hex;
  return {
    r: parseInt(expanded.slice(0, 2), 16), g: parseInt(expanded.slice(2, 4), 16), b: parseInt(expanded.slice(4, 6), 16),
    a: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) : 255
  };
}

export function parseCssColor(value) {
  const source = String(value).trim();
  const named = { black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", gray: "#808080", grey: "#808080", yellow: "#ffff00", magenta: "#ff00ff", cyan: "#00ffff" };
  if (named[source.toLowerCase()]) return hexToRgba(named[source.toLowerCase()]);
  const hex = hexToRgba(source);
  if (hex) return hex;
  const match = source.match(/^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (!match) return null;
  const component = index => clamp(parseFloat(match[index]) * (match[index].endsWith("%") ? 2.55 : 1));
  let alpha = 255;
  if (match[4] != null) alpha = clamp(parseFloat(match[4]) * (match[4].endsWith("%") ? 2.55 : 255));
  return { r: component(1), g: component(2), b: component(3), a: alpha };
}

export function rgbaToHex(color, includeAlpha = false) {
  const part = value => clamp(value).toString(16).padStart(2, "0");
  return `#${part(color.r)}${part(color.g)}${part(color.b)}${includeAlpha ? part(color.a ?? 255) : ""}`;
}

export function matchesColor(color, target, tolerance = 0) {
  const amount = Math.max(0, Number(tolerance) || 0);
  return Math.abs(color.r - target.r) <= amount && Math.abs(color.g - target.g) <= amount && Math.abs(color.b - target.b) <= amount;
}

export function luminance(color) {
  return clamp(color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722);
}

export function transformColor(color, options) {
  if (options.mode === "grayscale") {
    const gray = luminance(color);
    return { ...color, r: gray, g: gray, b: gray };
  }
  if (options.mode === "monochrome") {
    const value = luminance(color) >= Number(options.threshold ?? 128) ? 255 : 0;
    return { ...color, r: value, g: value, b: value };
  }
  const target = hexToRgba(options.target || "#ffffff");
  if (!target || !matchesColor(color, target, options.tolerance)) return color;
  if (options.mode === "transparent") return { ...color, a: 0 };
  const replacement = hexToRgba(options.replacement || "#000000");
  return replacement ? { ...replacement, a: color.a } : color;
}

export function processColorPixels(source, options) {
  const output = new Uint8ClampedArray(source);
  for (let index = 0; index < output.length; index += 4) {
    const original = { r: output[index], g: output[index + 1], b: output[index + 2], a: output[index + 3] };
    const next = transformColor(original, options);
    output[index] = next.r; output[index + 1] = next.g; output[index + 2] = next.b; output[index + 3] = next.a;
  }
  return output;
}

export function transformCssColor(value, options, transparentValue = "transparent") {
  const parsed = parseCssColor(value);
  if (!parsed) return value;
  const transformed = transformColor(parsed, options);
  if (transformed.a === 0) return transparentValue;
  return rgbaToHex(transformed, transformed.a < 255);
}

export function transformCssText(source, options) {
  return String(source).replace(/((?:fill|stroke|color|stop-color|flood-color|lighting-color)\s*:\s*)(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|black|white|red|green|blue|gray|grey|yellow|magenta|cyan)/gi,
    (_, prefix, value) => `${prefix}${transformCssColor(value, options)}`);
}

export function colorOutputName(name, format) {
  const stem = String(name).replace(/\.(?:svg|png|jpe?g|webp)$/i, "").replace(/[\\/:*?"<>|]/g, "").trim() || "image";
  const extension = format === "svg" ? "svg" : format === "webp" ? "webp" : "png";
  return `${stem}-color.${extension}`;
}
