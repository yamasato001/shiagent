import { init, potrace } from "esm-potrace-wasm";
import { createZip, formatBytes } from "../assets/js/png-core.js";
import {
  OUTPUT_SIZES,
  QUALITY_PRESETS,
  SPLIT_PRESETS,
  binaryToImageData,
  compositeOnWhite,
  cropRgba,
  foregroundMask,
  normalizeSvgCanvas,
  preprocessRgba,
  projectionSplit,
  safeBaseName
} from "../assets/js/png-to-svg-core.js";

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
  elements.fileCount.textContent = `${state.files.length}件`;
  elements.fileList.replaceChildren();
  state.files.forEach((file, index) => {
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
    meta.textContent = formatBytes(file.size);
    main.append(name, meta);
    const remove = document.createElement("button");
    remove.className = "icon-button";
    remove.type = "button";
    remove.setAttribute("aria-label", `${file.name}を削除`);
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

function addFiles(fileList) {
  const incoming = [...fileList].filter(file => file.type === "image/png" || file.name.toLowerCase().endsWith(".png"));
  if (!incoming.length) {
    showToast("PNGファイルを選択してください。");
    return;
  }
  const keys = new Set(state.files.map(file => `${file.name}:${file.size}:${file.lastModified}`));
  for (const file of incoming) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!keys.has(key)) {
      state.files.push(file);
      keys.add(key);
    }
  }
  revokeResults();
  elements.resultsPanel.hidden = true;
  renderFiles();
}

async function decodeFile(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data: imageData.data, width: imageData.width, height: imageData.height };
}

async function rgbaPreviewUrl(rgba, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  return URL.createObjectURL(blob);
}

async function traceAsset(asset, preset, canvasSize) {
  const processed = preprocessRgba(asset.data, asset.width, asset.height, preset);
  if (!processed.data.some(value => value === 0)) throw new Error("黒い線を検出できませんでした。");
  const traced = await potrace(binaryToImageData(processed.data, processed.width, processed.height), {
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

async function convertFile(file, fileIndex, totalFiles) {
  const source = await decodeFile(file);
  const assets = [];
  if (mode() === "single") {
    assets.push({ ...source, sourceIndex: 1 });
  } else {
    const rgb = compositeOnWhite(source.data);
    const mask = foregroundMask(rgb);
    const boxes = projectionSplit(mask, source.width, source.height, splitPreset());
    if (!boxes.length) throw new Error("イラストを検出できませんでした。");
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
  elements.resultCount.textContent = `${state.results.length}件`;
  const totalBytes = state.results.reduce((sum, result) => sum + result.blob.size, 0);
  elements.resultSize.textContent = formatBytes(totalBytes);
  elements.resultStatus.textContent = `${state.files.length}ファイルから${state.results.length}件のSVGを生成しました。`;
  elements.resultList.replaceChildren();
  state.results.forEach((result, index) => {
    const card = document.createElement("article");
    card.className = "vector-result-card";
    const compare = document.createElement("div");
    compare.className = "vector-compare";
    const beforeFigure = document.createElement("figure");
    const beforeImage = document.createElement("img");
    beforeImage.src = result.previewUrl;
    beforeImage.alt = `${result.name}の変換前`;
    const beforeCaption = document.createElement("figcaption");
    beforeCaption.textContent = "PNG";
    beforeFigure.append(beforeImage, beforeCaption);
    const afterFigure = document.createElement("figure");
    const afterImage = document.createElement("img");
    afterImage.src = result.url;
    afterImage.alt = `${result.name}の変換後`;
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
    download.textContent = "SVGを保存";
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
  elements.progressText.textContent = "Potraceを準備中…";
  revokeResults();
  try {
    state.wasmReady ||= init();
    await state.wasmReady;
    for (let index = 0; index < state.files.length; index += 1) await convertFile(state.files[index], index, state.files.length);
    renderResults();
    elements.progressText.textContent = "変換完了";
    elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    elements.progressText.textContent = "変換に失敗しました";
    showToast(error instanceof Error ? error.message : "変換中にエラーが発生しました。");
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
elements.fileInput.addEventListener("change", () => addFiles(elements.fileInput.files));
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
elements.dropZone.addEventListener("drop", event => addFiles(event.dataTransfer.files));
elements.clearButton.addEventListener("click", clearAll);
elements.removeAllButton.addEventListener("click", clearAll);
elements.convertButton.addEventListener("click", convertAll);
document.querySelectorAll('input[name="conversionMode"]').forEach(input => input.addEventListener("change", updateMode));
elements.downloadAllButton.addEventListener("click", () => {
  const encoder = new TextEncoder();
  const zip = createZip(state.results.map(result => ({ name: result.name, data: encoder.encode(result.svg) })));
  const url = URL.createObjectURL(zip);
  triggerDownload(url, "shiagent-svg.zip");
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

updateMode();
renderFiles();
