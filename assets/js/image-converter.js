import { formatBytes } from "./png-core.js";
import { canvasFromRgba, createZipBlob, decodeBrowserImage, encodeBrowserCanvas } from "./browser-runtime.js";
import { convertedName, detectImageFormat, formatLabel, OUTPUT_FORMATS, outputQuality, requiresSoftwareDecoder, sameFormatNotice } from "./image-converter-core.js";
import { lang, locale, localPath, pick } from "./i18n.js";
import converterText from "./i18n/image-converter.js";

const copy = pick(converterText);

const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), drop: $("#dropZone"), select: $("#selectButton"), add: $("#addButton"),
  clear: $("#clearButton"), removeAll: $("#removeAllButton"), queue: $("#queuePanel"), list: $("#fileList"),
  count: $("#fileCount"), convert: $("#convertButton"), cancel: $("#cancelButton"), progress: $("#progressText"),
  results: $("#resultsPanel"), resultStatus: $("#resultStatus"), before: $("#beforeTotal"), after: $("#afterTotal"),
  resultCount: $("#convertedCount"), downloadAll: $("#downloadAllButton"), toast: $("#toast"),
  outputGrid: $("#outputGrid"), quality: $("#quality"), qualityWrap: $("#qualityWrap")
};

let entries = [];
let running = false;
let cancelRequested = false;
let decoderWorker;
let decoderRequestId = 0;
const decoderRequests = new Map();
let toastTimer;

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2800);
}

