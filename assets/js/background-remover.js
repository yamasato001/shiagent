import { formatBytes } from "./png-core.js";
import { canvasFromRgba, createZipBlob, decodeBrowserImage, encodeBrowserCanvas, toImageData } from "./browser-runtime.js";
import { hexToRgb, outputFormat, outputName, rgbToHex } from "./background-remover-core.js";
import { detectImageFormat, requiresSoftwareDecoder } from "./image-converter-core.js";
import { lang, pick } from "./i18n.js";
import common from "./i18n/common.js";
import backgroundText from "./i18n/background-remover.js";

const shared = pick(common), copy = pick(backgroundText);

const $ = selector => document.querySelector(selector);
const elements = {
  dropZone: $("#dropZone"),
  fileInput: $("#fileInput"),
  selectButton: $("#selectButton"),
  clearButton: $("#clearButton"),
  keyColorInput: $("#keyColor"),
  tolerance: $("#tolerance"),
  toleranceValue: $("#toleranceValue"),
  softness: $("#softness"),
  softnessValue: $("#softnessValue"),
  fillColorInput: $("#fillColor"),
  format: $("#outputFormat"),
  queuePanel: $("#queuePanel"),
  fileCount: $("#fileCount"),
  fileList: $("#fileList"),
  addButton: $("#addButton"),
  removeAllButton: $("#removeAllButton"),
  processButton: $("#processButton"),
  progressText: $("#progressText"),
  resultsPanel: $("#resultsPanel"),
  resultStatus: $("#resultStatus"),
  resultCount: $("#resultCount"),
  resultSize: $("#resultSize"),
  resultList: $("#resultList"),
  downloadAllButton: $("#downloadAllButton"),
  toast: $("#toast")
};

const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|jfif|webp|gif|bmp|avif|heic|heif|tiff?)$/i;
const MIME_BY_FORMAT = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg" };
const state = { entries: [], running: false };
let worker = null;
let jobId = 0;
let decoderWorker = null;
let decoderId = 0;

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function checkedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function fillColor() {
  const fill = checkedValue("fill") || "transparent";
  if (fill === "transparent") return null;
  if (fill === "white") return [255, 255, 255];
  if (fill === "black") return [0, 0, 0];
  return hexToRgb(elements.fillColorInput.value);
}

function settings(entry) {
  const pickedKey = checkedValue("key") === "manual" ? hexToRgb(elements.keyColorInput.value) : null;
  return {
    removal: checkedValue("removal") || "connected",
    keyColor: entry.keyColor || pickedKey,
    tolerance: Number(elements.tolerance.value),
    softness: Number(elements.softness.value),
    fill: fillColor()
  };
}

function isImageFile(file) {
  return (file.type.startsWith("image/") && file.type !== "image/svg+xml") || IMAGE_EXTENSIONS.test(file.name);
}

function disposeResult(entry) {
  if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
  entry.resultUrl = null;
  entry.resultBlob = null;
  entry.resultName = null;
}

function dispose(entry) {
  disposeResult(entry);
  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
}

function hideResults() {
  state.entries.forEach(disposeResult);
  elements.resultsPanel.hidden = true;
}

async function addFiles(fileList) {
  if (state.running) return;
  const incoming = [...fileList].filter(isImageFile);
  if (!incoming.length) {
    showToast(copy.unsupported);
    return;
  }
  const keys = new Set(state.entries.map(entry => entry.key));
  for (const file of incoming) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (keys.has(key)) continue;
    keys.add(key);
    const format = detectImageFormat(await file.slice(0, 64).arrayBuffer());
    // HEIC / TIFF cannot be shown by <img>; a PNG preview is made after decoding.
    const software = requiresSoftwareDecoder(format);
    state.entries.push({ key, file, format, software, previewUrl: software ? null : URL.createObjectURL(file), keyColor: null, resultUrl: null, resultBlob: null, resultName: null, error: null, info: null });
  }
  hideResults();
  elements.fileInput.value = "";
  renderFiles();
}

