export const INPUT_FORMATS = Object.freeze({
  png: { label: "PNG", extensions: ["png"] },
  jpeg: { label: "JPEG", extensions: ["jpg", "jpeg"] },
  webp: { label: "WebP", extensions: ["webp"] },
  heic: { label: "HEIC / HEIF", extensions: ["heic", "heif"] },
  avif: { label: "AVIF", extensions: ["avif"] },
  gif: { label: "GIF", extensions: ["gif"] },
  bmp: { label: "BMP", extensions: ["bmp"] },
  tiff: { label: "TIFF", extensions: ["tif", "tiff"] }
});

export const OUTPUT_FORMATS = Object.freeze({
  png: { label: "PNG", mime: "image/png", extension: "png" },
  jpeg: { label: "JPEG", mime: "image/jpeg", extension: "jpg" },
  webp: { label: "WebP", mime: "image/webp", extension: "webp" }
});

function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

export function detectImageFormat(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG" &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) return "gif";
  if (bytes.length >= 2 && ascii(bytes, 0, 2) === "BM") return "bmp";
  if (bytes.length >= 4 && ((ascii(bytes, 0, 2) === "II" && bytes[2] === 0x2a && bytes[3] === 0) ||
      (ascii(bytes, 0, 2) === "MM" && bytes[2] === 0 && bytes[3] === 0x2a))) return "tiff";
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brands = ascii(bytes, 8, Math.min(bytes.length - 8, 56));
    if (/(avif|avis)/.test(brands)) return "avif";
    if (/(heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1)/.test(brands)) return "heic";
  }
  return null;
}

export function formatLabel(format) {
  return INPUT_FORMATS[format]?.label || format?.toUpperCase() || "UNKNOWN";
}

export function convertedName(name, outputFormat, suffix = "") {
  const extension = OUTPUT_FORMATS[outputFormat]?.extension;
  if (!extension) throw new Error(`Unsupported output format: ${outputFormat}`);
  const stem = name.replace(/\.(?:png|jpe?g|webp|heic|heif|avif|gif|bmp|tiff?)$/i, "");
  return `${stem}${suffix}.${extension}`;
}

export function outputQuality(format, preset = "standard") {
  if (format === "png") return undefined;
  const values = format === "webp"
    ? { compact: 0.68, standard: 0.82, high: 0.92 }
    : { compact: 0.72, standard: 0.86, high: 0.94 };
  return values[preset] ?? values.standard;
}

export function requiresSoftwareDecoder(format) {
  return format === "heic" || format === "tiff";
}
