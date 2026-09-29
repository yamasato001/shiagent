import { createZip, formatBytes } from "./png-core.js";
import { addPngDensity, parseSvgSize, rasterDimensions, rasterizedName } from "./svg-rasterizer-core.js";
import { locale, pick } from "./i18n.js";
import rasterizerText from "./i18n/svg-rasterizer.js";

const copy = pick(rasterizerText);
const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), drop: $("#dropZone"), select: $("#selectButton"), add: $("#addButton"), clear: $("#clearButton"),
  removeAll: $("#removeAllButton"), queue: $("#queuePanel"), list: $("#fileList"), count: $("#fileCount"), run: $("#rasterizeButton"),
  cancel: $("#cancelButton"), progress: $("#progressText"), results: $("#resultsPanel"), resultStatus: $("#resultStatus"),
  before: $("#beforeTotal"), after: $("#afterTotal"), resultCount: $("#rasterizedCount"), downloadAll: $("#downloadAllButton"),
  modeGrid: $("#sizeModeGrid"), scaleField: $("#scaleField"), pixelFields: $("#pixelFields"), dpiField: $("#dpiField"),
  scale: $("#scaleInput"), width: $("#widthInput"), height: $("#heightInput"), keepAspect: $("#keepAspectInput"), dpi: $("#dpiInput"),
  outputFormat: $("#outputFormat"), quality: $("#qualityInput"), background: $("#backgroundMode"), color: $("#backgroundColor"),
  colorWrap: $("#customColorField"), toast: $("#toast")
};

let entries = [];
let running = false;
let cancelRequested = false;
let toastTimer;
let lastDimensionChanged = "width";

const isSvg = file => file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
const selectedMode = () => document.querySelector('input[name="sizeMode"]:checked')?.value || "scale";
const selectedBackground = () => document.querySelector('input[name="backgroundMode"]:checked')?.value || "transparent";

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
    Object.assign(entry, { resultBlob: null, resultUrl: null, status: "ready", error: null, outputWidth: null, outputHeight: null });
  }
}

function sanitizeSvg(source, size) {
  const documentNode = new DOMParser().parseFromString(source, "image/svg+xml");
  if (documentNode.querySelector("parsererror") || documentNode.documentElement.localName !== "svg") throw new Error("Invalid SVG");
  const root = documentNode.documentElement;
  for (const element of [...root.querySelectorAll("script,foreignObject,iframe,object,embed,audio,video")]) element.remove();
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || ((name === "href" || name === "xlink:href") && !/^(?:#|data:image\/)/i.test(value)) || (name === "style" && /(?:@import|url\(\s*['\"]?(?:https?:|\/\/))/i.test(value))) element.removeAttribute(attribute.name);
    }
  }
  for (const style of root.querySelectorAll("style")) style.textContent = style.textContent.replace(/@import[\s\S]*?;/gi, "").replace(/url\(\s*(['\"]?)(?:https?:|\/\/)[^)]+\)/gi, "none");
  root.setAttribute("width", String(size.width));
  root.setAttribute("height", String(size.height));
  if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", size.viewBox.join(" "));
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(root);
}

async function addFiles(fileList) {
  if (running) return;
  let rejected = false;
  let duplicate = false;
  for (const file of fileList) {
    if (!isSvg(file)) { rejected = true; continue; }
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (entries.some(entry => entry.key === key)) { duplicate = true; continue; }
    try {
      const source = await file.text();
      const size = parseSvgSize(source);
      const safeSource = sanitizeSvg(source, size);
      const previewUrl = URL.createObjectURL(new Blob([safeSource], { type: "image/svg+xml" }));
      entries.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, key, file, source: safeSource, size, previewUrl, resultBlob: null, resultUrl: null, status: "ready", error: null });
    } catch { showToast(copy.invalidSvg(file.name)); }
  }
  if (rejected) showToast(copy.selectSvg);
  else if (duplicate) showToast(copy.duplicate);
  elements.input.value = "";
  syncAspect();
  resetResults();
  render();
}

function removeEntry(id) {
  if (running) return;
  const index = entries.findIndex(entry => entry.id === id);
  if (index < 0) return;
  disposeEntry(entries[index]);
  entries.splice(index, 1);
  syncAspect();
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

function syncAspect(changed = lastDimensionChanged) {
  if (selectedMode() !== "pixels" || !elements.keepAspect.checked || !entries[0]) return;
  const { width, height } = entries[0].size;
  if (changed === "height") elements.width.value = String(Math.max(1, Math.round(Number(elements.height.value) * width / height)));
  else elements.height.value = String(Math.max(1, Math.round(Number(elements.width.value) * height / width)));
}

function options() {
  return { mode: selectedMode(), scale: elements.scale.value, width: elements.width.value, height: elements.height.value, keepAspect: elements.keepAspect.checked, dpi: elements.dpi.value };
}

function render() {
  const mode = selectedMode();
  elements.scaleField.hidden = mode !== "scale";
  elements.pixelFields.hidden = mode !== "pixels";
  elements.dpiField.hidden = mode !== "dpi";
  elements.colorWrap.hidden = selectedBackground() !== "custom";
  elements.quality.disabled = elements.outputFormat.value !== "webp" || running;
  elements.queue.hidden = entries.length === 0;
  elements.count.textContent = copy.files(entries.length);
  elements.run.disabled = entries.length === 0 || running;
  for (const element of [elements.select, elements.add, elements.clear, elements.removeAll, elements.scale, elements.width, elements.height, elements.keepAspect, elements.dpi, elements.outputFormat, elements.background, elements.color]) element.disabled = running;
  elements.modeGrid.disabled = running;
  elements.cancel.hidden = !running;
  elements.run.hidden = running;
  elements.list.innerHTML = entries.map(entry => {
    const details = entry.resultBlob ? copy.output(entry.outputWidth, entry.outputHeight, elements.outputFormat.value.toUpperCase()) : `${Math.round(entry.size.width)} × ${Math.round(entry.size.height)}px · ${formatBytes(entry.file.size, locale)}`;
    const result = entry.resultBlob ? `<div class="file-result"><span>${formatBytes(entry.resultBlob.size, locale)}</span><button class="button button-light file-download" type="button" data-download="${entry.id}">${copy.download}</button></div>` : "";
    return `<article class="file-row converter-file-row ${entry.resultBlob ? "has-result" : ""}" data-id="${entry.id}"><img class="file-thumb" src="${entry.resultUrl || entry.previewUrl}" alt=""><div class="file-main"><span class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span><span class="file-meta">${escapeHtml(details)}</span>${entry.error ? `<small class="converter-error">${escapeHtml(entry.error)}</small>` : ""}</div><span class="file-status ${entry.status}">${copy.status[entry.status] || copy.status.ready}</span>${result || `<button class="icon-button" type="button" data-remove="${entry.id}" aria-label="${copy.remove}">×</button>`}</article>`;
  }).join("");
}

function canvasBlob(canvas, format) {
  const mime = format === "webp" ? "image/webp" : "image/png";
  const quality = Number(elements.quality.value) / 100;
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) reject(new Error(copy.encodeFailed));
    else if (format === "webp" && blob.type !== mime) reject(new Error(copy.webpUnsupported));
    else resolve(blob);
  }, mime, quality));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(copy.encodeFailed));
    image.src = url;
  });
}

