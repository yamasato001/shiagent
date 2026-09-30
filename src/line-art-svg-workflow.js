import { init, potrace } from "esm-potrace-wasm";
import { detectRasterFormat, formatBytes } from "../assets/js/png-core.js";
import { canvasFromRgba, createZipBlob, decodeBrowserImage, encodeBrowserCanvas, toImageData } from "../assets/js/browser-runtime.js";
import { contentBounds, paddedBounds } from "../assets/js/image-cropper-core.js";
import { processBackground } from "../assets/js/background-remover-core.js";
import { QUALITY_PRESETS, binaryToRgba, cropRgba, normalizeSvgCanvas, preprocessRgba } from "../assets/js/png-to-svg-core.js";
import { FILL_PRESETS, closedRegionMask, insertWhiteFill, maskToPath, viewBoxOfSvg } from "../assets/js/svg-white-fill-core.js";
import { cleanSvg } from "../assets/js/svg-cleaner-core.js";
import { whiteFillMode, workflowOutputName } from "../assets/js/line-art-svg-workflow-core.js";
import { replaceTray } from "../assets/js/work-tray.js";
import { localPath, pick } from "../assets/js/i18n.js";
import common from "../assets/js/i18n/common.js";
import workflowText from "../assets/js/i18n/line-art-svg-workflow.js";

const shared = pick(common), copy = pick(workflowText);
const $ = selector => document.querySelector(selector);
const elements = {
  drop: $("#dropZone"), input: $("#fileInput"), select: $("#selectButton"), add: $("#addButton"), clear: $("#clearButton"), removeAll: $("#removeAllButton"),
  queue: $("#queuePanel"), count: $("#fileCount"), list: $("#fileList"), fillMethod: $("#fillMethodSettings"), run: $("#runButton"), progress: $("#progressText"),
  results: $("#resultsPanel"), resultStatus: $("#resultStatus"), resultCount: $("#resultCount"), resultSize: $("#resultSize"), resultList: $("#resultList"), downloadAll: $("#downloadAllButton"), toast: $("#toast")
};
const state = { entries: [], results: [], running: false, initialized: null };

const selectedFillMode = () => whiteFillMode(document.querySelector('input[name="whiteFill"]:checked')?.value, document.querySelector('input[name="fillMethod"]:checked')?.value);
const sourceLabel = format => format === "jpeg" ? "JPEG" : format === "webp" ? "WebP" : "PNG";
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add("show"); setTimeout(() => elements.toast.classList.remove("show"), 2600); }
function revokeResults() { state.results.forEach(result => { URL.revokeObjectURL(result.url); URL.revokeObjectURL(result.previewUrl); }); state.results = []; }
function resetResults() { revokeResults(); elements.results.hidden = true; elements.progress.textContent = ""; }
function updateFillSettings() { elements.fillMethod.hidden = document.querySelector('input[name="whiteFill"]:checked')?.value !== "yes"; }

function render() {
  elements.queue.hidden = !state.entries.length;
  elements.count.textContent = shared.fileCount(state.entries.length);
  elements.list.innerHTML = state.entries.map((entry, index) => `<article class="file-row workflow-file-row ${entry.status === "done" ? "is-done" : ""}">
    <img class="file-thumb" src="${entry.previewUrl}" alt=""><div class="file-main"><strong class="file-name">${escapeHtml(entry.file.name)}</strong><span class="file-meta">${sourceLabel(entry.format)} · ${formatBytes(entry.file.size)}</span>${entry.error ? `<small class="converter-error">${escapeHtml(entry.error)}</small>` : ""}</div>
    <span class="file-status ${entry.status}">${copy.status[entry.status]}</span><button class="icon-button" type="button" data-remove="${index}" aria-label="${escapeHtml(shared.removeFile(entry.file.name))}">×</button></article>`).join("");
}

