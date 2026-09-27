export const STYLE_PRESETS = Object.freeze({
  worksheet: "clean black and white line art for a children's worksheet, white background, simple bold outlines, no shading, no color",
  delicate: "delicate black and white line drawing, white background, thin precise outlines, minimal hatching, no color",
  comic: "expressive black and white comic ink drawing, white background, confident outlines, sparse detail, no color",
  icon: "minimal black and white outline icon, centered, isolated on white background, uniform stroke, no color"
});

export function buildPrompt(prompt, style = "worksheet") {
  const clean = String(prompt || "").trim().replace(/\s+/g, " ");
  const suffix = STYLE_PRESETS[style] || STYLE_PRESETS.worksheet;
  return `${clean}, ${suffix}`;
}

export function parsePromptList(value, limit = 20) {
  return String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, limit);
}

export function toFixedTokenIds(source, length = 77, padTokenId = 0) {
  const values = source?.data || source || [];
  const output = new Int32Array(length);
  output.fill(Number(padTokenId) || 0);
  const count = Math.min(values.length, length);
  for (let index = 0; index < count; index += 1) output[index] = Number(values[index]);
  return output;
}

export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createLatents(shape, sigma, seed) {
  const length = shape.reduce((total, value) => total * value, 1);
  const output = new Float32Array(length);
  const random = mulberry32(seed);
  for (let index = 0; index < length; index += 2) {
    const u = Math.max(Number.EPSILON, random());
    const v = random();
    const radius = Math.sqrt(-2 * Math.log(u));
    output[index] = radius * Math.cos(2 * Math.PI * v) * sigma;
    if (index + 1 < length) output[index + 1] = radius * Math.sin(2 * Math.PI * v) * sigma;
  }
  return output;
}

export function tensorToLineArt(data, width, height, strength = 0.72) {
  const pixels = width * height;
  const output = new Uint8ClampedArray(pixels * 4);
  for (let i = 0; i < pixels; i += 1) {
    const r = Math.max(0, Math.min(1, data[i] / 2 + 0.5));
    const g = Math.max(0, Math.min(1, data[pixels + i] / 2 + 0.5));
    const b = Math.max(0, Math.min(1, data[pixels * 2 + i] / 2 + 0.5));
    const gray = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 255;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * (1 + strength) + 150));
    const value = contrasted > 238 ? 255 : Math.round(contrasted / 4) * 4;
    const offset = i * 4;
    output[offset] = output[offset + 1] = output[offset + 2] = value;
    output[offset + 3] = 255;
  }
  return output;
}
