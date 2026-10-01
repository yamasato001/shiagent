export const MODES = Object.freeze({
  exact: { rgbStep: 1, alphaStep: 1 },
  balanced: { rgbStep: 8, alphaStep: 8 },
  smallest: { rgbStep: 24, alphaStep: 24 },
  lineart: { rgbStep: 4, alphaStep: 1 }
});

export function detectRasterFormat(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data.length >= 8 &&
      data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 &&
      data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) return "png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  if (data.length >= 12 &&
      data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return "webp";
  return null;
}

export function outputName(name, format, suffix = "") {
  const stem = name.replace(/\.(?:png|jpe?g|webp)$/i, "");
  const extension = format === "jpeg" ? ".jpg" : format === "webp" ? ".webp" : ".png";
  return `${stem}-compressed${suffix}${extension}`;
}

export function jpegQuality(mode, effort = "standard", kind = "photo") {
  let quality;
  if (mode === "lineart") quality = 0.92;
  else if (mode === "smallest") quality = 0.68;
  else if (mode === "balanced") quality = 0.82;
  else quality = kind === "lineart" ? 0.92 : kind === "illustration" ? 0.86 : 0.82;
  return effort === "careful" ? Math.min(0.96, quality + 0.06) : quality;
}

// OxiPNG optimization level. Level 3 took 4-5x as long as level 2 and produced
// the same file size in our benchmarks (line art, illustration and photo-like
// images), so level 2 is the standard. "careful" spends the extra time for
// the few percent that level 4 can still save.
export function pngOptimizationLevel(effort = "standard") {
  return effort === "careful" ? 4 : 2;
}

// Color guard for the palette modes. Reducing to 256 colors is invisible on
// illustrations but visibly shifts photos and smooth gradients (in our
// measurements 82% and 45% of pixels changed noticeably, 0% for illustrations).
// When more than COLOR_GUARD_LIMIT of the pixels change visibly, the
// compressor keeps every color and optimizes losslessly instead.
export const COLOR_GUARD_LIMIT = 0.02;
// Below 256 colors the bar is stricter, because a smaller palette first eats
// into anti-aliased edges (text on a white diagram). On a 6304x5484 draw.io
// diagram: 32 colors changed 0.25% of pixels (86% smaller), 16 colors 0.64%.
export const PALETTE_REDUCTION_LIMIT = 0.003;
// Tried fewest first; the first one within PALETTE_REDUCTION_LIMIT is used.
export const PALETTE_STEPS = Object.freeze([32, 64, 128]);
const VISIBLE_DELTA_E = 2.3; // CIE76 "just noticeable difference"

const linear = new Float32Array(256).map((_, value) => {
  const c = value / 255;
  return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
});
const labF = value => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);