async function addFiles(fileList) {
  if (state.running) return;
  const keys = new Set(state.entries.map(entry => entry.key));
  let rejected = false, duplicate = false;
  for (const file of fileList) {
    const format = detectRasterFormat(await file.slice(0, 12).arrayBuffer());
    if (!format) { rejected = true; continue; }
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (keys.has(key)) { duplicate = true; continue; }
    state.entries.push({ file, format, key, previewUrl: URL.createObjectURL(file), status: "ready", error: null });
    keys.add(key);
  }
  if (rejected) showToast(copy.unsupported); else if (duplicate) showToast(copy.duplicate);
  elements.input.value = ""; resetResults(); render();
}

async function decode(file) {
  const canvas = await decodeBrowserImage(file, { willReadFrequently: true });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data: image.data, width: image.width, height: image.height };
}

function prepareRaster(source, fileName) {
  const detected = contentBounds(source.data, source.width, source.height, { background: "auto", tolerance: 18 });
  if (!detected) throw new Error(copy.noContent(fileName));
  const bounds = paddedBounds(detected, source.width, source.height, { safeEdge: 4, padding: 3, paddingUnit: "percent" });
  const cropped = cropRgba(source.data, source.width, source.height, [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height], 0);
  const processed = processBackground(cropped.data, cropped.width, cropped.height, { removal: "connected", tolerance: 10, softness: 6, fill: null });
  return { data: processed.data, width: cropped.width, height: cropped.height };
}

async function trace(raster) {
  const preset = QUALITY_PRESETS.smooth;
  const processed = preprocessRgba(raster.data, raster.width, raster.height, preset);
  if (!processed.data.some(value => value === 0)) throw new Error(copy.noContent(""));
  const traced = await potrace(toImageData(binaryToRgba(processed.data, processed.width, processed.height)), { turdsize: preset.turdsize, turnpolicy: 4, alphamax: preset.alphamax, opticurve: 1, opttolerance: preset.opttolerance, pathonly: false, extractcolors: false, posterizelevel: 2, posterizationalgorithm: 0 });
  return normalizeSvgCanvas(traced, 512);
}

function loadImage(blob) {
  return new Promise((resolve, reject) => { const url = URL.createObjectURL(blob), image = new Image(); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(copy.renderFailed)); }; image.src = url; });
}

async function addAutoFill(svg) {
  const source = insertWhiteFill(svg, "");
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const viewBox = viewBoxOfSvg(parsed.documentElement), preset = FILL_PRESETS.standard;
  const width = viewBox[2] >= viewBox[3] ? preset.longSide : Math.max(1, Math.round(preset.longSide * viewBox[2] / viewBox[3]));
  const height = viewBox[3] >= viewBox[2] ? preset.longSide : Math.max(1, Math.round(preset.longSide * viewBox[3] / viewBox[2]));
  const image = await loadImage(new Blob([source], { type: "image/svg+xml" }));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data, alpha = new Uint8ClampedArray(width * height);
  for (let index = 0; index < alpha.length; index += 1) alpha[index] = rgba[index * 4 + 3];
  return insertWhiteFill(svg, maskToPath(closedRegionMask(alpha, width, height, preset), width, height, viewBox));
}

async function previewUrl(raster) {
  const canvas = canvasFromRgba(raster);
  const blob = await encodeBrowserCanvas(canvas, "image/png"); return URL.createObjectURL(blob);
}

async function processEntry(entry, index, total, mode) {
  elements.progress.textContent = copy.progress(index + 1, total, entry.file.name, copy.steps.trim);
  const raster = prepareRaster(await decode(entry.file), entry.file.name);
  elements.progress.textContent = copy.progress(index + 1, total, entry.file.name, copy.steps.background);
  await new Promise(resolve => requestAnimationFrame(resolve));
  elements.progress.textContent = copy.progress(index + 1, total, entry.file.name, copy.steps.vectorize);
  let svg = await trace(raster);
  if (mode === "auto") { elements.progress.textContent = copy.progress(index + 1, total, entry.file.name, copy.steps.autoFill); svg = await addAutoFill(svg); }
  if (mode !== "manual") { elements.progress.textContent = copy.progress(index + 1, total, entry.file.name, copy.steps.clean); svg = cleanSvg(svg).svg; }
  const name = workflowOutputName(entry.file.name, mode), blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  return { name, svg, blob, url: URL.createObjectURL(blob), previewUrl: await previewUrl(raster) };
}

