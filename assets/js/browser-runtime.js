import { planRenames } from "./batch-rename-core.js";
import { createZip } from "./png-core.js";
import { applyConfiguredOutputSuffix } from "./output-name.js";

export function createZipBlob(entries, modified = new Date(), options = {}) {
  const prepared = options.applySuffix === false ? entries : entries.map(entry => ({ ...entry, name: applyConfiguredOutputSuffix(entry.name) }));
  const blob = new Blob([createZip(prepared, modified)], { type: "application/zip" });
  Object.defineProperty(blob, Symbol.for("shiagent.outputFiles"), {
    value: prepared.map(entry => ({ name: entry.name, blob: entry.data instanceof Blob ? entry.data : new Blob([entry.data]) }))
  });
  return blob;
}

export function createRenamedFiles(files, options) {
  return planRenames(files, options).map(({ source, name }) => new File([source], name, {
    type: source.type,
    lastModified: source.lastModified,
  }));
}

export function toImageData(image) {
  return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}

export function canvasFromRgba(image, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d", { alpha: options.alpha !== false, willReadFrequently: Boolean(options.willReadFrequently) })
    .putImageData(toImageData(image), 0, 0);
  return canvas;
}

export async function decodeBrowserImage(file, options = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: options.imageOrientation || "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d", { willReadFrequently: Boolean(options.willReadFrequently) }).drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export function encodeBrowserCanvas(canvas, mime, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error(`Could not encode ${mime}.`)),
    mime,
    quality,
  ));
}
