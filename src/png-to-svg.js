import { init, potrace } from "esm-potrace-wasm";
import { detectRasterFormat, formatBytes } from "../assets/js/png-core.js";
import { canvasFromRgba, createZipBlob, decodeBrowserImage, encodeBrowserCanvas, toImageData } from "../assets/js/browser-runtime.js";
import {
  OUTPUT_SIZES,
  QUALITY_PRESETS,
  SPLIT_PRESETS,
  binaryToRgba,
  compositeOnWhite,
  cropRgba,
  foregroundMask,
  normalizeSvgCanvas,
  preprocessRgba,
  projectionSplit,
  safeBaseName
} from "../assets/js/png-to-svg-core.js";
import { pick } from "../assets/js/i18n.js";
import common from "../assets/js/i18n/common.js";
import vectorText from "../assets/js/i18n/vector-tools.js";

const shared = pick(common), copy = pick(vectorText).vectorizer;

const $ = selector => document.querySelector(selector);
const elements = {
  dropZone: $("#dropZone"),
  fileInput: $("#fileInput"),
  selectButton: $("#selectButton"),
  settingsPanel: $("#settingsPanel"),
  splitSettings: $("#splitSettings"),
  queuePanel: $("#queuePanel"),
  fileCount: $("#fileCount"),
  fileList: $("#fileList"),
  addButton: $("#addButton"),
  clearButton: $("#clearButton"),
  removeAllButton: $("#removeAllButton"),
  convertButton: $("#convertButton"),
  progressText: $("#progressText"),
  resultsPanel: $("#resultsPanel"),
  resultStatus: $("#resultStatus"),
  resultCount: $("#resultCount"),
  resultSize: $("#resultSize"),
  resultList: $("#resultList"),
  downloadAllButton: $("#downloadAllButton"),
  toast: $("#toast")
};

const state = {
  files: [],
  results: [],
  running: false,
  wasmReady: null
};

const sourceFormatLabel = format => format === "jpeg" ? "JPEG" : format === "webp" ? "WebP" : "PNG";

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function mode() {
  return document.querySelector('input[name="conversionMode"]:checked')?.value || "split";
}

function quality() {
  return QUALITY_PRESETS[document.querySelector('input[name="quality"]:checked')?.value || "smooth"];
}

function splitPreset() {
  return SPLIT_PRESETS[document.querySelector('input[name="split"]:checked')?.value || "standard"];
}

function outputSize() {
  const selected = Number(document.querySelector('input[name="outputSize"]:checked')?.value || 512);
  return OUTPUT_SIZES.includes(selected) ? selected : 512;
}

function revokeResults() {
  for (const result of state.results) {
    URL.revokeObjectURL(result.url);
    URL.revokeObjectURL(result.previewUrl);
  }
  state.results = [];
}

function updateMode() {
  elements.splitSettings.hidden = mode() !== "split";
}

function renderFiles() {
  elements.queuePanel.hidden = state.files.length === 0;
  elements.fileCount.textContent = shared.fileCount(state.files.length);
  elements.fileList.replaceChildren();
  state.files.forEach((entry, index) => {
    const { file, format } = entry;
    const row = document.createElement("div");
    row.className = "file-row";
    const preview = document.createElement("img");
    preview.className = "file-thumb";
    preview.alt = "";
    const previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.addEventListener("load", () => URL.revokeObjectURL(previewUrl), { once: true });
    const main = document.createElement("div");
    main.className = "file-main";
    const name = document.createElement("strong");
    name.className = "file-name";
    name.textContent = file.name;
    const meta = document.createElement("span");
    meta.className = "file-meta";
    meta.textContent = `${sourceFormatLabel(format)} · ${formatBytes(file.size)}`;
    main.append(name, meta);
    const remove = document.createElement("button");
    remove.className = "icon-button";
    remove.type = "button";
    remove.setAttribute("aria-label", shared.removeFile(file.name));
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      state.files.splice(index, 1);
      revokeResults();
      elements.resultsPanel.hidden = true;
      renderFiles();
    });
    row.append(preview, main, remove);
    elements.fileList.append(row);
  });
}