function renderFiles() {
  elements.queuePanel.hidden = state.entries.length === 0;
  elements.fileCount.textContent = shared.fileCount(state.entries.length);
  elements.fileList.replaceChildren();
  state.entries.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "file-row";
    let preview;
    if (entry.previewUrl) {
      preview = document.createElement("img");
      preview.className = "file-thumb";
      preview.alt = "";
      preview.src = entry.previewUrl;
    } else {
      preview = document.createElement("span");
      preview.className = "svg-file-mark";
      preview.textContent = (entry.format || "IMG").toUpperCase();
    }
    const main = document.createElement("div");
    main.className = "file-main";
    const name = document.createElement("strong");
    name.className = "file-name";
    name.textContent = entry.file.name;
    const meta = document.createElement("span");
    meta.className = "file-meta";
    meta.textContent = formatBytes(entry.file.size);
    main.append(name, meta);
    const remove = document.createElement("button");
    remove.className = "icon-button";
    remove.type = "button";
    remove.setAttribute("aria-label", shared.removeFile(entry.file.name));
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      if (state.running) return;
      dispose(entry);
      state.entries.splice(index, 1);
      hideResults();
      renderFiles();
    });
    row.append(preview, main, remove);
    elements.fileList.append(row);
  });
}

// HEIC / TIFF go through the shared WASM decoder bundle used by the image converter.
async function decodeInWorker(file, format) {
  decoderWorker ||= new Worker("/assets/dist/image-decoder-worker.js", { type: "module", name: lang });
  const buffer = await file.arrayBuffer();
  const id = ++decoderId;
  return new Promise((resolve, reject) => {
    const onMessage = event => {
      if (event.data.id !== id) return;
      decoderWorker.removeEventListener("message", onMessage);
      decoderWorker.removeEventListener("error", onError);
      if (event.data.error) reject(new Error(`${file.name}: ${event.data.error}`));
      else resolve(event.data.result);
    };
    const onError = event => {
      decoderWorker.terminate();
      decoderWorker = null;
      reject(new Error(`${file.name}: ${event.message || copy.decoderMissing}`));
    };
    decoderWorker.addEventListener("message", onMessage);
    decoderWorker.addEventListener("error", onError);
    decoderWorker.postMessage({ id, buffer, format }, [buffer]);
  });
}

async function decodeFile(entry) {
  const { file } = entry;
  if (entry.software) {
    const decoded = await decodeInWorker(file, entry.format);
    const imageData = toImageData(decoded);
    if (!entry.previewUrl) {
      entry.previewUrl = URL.createObjectURL(await encode(imageData.data, imageData.width, imageData.height, "png"));
    }
    return imageData;
  }
  try {
    const canvas = await decodeBrowserImage(file, { willReadFrequently: true });
    return canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    throw new Error(copy.undecodable(file.name));
  }
}

function runWorker(imageData, options) {
  worker ||= new Worker(new URL("./background-remover-worker.js", import.meta.url), { type: "module" });
  const id = ++jobId;
  return new Promise((resolve, reject) => {
    const onMessage = event => {
      if (event.data.id !== id) return;
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data);
    };
    const onError = event => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      worker.terminate();
      worker = null;
      reject(new Error(event.message || copy.processFailed));
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    const buffer = imageData.data.buffer;
    worker.postMessage({ id, buffer, width: imageData.width, height: imageData.height, options }, [buffer]);
  });
}

function encode(rgba, width, height, format) {
  const canvas = canvasFromRgba({ data: rgba, width, height });
  const quality = format === "png" ? undefined : 0.92;
  return encodeBrowserCanvas(canvas, MIME_BY_FORMAT[format], quality).catch(() => { throw new Error(copy.encodeFailed); });
}

async function processEntry(entry) {
  disposeResult(entry);
  entry.error = null;
  const imageData = await decodeFile(entry);
  const { width, height } = imageData;
  const options = settings(entry);
  const result = await runWorker(imageData, options);
  let format = outputFormat(elements.format.value, options.fill);
  let blob = await encode(result.buffer, width, height, format);
  // Some browsers (Safari) silently fall back to PNG for unsupported encoders.
  if (blob.type && blob.type !== MIME_BY_FORMAT[format]) format = "png";
  entry.resultBlob = blob;
  entry.resultUrl = URL.createObjectURL(blob);
  entry.resultName = outputName(entry.file.name, format, Boolean(options.fill));
  entry.info = {
    width, height, format,
    keyColor: result.keyColor,
    removal: options.removal,
    removedRatio: result.removedRatio,
    alreadyTransparent: result.detected.transparent && !options.keyColor
  };
}

