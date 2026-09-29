import { createZip, formatBytes } from "./png-core.js";
import { detectImageFormat, formatLabel } from "./image-converter-core.js";
import { cleanedName, cleanImageMetadata } from "./image-metadata-core.js";
import { locale, pick } from "./i18n.js";
import metadataText from "./i18n/image-metadata-cleaner.js";

const copy = pick(metadataText);
const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), drop: $("#dropZone"), select: $("#selectButton"), add: $("#addButton"),
  clear: $("#clearButton"), removeAll: $("#removeAllButton"), queue: $("#queuePanel"), list: $("#fileList"),
  count: $("#fileCount"), run: $("#cleanButton"), cancel: $("#cancelButton"), progress: $("#progressText"),
  results: $("#resultsPanel"), resultStatus: $("#resultStatus"), before: $("#beforeTotal"), after: $("#afterTotal"),
  resultCount: $("#cleanedCount"), downloadAll: $("#downloadAllButton"), toast: $("#toast")
};

let entries = [];
let running = false;
let cancelRequested = false;
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

function disposeEntry(entry) {
  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
  if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
}

function resetResults() {
  elements.results.hidden = true;
  for (const entry of entries) {
    if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
    Object.assign(entry, { resultBlob: null, resultUrl: null, removed: [], status: "ready", error: null });
  }
}

async function addFiles(fileList) {
  if (running) return;
  let rejected = false;
  let duplicate = false;
  for (const file of fileList) {
    const format = detectImageFormat(await file.slice(0, 64).arrayBuffer());
    if (!new Set(["png", "jpeg", "webp"]).has(format)) { rejected = true; continue; }
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (entries.some(entry => entry.key === key)) { duplicate = true; continue; }
    entries.push({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, key, file, format,
      previewUrl: URL.createObjectURL(file), resultBlob: null, resultUrl: null, removed: [], status: "ready", error: null
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
  resetResults();
  render();
}

function clearEntries() {
  if (running) return;
  entries.forEach(disposeEntry);
  entries = [];
  elements.results.hidden = true;
  render();
}

function render() {
  elements.queue.hidden = entries.length === 0;
  elements.count.textContent = copy.files(entries.length);
  elements.run.disabled = entries.length === 0 || running;
  for (const element of [elements.select, elements.add, elements.clear, elements.removeAll]) element.disabled = running;
  elements.cancel.hidden = !running;
  elements.run.hidden = running;
  elements.list.innerHTML = entries.map(entry => {
    const message = entry.error ? entry.error : entry.status === "done" ? (entry.removed.length ? copy.removed(entry.removed) : copy.unchanged) : "";
    const result = entry.resultBlob ? `<div class="file-result"><span>${formatBytes(entry.file.size, locale)} → ${formatBytes(entry.resultBlob.size, locale)}</span><button class="button button-light file-download" type="button" data-download="${entry.id}">${copy.download}</button></div>` : "";
    return `<article class="file-row converter-file-row ${entry.resultBlob ? "has-result" : ""}" data-id="${entry.id}">
      <img class="file-thumb" src="${entry.previewUrl}" alt="">
      <div class="file-main"><span class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span><span class="file-meta">${escapeHtml(formatLabel(entry.format))} · ${formatBytes(entry.file.size, locale)}</span>${message ? `<small class="${entry.error ? "converter-error" : "file-meta"}">${escapeHtml(message)}</small>` : ""}</div>
      <span class="file-status ${entry.status}">${copy.status[entry.status] || copy.status.ready}</span>
      ${result || `<button class="icon-button" type="button" data-remove="${entry.id}" aria-label="${copy.remove}">×</button>`}
    </article>`;
  }).join("");
}

async function cleanEntry(entry) {
  entry.status = "processing";
  render();
  await new Promise(resolve => requestAnimationFrame(resolve));
  const result = cleanImageMetadata(await entry.file.arrayBuffer(), entry.format);
  const mime = entry.format === "jpeg" ? "image/jpeg" : `image/${entry.format}`;
  entry.resultBlob = new Blob([result.bytes], { type: mime });
  entry.resultUrl = URL.createObjectURL(entry.resultBlob);
  entry.removed = [...new Set(result.removed)];
  entry.status = "done";
}

function outputFiles(done) {
  const names = new Map();
  return done.map(entry => {
    let name = cleanedName(entry.file.name);
    const seen = names.get(name) || 0;
    names.set(name, seen + 1);
    if (seen) name = name.replace(/(\.[^.]*)?$/, `-${seen + 1}$1`);
    return new File([entry.resultBlob], name, { type: entry.resultBlob.type });
  });
}

async function runCleaner() {
  if (!entries.length || running) return;
  resetResults();
  running = true;
  cancelRequested = false;
  elements.cancel.disabled = false;
  render();
  let completed = 0;
  for (const entry of entries) {
    if (cancelRequested) break;
    try { await cleanEntry(entry); completed += 1; }
    catch (error) { entry.status = "error"; entry.error = error instanceof Error ? error.message : String(error); }
    elements.progress.textContent = copy.progress(completed, entries.length);
    render();
  }
  running = false;
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
  document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: outputFiles(done), source: "metadata-cleaner-result" } }));
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
  const zipEntries = [];
  for (const file of outputFiles(done)) zipEntries.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
  if (zipEntries.length) downloadBlob(createZip(zipEntries), "shiagent-clean-images.zip");
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
elements.run.addEventListener("click", runCleaner);
elements.cancel.addEventListener("click", () => { cancelRequested = true; elements.cancel.disabled = true; });
elements.downloadAll.addEventListener("click", downloadAll);
elements.list.addEventListener("click", event => {
  const remove = event.target.closest("[data-remove]");
  if (remove) removeEntry(remove.dataset.remove);
  const download = event.target.closest("[data-download]");
  if (download) {
    const entry = entries.find(item => item.id === download.dataset.download);
    if (entry?.resultBlob) downloadBlob(entry.resultBlob, cleanedName(entry.file.name));
  }
});
window.addEventListener("beforeunload", () => entries.forEach(disposeEntry));
render();