async function addFiles(fileList) {
  const keys = new Set(state.files.map(entry => entry.key));
  let accepted = 0;
  let rejected = 0;
  for (const file of fileList) {
    const format = detectRasterFormat(await file.slice(0, 12).arrayBuffer());
    if (!format) {
      rejected += 1;
      continue;
    }
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!keys.has(key)) {
      state.files.push({ file, format, key });
      keys.add(key);
      accepted += 1;
    }
  }
  if (rejected) showToast(copy.unsupported);
  if (!accepted) return;
  revokeResults();
  elements.resultsPanel.hidden = true;
  renderFiles();
}

async function decodeFile(file) {
  const canvas = await decodeBrowserImage(file, { willReadFrequently: true });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data: imageData.data, width: imageData.width, height: imageData.height };
}

async function rgbaPreviewUrl(rgba, width, height) {
  const canvas = canvasFromRgba({ data: rgba, width, height });
  const blob = await encodeBrowserCanvas(canvas, "image/png");
  return URL.createObjectURL(blob);
}

async function traceAsset(asset, preset, canvasSize) {
  const processed = preprocessRgba(asset.data, asset.width, asset.height, preset);
  if (!processed.data.some(value => value === 0)) throw new Error(copy.noLines);
  const traced = await potrace(toImageData(binaryToRgba(processed.data, processed.width, processed.height)), {
    turdsize: preset.turdsize,
    turnpolicy: 4,
    alphamax: preset.alphamax,
    opticurve: 1,
    opttolerance: preset.opttolerance,
    pathonly: false,
    extractcolors: false,
    posterizelevel: 2,
    posterizationalgorithm: 0
  });
  return normalizeSvgCanvas(traced, canvasSize);
}

async function convertFile(entry, fileIndex, totalFiles) {
  const { file, format } = entry;
  const source = await decodeFile(file);
  const assets = [];
  if (mode() === "single") {
    assets.push({ ...source, sourceIndex: 1 });
  } else {
    const rgb = compositeOnWhite(source.data);
    const mask = foregroundMask(rgb);
    const boxes = projectionSplit(mask, source.width, source.height, splitPreset());
    if (!boxes.length) throw new Error(copy.nothingFound);
    boxes.forEach((box, index) => assets.push({ ...cropRgba(source.data, source.width, source.height, box, 16), sourceIndex: index + 1 }));
  }

  const baseName = safeBaseName(file.name);
  const canvasSize = outputSize();
  for (let index = 0; index < assets.length; index += 1) {
    elements.progressText.textContent = `${fileIndex + 1}/${totalFiles} ${file.name} — SVG ${index + 1}/${assets.length}`;
    await new Promise(resolve => requestAnimationFrame(resolve));
    const svg = await traceAsset(assets[index], quality(), canvasSize);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const outputName = assets.length === 1 ? `${baseName}.svg` : `${baseName}_${String(index + 1).padStart(2, "0")}.svg`;
    state.results.push({
      name: outputName,
      svg,
      blob,
      url: URL.createObjectURL(blob),
      previewUrl: await rgbaPreviewUrl(assets[index].data, assets[index].width, assets[index].height),
      sourceName: file.name,
      sourceFormat: format,
      sourceIndex: assets[index].sourceIndex,
      canvasSize
    });
  }
}