function toLab(r, g, b, out) {
  const R = linear[r], G = linear[g], B = linear[b];
  const x = labF((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = labF(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = labF((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  out[0] = 116 * y - 16; out[1] = 500 * (x - y); out[2] = 200 * (y - z);
}

// Share (0-1) of sampled pixels whose color visibly changed. Fully transparent
// pixels are ignored; an alpha change larger than 8 counts as visible.
export function visibleColorChange(original, processed, sampleLimit = 200_000) {
  const pixels = Math.floor(original.length / 4);
  const stride = Math.max(1, Math.floor(pixels / sampleLimit));
  const a = new Float32Array(3), b = new Float32Array(3);
  let sampled = 0, changed = 0;
  for (let pixel = 0; pixel < pixels; pixel += stride) {
    const i = pixel * 4;
    if (original[i + 3] === 0 && processed[i + 3] === 0) continue;
    sampled += 1;
    if (Math.abs(original[i + 3] - processed[i + 3]) > 8) { changed += 1; continue; }
    toLab(original[i], original[i + 1], original[i + 2], a);
    toLab(processed[i], processed[i + 1], processed[i + 2], b);
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > VISIBLE_DELTA_E) changed += 1;
  }
  return sampled ? changed / sampled : 0;
}

// The guard protects the modes where the visitor did not ask for the smallest
// file: Auto and Balanced. Smallest and Line Art keep their trade-off.
export function usesColorGuard(requestedMode) {
  return requestedMode === "auto" || requestedMode === "balanced";
}

const clamp = value => Math.max(0, Math.min(255, value));
const quantize = (value, step) => step <= 1 ? value : clamp(Math.round(value / step) * step);

export function analyzePixels(data, width, height) {
  const totalPixels = Math.max(1, width * height);
  const stride = Math.max(1, Math.floor(totalPixels / 50000));
  const buckets = new Set();
  const exactColors = new Set();
  let sampled = 0;
  let grayscale = 0;
  let white = 0;
  let background = 0;
  let dark = 0;
  let transparent = 0;
  let saturationSum = 0;
  let edgeHits = 0;
  let edgeTests = 0;

  for (let pixel = 0; pixel < totalPixels; pixel += stride) {
    const i = pixel * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    sampled += 1;
    if (max - min < 12) grayscale += 1;
    if (r > 244 && g > 244 && b > 244 && a > 245) white += 1;
    if (a < 245) transparent += 1;
    if ((r > 244 && g > 244 && b > 244 && a > 245) || a < 16) background += 1;
    if ((r * 0.2126 + g * 0.7152 + b * 0.0722) < 96 && a > 16) dark += 1;
    saturationSum += max === 0 ? 0 : (max - min) / max;
    buckets.add(`${r >> 4},${g >> 4},${b >> 4},${a >> 5}`);
    // Coarse buckets alone mistake smooth photographs for flat artwork. A
    // capped exact-color count distinguishes repeated fills from continuous
    // tone and sensor/texture noise without retaining an unbounded histogram.
    if (exactColors.size <= 2048) exactColors.add(((r << 24) | (g << 16) | (b << 8) | a) >>> 0);

    if (pixel + 1 < totalPixels && pixel % width !== width - 1) {
      const j = i + 4;
      const luma = (r * 3 + g * 6 + b) / 10;
      const next = (data[j] * 3 + data[j + 1] * 6 + data[j + 2]) / 10;
      edgeHits += Math.abs(luma - next) > 48 ? 1 : 0;
      edgeTests += 1;
    }
    if (pixel + width < totalPixels) {
      const j = i + width * 4;
      const luma = (r * 3 + g * 6 + b) / 10;
      const next = (data[j] * 3 + data[j + 1] * 6 + data[j + 2]) / 10;
      edgeHits += Math.abs(luma - next) > 48 ? 1 : 0;
      edgeTests += 1;
    }
  }

  const metrics = {
    grayscaleRatio: grayscale / sampled,
    whiteRatio: white / sampled,
    backgroundRatio: background / sampled,
    darkRatio: dark / sampled,
    transparentRatio: transparent / sampled,
    averageSaturation: saturationSum / sampled,
    edgeRatio: edgeTests ? edgeHits / edgeTests : 0,
    colorBuckets: buckets.size,
    exactColors: exactColors.size
  };
  const isLineArt = metrics.grayscaleRatio > 0.78 &&
    metrics.backgroundRatio > 0.35 &&
    metrics.darkRatio > 0.003 &&
    metrics.edgeRatio > 0.004 &&
    metrics.averageSaturation < 0.12;
  const exactColorLimit = Math.min(2048, Math.max(8, sampled * 0.06));
  const hasGraphicStructure = metrics.transparentRatio > 0.005 ||
    metrics.averageSaturation > 0.2 || metrics.edgeRatio > 0.002;
  const isFlatIllustration = metrics.exactColors <= exactColorLimit && hasGraphicStructure;
  const isIllustration = isFlatIllustration || (
    metrics.averageSaturation > 0.28 &&
    metrics.edgeRatio > 0.015 &&
    metrics.edgeRatio < 0.25
  );
  const kind = isLineArt ? "lineart" : isIllustration ? "illustration" : "photo";
  const preset = isLineArt ? "lineart" : isFlatIllustration ? "illustration" : "balanced";
  return { preset, kind, metrics };
}

export function processPixels(source, mode) {
  const output = new Uint8ClampedArray(source);
  const settings = MODES[mode] || MODES.balanced;
  for (let i = 0; i < output.length; i += 4) {
    if (mode === "lineart") {
      const r = output[i];
      const g = output[i + 1];
      const b = output[i + 2];
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (spread < 32) {
        const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
        const gray = luma > 248 ? 255 : luma < 7 ? 0 : Math.round(luma / settings.rgbStep) * settings.rgbStep;
        output[i] = output[i + 1] = output[i + 2] = clamp(gray);
      }
    } else {
      output[i] = quantize(output[i], settings.rgbStep);
      output[i + 1] = quantize(output[i + 1], settings.rgbStep);
      output[i + 2] = quantize(output[i + 2], settings.rgbStep);
    }
    output[i + 3] = quantize(output[i + 3], settings.alphaStep);
  }
  return output;
}

export function formatBytes(bytes, locale = "ja-JP") {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: index ? 1 : 0 }).format(value)} ${units[index]}`;
}

export function savedPercent(before, after) {
  return before > 0 ? ((before - after) / before) * 100 : 0;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(date) {
  return ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((date.getSeconds() / 2) & 31);
}

function dosDate(date) {
  return (((Math.max(1980, date.getFullYear()) - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31);
}

export function createZip(entries, modified = new Date(1980, 0, 1)) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true); lv.setUint16(10, dosTime(modified), true); lv.setUint16(12, dosDate(modified), true);
    lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true);
    local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, dosTime(modified), true); cv.setUint16(14, dosDate(modified), true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
    central.set(name, 46); centralParts.push(central);
    offset += local.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
  const parts = [...localParts, ...centralParts, end];
  const size = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const bytes = new Uint8Array(size);
  let cursor = 0;
  for (const part of parts) {
    bytes.set(part, cursor);
    cursor += part.byteLength;
  }
  return bytes;
}