function triggerDownload(url, name) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function describe(entry) {
  if (entry.error) return entry.error;
  const { info } = entry;
  const parts = [`${info.width} × ${info.height}`, info.format.toUpperCase(), formatBytes(entry.resultBlob.size)];
  if (info.removal !== "none") {
    if (info.alreadyTransparent) parts.push(copy.alreadyTransparent);
    else parts.push(copy.removed(Math.round(info.removedRatio * 100)));
  }
  return parts.join(" / ");
}

// Reads the pixel under the pointer from the original image so the user can
// correct a wrongly detected background color for this one file.
async function pickColor(entry, image, event) {
  const rect = image.getBoundingClientRect();
  const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const offsetX = (rect.width - image.naturalWidth * scale) / 2;
  const offsetY = (rect.height - image.naturalHeight * scale) / 2;
  const x = Math.floor((event.clientX - rect.left - offsetX) / scale);
  const y = Math.floor((event.clientY - rect.top - offsetY) / scale);
  if (x < 0 || y < 0 || x >= image.naturalWidth || y >= image.naturalHeight) return;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, x, y, 1, 1, 0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  if (a < 128) { showToast(copy.transparentPick); return; }
  entry.keyColor = [r, g, b];
  await reprocess(entry, copy.picked(rgbToHex(entry.keyColor)));
}

async function reprocess(entry, message) {
  if (state.running) return;
  state.running = true;
  elements.processButton.disabled = true;
  try {
    await processEntry(entry);
    renderResults();
    publishOutputs();
    showToast(message);
  } catch (error) {
    console.error(error);
    showToast(error instanceof Error ? error.message : copy.failed);
  } finally {
    state.running = false;
    elements.processButton.disabled = false;
  }
}

function resultCard(entry, index) {
  const card = document.createElement("article");
  card.className = "bg-result-card";
  const compare = document.createElement("div");
  compare.className = "bg-compare";
  const before = document.createElement("figure");
  const beforeImage = document.createElement("img");
  if (entry.previewUrl) beforeImage.src = entry.previewUrl;
  beforeImage.alt = copy.beforeAlt(entry.file.name);
  beforeImage.title = copy.pickHint;
  beforeImage.className = "bg-picker";
  beforeImage.addEventListener("click", event => pickColor(entry, beforeImage, event));
  const beforeCaption = document.createElement("figcaption");
  beforeCaption.textContent = copy.beforeCaption;
  before.append(beforeImage, beforeCaption);
  const after = document.createElement("figure");
  after.className = "bg-after";
  if (entry.resultUrl) {
    const afterImage = document.createElement("img");
    afterImage.src = entry.resultUrl;
    afterImage.alt = copy.afterAlt(entry.resultName);
    after.append(afterImage);
  }
  const afterCaption = document.createElement("figcaption");
  afterCaption.textContent = "AFTER";
  after.append(afterCaption);
  compare.append(before, after);

  const body = document.createElement("div");
  const number = document.createElement("span");
  number.textContent = String(index + 1).padStart(2, "0");
  const name = document.createElement("strong");
  name.textContent = entry.resultName || entry.file.name;
  const meta = document.createElement("small");
  meta.textContent = describe(entry);
  if (entry.error) meta.className = "is-error";
  body.append(number, name, meta);
  if (entry.info?.keyColor && entry.info.removal !== "none") {
    const swatch = document.createElement("small");
    swatch.className = "bg-key";
    const chip = document.createElement("i");
    chip.style.background = rgbToHex(entry.info.keyColor);
    swatch.append(chip, copy.keyColor(rgbToHex(entry.info.keyColor), Boolean(entry.keyColor)));
    if (entry.keyColor) {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "text-button";
      reset.textContent = copy.resetAuto;
      reset.addEventListener("click", () => { entry.keyColor = null; reprocess(entry, copy.resetDone); });
      swatch.append(reset);
    }
    body.append(swatch);
  }
  if (entry.resultUrl) {
    const download = document.createElement("button");
    download.type = "button";
    download.className = "button button-light";
    download.textContent = copy.download;
    download.addEventListener("click", () => triggerDownload(entry.resultUrl, entry.resultName));
    body.append(download);
  }
  card.append(compare, body);
  return card;
}

function renderResults() {
  const done = state.entries.filter(entry => entry.resultBlob);
  const failed = state.entries.filter(entry => entry.error);
  elements.resultsPanel.hidden = false;
  elements.resultsPanel.dataset.preview = checkedValue("preview") || "checker";
  elements.resultCount.textContent = shared.fileCount(done.length);
  elements.resultSize.textContent = formatBytes(done.reduce((sum, entry) => sum + entry.resultBlob.size, 0));
  elements.resultStatus.textContent = failed.length
    ? copy.statusWithErrors(done.length, failed.length)
    : copy.status(done.length);
  elements.downloadAllButton.disabled = done.length === 0;
  elements.resultList.replaceChildren(...state.entries.map(resultCard));
}

