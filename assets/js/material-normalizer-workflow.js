import { contentBounds } from "./image-cropper-core.js";
import { detectImageFormat, OUTPUT_FORMATS, outputQuality, requiresSoftwareDecoder } from "./image-converter-core.js";
import { formatBytes, savedPercent } from "./png-core.js";
import { canvasFromRgba, createZipBlob, decodeBrowserImage, encodeBrowserCanvas } from "./browser-runtime.js";
import { assetNormalizerNames, assetNormalizerPlacement, materialNames, validCanvasSize, validOccupancy, validPadding, workflowPlacement } from "./material-normalizer-workflow-core.js";
import { lang, locale, pick } from "./i18n.js";
import common from "./i18n/common.js";
import workflowText from "./i18n/material-normalizer-workflow.js";

const shared = pick(common), copy = pick(workflowText);
const isAssetNormalizer = document.body.dataset.workflow === "asset-normalizer";
const $ = selector => document.querySelector(selector);
const elements = {
  drop: $("#dropZone"), input: $("#fileInput"), select: $("#selectButton"), add: $("#addButton"), clear: $("#clearButton"), removeAll: $("#removeAllButton"),
  queue: $("#queuePanel"), count: $("#fileCount"), list: $("#fileList"), run: $("#runButton"), cancel: $("#cancelButton"), progress: $("#progressText"),
  trimBackground: $("#trimBackground"), tolerance: $("#toleranceInput"), toleranceValue: $("#toleranceValue"), padding: $("#paddingInput"), paddingUnit: $("#paddingUnit"),
  occupancy: $("#occupancyInput"), occupancyValue: $("#occupancyValue"),
  width: $("#widthInput"), height: $("#heightInput"), presets: document.querySelectorAll("[data-canvas-size]"), format: $("#formatInput"), quality: $("#qualityInput"),
  background: $("#backgroundInput"), backgroundColor: $("#backgroundColorInput"), baseName: $("#baseNameInput"), start: $("#startNumberInput"), preview: $("#namePreview"),
  results: $("#resultsPanel"), resultStatus: $("#resultStatus"), resultMark: $("#resultMark"), before: $("#beforeTotal"), after: $("#afterTotal"), saved: $("#savedTotal"), savedRate: $("#savedRate"),
  downloadAll: $("#downloadAllButton"), toast: $("#toast"), summaryCanvas: $("#summaryCanvas"), summaryObject: $("#summaryObject"), summaryPadding: $("#summaryPadding"), summaryBackground: $("#summaryBackground"), summaryFormat: $("#summaryFormat"), summaryNaming: $("#summaryNaming")
};
let entries = [], running = false, cancelRequested = false, decoderWorker = null, decoderId = 0, optimizerWorker = null, optimizerId = 0;
const decoderRequests = new Map();
const optimizerRequests = new Map();

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add("show"); window.setTimeout(() => elements.toast.classList.remove("show"), 2600); }
function disposeResult(entry) { if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl); Object.assign(entry, { resultUrl: null, resultBlob: null, resultName: null, error: null, status: "ready" }); }
function dispose(entry) { disposeResult(entry); if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl); }
function resetResults() { entries.forEach(disposeResult); elements.results.hidden = true; elements.progress.textContent = ""; }

function names() { return isAssetNormalizer ? assetNormalizerNames(entries.length, elements.baseName.value, elements.start.value, elements.format.value) : materialNames(entries.length, elements.baseName.value, elements.start.value, elements.format.value); }
function updateControls() {
  elements.toleranceValue.textContent = elements.tolerance.value;
  elements.backgroundColor.disabled = elements.background.value !== "custom";
  const planned = names();
  const fallbackName = isAssetNormalizer ? assetNormalizerNames(1)[0] : materialNames(1)[0];
  elements.preview.textContent = copy.preview(planned[0] || fallbackName, elements.width.value, elements.height.value);
  elements.presets.forEach(button => button.classList.toggle("is-active", button.dataset.canvasSize === `${elements.width.value}x${elements.height.value}`));
  if (elements.occupancyValue) elements.occupancyValue.textContent = `${elements.occupancy.value}%`;
  if (elements.summaryCanvas) {
    const backgrounds = { transparent: lang === "ja" ? "透明" : "Transparent", white: lang === "ja" ? "白" : "White", black: lang === "ja" ? "黒" : "Black", custom: elements.backgroundColor.value.toUpperCase() };
    elements.summaryCanvas.textContent = `${elements.width.value} × ${elements.height.value}`;
    elements.summaryObject.textContent = `${elements.occupancy.value}%`;
    elements.summaryPadding.textContent = `${elements.padding.value}${elements.paddingUnit.value === "px" ? "px" : "%"}`;
    elements.summaryBackground.textContent = backgrounds[elements.background.value];
    elements.summaryFormat.textContent = elements.format.value.toUpperCase();
    elements.summaryNaming.textContent = planned[0] || fallbackName;
  }
  if (isAssetNormalizer) elements.run.innerHTML = `${copy.normalizeCount(entries.length)} <span>→</span>`;
}

