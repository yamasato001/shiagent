import { createZip, formatBytes } from "./png-core.js";
import { detectImageFormat, formatLabel, OUTPUT_FORMATS, outputQuality, requiresSoftwareDecoder } from "./image-converter-core.js";
import { linkedDimension, resizeDimensions, resizedName, resolvedOutputFormat } from "./image-resizer-core.js";
import { lang, locale, pick } from "./i18n.js";
import resizerText from "./i18n/image-resizer.js";

const copy = pick(resizerText);
const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), drop: $("#dropZone"), select: $("#selectButton"), add: $("#addButton"), clear: $("#clearButton"),
  removeAll: $("#removeAllButton"), queue: $("#queuePanel"), list: $("#fileList"), count: $("#fileCount"),
  resize: $("#resizeButton"), cancel: $("#cancelButton"), progress: $("#progressText"), results: $("#resultsPanel"),
  resultStatus: $("#resultStatus"), before: $("#beforeTotal"), after: $("#afterTotal"), resultCount: $("#resizedCount"),
  downloadAll: $("#downloadAllButton"), toast: $("#toast"), modeGrid: $("#resizeModeGrid"), pixelFields: $("#pixelFields"),
  width: $("#widthInput"), height: $("#heightInput"), keepAspect: $("#keepAspectInput"), percentField: $("#percentField"),
  percent: $("#percentInput"), outputFormat: $("#outputFormat"), quality: $("#quality")
};

let entries = [];
let running = false;
let cancelRequested = false;
let decoderWorker;
let decoderRequestId = 0;
let toastTimer;
let lastDimensionChanged = "width";
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
  return document.querySelector('input[name="resizeMode"]:checked')?.value || "pixels";
}

