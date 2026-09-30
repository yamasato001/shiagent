import { formatBytes } from "./png-core.js";
import { canvasFromRgba, decodeBrowserImage, encodeBrowserCanvas } from "./browser-runtime.js";
import { detectImageFormat, formatLabel, OUTPUT_FORMATS, outputQuality, requiresSoftwareDecoder } from "./image-converter-core.js";
import { joinLayout, joinedName } from "./image-joiner-core.js";
import { lang, locale, pick } from "./i18n.js";
import joinerText from "./i18n/image-joiner.js";

const copy = pick(joinerText);
const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), drop: $("#dropZone"), select: $("#selectButton"), add: $("#addButton"), clear: $("#clearButton"),
  removeAll: $("#removeAllButton"), queue: $("#queuePanel"), list: $("#fileList"), count: $("#fileCount"),
  run: $("#joinButton"), cancel: $("#cancelButton"), progress: $("#progressText"), results: $("#resultsPanel"),
  resultStatus: $("#resultStatus"), dimensions: $("#outputDimensions"), resultSize: $("#resultSize"), inputCount: $("#joinedCount"),
  resultImage: $("#resultImage"), download: $("#downloadButton"), toast: $("#toast"), modeGrid: $("#joinModeGrid"),
  columnsWrap: $("#columnsWrap"), columns: $("#columnsInput"), gap: $("#gapInput"), padding: $("#paddingInput"),
  background: $("#backgroundSelect"), customColorWrap: $("#customColorWrap"), customColor: $("#customColor"), outputFormat: $("#outputFormat"), quality: $("#quality")
};

let entries = [];
let running = false;
let cancelRequested = false;
let decoderWorker;
let decoderRequestId = 0;
let resultBlob;
let resultUrl;
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
  return document.querySelector('input[name="joinMode"]:checked')?.value || "horizontal";
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
  if (requiresSoftwareDecoder(entry.format)) {
    const buffer = await entry.file.arrayBuffer();
    const decoded = await new Promise((resolve, reject) => {
      const id = ++decoderRequestId;
      decoderRequests.set(id, { resolve, reject });
      ensureDecoderWorker().postMessage({ id, buffer, format: entry.format }, [buffer]);
    });
    return canvasFromRgba(decoded);
  }
  return decodeBrowserImage(entry.file);
}

function encodeCanvas(canvas, format) {
  const definition = OUTPUT_FORMATS[format];
  return encodeBrowserCanvas(canvas, definition.mime, outputQuality(format, elements.quality.value)).then(blob => {
    if (blob.type !== definition.mime) throw new Error(copy.encodeUnsupported(definition.label));
    return blob;
  });
}

function disposeEntry(entry) {
  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
}

function resetResult() {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultBlob = null;
  resultUrl = null;
  elements.results.hidden = true;
  elements.resultImage.removeAttribute("src");
  for (const entry of entries) { entry.status = "ready"; entry.error = null; }
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
      previewUrl: requiresSoftwareDecoder(format) ? null : URL.createObjectURL(file), status: "ready", error: null
    });
  }
  if (rejected) showToast(copy.unsupported);
  else if (duplicate) showToast(copy.duplicate);
  elements.input.value = "";
  resetResult();
  render();
}

function removeEntry(id) {
  if (running) return;
  const index = entries.findIndex(entry => entry.id === id);
  if (index < 0) return;
  disposeEntry(entries[index]);
  entries.splice(index, 1);
  resetResult();
  render();
}

function moveEntry(id, direction) {
  if (running) return;
  const index = entries.findIndex(entry => entry.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= entries.length) return;
  [entries[index], entries[target]] = [entries[target], entries[index]];
  resetResult();
  render();
}

function clearEntries() {
  if (running) return;
  entries.forEach(disposeEntry);
  entries = [];
  resetResult();
  render();
}

