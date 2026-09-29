import { contentBounds } from "./image-cropper-core.js";
import { createZip, formatBytes, savedPercent } from "./png-core.js";
import { detectImageFormat, OUTPUT_FORMATS, outputQuality, requiresSoftwareDecoder } from "./image-converter-core.js";
import {
  MAX_LONG_SIDE, MAX_OUTPUT_PIXELS, MAX_START_NUMBER, MIN_LONG_SIDE, downscaleSteps, fitLongSide,
  optimizedName, presetSettings, renamedOutputNames, resolvedOutputFormat, validLongSide, validStartNumber
} from "./phone-photo-workflow-core.js";
import { lang, locale, pick } from "./i18n.js";
import common from "./i18n/common.js";
import workflowText from "./i18n/phone-photo-workflow.js";

const shared = pick(common), copy = pick(workflowText);
const $ = selector => document.querySelector(selector);
const elements = {
  dropZone: $("#dropZone"), fileInput: $("#fileInput"), selectButton: $("#selectButton"), clearButton: $("#clearButton"),
  presetInputs: document.querySelectorAll('input[name="webPreset"]'), crop: $("#cropInput"), resize: $("#resizeInput"),
  longSide: $("#longSideInput"), format: $("#formatInput"), quality: $("#qualityInput"), settingSummary: $("#settingSummary"),
  rename: $("#renameInput"), baseName: $("#baseNameInput"), startNumber: $("#startNumberInput"), namePreview: $("#namePreview"),
  queuePanel: $("#queuePanel"), fileCount: $("#fileCount"), fileList: $("#fileList"), addButton: $("#addButton"), removeAllButton: $("#removeAllButton"),
  runButton: $("#runButton"), cancelButton: $("#cancelButton"), progressText: $("#progressText"),
  resultsPanel: $("#resultsPanel"), resultStatus: $("#resultStatus"), before: $("#beforeTotal"), after: $("#afterTotal"),
  saved: $("#savedTotal"), savedRate: $("#savedRate"), resultMark: $("#resultMark"), downloadAllButton: $("#downloadAllButton"), toast: $("#toast")
};

let entries = [], running = false, cancelRequested = false, decoderWorker = null, decoderId = 0, optimizerWorker = null, optimizerId = 0;
const decoderRequests = new Map(), optimizerRequests = new Map();

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add("show"); window.setTimeout(() => elements.toast.classList.remove("show"), 2600); }
function disposeResult(entry) { if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl); Object.assign(entry, { resultUrl: null, resultBlob: null, resultName: null, width: null, height: null, scaled: false, error: null, status: "ready" }); }
function dispose(entry) { disposeResult(entry); if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl); }
function resetResults() { entries.forEach(disposeResult); elements.resultsPanel.hidden = true; elements.progressText.textContent = ""; }

function currentFormat(entry) { return resolvedOutputFormat(entry.format, elements.format.value); }
function plannedNames() {
  if (elements.rename.checked) return renamedOutputNames(entries.map(currentFormat), elements.baseName.value, elements.startNumber.value);
  const used = new Map();
  return entries.map(entry => {
    const name = optimizedName(entry.file.name, currentFormat(entry));
    const count = (used.get(name.toLocaleLowerCase("en-US")) || 0) + 1;
    used.set(name.toLocaleLowerCase("en-US"), count);
    return count === 1 ? name : name.replace(/(\.[^.]+)$/, `-${count}$1`);
  });
}
function updateControls() {
  elements.longSide.disabled = !elements.resize.checked || running;
  elements.baseName.disabled = !elements.rename.checked || running;
  elements.startNumber.disabled = !elements.rename.checked || running;
  const size = elements.resize.checked ? `${elements.longSide.value}px` : copy.originalSize;
  const format = elements.format.options[elements.format.selectedIndex]?.text || elements.format.value;
  const quality = elements.quality.options[elements.quality.selectedIndex]?.text || elements.quality.value;
  elements.settingSummary.textContent = copy.settingSummary(size, format, quality);
  const names = plannedNames();
  elements.namePreview.textContent = elements.rename.checked
    ? copy.namePreview(names[0] || renamedOutputNames(["webp"], elements.baseName.value, elements.startNumber.value)[0], names.at(-1) || names[0])
    : copy.renameOff;
}

