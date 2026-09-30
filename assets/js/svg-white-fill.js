import { formatBytes } from "./png-core.js";
import { createZipBlob } from "./browser-runtime.js";
import { FILL_PRESETS, closedRegionMask, insertWhiteFill, maskToPath, viewBoxOfSvg } from "./svg-white-fill-core.js";
import { replaceTray } from "./work-tray.js";
import { localPath, pick } from "./i18n.js";
import common from "./i18n/common.js";
import svgTools from "./i18n/svg-tools.js";

const shared = pick(common), copy = pick(svgTools).whiteFill;

const $ = selector => document.querySelector(selector);
const elements = { input: $("#fileInput"), drop: $("#dropZone"), select: $("#selectButton"), add: $("#addButton"), clear: $("#clearButton"), removeAll: $("#removeAllButton"), queue: $("#queuePanel"), count: $("#fileCount"), list: $("#fileList"), run: $("#processButton"), progress: $("#progressText"), results: $("#resultsPanel"), status: $("#resultStatus"), resultCount: $("#resultCount"), resultSize: $("#resultSize"), resultList: $("#resultList"), download: $("#downloadAllButton"), manualEditor: $("#manualEditorButton"), toast: $("#toast") };
const state = { files: [], results: [], running: false };
const isSvg = file => file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
const preset = () => FILL_PRESETS[document.querySelector('input[name="preset"]:checked')?.value || "standard"];
const baseName = name => name.replace(/\.svg$/i, "").replace(/[\\/:*?"<>|]/g, "").trim() || "image";

function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add("show"); setTimeout(() => elements.toast.classList.remove("show"), 2600); }
function revokeResults() { state.results.forEach(result => { URL.revokeObjectURL(result.beforeUrl); URL.revokeObjectURL(result.afterUrl); }); state.results = []; }
function renderFiles() {
  elements.queue.hidden = !state.files.length; elements.count.textContent = shared.fileCount(state.files.length); elements.list.replaceChildren();
  state.files.forEach((file, index) => { const row = document.createElement("div"); row.className = "file-row"; row.innerHTML = `<div class="svg-file-mark">SVG</div><div class="file-main"><strong class="file-name"></strong><span class="file-meta">${formatBytes(file.size)}</span></div>`; row.querySelector("strong").textContent = file.name; const remove = document.createElement("button"); remove.className = "icon-button"; remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", shared.removeFile(file.name)); remove.addEventListener("click", () => { state.files.splice(index, 1); revokeResults(); elements.results.hidden = true; renderFiles(); }); row.append(remove); elements.list.append(row); });
}
function addFiles(fileList) { const incoming = [...fileList].filter(isSvg); if (!incoming.length) return showToast(shared.selectSvg); const names = new Set(state.files.map(file => `${file.name}:${file.size}`)); incoming.forEach(file => { const key = `${file.name}:${file.size}`; if (!names.has(key)) { state.files.push(file); names.add(key); } }); revokeResults(); elements.results.hidden = true; elements.input.value = ""; renderFiles(); }
function loadImage(blob) { return new Promise((resolve, reject) => { const url = URL.createObjectURL(blob); const image = new Image(); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(shared.svgRenderFailed)); }; image.src = url; }); }
async function processFile(file) {
  const original = await file.text();
  const cleanForDetection = insertWhiteFill(original, "");
  const parsed = new DOMParser().parseFromString(cleanForDetection, "image/svg+xml");
  const viewBox = viewBoxOfSvg(parsed.documentElement);
  const selected = preset();
  const width = viewBox[2] >= viewBox[3] ? selected.longSide : Math.max(1, Math.round(selected.longSide * viewBox[2] / viewBox[3]));
  const height = viewBox[3] >= viewBox[2] ? selected.longSide : Math.max(1, Math.round(selected.longSide * viewBox[3] / viewBox[2]));
  const image = await loadImage(new Blob([cleanForDetection], { type: "image/svg+xml" }));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true }); context.clearRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data; const alpha = new Uint8ClampedArray(width * height); for (let i = 0; i < alpha.length; i += 1) alpha[i] = rgba[i * 4 + 3];
  const mask = closedRegionMask(alpha, width, height, selected); const path = maskToPath(mask, width, height, viewBox); const svg = insertWhiteFill(original, path);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  return { name: `${baseName(file.name)}-white-filled.svg`, blob, svg, regions: (path.match(/M/g) || []).length, beforeUrl: URL.createObjectURL(file), afterUrl: URL.createObjectURL(blob) };
}
function renderResults() { elements.results.hidden = false; elements.resultCount.textContent = shared.fileCount(state.results.length); elements.resultSize.textContent = formatBytes(state.results.reduce((sum, result) => sum + result.blob.size, 0)); elements.status.textContent = copy.status(state.results.reduce((sum, result) => sum + result.regions, 0)); elements.resultList.replaceChildren(); state.results.forEach(result => { const card = document.createElement("article"); card.className = "vector-result-card svg-result-card"; card.innerHTML = `<div class="vector-compare"><figure><img alt="${copy.beforeAlt}"><figcaption>BEFORE</figcaption></figure><figure><img alt="${copy.afterAlt}"><figcaption>AFTER</figcaption></figure></div><div><span>SVG</span><strong></strong><small>${copy.regions(result.regions)} / ${formatBytes(result.blob.size)}</small><button class="button button-light" type="button">${shared.saveSvg}</button></div>`; const images = card.querySelectorAll("img"); images[0].src = result.beforeUrl; images[1].src = result.afterUrl; card.querySelector("strong").textContent = result.name; card.querySelector("button").addEventListener("click", () => trigger(result.afterUrl, result.name)); elements.resultList.append(card); }); }
async function run() { if (!state.files.length || state.running) return; state.running = true; elements.run.disabled = true; revokeResults(); try { for (let i = 0; i < state.files.length; i += 1) { elements.progress.textContent = `${i + 1}/${state.files.length} ${state.files[i].name}`; await new Promise(resolve => requestAnimationFrame(resolve)); state.results.push(await processFile(state.files[i])); } renderResults(); document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: state.results.map(result => ({ name: result.name, blob: result.blob })), source: "svg-white-fill-result" } })); elements.progress.textContent = copy.done; elements.results.scrollIntoView({ behavior: "smooth" }); } catch (error) { console.error(error); showToast(error.message); } finally { state.running = false; elements.run.disabled = false; } }
function trigger(url, name) { const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); }
async function downloadAll() { const entries = state.results.map(result => ({ name: result.name, data: new TextEncoder().encode(result.svg) })); const url = URL.createObjectURL(createZipBlob(entries)); trigger(url, "shiagent-white-filled-svg.zip"); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function clearAll() { state.files = []; revokeResults(); elements.results.hidden = true; renderFiles(); }
elements.select.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); }); elements.add.addEventListener("click", () => elements.input.click()); elements.input.addEventListener("change", () => addFiles(elements.input.files)); elements.drop.addEventListener("click", () => elements.input.click()); elements.drop.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); elements.input.click(); } }); for (const type of ["dragenter", "dragover"]) elements.drop.addEventListener(type, event => { event.preventDefault(); elements.drop.classList.add("is-over"); }); for (const type of ["dragleave", "drop"]) elements.drop.addEventListener(type, event => { event.preventDefault(); elements.drop.classList.remove("is-over"); }); elements.drop.addEventListener("drop", event => addFiles(event.dataTransfer.files)); elements.clear.addEventListener("click", clearAll); elements.removeAll.addEventListener("click", clearAll); elements.run.addEventListener("click", run); elements.download.addEventListener("click", downloadAll); elements.manualEditor.addEventListener("click", async () => { await replaceTray(state.results.map(result => ({ name: result.name, blob: result.blob })), "svg-white-fill-manual", { applySuffix: true }); location.href = `${localPath("/svg-white-fill/editor/")}?tray=1`; }); renderFiles();

