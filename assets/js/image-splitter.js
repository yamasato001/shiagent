import { formatBytes } from "./png-core.js";
import { canvasFromRgba, createZipBlob, decodeBrowserImage, encodeBrowserCanvas } from "./browser-runtime.js";
import { SPLIT_PRESETS, compositeOnWhite, cropRgba, foregroundMask, projectionSplit, safeBaseName } from "./png-to-svg-core.js";
import { pick } from "./i18n.js";
import common from "./i18n/common.js";
import splitterText from "./i18n/image-splitter.js";

const shared = pick(common), copy = pick(splitterText);

const $ = selector => document.querySelector(selector);
const elements = {
  dropZone: $("#dropZone"),
  fileInput: $("#fileInput"),
  selectButton: $("#selectButton"),
  clearButton: $("#clearButton"),
  queuePanel: $("#queuePanel"),
  fileCount: $("#fileCount"),
  fileList: $("#fileList"),
  addButton: $("#addButton"),
  removeAllButton: $("#removeAllButton"),
  splitButton: $("#splitButton"),
  progressText: $("#progressText"),
  resultsPanel: $("#resultsPanel"),
  resultStatus: $("#resultStatus"),
  resultCount: $("#resultCount"),
  resultSize: $("#resultSize"),
  detectionList: $("#detectionList"),
  resultList: $("#resultList"),
  downloadAllButton: $("#downloadAllButton"),
  toast: $("#toast")
};

const state = { files: [], results: [], previews: [], running: false };

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function preset() {
  return SPLIT_PRESETS[document.querySelector('input[name="split"]:checked')?.value || "standard"];
}

function revokeResults() {
  for (const result of state.results) URL.revokeObjectURL(result.url);
  for (const preview of state.previews) URL.revokeObjectURL(preview.url);
  state.results = [];
  state.previews = [];
}

function isImageFile(file) {
  return ["image/png", "image/jpeg"].includes(file.type) || /\.(?:png|jpe?g)$/i.test(file.name);
}