function thumb(entry) {
  const url = entry.resultUrl || entry.previewUrl;
  return url ? `<img class="file-thumb" src="${url}" alt="">` : `<span class="svg-file-mark">${escapeHtml((entry.format || "IMG").toUpperCase())}</span>`;
}
function render() {
  const names = plannedNames();
  elements.queuePanel.hidden = entries.length === 0;
  elements.fileCount.textContent = shared.fileCount(entries.length);
  elements.fileList.innerHTML = entries.map((entry, index) => {
    const statusText = copy.status[entry.status] || copy.status.ready;
    const result = entry.status === "done"
      ? `<div class="file-result"><span>${formatBytes(entry.file.size, locale)} → ${formatBytes(entry.resultBlob.size, locale)}</span><strong>${entry.width} × ${entry.height}</strong><button class="button button-light file-download" type="button" data-download="${index}">${copy.download}</button></div>`
      : `<button class="icon-button" type="button" data-remove="${index}" aria-label="${escapeHtml(shared.removeFile(entry.file.name))}">×</button>`;
    const note = entry.error ? `<small class="converter-error">${escapeHtml(entry.error)}</small>` : entry.status === "done" && !entry.scaled ? `<small class="file-meta">${copy.notResized}</small>` : "";
    return `<article class="file-row workflow-file-row ${entry.status === "done" ? "is-done" : ""}">${thumb(entry)}<div class="file-main"><span class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span><span class="file-meta workflow-rename">→ ${escapeHtml(entry.resultName || names[index])}</span>${note}${entry.status === "processing" ? '<div class="progress-track"><span class="progress-bar" style="width:55%"></span></div>' : ""}</div><span class="file-status ${entry.status}">${statusText}</span>${result}</article>`;
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
  elements.fileInput.value = ""; resetResults(); render();
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
    optimizerWorker = new Worker("/assets/dist/png-optimizer-worker.js", { type: "module", name: `${lang}-web-image-optimizer` });
    optimizerWorker.addEventListener("message", event => { const request = optimizerRequests.get(event.data.id); if (!request) return; optimizerRequests.delete(event.data.id); event.data.error ? request.reject(new Error(event.data.error)) : request.resolve(event.data.result); });
    optimizerWorker.addEventListener("error", event => stopOptimizerWorker(new Error(event.message || copy.encodeFailed)));
  }
  return optimizerWorker;
}
function stopOptimizerWorker(error = Object.assign(new Error(copy.cancelled), { name: "AbortError" })) { optimizerWorker?.terminate(); optimizerWorker = null; for (const request of optimizerRequests.values()) request.reject(error); optimizerRequests.clear(); }

async function decode(entry) {
  const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
  if (entry.software) {
    const buffer = await entry.file.arrayBuffer();
    const decoded = await new Promise((resolve, reject) => { const id = ++decoderId; decoderRequests.set(id, { resolve, reject }); ensureDecoderWorker().postMessage({ id, buffer, format: entry.format }, [buffer]); });
    canvas.width = decoded.width; canvas.height = decoded.height; context.putImageData(new ImageData(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height), 0, 0); return canvas;
  }
  let bitmap;
  try { bitmap = await createImageBitmap(entry.file, { imageOrientation: "from-image" }); } catch { throw new Error(copy.undecodable(entry.file.name)); }
  canvas.width = bitmap.width; canvas.height = bitmap.height; context.drawImage(bitmap, 0, 0); bitmap.close(); return canvas;
}

function cropSource(source) {
  if (elements.crop.value === "none") return source;
  const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
  const scan = document.createElement("canvas"); scan.width = Math.max(1, Math.round(source.width * scale)); scan.height = Math.max(1, Math.round(source.height * scale));
  const scanContext = scan.getContext("2d", { willReadFrequently: true }); scanContext.drawImage(source, 0, 0, scan.width, scan.height);
  const bounds = contentBounds(scanContext.getImageData(0, 0, scan.width, scan.height).data, scan.width, scan.height, { background: "auto", tolerance: 12 });
  if (!bounds || (bounds.x === 0 && bounds.y === 0 && bounds.width === scan.width && bounds.height === scan.height)) return source;
  const edge = 2, x = Math.max(0, Math.floor(bounds.x / scale) - edge), y = Math.max(0, Math.floor(bounds.y / scale) - edge);
  const right = Math.min(source.width, Math.ceil((bounds.x + bounds.width) / scale) + edge), bottom = Math.min(source.height, Math.ceil((bounds.y + bounds.height) / scale) + edge);
  const width = right - x, height = bottom - y;
  const cropped = document.createElement("canvas"); cropped.width = width; cropped.height = height; cropped.getContext("2d").drawImage(source, x, y, width, height, 0, 0, width, height); return cropped;
}
function resize(source, target, outputFormat) {
  let current = source;
  for (const step of downscaleSteps(source.width, source.height, target)) {
    if (step.width === current.width && step.height === current.height && current === source) continue;
    const canvas = document.createElement("canvas"); canvas.width = step.width; canvas.height = step.height;
    const context = canvas.getContext("2d"); context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
    if (outputFormat === "jpeg") { context.fillStyle = "#fff"; context.fillRect(0, 0, step.width, step.height); }
    context.drawImage(current, 0, 0, step.width, step.height); current = canvas;
  }
  if (current === source && outputFormat === "jpeg") {
    const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext("2d"); context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(source, 0, 0); return canvas;
  }
  return current;
}
function encode(canvas, format) {
  const definition = OUTPUT_FORMATS[format];
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(copy.encodeFailed)), definition.mime, outputQuality(format, elements.quality.value)));
}
async function optimizePng(blob) {
  const buffer = await blob.arrayBuffer(), level = elements.quality.value === "compact" ? 4 : elements.quality.value === "high" ? 2 : 3;
  const result = await new Promise((resolve, reject) => { const id = ++optimizerId; optimizerRequests.set(id, { resolve, reject }); ensureOptimizerWorker().postMessage({ id, buffer, level, optimiseAlpha: false }, [buffer]); });
  return new Blob([result], { type: "image/png" });
}
async function processEntry(entry, longSide, name) {
  const decoded = await decode(entry), source = cropSource(decoded), cropped = source !== decoded;
  const target = fitLongSide(source.width, source.height, longSide, elements.resize.checked);
  if (target.width * target.height > MAX_OUTPUT_PIXELS) throw new Error(copy.tooLarge);
  const format = currentFormat(entry), canvas = resize(source, target, format), encoded = await encode(canvas, format);
  const blob = format === "png" ? await optimizePng(encoded) : encoded;
  Object.assign(entry, { resultBlob: blob, resultUrl: URL.createObjectURL(blob), resultName: name, width: target.width, height: target.height, scaled: target.scaled || cropped });
}

