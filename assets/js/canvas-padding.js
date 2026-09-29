import { createZip, formatBytes } from "./png-core.js";
import { detectImageFormat, formatLabel, OUTPUT_FORMATS, outputQuality, requiresSoftwareDecoder } from "./image-converter-core.js";
import { fixedCanvasPlacement, paddedName, relativePaddingPlacement } from "./canvas-padding-core.js";
import { lang, locale, pick } from "./i18n.js";
import paddingText from "./i18n/canvas-padding.js";

const copy = pick(paddingText);
const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), drop: $("#dropZone"), select: $("#selectButton"), add: $("#addButton"), clear: $("#clearButton"),
  removeAll: $("#removeAllButton"), queue: $("#queuePanel"), list: $("#fileList"), count: $("#fileCount"),
  run: $("#paddingButton"), cancel: $("#cancelButton"), progress: $("#progressText"), results: $("#resultsPanel"),
  resultStatus: $("#resultStatus"), resultList: $("#resultList"), resultCount: $("#resultCount"), resultSize: $("#resultSize"),
  downloadAll: $("#downloadAllButton"), toast: $("#toast"), modeGrid: $("#paddingModeGrid"), relative: $("#relativeSettings"), fixed: $("#fixedSettings"),
  padding: $("#paddingInput"), unit: $("#paddingUnit"), canvasWidth: $("#canvasWidth"), canvasHeight: $("#canvasHeight"),
  inset: $("#insetInput"), allowUpscale: $("#allowUpscale"), background: $("#backgroundSelect"), customWrap: $("#customColorWrap"),
  customColor: $("#customColor"), format: $("#outputFormat"), quality: $("#quality")
};

const state = { entries: [], running: false, cancelRequested: false };
let decoderWorker;
let decoderRequestId = 0;
let toastTimer;
const decoderRequests = new Map();

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2800);
}

function escapeHtml(value) {
  return value.replace(/[&<>\"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function selectedMode() {
  return document.querySelector('input[name="paddingMode"]:checked')?.value || "relative";
}

function ensureDecoderWorker() {
  if (!decoderWorker) {
    decoderWorker = new Worker("/assets/dist/image-decoder-worker.js", { type: "module", name: lang });
    decoderWorker.addEventListener("message", event => {
      const request = decoderRequests.get(event.data.id);
      if (!request) return;
      decoderRequests.delete(event.data.id);
      if (event.data.error) request.reject(new Error(event.data.error));
      else request.resolve(event.data.result);
    });
    decoderWorker.addEventListener("error", event => stopDecoderWorker(new Error(event.message || copy.decoderError)));
  }
  return decoderWorker;
}

function stopDecoderWorker(error = Object.assign(new Error(copy.cancelled), { name: "AbortError" })) {
  decoderWorker?.terminate();
  decoderWorker = null;
  for (const request of decoderRequests.values()) request.reject(error);
  decoderRequests.clear();
}

async function decode(entry) {
  if (entry.canvas) return entry.canvas;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: true });
  if (requiresSoftwareDecoder(entry.format)) {
    const buffer = await entry.file.arrayBuffer();
    const decoded = await new Promise((resolve, reject) => {
      const id = ++decoderRequestId;
      decoderRequests.set(id, { resolve, reject });
      ensureDecoderWorker().postMessage({ id, buffer, format: entry.format }, [buffer]);
    });
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    context.putImageData(new ImageData(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height), 0, 0);
  } else {
    const bitmap = await createImageBitmap(entry.file, { imageOrientation: "from-image" });
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
  }
  entry.canvas = canvas;
  return canvas;
}

function outputFormat(entry) {
  if (elements.format.value !== "original") return elements.format.value;
  return ["png", "jpeg", "webp"].includes(entry.format) ? entry.format : "jpeg";
}

function encode(canvas, format) {
  const definition = OUTPUT_FORMATS[format];
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) return reject(new Error(copy.encodeFailed(definition.label)));
    if (blob.type !== definition.mime) return reject(new Error(copy.encodeUnsupported(definition.label)));
    resolve(blob);
  }, definition.mime, outputQuality(format, elements.quality.value)));
}

function disposeEntry(entry) {
  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
  if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
}

function resetResults() {
  elements.results.hidden = true;
  for (const entry of state.entries) {
    if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
    Object.assign(entry, { resultUrl: null, resultBlob: null, resultName: null, outputWidth: null, outputHeight: null, status: "ready", error: null });
  }
}