function thumb(entry) {
  const url = entry.resultUrl || entry.previewUrl;
  return url ? `<img class="file-thumb" src="${url}" alt="">` : `<span class="svg-file-mark">${escapeHtml((entry.format || "IMG").toUpperCase())}</span>`;
}
function render() {
  const planned = names();
  elements.queue.hidden = entries.length === 0;
  elements.count.textContent = shared.fileCount(entries.length);
  elements.list.innerHTML = entries.map((entry, index) => {
    const result = entry.status === "done" ? `<div class="file-result"><span>${formatBytes(entry.file.size, locale)} → ${formatBytes(entry.resultBlob.size, locale)}</span><strong>${entry.width} × ${entry.height}</strong><button class="button button-light file-download" type="button" data-download="${index}">${copy.download}</button></div>` : `<button class="icon-button" type="button" data-remove="${index}" aria-label="${escapeHtml(shared.removeFile(entry.file.name))}">×</button>`;
    const error = entry.error ? `<small class="converter-error">${escapeHtml(entry.error)}</small>` : "";
    return `<article class="file-row workflow-file-row ${entry.status === "done" ? "is-done" : ""}">${thumb(entry)}<div class="file-main"><span class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span><span class="file-meta workflow-rename">→ ${escapeHtml(entry.resultName || planned[index])}</span>${error}${entry.status === "processing" ? '<div class="progress-track"><span class="progress-bar" style="width:55%"></span></div>' : ""}</div><span class="file-status ${entry.status}">${copy.status[entry.status]}</span>${result}</article>`;
  }).join("");
  updateControls();
}

async function addFiles(fileList) {
  if (running) return;
  let rejected = false, duplicate = false;
  for (const file of fileList) {
    const format = detectImageFormat(await file.slice(0, 64).arrayBuffer());
    if (!format) { rejected = true; continue; }
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (entries.some(entry => entry.key === key)) { duplicate = true; continue; }
    const software = requiresSoftwareDecoder(format);
    const entry = { key, file, format, software, previewUrl: software ? null : URL.createObjectURL(file) };
    disposeResult(entry); entries.push(entry);
  }
  elements.input.value = ""; resetResults(); render();
  if (rejected) showToast(copy.unsupported); else if (duplicate) showToast(copy.duplicate);
}

function ensureDecoderWorker() {
  if (!decoderWorker) {
    decoderWorker = new Worker("/assets/dist/image-decoder-worker.js", { type: "module", name: lang });
    decoderWorker.addEventListener("message", event => { const request = decoderRequests.get(event.data.id); if (!request) return; decoderRequests.delete(event.data.id); event.data.error ? request.reject(new Error(event.data.error)) : request.resolve(event.data.result); });
    decoderWorker.addEventListener("error", event => stopDecoderWorker(new Error(event.message || copy.decoderError)));
  }
  return decoderWorker;
}
function stopDecoderWorker(error = Object.assign(new Error(copy.cancelled), { name: "AbortError" })) { decoderWorker?.terminate(); decoderWorker = null; for (const request of decoderRequests.values()) request.reject(error); decoderRequests.clear(); }
function ensureOptimizerWorker() {
  if (!optimizerWorker) {
    optimizerWorker = new Worker("/assets/dist/png-optimizer-worker.js", { type: "module", name: `${lang}-ai-asset-prep` });
    optimizerWorker.addEventListener("message", event => { const request = optimizerRequests.get(event.data.id); if (!request) return; optimizerRequests.delete(event.data.id); event.data.error ? request.reject(new Error(event.data.error)) : request.resolve(event.data.result); });
    optimizerWorker.addEventListener("error", event => stopOptimizerWorker(new Error(event.message || copy.encodeFailed)));
  }
  return optimizerWorker;
}
function stopOptimizerWorker(error = Object.assign(new Error(copy.cancelled), { name: "AbortError" })) { optimizerWorker?.terminate(); optimizerWorker = null; for (const request of optimizerRequests.values()) request.reject(error); optimizerRequests.clear(); }
async function optimizePng(blob) {
  const buffer = await blob.arrayBuffer();
  const level = elements.quality.value === "compact" ? 4 : elements.quality.value === "high" ? 2 : 3;
  const result = await new Promise((resolve, reject) => { const id = ++optimizerId; optimizerRequests.set(id, { resolve, reject }); ensureOptimizerWorker().postMessage({ id, buffer, level, optimiseAlpha: false }, [buffer]); });
  return new Blob([result], { type: "image/png" });
}
async function decode(entry) {
  if (entry.software) {
    const buffer = await entry.file.arrayBuffer();
    const decoded = await new Promise((resolve, reject) => { const id = ++decoderId; decoderRequests.set(id, { resolve, reject }); ensureDecoderWorker().postMessage({ id, buffer, format: entry.format }, [buffer]); });
    return canvasFromRgba(decoded);
  }
  try { return await decodeBrowserImage(entry.file); } catch { throw new Error(copy.undecodable(entry.file.name)); }
}