function setBusy(value) {
  for (const control of document.querySelectorAll(".workflow-card button, .workflow-card input, .workflow-card select")) control.disabled = value;
  elements.cancelButton.hidden = !value; elements.cancelButton.disabled = false;
  if (!value) updateControls();
}
async function run() {
  if (!entries.length || running) return;
  const longSide = elements.resize.checked ? validLongSide(elements.longSide.value) : null;
  if (elements.resize.checked && !longSide) { showToast(copy.invalidSize(MIN_LONG_SIDE, MAX_LONG_SIDE)); elements.longSide.focus(); return; }
  if (elements.rename.checked && !validStartNumber(elements.startNumber.value)) { showToast(copy.invalidStart(1, MAX_START_NUMBER)); elements.startNumber.focus(); return; }
  running = true; cancelRequested = false; resetResults(); setBusy(true); let success = 0; const names = plannedNames();
  for (let index = 0; index < entries.length && !cancelRequested; index += 1) {
    const entry = entries[index]; entry.status = "processing"; elements.progressText.textContent = copy.progress(index + 1, entries.length, entry.file.name); render();
    try { await processEntry(entry, longSide, names[index]); entry.status = "done"; success += 1; }
    catch (error) { if (cancelRequested || error?.name === "AbortError") entry.status = "ready"; else { console.error(error); entry.status = "error"; entry.error = error instanceof Error ? error.message : copy.status.error; } }
    render();
  }
  running = false; setBusy(false); if (cancelRequested) showToast(copy.cancelled); showResults(success);
}
function showResults(success) {
  const done = entries.filter(entry => entry.status === "done"), failed = entries.filter(entry => entry.status === "error").length;
  elements.progressText.textContent = ""; if (!done.length) return;
  const before = done.reduce((sum, entry) => sum + entry.file.size, 0), after = done.reduce((sum, entry) => sum + entry.resultBlob.size, 0), rate = savedPercent(before, after);
  elements.before.textContent = formatBytes(before, locale); elements.after.textContent = formatBytes(after, locale); elements.saved.textContent = formatBytes(Math.max(0, before - after), locale); elements.savedRate.textContent = rate >= 0 ? copy.saved(rate) : copy.larger(Math.abs(rate));
  if (cancelRequested) { elements.resultMark.textContent = copy.resultMarks.cancelled; elements.resultStatus.textContent = copy.cancelledResult(done.length, entries.length); }
  else if (failed) { elements.resultMark.textContent = copy.resultMarks.partial; elements.resultStatus.textContent = copy.partial(success, failed, entries.length); }
  else { elements.resultMark.textContent = copy.resultMarks.complete; elements.resultStatus.textContent = copy.completed(success, entries.length); }
  elements.resultsPanel.hidden = false; elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: done.map(entry => ({ name: entry.resultName, blob: entry.resultBlob })), source: "web-image-optimizer-result" } }));
}
function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function downloadAll() { const done = entries.filter(entry => entry.status === "done"); if (!done.length) return; const files = await Promise.all(done.map(async entry => ({ name: entry.resultName, data: new Uint8Array(await entry.resultBlob.arrayBuffer()) }))); downloadBlob(createZip(files), "web-images.zip"); showToast(copy.downloaded); }
function clearAll() { if (running) return; entries.forEach(dispose); entries = []; resetResults(); render(); }
function resetAfterSettingChange() { if (!running && entries.some(entry => entry.status !== "ready")) resetResults(); render(); }
function settingsChanged() { elements.presetInputs.forEach(input => { input.checked = false; }); resetAfterSettingChange(); }
function renameChanged() { resetAfterSettingChange(); }
function applyPreset(name) {
  const preset = presetSettings(name); if (!preset) return;
  elements.crop.value = preset.crop; elements.resize.checked = preset.resize; if (preset.longSide) elements.longSide.value = preset.longSide;
  elements.format.value = preset.format; elements.quality.value = preset.quality;
  if (!running && entries.some(entry => entry.status !== "ready")) resetResults(); render();
}

