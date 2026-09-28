import { createZip, formatBytes } from "./png-core.js";
import { SPLIT_PRESETS, compositeOnWhite, cropRgba, foregroundMask, projectionSplit, safeBaseName } from "./png-to-svg-core.js";

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
  const incoming = [...fileList].filter(isImageFile);
  if (!incoming.length) {
    showToast("PNGまたはJPGファイルを選択してください。");
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
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
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

function canvasFromRgba(rgba, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas;
}

function canvasToPng(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNGを書き出せませんでした。")), "image/png"));
}

async function detectionPreview(rgba, width, height, boxes) {
  const canvas = canvasFromRgba(rgba, width, height);
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
  elements.progressText.textContent = `${fileIndex + 1}/${totalFiles} ${file.name} — 画像を解析中`;
  await new Promise(resolve => requestAnimationFrame(resolve));
  const source = await decodeFile(file);
  const rgb = compositeOnWhite(source.data);
  const sourceRgba = opaqueRgba(rgb);
  const boxes = projectionSplit(foregroundMask(rgb), source.width, source.height, preset());
  if (!boxes.length) throw new Error(`${file.name}: イラストを検出できませんでした。`);
  state.previews.push({ name: file.name, count: boxes.length, url: await detectionPreview(sourceRgba, source.width, source.height, boxes) });
  const baseName = safeBaseName(file.name);
  for (let index = 0; index < boxes.length; index += 1) {
    elements.progressText.textContent = `${fileIndex + 1}/${totalFiles} ${file.name} — ${index + 1}/${boxes.length}を書き出し中`;
    await new Promise(resolve => requestAnimationFrame(resolve));
    const crop = cropRgba(sourceRgba, source.width, source.height, boxes[index], 16);
    const blob = await canvasToPng(canvasFromRgba(crop.data, crop.width, crop.height));
    const name = `${baseName}_${String(index + 1).padStart(2, "0")}.png`;
    state.results.push({ name, blob, url: URL.createObjectURL(blob), width: crop.width, height: crop.height, sourceName: file.name });
  }
}

function renderResults() {
  elements.resultsPanel.hidden = false;
  elements.resultCount.textContent = `${state.results.length}件`;
  elements.resultSize.textContent = formatBytes(state.results.reduce((sum, result) => sum + result.blob.size, 0));
  elements.resultStatus.textContent = `${state.files.length}ファイルから${state.results.length}枚に分割しました。`;
  elements.detectionList.replaceChildren();
  state.previews.forEach(preview => {
    const figure = document.createElement("figure");
    figure.className = "splitter-detection";
    const image = document.createElement("img");
    image.src = preview.url;
    image.alt = `${preview.name}の検出結果`;
    const caption = document.createElement("figcaption");
    caption.textContent = `${preview.name} — ${preview.count}個を検出`;
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
    download.textContent = "PNGを保存";
    download.addEventListener("click", () => triggerDownload(result.url, result.name));
    body.append(number, name, meta, download);
    card.append(image, body);
    elements.resultList.append(card);
  });
}

async function splitAll() {
  if (!state.files.length || state.running) return;
  state.running = true;
  elements.splitButton.disabled = true;
  revokeResults();
  try {
    for (let index = 0; index < state.files.length; index += 1) await splitFile(state.files[index], index, state.files.length);
    renderResults();
    elements.progressText.textContent = "分割完了";
    elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    elements.progressText.textContent = "分割に失敗しました";
    showToast(error instanceof Error ? error.message : "分割中にエラーが発生しました。");
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
  const url = URL.createObjectURL(createZip(entries));
  triggerDownload(url, "shiagent-split-images.zip");
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

renderFiles();
