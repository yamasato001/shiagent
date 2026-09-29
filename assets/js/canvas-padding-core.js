const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function relativePaddingPlacement(imageWidth, imageHeight, options = {}) {
  if (imageWidth <= 0 || imageHeight <= 0) throw new Error("Invalid image dimensions");
  const amount = Math.max(0, number(options.padding));
  const unit = options.unit === "px" ? "px" : "percent";
  const x = unit === "percent" ? Math.round(imageWidth * amount / 100) : Math.round(amount);
  const y = unit === "percent" ? Math.round(imageHeight * amount / 100) : Math.round(amount);
  return {
    canvasWidth: imageWidth + x * 2,
    canvasHeight: imageHeight + y * 2,
    x, y, width: imageWidth, height: imageHeight
  };
}

export function fixedCanvasPlacement(imageWidth, imageHeight, canvasWidth, canvasHeight, options = {}) {
  const width = Math.max(1, Math.round(number(canvasWidth)));
  const height = Math.max(1, Math.round(number(canvasHeight)));
  if (imageWidth <= 0 || imageHeight <= 0) throw new Error("Invalid image dimensions");
  const inset = Math.max(0, Math.round(number(options.inset)));
  const availableWidth = Math.max(1, width - inset * 2);
  const availableHeight = Math.max(1, height - inset * 2);
  const fitScale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const scale = options.allowUpscale ? fitScale : Math.min(1, fitScale);
  const outputWidth = Math.max(1, Math.round(imageWidth * scale));
  const outputHeight = Math.max(1, Math.round(imageHeight * scale));
  return {
    canvasWidth: width,
    canvasHeight: height,
    x: Math.round((width - outputWidth) / 2),
    y: Math.round((height - outputHeight) / 2),
    width: outputWidth,
    height: outputHeight
  };
}

export function paddedName(name, format, suffix = "") {
  const extension = format === "jpeg" ? "jpg" : format;
  if (!["png", "jpg", "webp"].includes(extension)) throw new Error("Unsupported output format");
  const stem = name.replace(/\.[^./\\]+$/, "") || "image";
  return `${stem}-padded${suffix}.${extension}`;
}