function resizeOptions() {
  return {
    mode: selectedMode(), width: elements.width.value, height: elements.height.value,
    keepAspect: elements.keepAspect.checked, percent: elements.percent.value
  };
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

async function decodeToCanvas(entry) {
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
    return canvas;
  }
  const bitmap = await createImageBitmap(entry.file, { imageOrientation: "from-image" });
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

async function ensureReferenceDimensions() {
  const entry = entries[0];
  if (!entry || entry.sourceWidth && entry.sourceHeight) return entry || null;
  if (requiresSoftwareDecoder(entry.format)) {
    const canvas = await decodeToCanvas(entry);
    entry.sourceWidth = canvas.width;
    entry.sourceHeight = canvas.height;
  } else {
    const bitmap = await createImageBitmap(entry.file, { imageOrientation: "from-image" });
    entry.sourceWidth = bitmap.width;
    entry.sourceHeight = bitmap.height;
    bitmap.close();
  }
  return entry;
}

function syncAspect(changed = lastDimensionChanged) {
  if (selectedMode() !== "pixels" || !elements.keepAspect.checked) return;
  const entry = entries[0];
  if (!entry?.sourceWidth || !entry.sourceHeight) return;
  const source = changed === "height" ? elements.height : elements.width;
  const target = changed === "height" ? elements.width : elements.height;
  const next = linkedDimension(entry.sourceWidth, entry.sourceHeight, changed, source.value);
  if (next) target.value = String(next);
}

function encodeCanvas(canvas, format) {
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
  for (const entry of entries) {
    if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
    Object.assign(entry, { resultUrl: null, resultBlob: null, status: "ready", error: null, width: null, height: null, outputFormat: null });
  }
}

async function addFiles(fileList) {
  if (running) return;
  let rejected = false;
  let duplicate = false;
  for (const file of fileList) {
    const format = detectImageFormat(await file.slice(0, 64).arrayBuffer());
    if (!format) { rejected = true; continue; }
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (entries.some(entry => entry.key === key)) { duplicate = true; continue; }
    entries.push({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, key, file, format,
      previewUrl: requiresSoftwareDecoder(format) ? null : URL.createObjectURL(file), resultUrl: null, resultBlob: null,
      status: "ready", error: null, sourceWidth: null, sourceHeight: null, width: null, height: null, outputFormat: null
    });
  }
  if (rejected) showToast(copy.unsupported);
  else if (duplicate) showToast(copy.duplicate);
  elements.input.value = "";
  await ensureReferenceDimensions().catch(() => null);
  syncAspect();
  resetResults();
  render();
}

async function removeEntry(id) {
  if (running) return;
  const index = entries.findIndex(entry => entry.id === id);
  if (index < 0) return;
  disposeEntry(entries[index]);
  entries.splice(index, 1);
  await ensureReferenceDimensions().catch(() => null);
  syncAspect();
  render();
}

function clearEntries() {
  if (running) return;
  entries.forEach(disposeEntry);
  entries = [];
  elements.results.hidden = true;
  render();
}

function preview(entry) {
  return entry.previewUrl
    ? `<img class="file-thumb" src="${entry.previewUrl}" alt="">`
    : `<span class="converter-format-placeholder">${escapeHtml(formatLabel(entry.format))}</span>`;
}

function render() {
  const mode = selectedMode();
  elements.pixelFields.hidden = mode !== "pixels";
  elements.percentField.hidden = mode !== "percent";
  elements.queue.hidden = entries.length === 0;
  elements.count.textContent = copy.files(entries.length);
  elements.resize.disabled = entries.length === 0 || running;
  for (const element of [elements.select, elements.add, elements.clear, elements.removeAll, elements.width, elements.height, elements.keepAspect, elements.percent, elements.outputFormat, elements.quality]) element.disabled = running;
  elements.modeGrid.disabled = running;
  elements.cancel.hidden = !running;
  elements.resize.hidden = running;
  elements.list.innerHTML = entries.map(entry => {
    const output = entry.resultUrl ? `<figure><figcaption>${copy.after}</figcaption><img class="file-thumb" src="${entry.resultUrl}" alt=""></figure>` : "";
    const error = entry.error ? `<small class="converter-error">${escapeHtml(entry.error)}</small>` : "";
    const dimensions = entry.status === "done" ? `${entry.sourceWidth} × ${entry.sourceHeight} → ${entry.width} × ${entry.height}` : "";
    const result = entry.status === "done" ? `<div class="file-result"><span>${formatBytes(entry.file.size, locale)} → ${formatBytes(entry.resultBlob.size, locale)}</span><strong>${dimensions}</strong><button class="button button-light file-download" type="button" data-download="${entry.id}">${copy.download}</button></div>` : "";
    return `<article class="file-row converter-file-row ${entry.status === "done" ? "has-result" : ""}" data-id="${entry.id}">
      <div class="file-compare"><figure><figcaption>${copy.before}</figcaption>${preview(entry)}</figure>${output}</div>
      <div class="file-main"><span class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span><span class="file-meta">${escapeHtml(formatLabel(entry.format))} · ${formatBytes(entry.file.size, locale)}</span>${error}${entry.status === "processing" ? '<div class="progress-track"><span class="progress-bar" style="width:55%"></span></div>' : ""}</div>
      <span class="file-status ${entry.status}">${copy.status[entry.status] || copy.status.ready}</span>
      ${result || `<button class="icon-button" type="button" data-remove="${entry.id}" aria-label="${copy.remove}">×</button>`}
    </article>`;
  }).join("");
}

async function resizeEntry(entry, options) {
  entry.status = "processing";
  render();
  await new Promise(resolve => requestAnimationFrame(resolve));
  const source = await decodeToCanvas(entry);
  const size = resizeDimensions(source.width, source.height, options);
  if (size.width > 32767 || size.height > 32767 || size.width * size.height > 100_000_000) throw new Error(copy.tooLarge);
  const outputFormat = resolvedOutputFormat(entry.format, elements.outputFormat.value);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { alpha: outputFormat !== "jpeg" });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (outputFormat === "jpeg") {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, size.width, size.height);
  }
  context.drawImage(source, 0, 0, size.width, size.height);
  entry.sourceWidth = source.width;
  entry.sourceHeight = source.height;
  entry.width = size.width;
  entry.height = size.height;
  entry.outputFormat = outputFormat;
  entry.resultBlob = await encodeCanvas(canvas, outputFormat);
  entry.resultUrl = URL.createObjectURL(entry.resultBlob);
  entry.status = "done";
}