async function addFiles(fileList) {
  if (state.running) return;
  let rejected = false;
  let duplicate = false;
  for (const file of fileList) {
    const format = detectImageFormat(await file.slice(0, 64).arrayBuffer());
    if (!format) { rejected = true; continue; }
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (state.entries.some(entry => entry.key === key)) { duplicate = true; continue; }
    state.entries.push({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, key, file, format, canvas: null,
      previewUrl: requiresSoftwareDecoder(format) ? null : URL.createObjectURL(file), resultUrl: null, resultBlob: null,
      resultName: null, outputWidth: null, outputHeight: null, status: "ready", error: null
    });
  }
  if (rejected) showToast(copy.unsupported);
  else if (duplicate) showToast(copy.duplicate);
  elements.input.value = "";
  resetResults();
  render();
}

function removeEntry(id) {
  if (state.running) return;
  const index = state.entries.findIndex(entry => entry.id === id);
  if (index < 0) return;
  disposeEntry(state.entries[index]);
  state.entries.splice(index, 1);
  resetResults();
  render();
}

function clearEntries() {
  if (state.running) return;
  state.entries.forEach(disposeEntry);
  state.entries = [];
  elements.results.hidden = true;
  render();
}

function render() {
  const fixed = selectedMode() === "fixed";
  elements.relative.hidden = fixed;
  elements.fixed.hidden = !fixed;
  elements.customWrap.hidden = elements.background.value !== "custom";
  elements.queue.hidden = state.entries.length === 0;
  elements.count.textContent = copy.files(state.entries.length);
  elements.run.disabled = state.entries.length === 0 || state.running;
  const controls = [elements.select, elements.add, elements.clear, elements.removeAll, elements.padding, elements.unit, elements.canvasWidth, elements.canvasHeight, elements.inset, elements.allowUpscale, elements.background, elements.customColor, elements.format, elements.quality];
  controls.forEach(control => { control.disabled = state.running; });
  elements.modeGrid.disabled = state.running;
  elements.cancel.hidden = !state.running;
  elements.run.hidden = state.running;
  elements.list.innerHTML = state.entries.map(entry => {
    const preview = entry.previewUrl ? `<img class="file-thumb" src="${entry.previewUrl}" alt="">` : `<span class="converter-format-placeholder">${escapeHtml(formatLabel(entry.format))}</span>`;
    return `<article class="file-row converter-file-row ${entry.resultBlob ? "has-result" : ""}" data-id="${entry.id}">${preview}<div class="file-main"><span class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span><span class="file-meta">${escapeHtml(formatLabel(entry.format))} · ${formatBytes(entry.file.size, locale)}</span>${entry.error ? `<small class="converter-error">${escapeHtml(entry.error)}</small>` : ""}</div><span class="file-status ${entry.status}">${copy.status[entry.status] || copy.status.ready}</span><button class="icon-button" type="button" data-remove="${entry.id}" aria-label="${copy.remove}">×</button></article>`;
  }).join("");
}

function placement(source) {
  try {
    if (selectedMode() === "fixed") return fixedCanvasPlacement(source.width, source.height, elements.canvasWidth.value, elements.canvasHeight.value, { inset: elements.inset.value, allowUpscale: elements.allowUpscale.checked });
    return relativePaddingPlacement(source.width, source.height, { padding: elements.padding.value, unit: elements.unit.value });
  } catch {
    throw new Error(copy.invalidSize);
  }
}

function backgroundColor(format) {
  if (elements.background.value === "transparent" && format !== "jpeg") return null;
  if (elements.background.value === "black") return "#000000";
  if (elements.background.value === "custom") return elements.customColor.value;
  return "#ffffff";
}

async function processEntry(entry) {
  entry.status = "processing";
  render();
  await new Promise(resolve => requestAnimationFrame(resolve));
  const source = await decode(entry);
  const place = placement(source);
  if (place.canvasWidth > 32767 || place.canvasHeight > 32767 || place.canvasWidth * place.canvasHeight > 100_000_000) throw new Error(copy.tooLarge);
  const format = outputFormat(entry);
  const canvas = document.createElement("canvas");
  canvas.width = place.canvasWidth;
  canvas.height = place.canvasHeight;
  const context = canvas.getContext("2d", { alpha: true });
  const background = backgroundColor(format);
  if (background) { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, place.x, place.y, place.width, place.height);
  entry.resultBlob = await encode(canvas, format);
  entry.resultUrl = URL.createObjectURL(entry.resultBlob);
  entry.resultName = paddedName(entry.file.name, format);
  entry.outputWidth = canvas.width;
  entry.outputHeight = canvas.height;
  entry.status = "done";
}