function renderResults() {
  elements.results.hidden = false; elements.resultCount.textContent = shared.fileCount(state.results.length);
  elements.resultSize.textContent = formatBytes(state.results.reduce((sum, result) => sum + result.blob.size, 0));
  elements.resultStatus.textContent = state.results.length === state.entries.length ? copy.completed(state.results.length, state.entries.length) : copy.partial(state.results.length, state.entries.length);
  elements.resultList.innerHTML = state.results.map((result, index) => `<article class="vector-result-card"><div class="vector-compare"><figure><img src="${result.previewUrl}" alt=""><figcaption>BEFORE</figcaption></figure><figure><img src="${result.url}" alt=""><figcaption>SVG</figcaption></figure></div><div><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(result.name)}</strong><small>${formatBytes(result.blob.size)}</small><button class="button button-light" type="button" data-download="${index}">${copy.download}</button></div></article>`).join("");
}

async function run() {
  if (!state.entries.length || state.running) return;
  state.running = true; elements.run.disabled = true; resetResults(); const mode = selectedFillMode();
  try {
    state.initialized ||= init(); await state.initialized;
    for (let index = 0; index < state.entries.length; index += 1) {
      const entry = state.entries[index]; entry.status = "processing"; entry.error = null; render();
      try { state.results.push(await processEntry(entry, index, state.entries.length, mode)); entry.status = "done"; } catch (error) { console.error(error); entry.status = "error"; entry.error = error.message; }
      render();
    }
    if (!state.results.length) throw new Error(copy.failed);
    if (mode === "manual") {
      elements.progress.textContent = copy.manualHandoff(state.results.length);
      await replaceTray(state.results.map(result => ({ name: result.name, blob: result.blob })), "line-art-svg-workflow", { applySuffix: true });
      location.href = `${localPath("/svg-white-fill/editor/")}?tray=1&workflow=line-art-to-svg`;
      return;
    }
    renderResults();
    document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: state.results.map(result => ({ name: result.name, blob: result.blob })), source: "line-art-svg-workflow" } }));
    elements.progress.textContent = copy.complete; elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { console.error(error); showToast(error.message || copy.failed); }
  finally { state.running = false; elements.run.disabled = false; }
}

function trigger(result) { const anchor = document.createElement("a"); anchor.href = result.url; anchor.download = result.name; anchor.click(); }
function clearAll() { state.entries.forEach(entry => URL.revokeObjectURL(entry.previewUrl)); state.entries = []; resetResults(); render(); }
elements.select.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); }); elements.add.addEventListener("click", () => elements.input.click());
elements.input.addEventListener("change", () => addFiles(elements.input.files)); elements.drop.addEventListener("click", () => elements.input.click());
for (const type of ["dragenter", "dragover"]) elements.drop.addEventListener(type, event => { event.preventDefault(); elements.drop.classList.add("is-over"); });
for (const type of ["dragleave", "drop"]) elements.drop.addEventListener(type, event => { event.preventDefault(); elements.drop.classList.remove("is-over"); });
elements.drop.addEventListener("drop", event => addFiles(event.dataTransfer.files)); elements.clear.addEventListener("click", clearAll); elements.removeAll.addEventListener("click", clearAll);
elements.list.addEventListener("click", event => { const button = event.target.closest("[data-remove]"); if (!button || state.running) return; const [entry] = state.entries.splice(Number(button.dataset.remove), 1); URL.revokeObjectURL(entry.previewUrl); resetResults(); render(); });
document.querySelectorAll('input[name="whiteFill"]').forEach(input => input.addEventListener("change", updateFillSettings)); elements.run.addEventListener("click", run);
elements.resultList.addEventListener("click", event => { const button = event.target.closest("[data-download]"); if (button) trigger(state.results[Number(button.dataset.download)]); });
elements.downloadAll.addEventListener("click", async () => { const zip = createZipBlob(state.results.map(result => ({ name: result.name, data: new TextEncoder().encode(result.svg) }))); const url = URL.createObjectURL(zip), anchor = document.createElement("a"); anchor.href = url; anchor.download = "shiagent-line-art-svg.zip"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
updateFillSettings(); render();