elements.selectButton.addEventListener("click", event => { event.stopPropagation(); elements.fileInput.click(); }); elements.addButton.addEventListener("click", () => elements.fileInput.click()); elements.fileInput.addEventListener("change", () => addFiles(elements.fileInput.files));
elements.dropZone.addEventListener("click", () => elements.fileInput.click()); elements.dropZone.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.fileInput.click(); } });
for (const name of ["dragenter", "dragover"]) elements.dropZone.addEventListener(name, event => { event.preventDefault(); elements.dropZone.classList.add("is-over"); });
for (const name of ["dragleave", "drop"]) elements.dropZone.addEventListener(name, event => { event.preventDefault(); elements.dropZone.classList.remove("is-over"); });
elements.dropZone.addEventListener("drop", event => addFiles(event.dataTransfer.files)); elements.addButton.closest(".queue-panel")?.addEventListener("dragover", event => event.preventDefault()); elements.addButton.closest(".queue-panel")?.addEventListener("drop", event => { event.preventDefault(); addFiles(event.dataTransfer.files); });
elements.presetInputs.forEach(input => input.addEventListener("change", () => applyPreset(input.value)));
for (const control of [elements.crop, elements.resize, elements.longSide, elements.format, elements.quality]) control.addEventListener("input", settingsChanged);
for (const control of [elements.rename, elements.baseName, elements.startNumber]) control.addEventListener("input", renameChanged);
elements.clearButton.addEventListener("click", clearAll); elements.removeAllButton.addEventListener("click", clearAll); elements.runButton.addEventListener("click", run); elements.cancelButton.addEventListener("click", () => { cancelRequested = true; stopDecoderWorker(); stopOptimizerWorker(); }); elements.downloadAllButton.addEventListener("click", downloadAll);
elements.fileList.addEventListener("click", event => { const remove = event.target.closest("[data-remove]"); if (remove && !running) { const [entry] = entries.splice(Number(remove.dataset.remove), 1); dispose(entry); resetResults(); render(); } const download = event.target.closest("[data-download]"); if (download) { const entry = entries[Number(download.dataset.download)]; if (entry?.resultBlob) downloadBlob(entry.resultBlob, entry.resultName); } });
window.addEventListener("beforeunload", () => { stopDecoderWorker(); stopOptimizerWorker(); entries.forEach(dispose); });
applyPreset("blog");