function validateOptions(options) {
  try {
    resizeDimensions(100, 100, options);
    return true;
  } catch {
    showToast(copy.invalidSize);
    return false;
  }
}

async function runResize() {
  if (!entries.length || running) return;
  const options = resizeOptions();
  if (!validateOptions(options)) return;
  resetResults();
  running = true;
  cancelRequested = false;
  elements.cancel.disabled = false;
  render();
  let completed = 0;
  for (const entry of entries) {
    if (cancelRequested) break;
    try {
      await resizeEntry(entry, options);
      completed += 1;
      elements.progress.textContent = copy.progress(completed, entries.length);
    } catch (error) {
      if (cancelRequested || error?.name === "AbortError") entry.status = "ready";
      else { entry.status = "error"; entry.error = error instanceof Error ? error.message : String(error); }
    }
    render();
  }
  running = false;
  for (const entry of entries.filter(item => item.status === "processing")) entry.status = "ready";
  const done = entries.filter(entry => entry.status === "done");
  render();
  if (cancelRequested) showToast(copy.cancelled);
  if (!done.length) return;
  elements.resultStatus.textContent = copy.completed(done.length, entries.length);
  elements.before.textContent = formatBytes(done.reduce((sum, entry) => sum + entry.file.size, 0), locale);
  elements.after.textContent = formatBytes(done.reduce((sum, entry) => sum + entry.resultBlob.size, 0), locale);
  elements.resultCount.textContent = copy.files(done.length);
  elements.results.hidden = false;
  elements.results.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: outputFiles(done), source: "image-resizer-result" } }));
}

function outputFiles(done) {
  const names = new Map();
  return done.map(entry => {
    let name = resizedName(entry.file.name, entry.outputFormat);
    const seen = names.get(name) || 0;
    names.set(name, seen + 1);
    if (seen) name = resizedName(entry.file.name, entry.outputFormat, `-${seen + 1}`);
    return new File([entry.resultBlob], name, { type: entry.resultBlob.type });
  });
}

function downloadBlob(blob, name) {
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
  const done = entries.filter(entry => entry.status === "done");
  if (!done.length) return;
  const zipEntries = [];
  for (const file of outputFiles(done)) zipEntries.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
  downloadBlob(createZip(zipEntries), "shiagent-resized-images.zip");
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
elements.resize.addEventListener("click", runResize);
elements.cancel.addEventListener("click", () => { cancelRequested = true; elements.cancel.disabled = true; stopDecoderWorker(); });
elements.downloadAll.addEventListener("click", downloadAll);
elements.width.addEventListener("input", () => { lastDimensionChanged = "width"; syncAspect("width"); resetResults(); render(); });
elements.height.addEventListener("input", () => { lastDimensionChanged = "height"; syncAspect("height"); resetResults(); render(); });
elements.keepAspect.addEventListener("change", () => { syncAspect(); resetResults(); render(); });
elements.modeGrid.addEventListener("change", () => { syncAspect(); resetResults(); render(); });
for (const element of [elements.percent, elements.outputFormat, elements.quality]) element.addEventListener("change", () => { resetResults(); render(); });
elements.list.addEventListener("click", event => {
  const remove = event.target.closest("[data-remove]");
  if (remove) removeEntry(remove.dataset.remove).catch(error => showToast(error.message));
  const download = event.target.closest("[data-download]");
  if (download) {
    const entry = entries.find(item => item.id === download.dataset.download);
    if (entry?.resultBlob) downloadBlob(entry.resultBlob, resizedName(entry.file.name, entry.outputFormat));
  }
});
window.addEventListener("beforeunload", () => { stopDecoderWorker(); entries.forEach(disposeEntry); });
render();