function renderFiles() {
  elements.queuePanel.hidden = state.files.length === 0;
  elements.fileCount.textContent = shared.fileCount(state.files.length);
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

function addFiles(fileList) {
  const incoming = [...fileList].filter(isImageFile);
  if (!incoming.length) {
    showToast(copy.unsupported);
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
  elements.fileInput.value = "";
  renderFiles();
}

async function decodeFile(file) {
  const canvas = await decodeBrowserImage(file, { willReadFrequently: true });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data: imageData.data, width: imageData.width, height: imageData.height };
}

function opaqueRgba(rgb) {
  const output = new Uint8ClampedArray((rgb.length / 3) * 4);
  for (let source = 0, target = 0; source < rgb.length; source += 3, target += 4) {
    output[target] = rgb[source];
    output[target + 1] = rgb[source + 1];
    output[target + 2] = rgb[source + 2];
    output[target + 3] = 255;
  }
  return output;
}

function canvasToPng(canvas) {
  return encodeBrowserCanvas(canvas, "image/png").catch(() => { throw new Error(copy.pngFailed); });
}

async function detectionPreview(rgba, width, height, boxes) {
  const canvas = canvasFromRgba({ data: rgba, width, height });
  const context = canvas.getContext("2d");
  const scale = Math.max(1, Math.min(width, height) / 500);
  context.lineWidth = Math.max(2, Math.round(3 * scale));
  context.strokeStyle = "#d30000";
  context.fillStyle = "#ffffff";
  context.font = `${Math.max(13, Math.round(16 * scale))}px sans-serif`;
  context.textBaseline = "top";
  boxes.forEach(([x1, y1, x2, y2], index) => {
    context.strokeRect(x1, y1, x2 - x1, y2 - y1);
    const label = String(index + 1);
    const labelWidth = context.measureText(label).width + 10;
    const labelHeight = Math.max(20, Math.round(23 * scale));
    context.fillRect(x1, y1, labelWidth, labelHeight);
    context.fillStyle = "#d30000";
    context.fillText(label, x1 + 5, y1 + 2);
    context.fillStyle = "#ffffff";
  });
  return URL.createObjectURL(await canvasToPng(canvas));
}

function triggerDownload(url, name) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

async function splitFile(file, fileIndex, totalFiles) {
  elements.progressText.textContent = `${fileIndex + 1}/${totalFiles} ${file.name} — ${copy.analyzing}`;
  await new Promise(resolve => requestAnimationFrame(resolve));
  const source = await decodeFile(file);
  const rgb = compositeOnWhite(source.data);
  const sourceRgba = opaqueRgba(rgb);
  const boxes = projectionSplit(foregroundMask(rgb), source.width, source.height, preset());
  if (!boxes.length) throw new Error(copy.nothingFound(file.name));
  state.previews.push({ name: file.name, count: boxes.length, url: await detectionPreview(sourceRgba, source.width, source.height, boxes) });
  const baseName = safeBaseName(file.name);
  for (let index = 0; index < boxes.length; index += 1) {
    elements.progressText.textContent = `${fileIndex + 1}/${totalFiles} ${file.name} — ${copy.writing(index + 1, boxes.length)}`;
    await new Promise(resolve => requestAnimationFrame(resolve));
    const crop = cropRgba(sourceRgba, source.width, source.height, boxes[index], 16);
    const blob = await canvasToPng(canvasFromRgba(crop));
    const name = `${baseName}_${String(index + 1).padStart(2, "0")}.png`;
    state.results.push({ name, blob, url: URL.createObjectURL(blob), width: crop.width, height: crop.height, sourceName: file.name });
  }
}

function renderResults() {
  elements.resultsPanel.hidden = false;
  elements.resultCount.textContent = shared.fileCount(state.results.length);
  elements.resultSize.textContent = formatBytes(state.results.reduce((sum, result) => sum + result.blob.size, 0));
  elements.resultStatus.textContent = copy.status(state.files.length, state.results.length);
  elements.detectionList.replaceChildren();
  state.previews.forEach(preview => {
    const figure = document.createElement("figure");
    figure.className = "splitter-detection";
    const image = document.createElement("img");
    image.src = preview.url;
    image.alt = copy.detectionAlt(preview.name);
    const caption = document.createElement("figcaption");
    caption.textContent = copy.detected(preview.name, preview.count);
    figure.append(image, caption);
    elements.detectionList.append(figure);
  });
  elements.resultList.replaceChildren();
  state.results.forEach((result, index) => {
    const card = document.createElement("article");
    card.className = "splitter-result-card";
    const image = document.createElement("img");
    image.src = result.url;
    image.alt = result.name;
    const body = document.createElement("div");
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("strong");
    name.textContent = result.name;
    const meta = document.createElement("small");
    meta.textContent = `${result.width} × ${result.height} / ${formatBytes(result.blob.size)}`;
    const download = document.createElement("button");
    download.type = "button";
    download.className = "button button-light";
    download.textContent = copy.savePng;
    download.addEventListener("click", () => triggerDownload(result.url, result.name));
    body.append(number, name, meta, download);
    card.append(image, body);
    elements.resultList.append(card);
  });
  if (state.results.length) {
    const files = state.results.map(result => new File([result.blob], result.name, { type: result.blob.type }));
    document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files, source: "image-splitter-result" } }));
  }
}

async function splitAll() {
  if (!state.files.length || state.running) return;
  state.running = true;
  elements.splitButton.disabled = true;
  revokeResults();
  try {
    for (let index = 0; index < state.files.length; index += 1) await splitFile(state.files[index], index, state.files.length);
    renderResults();
    elements.progressText.textContent = copy.done;
    elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    elements.progressText.textContent = copy.failed;
    showToast(error instanceof Error ? error.message : copy.error);
  } finally {
    state.running = false;
    elements.splitButton.disabled = false;
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
elements.splitButton.addEventListener("click", splitAll);
elements.downloadAllButton.addEventListener("click", async () => {
  const entries = await Promise.all(state.results.map(async result => ({ name: result.name, data: new Uint8Array(await result.blob.arrayBuffer()) })));
  const url = URL.createObjectURL(createZipBlob(entries));
  triggerDownload(url, "shiagent-split-images.zip");
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

renderFiles();