function detectBounds(source) {
  const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
  const scan = document.createElement("canvas"); scan.width = Math.max(1, Math.round(source.width * scale)); scan.height = Math.max(1, Math.round(source.height * scale));
  const context = scan.getContext("2d", { willReadFrequently: true }); context.drawImage(source, 0, 0, scan.width, scan.height);
  const found = contentBounds(context.getImageData(0, 0, scan.width, scan.height).data, scan.width, scan.height, { background: elements.trimBackground.value, tolerance: elements.tolerance.value });
  if (!found) return null;
  const left = Math.max(0, Math.floor(found.x / scale) - 2), top = Math.max(0, Math.floor(found.y / scale) - 2);
  const right = Math.min(source.width, Math.ceil((found.x + found.width) / scale) + 2), bottom = Math.min(source.height, Math.ceil((found.y + found.height) / scale) + 2);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
function encode(canvas, format) {
  const definition = OUTPUT_FORMATS[format];
  return encodeBrowserCanvas(canvas, definition.mime, outputQuality(format, elements.quality.value)).catch(() => { throw new Error(copy.encodeFailed); });
}
async function processEntry(entry, name, target) {
  const source = await decode(entry), bounds = detectBounds(source);
  if (!bounds) throw new Error(copy.empty);
  const placement = isAssetNormalizer ? assetNormalizerPlacement(bounds, target.width, target.height, elements.occupancy.value, elements.padding.value, elements.paddingUnit.value) : workflowPlacement(bounds, target.width, target.height, elements.padding.value, elements.paddingUnit.value);
  const output = document.createElement("canvas"); output.width = target.width; output.height = target.height;
  const context = output.getContext("2d");
  const background = elements.format.value === "jpeg" && elements.background.value === "transparent" ? "white" : elements.background.value;
  if (background !== "transparent") { context.fillStyle = background === "custom" ? elements.backgroundColor.value : background; context.fillRect(0, 0, output.width, output.height); }
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
  context.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height, placement.x, placement.y, placement.width, placement.height);
  const encoded = await encode(output, elements.format.value);
  const blob = elements.format.value === "png" ? await optimizePng(encoded) : encoded;
  Object.assign(entry, { resultBlob: blob, resultUrl: URL.createObjectURL(blob), resultName: name, width: output.width, height: output.height });
}

