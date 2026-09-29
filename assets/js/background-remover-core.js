// Background removal for flat backgrounds (white sheets, studio colors, UI
// screenshots). It keys out one background color by RGB distance, with a soft
// band that turns anti-aliased edge pixels semi-transparent and removes the
// background color bleeding from them so they composite cleanly on any color.

export const REMOVAL_MODES = Object.freeze(["connected", "global", "none"]);

const MAX_DISTANCE = Math.sqrt(3 * 255 * 255);

export function hexToRgb(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map(value => value.toString(16).padStart(2, "0")).join("")}`;
}

// Percentages from the UI (0-100) mapped onto RGB distance.
export function toleranceToDistance(percent) {
  return (Math.max(0, Math.min(100, percent)) / 100) * MAX_DISTANCE * 0.5;
}

function distance(data, i, [r, g, b]) {
  const dr = data[i] - r;
  const dg = data[i + 1] - g;
  const db = data[i + 2] - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Picks the most common opaque color along the image border. Colors are
// bucketed (4 bits per channel) and the bucket's average is returned so JPEG
// noise does not split the vote.
export function estimateBackground(data, width, height) {
  const buckets = new Map();
  let opaque = 0;
  let total = 0;
  const visit = pixel => {
    const i = pixel * 4;
    total += 1;
    if (data[i + 3] < 128) return;
    opaque += 1;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += data[i];
    bucket.g += data[i + 1];
    bucket.b += data[i + 2];
    buckets.set(key, bucket);
  };
  for (let x = 0; x < width; x += 1) {
    visit(x);
    if (height > 1) visit((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    visit(y * width);
    if (width > 1) visit(y * width + width - 1);
  }
  if (!total || opaque / total < 0.5) return { color: null, coverage: 0, transparent: true };
  let best = null;
  for (const bucket of buckets.values()) if (!best || bucket.count > best.count) best = bucket;
  const color = [best.r, best.g, best.b].map(sum => Math.round(sum / best.count));
  return { color, coverage: best.count / total, transparent: false };
}

// Returns per-pixel removal alpha (0 = background, 255 = keep).
// connected: only background reachable from the image border is removed, so
//   white areas enclosed by lines (eyes, teeth, paper inside a frame) stay.
// global: every pixel close to the color is removed wherever it is.
export function backgroundAlpha(data, width, height, options) {
  const { color, tolerance, softness, mode = "connected" } = options;
  const total = width * height;
  const alpha = new Uint8Array(total).fill(255);
  if (mode === "none" || !color) return alpha;
  const hard = toleranceToDistance(tolerance);
  const soft = Math.max(hard + 1, hard + toleranceToDistance(softness));
  const level = pixel => {
    const d = distance(data, pixel * 4, color);
    if (d <= hard) return 0;
    if (d >= soft) return 255;
    return Math.round(((d - hard) / (soft - hard)) * 255);
  };

  if (mode === "global") {
    for (let pixel = 0; pixel < total; pixel += 1) alpha[pixel] = level(pixel);
    return alpha;
  }

  // Flood fill through core background pixels, then grow a short distance
  // into the soft band so anti-aliased edges fade instead of leaving a halo.
  const state = new Uint8Array(total); // 0 unvisited, 1 background, 2 edge
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const seed = pixel => {
    if (state[pixel] || level(pixel) !== 0) return;
    state[pixel] = 1;
    queue[tail++] = pixel;
  };
  for (let x = 0; x < width; x += 1) { seed(x); seed((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { seed(y * width); seed(y * width + width - 1); }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    if (x > 0) seed(pixel - 1);
    if (x < width - 1) seed(pixel + 1);
    if (pixel >= width) seed(pixel - width);
    if (pixel < total - width) seed(pixel + width);
  }

  let frontier = queue.subarray(0, tail);
  const edgeRadius = 2;
  for (let step = 0; step < edgeRadius && frontier.length; step += 1) {
    const next = [];
    for (const pixel of frontier) {
      const x = pixel % width;
      const y = (pixel - x) / width;
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const neighbor = ny * width + nx;
          if (state[neighbor]) continue;
          const value = level(neighbor);
          if (value === 255) continue;
          state[neighbor] = 2;
          alpha[neighbor] = value;
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  for (let pixel = 0; pixel < total; pixel += 1) if (state[pixel] === 1) alpha[pixel] = 0;
  return alpha;
}

// Applies removal alpha and "un-mixes" the background color from partially
// transparent pixels: observed = fg * a + bg * (1 - a)  =>  fg = (observed - bg * (1 - a)) / a.
export function applyAlpha(data, removal, color) {
  const output = new Uint8ClampedArray(data.length);
  for (let pixel = 0, i = 0; i < data.length; pixel += 1, i += 4) {
    const keep = removal[pixel];
    const a = keep / 255;
    if (keep > 0 && keep < 255 && color) {
      for (let channel = 0; channel < 3; channel += 1) {
        output[i + channel] = (data[i + channel] - color[channel] * (1 - a)) / a;
      }
    } else {
      output[i] = data[i];
      output[i + 1] = data[i + 1];
      output[i + 2] = data[i + 2];
    }
    output[i + 3] = Math.round((data[i + 3] * keep) / 255);
  }
  return output;
}

// Flattens RGBA onto an opaque color (null keeps transparency).
export function fillBackground(data, color) {
  if (!color) return data;
  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    output[i] = data[i] * a + color[0] * (1 - a);
    output[i + 1] = data[i + 1] * a + color[1] * (1 - a);
    output[i + 2] = data[i + 2] * a + color[2] * (1 - a);
    output[i + 3] = 255;
  }
  return output;
}

export function processBackground(data, width, height, options) {
  const { removal = "connected", keyColor = null, tolerance = 12, softness = 10, fill = null } = options;
  const detected = estimateBackground(data, width, height);
  const color = keyColor || detected.color;
  const alpha = backgroundAlpha(data, width, height, { color, tolerance, softness, mode: removal });
  let removed = 0;
  for (let pixel = 0; pixel < alpha.length; pixel += 1) if (alpha[pixel] < 128) removed += 1;
  const cutout = removal === "none" ? new Uint8ClampedArray(data) : applyAlpha(data, alpha, color);
  return {
    data: fillBackground(cutout, fill),
    keyColor: color,
    detected,
    removedRatio: alpha.length ? removed / alpha.length : 0
  };
}

export function outputFormat(requested, fill) {
  // JPEG cannot store transparency; fall back to PNG when nothing fills it.
  if (requested === "jpeg" && !fill) return "png";
  return requested;
}

export function outputName(name, format, filled) {
  const stem = name.replace(/\.[^./\\]+$/, "") || "image";
  const extension = format === "jpeg" ? ".jpg" : format === "webp" ? ".webp" : ".png";
  return `${stem}-${filled ? "bg" : "nobg"}${extension}`;
}
