import { crc32 } from "./png-core.js";

const UNIT_TO_PX = Object.freeze({ px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, pt: 96 / 72, pc: 16 });

function attributesOf(source) {
  const root = source.match(/<svg\b([^>]*)>/i);
  if (!root) throw new Error("Invalid SVG");
  const attributes = {};
  for (const match of root[1].matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)) attributes[match[1].toLowerCase()] = match[3];
  return attributes;
}

export function svgLengthToPx(value) {
  const match = String(value ?? "").trim().match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+))(px|in|cm|mm|q|pt|pc)?$/i);
  if (!match) return null;
  return Number(match[1]) * UNIT_TO_PX[(match[2] || "px").toLowerCase()];
}

export function parseSvgSize(source) {
  const attributes = attributesOf(source);
  const viewBox = String(attributes.viewbox || "").trim().split(/[\s,]+/).map(Number);
  const hasViewBox = viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0;
  let width = svgLengthToPx(attributes.width);
  let height = svgLengthToPx(attributes.height);
  if (width && !height && hasViewBox) height = width * viewBox[3] / viewBox[2];
  if (height && !width && hasViewBox) width = height * viewBox[2] / viewBox[3];
  if (!width || !height) {
    if (!hasViewBox) throw new Error("SVG size is missing");
    width = viewBox[2];
    height = viewBox[3];
  }
  return { width, height, viewBox: hasViewBox ? viewBox : [0, 0, width, height] };
}

const positive = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error("Invalid output size");
  return number;
};

export function rasterDimensions(sourceWidth, sourceHeight, options) {
  const width = positive(sourceWidth), height = positive(sourceHeight);
  let outputWidth, outputHeight;
  if (options.mode === "scale") {
    const scale = positive(options.scale) / 100;
    outputWidth = width * scale;
    outputHeight = height * scale;
  } else if (options.mode === "dpi") {
    const scale = positive(options.dpi) / 96;
    outputWidth = width * scale;
    outputHeight = height * scale;
  } else {
    const targetWidth = positive(options.width), targetHeight = positive(options.height);
    if (options.keepAspect !== false) {
      const scale = Math.min(targetWidth / width, targetHeight / height);
      outputWidth = width * scale;
      outputHeight = height * scale;
    } else {
      outputWidth = targetWidth;
      outputHeight = targetHeight;
    }
  }
  const result = { width: Math.max(1, Math.round(outputWidth)), height: Math.max(1, Math.round(outputHeight)) };
  if (result.width > 32767 || result.height > 32767 || result.width * result.height > 100_000_000) throw new Error("Output size is too large");
  return result;
}

export function rasterizedName(name, format, suffix = "") {
  const stem = String(name).replace(/\.svg$/i, "").replace(/[\\/:*?"<>|]/g, "").trim() || "image";
  return `${stem}${suffix}.${format === "webp" ? "webp" : "png"}`;
}

export function addPngDensity(input, dpi) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 33 || bytes[0] !== 137 || String.fromCharCode(...bytes.subarray(1, 4)) !== "PNG") return bytes;
  const pixelsPerMeter = Math.max(1, Math.round(positive(dpi) / 0.0254));
  const type = new TextEncoder().encode("pHYs");
  const data = new Uint8Array(9);
  const dataView = new DataView(data.buffer);
  dataView.setUint32(0, pixelsPerMeter); dataView.setUint32(4, pixelsPerMeter); data[8] = 1;
  const crcInput = new Uint8Array(type.length + data.length); crcInput.set(type); crcInput.set(data, 4);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9); chunk.set(type, 4); chunk.set(data, 8); view.setUint32(17, crc32(crcInput));
  const parts = [bytes.subarray(0, 33), chunk];
  let offset = 33;
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const end = offset + length + 12;
    if (end > bytes.length) break;
    const typeName = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (typeName !== "pHYs") parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  if (offset < bytes.length) parts.push(bytes.subarray(offset));
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) { output.set(part, cursor); cursor += part.length; }
  return output;
}