async function rasterizeEntry(entry, settings) {
  entry.status = "processing";
  render();
  await new Promise(resolve => requestAnimationFrame(resolve));
  const dimensions = rasterDimensions(entry.size.width, entry.size.height, settings);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: selectedBackground() === "transparent" });
  const background = selectedBackground();
  if (background !== "transparent") {
    context.fillStyle = background === "white" ? "#ffffff" : background === "black" ? "#000000" : elements.color.value;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const image = await loadImage(entry.previewUrl);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let blob = await canvasBlob(canvas, elements.outputFormat.value);
  if (elements.outputFormat.value === "png") {
    const density = settings.mode === "dpi" ? Number(settings.dpi) : 96;
    blob = new Blob([addPngDensity(await blob.arrayBuffer(), density)], { type: "image/png" });
  }
  entry.resultBlob = blob;
  entry.resultUrl = URL.createObjectURL(blob);
  entry.outputWidth = dimensions.width;
  entry.outputHeight = dimensions.height;
  entry.status = "done";
}

function outputFiles(done) {
  const names = new Map();
  return done.map(entry => {
    let name = rasterizedName(entry.file.name, elements.outputFormat.value);
    const seen = names.get(name) || 0;
    names.set(name, seen + 1);
    if (seen) name = rasterizedName(entry.file.name, elements.outputFormat.value, `-${seen + 1}`);
    return new File([entry.resultBlob], name, { type: entry.resultBlob.type });
  });
}

async function runRasterizer() {
  if (!entries.length || running) return;
  const settings = options();
  try { rasterDimensions(entries[0].size.width, entries[0].size.height, settings); }
  catch { showToast(copy.invalidSize); return; }
  resetResults();
  running = true;
  cancelRequested = false;
  elements.cancel.disabled = false;
  render();
  let completed = 0;
  for (const entry of entries) {
    if (cancelRequested) break;
    try { await rasterizeEntry(entry, settings); completed += 1; }
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
  document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: outputFiles(done), source: "svg-rasterizer-result" } }));
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadAll() {
  const files = outputFiles(entries.filter(entry => entry.status === "done"));
  const zipEntries = [];
  for (const file of files) zipEntries.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
  if (zipEntries.length) downloadBlob(createZip(zipEntries), "shiagent-rasterized-images.zip");
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
elements.run.addEventListener("click", runRasterizer);
elements.cancel.addEventListener("click", () => { cancelRequested = true; elements.cancel.disabled = true; });
elements.downloadAll.addEventListener("click", downloadAll);
elements.width.addEventListener("input", () => { lastDimensionChanged = "width"; syncAspect("width"); resetResults(); render(); });
elements.height.addEventListener("input", () => { lastDimensionChanged = "height"; syncAspect("height"); resetResults(); render(); });
elements.keepAspect.addEventListener("change", () => { syncAspect(); resetResults(); render(); });
elements.modeGrid.addEventListener("change", () => { syncAspect(); resetResults(); render(); });
for (const element of [elements.scale, elements.dpi, elements.outputFormat, elements.quality, elements.background, elements.color]) element.addEventListener("change", () => { resetResults(); render(); });
elements.list.addEventListener("click", event => {
  const remove = event.target.closest("[data-remove]");
  if (remove) removeEntry(remove.dataset.remove);
  const download = event.target.closest("[data-download]");
  if (download) {
    const entry = entries.find(item => item.id === download.dataset.download);
    if (entry?.resultBlob) downloadBlob(entry.resultBlob, rasterizedName(entry.file.name, elements.outputFormat.value));
  }
});
window.addEventListener("beforeunload", () => entries.forEach(disposeEntry));
render();
