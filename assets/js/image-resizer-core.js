import { OUTPUT_FORMATS } from "./image-converter-core.js";

const integer = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
};

export function resizeDimensions(sourceWidth, sourceHeight, options) {
  const width = integer(sourceWidth);
  const height = integer(sourceHeight);
  if (!width || !height) throw new Error("Invalid source dimensions");

  if (options.mode === "percent") {
    const percent = Number(options.percent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 1000) throw new Error("Invalid resize percentage");
    return {
      width: Math.max(1, Math.round(width * percent / 100)),
      height: Math.max(1, Math.round(height * percent / 100))
    };
  }

  const targetWidth = integer(options.width);
  const targetHeight = integer(options.height);
  if (!targetWidth && !targetHeight) throw new Error("Missing target dimensions");
  if (!options.keepAspect) {
    if (!targetWidth || !targetHeight) throw new Error("Both dimensions are required");
    return { width: targetWidth, height: targetHeight };
  }

  const scale = targetWidth && targetHeight
    ? Math.min(targetWidth / width, targetHeight / height)
    : targetWidth ? targetWidth / width : targetHeight / height;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

export function linkedDimension(sourceWidth, sourceHeight, changed, value) {
  const width = integer(sourceWidth);
  const height = integer(sourceHeight);
  const input = integer(value);
  if (!width || !height || !input) return null;
  if (changed === "width") return Math.max(1, Math.round(input * height / width));
  if (changed === "height") return Math.max(1, Math.round(input * width / height));
  return null;
}

export function resolvedOutputFormat(inputFormat, requested = "original") {
  if (requested !== "original") {
    if (!OUTPUT_FORMATS[requested]) throw new Error(`Unsupported output format: ${requested}`);
    return requested;
  }
  return ["png", "jpeg", "webp"].includes(inputFormat) ? inputFormat : "jpeg";
}

export function resizedName(name, outputFormat, suffix = "") {
  const definition = OUTPUT_FORMATS[outputFormat];
  if (!definition) throw new Error(`Unsupported output format: ${outputFormat}`);
  const stem = name.replace(/\.(?:png|jpe?g|webp|heic|heif|avif|gif|bmp|tiff?)$/i, "");
  return `${stem}-resized${suffix}.${definition.extension}`;
}