function triggerDownload(url, name) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function renderResults() {
  elements.resultsPanel.hidden = false;
  elements.resultCount.textContent = shared.fileCount(state.results.length);
  const totalBytes = state.results.reduce((sum, result) => sum + result.blob.size, 0);
  elements.resultSize.textContent = formatBytes(totalBytes);
  elements.resultStatus.textContent = copy.status(state.files.length, state.results.length);
  elements.resultList.replaceChildren();
  state.results.forEach((result, index) => {
    const card = document.createElement("article");
    card.className = "vector-result-card";
    const compare = document.createElement("div");
    compare.className = "vector-compare";
    const beforeFigure = document.createElement("figure");
    const beforeImage = document.createElement("img");
    beforeImage.src = result.previewUrl;
    beforeImage.alt = copy.beforeAlt(result.name);
    const beforeCaption = document.createElement("figcaption");
    beforeCaption.textContent = sourceFormatLabel(result.sourceFormat);
    beforeFigure.append(beforeImage, beforeCaption);
    const afterFigure = document.createElement("figure");
    const afterImage = document.createElement("img");
    afterImage.src = result.url;
    afterImage.alt = copy.afterAlt(result.name);
    const afterCaption = document.createElement("figcaption");
    afterCaption.textContent = "SVG";
    afterFigure.append(afterImage, afterCaption);
    compare.append(beforeFigure, afterFigure);
    const body = document.createElement("div");
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("strong");
    name.textContent = result.name;
    const meta = document.createElement("small");
    meta.textContent = `${formatBytes(result.blob.size)} / ${result.canvasSize} × ${result.canvasSize}`;
    const download = document.createElement("button");
    download.type = "button";
    download.className = "button button-light";
    download.textContent = shared.saveSvg;
    download.addEventListener("click", () => triggerDownload(result.url, result.name));
    body.append(number, name, meta, download);
    card.append(compare, body);
    elements.resultList.append(card);
  });
}

async function convertAll() {
  if (!state.files.length || state.running) return;
  state.running = true;
  elements.convertButton.disabled = true;
  elements.progressText.textContent = copy.preparing;
  revokeResults();
  try {
    state.wasmReady ||= init();
    await state.wasmReady;
    for (let index = 0; index < state.files.length; index += 1) await convertFile(state.files[index], index, state.files.length);
    renderResults();
    elements.progressText.textContent = copy.done;
    elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    elements.progressText.textContent = copy.failed;
    showToast(error instanceof Error ? error.message : copy.error);
  } finally {
    state.running = false;
    elements.convertButton.disabled = false;
  }
}

function clearAll() {
  state.files = [];
  revokeResults();
  elements.resultsPanel.hidden = true;
  elements.progressText.textContent = "";
  elements.fileInput.value = "";
  renderFiles();
}

elements.selectButton.addEventListener("click", event => {
  event.stopPropagation();
  elements.fileInput.click();
});
elements.addButton.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", () => addFiles(elements.fileInput.files).catch(error => {
  console.error(error);
  showToast(copy.loadFailed);
}));
elements.dropZone.addEventListener("click", () => elements.fileInput.click());
elements.dropZone.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    elements.fileInput.click();
  }
});
for (const name of ["dragenter", "dragover"]) elements.dropZone.addEventListener(name, event => {
  event.preventDefault();
  elements.dropZone.classList.add("is-over");
});
for (const name of ["dragleave", "drop"]) elements.dropZone.addEventListener(name, event => {
  event.preventDefault();
  elements.dropZone.classList.remove("is-over");
});
elements.dropZone.addEventListener("drop", event => addFiles(event.dataTransfer.files).catch(error => {
  console.error(error);
  showToast(copy.loadFailed);
}));
elements.clearButton.addEventListener("click", clearAll);
elements.removeAllButton.addEventListener("click", clearAll);
elements.convertButton.addEventListener("click", convertAll);
document.querySelectorAll('input[name="conversionMode"]').forEach(input => input.addEventListener("change", updateMode));
elements.downloadAllButton.addEventListener("click", () => {
  const encoder = new TextEncoder();
  const zip = createZipBlob(state.results.map(result => ({ name: result.name, data: encoder.encode(result.svg) })));
  const url = URL.createObjectURL(zip);
  triggerDownload(url, "shiagent-svg.zip");
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

updateMode();
renderFiles();