function publishOutputs() {
  const files = state.entries.filter(entry => entry.resultBlob).map(entry => ({ name: entry.resultName, blob: entry.resultBlob }));
  if (files.length) document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files, source: "background-remover-result" } }));
}

async function processAll() {
  if (!state.entries.length || state.running) return;
  state.running = true;
  elements.processButton.disabled = true;
  hideResults();
  try {
    for (let index = 0; index < state.entries.length; index += 1) {
      const entry = state.entries[index];
      elements.progressText.textContent = `${index + 1}/${state.entries.length} ${entry.file.name} — ${copy.processing}`;
      await new Promise(resolve => requestAnimationFrame(resolve));
      try {
        await processEntry(entry);
      } catch (error) {
        console.error(error);
        entry.error = error instanceof Error ? error.message : copy.entryFailed;
      }
    }
    renderResults();
    publishOutputs();
    elements.progressText.textContent = copy.done;
    elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } finally {
    state.running = false;
    elements.processButton.disabled = false;
  }
}

function clearAll() {
  if (state.running) return;
  state.entries.forEach(dispose);
  state.entries = [];
  elements.resultsPanel.hidden = true;
  elements.progressText.textContent = "";
  elements.fileInput.value = "";
  renderFiles();
}

function syncControls() {
  elements.toleranceValue.textContent = elements.tolerance.value;
  elements.softnessValue.textContent = elements.softness.value;
  const removal = checkedValue("removal");
  document.querySelectorAll("[data-needs-removal]").forEach(node => { node.disabled = removal === "none"; });
  const jpegOption = elements.format.querySelector('option[value="jpeg"]');
  jpegOption.disabled = !fillColor();
  if (jpegOption.disabled && elements.format.value === "jpeg") elements.format.value = "png";
  if (!elements.resultsPanel.hidden) elements.resultsPanel.dataset.preview = checkedValue("preview") || "checker";
}

elements.selectButton.addEventListener("click", event => { event.stopPropagation(); elements.fileInput.click(); });
elements.addButton.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", () => addFiles(elements.fileInput.files));
elements.dropZone.addEventListener("click", () => elements.fileInput.click());
elements.dropZone.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.fileInput.click(); }
});
for (const name of ["dragenter", "dragover"]) elements.dropZone.addEventListener(name, event => { event.preventDefault(); elements.dropZone.classList.add("is-over"); });
for (const name of ["dragleave", "drop"]) elements.dropZone.addEventListener(name, event => { event.preventDefault(); elements.dropZone.classList.remove("is-over"); });
elements.dropZone.addEventListener("drop", event => addFiles(event.dataTransfer.files));
elements.clearButton.addEventListener("click", clearAll);
elements.removeAllButton.addEventListener("click", clearAll);
elements.processButton.addEventListener("click", processAll);
elements.keyColorInput.addEventListener("input", () => { const manual = document.querySelector('input[name="key"][value="manual"]'); manual.checked = true; syncControls(); });
elements.fillColorInput.addEventListener("input", () => { document.querySelector('input[name="fill"][value="custom"]').checked = true; syncControls(); });
document.querySelector(".bg-settings").addEventListener("change", syncControls);
document.querySelector(".bg-settings").addEventListener("input", syncControls);
document.querySelector(".bg-preview-toggle").addEventListener("change", syncControls);
elements.downloadAllButton.addEventListener("click", async () => {
  const done = state.entries.filter(entry => entry.resultBlob);
  if (!done.length) return;
  const used = new Map();
  const zipEntries = [];
  for (const entry of done) {
    let name = entry.resultName;
    const seen = used.get(name) || 0;
    used.set(name, seen + 1);
    if (seen) name = name.replace(/(\.[^.]+)$/, `-${seen + 1}$1`);
    zipEntries.push({ name, data: new Uint8Array(await entry.resultBlob.arrayBuffer()) });
  }
  const url = URL.createObjectURL(createZipBlob(zipEntries));
  triggerDownload(url, "shiagent-background.zip");
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener("beforeunload", () => state.entries.forEach(dispose));

syncControls();
renderFiles();