function render() {
  const grid = selectedMode() === "grid";
  elements.columnsWrap.hidden = !grid;
  elements.customColorWrap.hidden = elements.background.value !== "custom";
  elements.queue.hidden = entries.length === 0;
  elements.count.textContent = copy.files(entries.length);
  elements.run.disabled = entries.length === 0 || running;
  for (const element of [elements.select, elements.add, elements.clear, elements.removeAll, elements.columns, elements.gap, elements.padding, elements.background, elements.customColor, elements.outputFormat, elements.quality]) element.disabled = running;
  elements.modeGrid.disabled = running;
  elements.cancel.hidden = !running;
  elements.run.hidden = running;
  elements.list.innerHTML = entries.map((entry, index) => {
    const preview = entry.previewUrl ? `<img class="file-thumb" src="${entry.previewUrl}" alt="">` : `<span class="converter-format-placeholder">${escapeHtml(formatLabel(entry.format))}</span>`;
    return `<article class="file-row converter-file-row" data-id="${entry.id}">
      ${preview}<div class="file-main"><span class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span><span class="file-meta">${index + 1} · ${escapeHtml(formatLabel(entry.format))} · ${formatBytes(entry.file.size, locale)}</span>${entry.error ? `<small class="converter-error">${escapeHtml(entry.error)}</small>` : ""}</div>
      <span class="file-status ${entry.status}">${copy.status[entry.status] || copy.status.ready}</span>
      <div class="join-order-actions"><button class="icon-button" type="button" data-move="-1" data-entry="${entry.id}" aria-label="${copy.moveEarlier}" ${index === 0 ? "disabled" : ""}>↑</button><button class="icon-button" type="button" data-move="1" data-entry="${entry.id}" aria-label="${copy.moveLater}" ${index === entries.length - 1 ? "disabled" : ""}>↓</button><button class="icon-button" type="button" data-remove="${entry.id}" aria-label="${copy.remove}">×</button></div>
    </article>`;
  }).join("");
}

function layoutOptions(canvases) {
  const options = {
    mode: selectedMode(), columns: elements.columns.value,
    gap: elements.gap.value, padding: elements.padding.value
  };
  return joinLayout(canvases.map(canvas => ({ width: canvas.width, height: canvas.height })), options);
}

function fillColor(format) {
  if (elements.background.value === "transparent" && format !== "jpeg") return null;
  if (elements.background.value === "black") return "#000000";
  if (elements.background.value === "custom") return elements.customColor.value;
  return "#ffffff";
}

async function runJoin() {
  if (!entries.length || running) return;
  resetResult();
  running = true;
  cancelRequested = false;
  elements.cancel.disabled = false;
  render();
  const canvases = [];
  try {
    for (let index = 0; index < entries.length; index += 1) {
      if (cancelRequested) throw Object.assign(new Error(copy.cancelled), { name: "AbortError" });
      entries[index].status = "processing";
      render();
      canvases.push(await decodeToCanvas(entries[index]));
      entries[index].status = "done";
      elements.progress.textContent = copy.progress(index + 1, entries.length);
    }
    const layout = layoutOptions(canvases);
    if (layout.width > 32767 || layout.height > 32767 || layout.width * layout.height > 100_000_000) throw new Error(copy.invalidLayout);
    const canvas = document.createElement("canvas");
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext("2d", { alpha: true });
    const background = fillColor(elements.outputFormat.value);
    if (background) { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); }
    layout.placements.forEach((placement, index) => context.drawImage(canvases[index], placement.x, placement.y));
    resultBlob = await encodeCanvas(canvas, elements.outputFormat.value);
    resultUrl = URL.createObjectURL(resultBlob);
    elements.resultImage.src = resultUrl;
    elements.resultStatus.textContent = copy.completed(entries.length, layout.width, layout.height);
    elements.dimensions.textContent = `${layout.width} × ${layout.height}px`;
    elements.resultSize.textContent = formatBytes(resultBlob.size, locale);
    elements.inputCount.textContent = copy.files(entries.length);
    elements.results.hidden = false;
    elements.results.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const output = new File([resultBlob], joinedName(elements.outputFormat.value), { type: resultBlob.type });
    document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: [output], source: "image-joiner-result" } }));
  } catch (error) {
    if (error?.name === "AbortError") showToast(copy.cancelled);
    else showToast(error instanceof Error ? error.message : String(error));
  } finally {
    running = false;
    for (const entry of entries) if (entry.status === "processing") entry.status = "ready";
    render();
  }
}

function downloadResult() {
  if (!resultBlob) return;
  const link = document.createElement("a");
  link.href = resultUrl;
  link.download = joinedName(elements.outputFormat.value);
  document.body.append(link);
  link.click();
  link.remove();
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
elements.run.addEventListener("click", runJoin);
elements.cancel.addEventListener("click", () => { cancelRequested = true; elements.cancel.disabled = true; stopDecoderWorker(); });
elements.download.addEventListener("click", downloadResult);
elements.list.addEventListener("click", event => {
  const remove = event.target.closest("[data-remove]");
  if (remove) removeEntry(remove.dataset.remove);
  const move = event.target.closest("[data-move]");
  if (move) moveEntry(move.dataset.entry, Number(move.dataset.move));
});
elements.modeGrid.addEventListener("change", () => { resetResult(); render(); });
for (const element of [elements.columns, elements.gap, elements.padding, elements.background, elements.customColor, elements.outputFormat, elements.quality]) element.addEventListener("change", () => { resetResult(); render(); });
window.addEventListener("beforeunload", () => { stopDecoderWorker(); entries.forEach(disposeEntry); if (resultUrl) URL.revokeObjectURL(resultUrl); });
render();