function setBusy(value) {
  for (const control of document.querySelectorAll(".workflow-card button, .workflow-card input, .workflow-card select")) control.disabled = value;
  elements.cancel.hidden = !value; elements.cancel.disabled = false;
}
async function run() {
  if (!entries.length || running) return;
  const target = validCanvasSize(elements.width.value, elements.height.value);
  if (!target) { showToast(copy.invalidSize); elements.width.focus(); return; }
  if (validPadding(elements.padding.value, elements.paddingUnit.value) === null) { showToast(copy.invalidPadding); elements.padding.focus(); return; }
  if (elements.occupancy && validOccupancy(elements.occupancy.value) === null) { showToast(copy.invalidOccupancy); elements.occupancy.focus(); return; }
  running = true; cancelRequested = false; resetResults(); setBusy(true);
  const planned = names(); let success = 0;
  for (let index = 0; index < entries.length && !cancelRequested; index += 1) {
    const entry = entries[index]; entry.status = "processing"; elements.progress.textContent = copy.progress(index + 1, entries.length, entry.file.name); render();
    try { await processEntry(entry, planned[index], target); entry.status = "done"; success += 1; }
    catch (error) { if (cancelRequested || error?.name === "AbortError") entry.status = "ready"; else { console.error(error); entry.status = "error"; entry.error = error instanceof Error ? error.message : copy.status.error; } }
    render();
  }
  running = false; setBusy(false); if (cancelRequested) showToast(copy.cancelled); showResults(success);
}
function showResults(success) {
  const done = entries.filter(entry => entry.status === "done"), failed = entries.filter(entry => entry.status === "error").length;
  elements.progress.textContent = ""; if (!done.length) return;
  const before = done.reduce((sum, entry) => sum + entry.file.size, 0), after = done.reduce((sum, entry) => sum + entry.resultBlob.size, 0), rate = savedPercent(before, after);
  elements.before.textContent = formatBytes(before, locale); elements.after.textContent = formatBytes(after, locale); elements.saved.textContent = formatBytes(Math.max(0, before - after), locale); elements.savedRate.textContent = rate >= 0 ? copy.saved(rate) : copy.larger(Math.abs(rate));
  elements.resultMark.textContent = failed ? copy.resultMarks.partial : copy.resultMarks.complete; elements.resultStatus.textContent = isAssetNormalizer ? (failed ? copy.normalizePartial(success, failed, entries.length) : copy.normalized(success, entries.length)) : (failed ? copy.partial(success, failed, entries.length) : copy.completed(success, entries.length)); elements.results.hidden = false;
  document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: done.map(entry => ({ name: entry.resultName, blob: entry.resultBlob })), source: isAssetNormalizer ? "asset-normalizer-result" : "material-normalizer-workflow-result" } }));
}
function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function downloadAll() { const done = entries.filter(entry => entry.status === "done"); if (!done.length) return; const files = await Promise.all(done.map(async entry => ({ name: entry.resultName, data: new Uint8Array(await entry.resultBlob.arrayBuffer()) }))); downloadBlob(createZipBlob(files), `${elements.baseName.value.trim() || "assets"}.zip`); showToast(copy.downloaded); }
function clearAll() { if (running) return; entries.forEach(dispose); entries = []; resetResults(); render(); }
function settingsChanged() { if (!running && entries.some(entry => entry.status !== "ready")) resetResults(); render(); }

elements.select.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); }); elements.add.addEventListener("click", () => elements.input.click()); elements.input.addEventListener("change", () => addFiles(elements.input.files));
elements.drop.addEventListener("click", () => elements.input.click()); elements.drop.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.input.click(); } });
for (const name of ["dragenter", "dragover"]) elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.add("is-over"); });
for (const name of ["dragleave", "drop"]) elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.remove("is-over"); });
elements.drop.addEventListener("drop", event => addFiles(event.dataTransfer.files)); elements.add.closest(".queue-panel")?.addEventListener("dragover", event => event.preventDefault()); elements.add.closest(".queue-panel")?.addEventListener("drop", event => { event.preventDefault(); addFiles(event.dataTransfer.files); });
elements.presets.forEach(button => button.addEventListener("click", () => { const [width, height] = button.dataset.canvasSize.split("x"); elements.width.value = width; elements.height.value = height; settingsChanged(); }));
for (const control of [elements.trimBackground, elements.tolerance, elements.padding, elements.paddingUnit, elements.occupancy, elements.width, elements.height, elements.format, elements.quality, elements.background, elements.backgroundColor, elements.baseName, elements.start].filter(Boolean)) control.addEventListener("input", settingsChanged);
elements.clear.addEventListener("click", clearAll); elements.removeAll.addEventListener("click", clearAll); elements.run.addEventListener("click", run); elements.cancel.addEventListener("click", () => { cancelRequested = true; stopDecoderWorker(); stopOptimizerWorker(); }); elements.downloadAll.addEventListener("click", downloadAll);
elements.list.addEventListener("click", event => { const remove = event.target.closest("[data-remove]"); if (remove && !running) { const [entry] = entries.splice(Number(remove.dataset.remove), 1); dispose(entry); resetResults(); render(); } const download = event.target.closest("[data-download]"); if (download) { const entry = entries[Number(download.dataset.download)]; if (entry?.resultBlob) downloadBlob(entry.resultBlob, entry.resultName); } });
window.addEventListener("beforeunload", () => { stopDecoderWorker(); stopOptimizerWorker(); entries.forEach(dispose); });
render();