function outputFiles(done) {
  const names = new Map();
  return done.map(entry => {
    let name = entry.resultName;
    const seen = names.get(name) || 0;
    names.set(name, seen + 1);
    if (seen) name = name.replace(/(\.[^.]*)$/, `-${seen + 1}$1`);
    return new File([entry.resultBlob], name, { type: entry.resultBlob.type });
  });
}

function renderResults() {
  const done = state.entries.filter(entry => entry.status === "done");
  if (!done.length) return;
  elements.resultStatus.textContent = copy.completed(done.length, state.entries.length);
  elements.resultCount.textContent = copy.files(done.length);
  elements.resultSize.textContent = formatBytes(done.reduce((sum, entry) => sum + entry.resultBlob.size, 0), locale);
  elements.resultList.innerHTML = done.map(entry => `<article class="crop-result-card"><img src="${entry.resultUrl}" alt=""><div><span>${escapeHtml(formatLabel(entry.format))}</span><strong>${escapeHtml(entry.resultName)}</strong><small>${entry.outputWidth} × ${entry.outputHeight} / ${formatBytes(entry.resultBlob.size, locale)}</small><button class="button button-light" type="button" data-download="${entry.id}">${copy.save}</button></div></article>`).join("");
  elements.results.hidden = false;
  elements.results.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: outputFiles(done), source: "canvas-padding-result" } }));
}

async function runPadding() {
  if (!state.entries.length || state.running) return;
  resetResults();
  state.running = true;
  state.cancelRequested = false;
  elements.cancel.disabled = false;
  render();
  let completed = 0;
  for (const entry of state.entries) {
    if (state.cancelRequested) break;
    try { await processEntry(entry); completed += 1; }
    catch (error) {
      if (error?.name === "AbortError") entry.status = "ready";
      else { entry.status = "error"; entry.error = error instanceof Error ? error.message : String(error); }
    }
    elements.progress.textContent = copy.progress(completed, state.entries.length);
    render();
  }
  state.running = false;
  for (const entry of state.entries) if (entry.status === "processing") entry.status = "ready";
  render();
  if (state.cancelRequested) showToast(copy.cancelled);
  renderResults();
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadAll() {
  const done = state.entries.filter(entry => entry.status === "done");
  const zipEntries = [];
  for (const file of outputFiles(done)) zipEntries.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
  if (zipEntries.length) download(createZip(zipEntries), "shiagent-padded-images.zip");
}

elements.select.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); });
elements.add.addEventListener("click", () => elements.input.click());
elements.input.addEventListener("change", () => addFiles(elements.input.files).catch(error => showToast(error.message)));
elements.drop.addEventListener("click", event => { if (!event.target.closest("button")) elements.input.click(); });
elements.drop.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.input.click(); } });
elements.drop.addEventListener("dragover", event => { event.preventDefault(); elements.drop.classList.add("is-over"); });
elements.drop.addEventListener("dragleave", () => elements.drop.classList.remove("is-over"));
elements.drop.addEventListener("drop", event => { event.preventDefault(); elements.drop.classList.remove("is-over"); addFiles(event.dataTransfer.files).catch(error => showToast(error.message)); });
elements.clear.addEventListener("click", clearEntries);
elements.removeAll.addEventListener("click", clearEntries);
elements.run.addEventListener("click", runPadding);
elements.cancel.addEventListener("click", () => { state.cancelRequested = true; elements.cancel.disabled = true; stopDecoderWorker(); });
elements.downloadAll.addEventListener("click", downloadAll);
elements.list.addEventListener("click", event => { const button = event.target.closest("[data-remove]"); if (button) removeEntry(button.dataset.remove); });
elements.resultList.addEventListener("click", event => { const button = event.target.closest("[data-download]"); const entry = state.entries.find(item => item.id === button?.dataset.download); if (entry?.resultBlob) download(entry.resultBlob, entry.resultName); });
elements.modeGrid.addEventListener("change", () => { resetResults(); render(); });
for (const control of [elements.padding, elements.unit, elements.canvasWidth, elements.canvasHeight, elements.inset, elements.allowUpscale, elements.background, elements.customColor, elements.format, elements.quality]) control.addEventListener("change", () => { resetResults(); render(); });
window.addEventListener("beforeunload", () => { stopDecoderWorker(); state.entries.forEach(disposeEntry); });
render();