function escapeHtml(value) {
  return value.replace(/[&<>\"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function selectedOutput() {
  return document.querySelector('input[name="outputFormat"]:checked')?.value || "jpeg";
}

// Shown when some files already have the chosen output format: that is a
// re-encode, not a conversion, and the compressor is the better tool for size.
const sameFormatNote = document.createElement("p");
sameFormatNote.className = "setting-note converter-same-format";
sameFormatNote.setAttribute("role", "status");
sameFormatNote.hidden = true;
elements.qualityWrap.after(sameFormatNote);

function renderSameFormatNote() {
  const output = selectedOutput();
  const notice = sameFormatNotice(entries.map(entry => entry.format), output);
  sameFormatNote.hidden = !notice;
  if (!notice) return;
  const link = document.createElement("a");
  link.href = localPath("/image-compressor/");
  link.textContent = copy.sameFormat.link;
  const text = (notice.lossless ? copy.sameFormat.lossless : copy.sameFormat.lossy)(OUTPUT_FORMATS[output].label, notice.count);
  sameFormatNote.replaceChildren(text, link, copy.sameFormat.after);
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

async function decodeInWorker(file, format) {
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const id = ++decoderRequestId;
    decoderRequests.set(id, { resolve, reject });
    ensureDecoderWorker().postMessage({ id, buffer, format }, [buffer]);
  });
}

async function decodeToCanvas(entry) {
  if (requiresSoftwareDecoder(entry.format)) {
    const decoded = await decodeInWorker(entry.file, entry.format);
    return canvasFromRgba(decoded);
  }
  return decodeBrowserImage(entry.file);
}

function encodeCanvas(source, format, qualityPreset) {
  const definition = OUTPUT_FORMATS[format];
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { alpha: format !== "jpeg" });
  if (format === "jpeg") {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(source, 0, 0);
  return encodeBrowserCanvas(canvas, definition.mime, outputQuality(format, qualityPreset)).then(blob => {
    if (blob.type !== definition.mime) throw new Error(copy.encodeUnsupported(definition.label));
    return blob;
  });
}

function disposeEntry(entry) {
  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
  if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
}

function resetResults() {
  elements.results.hidden = true;
  for (const entry of entries) {
    if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
    Object.assign(entry, { resultUrl: null, resultBlob: null, status: "ready", error: null, width: null, height: null });
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
    const previewUrl = requiresSoftwareDecoder(format) ? null : URL.createObjectURL(file);
    entries.push({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      key, file, format, previewUrl, resultUrl: null, resultBlob: null,
      status: "ready", error: null, width: null, height: null
    });
  }
  if (rejected) showToast(copy.unsupported);
  else if (duplicate) showToast(copy.duplicate);
  elements.input.value = "";
  resetResults();
  render();
}

function removeEntry(id) {
  if (running) return;
  const index = entries.findIndex(entry => entry.id === id);
  if (index < 0) return;
  disposeEntry(entries[index]);
  entries.splice(index, 1);
  render();
}

function clearEntries() {
  if (running) return;
  entries.forEach(disposeEntry);
  entries = [];
  elements.results.hidden = true;
  render();
}

function beforePreview(entry) {
  if (entry.previewUrl) return `<img class="file-thumb" src="${entry.previewUrl}" alt="">`;
  return `<span class="converter-format-placeholder">${escapeHtml(formatLabel(entry.format))}</span>`;
}

function render() {
  elements.queue.hidden = entries.length === 0;
  elements.count.textContent = copy.files(entries.length);
  elements.convert.disabled = entries.length === 0 || running;
  elements.select.disabled = running;
  elements.add.disabled = running;
  elements.clear.disabled = running;
  elements.removeAll.disabled = running;
  elements.outputGrid.disabled = running;
  elements.quality.disabled = running;
  elements.cancel.hidden = !running;
  elements.convert.hidden = running;
  elements.qualityWrap.hidden = selectedOutput() === "png";
  renderSameFormatNote();

  elements.list.innerHTML = entries.map(entry => {
    const statusText = copy.status[entry.status] || copy.status.ready;
    const error = entry.error ? `<small class="converter-error">${escapeHtml(entry.error)}</small>` : "";
    const output = entry.resultUrl ? `<figure><figcaption>${copy.after}</figcaption><img class="file-thumb" src="${entry.resultUrl}" alt=""></figure>` : "";
    const result = entry.status === "done" ? `<div class="file-result"><span>${formatBytes(entry.file.size, locale)} → ${formatBytes(entry.resultBlob.size, locale)}</span><strong>${entry.width} × ${entry.height}</strong><button class="button button-light file-download" type="button" data-download="${entry.id}">${copy.download}</button></div>` : "";
    return `<article class="file-row converter-file-row ${entry.status === "done" ? "has-result" : ""}" data-id="${entry.id}">
      <div class="file-compare"><figure><figcaption>${copy.before}</figcaption>${beforePreview(entry)}</figure>${output}</div>
      <div class="file-main"><span class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span><span class="file-meta">${escapeHtml(formatLabel(entry.format))} · ${formatBytes(entry.file.size, locale)}</span>${error}${entry.status === "processing" ? '<div class="progress-track"><span class="progress-bar" style="width:55%"></span></div>' : ""}</div>
      <span class="file-status ${entry.status}">${statusText}</span>
      ${result || `<button class="icon-button" type="button" data-remove="${entry.id}" aria-label="${copy.remove}">×</button>`}
    </article>`;
  }).join("");
}

async function convertEntry(entry, format, qualityPreset) {
  entry.status = "processing";
  render();
  await new Promise(resolve => requestAnimationFrame(resolve));
  const canvas = await decodeToCanvas(entry);
  const blob = await encodeCanvas(canvas, format, qualityPreset);
  entry.width = canvas.width;
  entry.height = canvas.height;
  entry.resultBlob = blob;
  entry.resultUrl = URL.createObjectURL(blob);
  entry.status = "done";
}

async function runConversion() {
  if (!entries.length || running) return;
  resetResults();
  running = true;
  cancelRequested = false;
  elements.cancel.disabled = false;
  const outputFormat = selectedOutput();
  const qualityPreset = elements.quality.value;
  render();
  let completed = 0;
  for (const entry of entries) {
    if (cancelRequested) break;
    try {
      await convertEntry(entry, outputFormat, qualityPreset);
      completed += 1;
      elements.progress.textContent = copy.progress(completed, entries.length);
    } catch (error) {
      if (cancelRequested || error?.name === "AbortError") entry.status = "ready";
      else {
        entry.status = "error";
        entry.error = error instanceof Error ? error.message : String(error);
      }
    }
    render();
  }
  running = false;
  for (const entry of entries.filter(item => item.status === "processing")) entry.status = "ready";
  const done = entries.filter(entry => entry.status === "done");
  render();
  if (cancelRequested) showToast(copy.cancelled);
  if (done.length) {
    const before = done.reduce((sum, entry) => sum + entry.file.size, 0);
    const after = done.reduce((sum, entry) => sum + entry.resultBlob.size, 0);
    elements.resultStatus.textContent = copy.completed(done.length, entries.length);
    elements.before.textContent = formatBytes(before, locale);
    elements.after.textContent = formatBytes(after, locale);
    elements.resultCount.textContent = copy.files(done.length);
    elements.results.hidden = false;
    elements.results.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const usedNames = new Map();
    const files = done.map(entry => {
      let name = convertedName(entry.file.name, outputFormat);
      const seen = usedNames.get(name) || 0;
      usedNames.set(name, seen + 1);
      if (seen) name = convertedName(entry.file.name, outputFormat, `-${seen + 1}`);
      return new File([entry.resultBlob], name, { type: entry.resultBlob.type });
    });
    document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files, source: "image-converter-result" } }));
  }
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
  const outputFormat = selectedOutput();
  const usedNames = new Map();
  const zipEntries = [];
  for (const entry of done) {
    let name = convertedName(entry.file.name, outputFormat);
    const seen = usedNames.get(name) || 0;
    usedNames.set(name, seen + 1);
    if (seen) name = convertedName(entry.file.name, outputFormat, `-${seen + 1}`);
    zipEntries.push({ name, data: new Uint8Array(await entry.resultBlob.arrayBuffer()) });
  }
  downloadBlob(createZipBlob(zipEntries), `shiagent-${OUTPUT_FORMATS[outputFormat].extension}-images.zip`);
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
elements.convert.addEventListener("click", runConversion);
elements.cancel.addEventListener("click", () => { cancelRequested = true; elements.cancel.disabled = true; stopDecoderWorker(); });
elements.downloadAll.addEventListener("click", downloadAll);
elements.outputGrid.addEventListener("change", () => { resetResults(); render(); });
elements.quality.addEventListener("change", () => { resetResults(); render(); });
elements.list.addEventListener("click", event => {
  const remove = event.target.closest("[data-remove]");
  if (remove) removeEntry(remove.dataset.remove);
  const download = event.target.closest("[data-download]");
  if (download) {
    const entry = entries.find(item => item.id === download.dataset.download);
    if (entry?.resultBlob) downloadBlob(entry.resultBlob, convertedName(entry.file.name, selectedOutput()));
  }
});
window.addEventListener("beforeunload", () => { stopDecoderWorker(); entries.forEach(disposeEntry); });
render();
