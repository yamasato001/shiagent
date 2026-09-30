import { formatBytes } from "./png-core.js";
import { createZipBlob, decodeBrowserImage, encodeBrowserCanvas } from "./browser-runtime.js";
import { detectImageFormat, formatLabel } from "./image-converter-core.js";
import { colorOutputName, processColorPixels, transformCssColor, transformCssText } from "./color-tool-core.js";
import { locale, pick } from "./i18n.js";
import colorText from "./i18n/color-tool.js";

const copy = pick(colorText);
const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), drop: $("#dropZone"), select: $("#selectButton"), add: $("#addButton"), clear: $("#clearButton"), removeAll: $("#removeAllButton"),
  queue: $("#queuePanel"), list: $("#fileList"), count: $("#fileCount"), run: $("#processButton"), cancel: $("#cancelButton"), progress: $("#progressText"),
  results: $("#resultsPanel"), resultStatus: $("#resultStatus"), before: $("#beforeTotal"), after: $("#afterTotal"), resultCount: $("#processedCount"), downloadAll: $("#downloadAllButton"),
  modeGrid: $("#colorModeGrid"), targetControls: $("#targetControls"), replacementField: $("#replacementField"), thresholdField: $("#thresholdField"),
  target: $("#targetColor"), targetHex: $("#targetHex"), replacement: $("#replacementColor"), replacementHex: $("#replacementHex"), tolerance: $("#toleranceInput"), toleranceValue: $("#toleranceValue"),
  threshold: $("#thresholdInput"), thresholdValue: $("#thresholdValue"), outputFormat: $("#outputFormat"), quality: $("#qualityInput"), whitePreset: $("#whiteTransparentPreset"), blackPreset: $("#blackReplacePreset"), toast: $("#toast")
};

let entries = [];
let running = false;
let cancelRequested = false;
let toastTimer;
const PAINT_ATTRIBUTES = new Set(["fill", "stroke", "color", "stop-color", "flood-color", "lighting-color"]);

const selectedMode = () => document.querySelector('input[name="colorMode"]:checked')?.value || "transparent";
const isSvg = file => file.type === "image/svg+xml" || /\.svg$/i.test(file.name);

function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2800); }
function escapeHtml(value) { return value.replace(/[&<>\"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]); }

function options() {
  return { mode: selectedMode(), target: elements.target.value, replacement: elements.replacement.value, tolerance: Number(elements.tolerance.value), threshold: Number(elements.threshold.value) };
}

function sanitizeSvg(source) {
  const documentNode = new DOMParser().parseFromString(source, "image/svg+xml");
  if (documentNode.querySelector("parsererror") || documentNode.documentElement.localName !== "svg") throw new Error("Invalid SVG");
  const root = documentNode.documentElement;
  for (const element of [...root.querySelectorAll("script,foreignObject,iframe,object,embed,audio,video")]) element.remove();
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase(), value = attribute.value.trim();
      if (name.startsWith("on") || ((name === "href" || name === "xlink:href") && !/^(?:#|data:image\/)/i.test(value)) || (name === "style" && /(?:@import|url\(\s*['\"]?(?:https?:|\/\/))/i.test(value))) element.removeAttribute(attribute.name);
    }
  }
  for (const style of root.querySelectorAll("style")) style.textContent = style.textContent.replace(/@import[\s\S]*?;/gi, "").replace(/url\(\s*(['\"]?)(?:https?:|\/\/)[^)]+\)/gi, "none");
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(root);
}

function transformSvg(source, settings) {
  const documentNode = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = documentNode.documentElement;
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (PAINT_ATTRIBUTES.has(name)) attribute.value = transformCssColor(attribute.value, settings, "none");
      else if (name === "style") attribute.value = transformCssText(attribute.value, settings);
    }
    if (element.localName === "style") element.textContent = transformCssText(element.textContent, settings);
  }
  return new XMLSerializer().serializeToString(root);
}

function disposeEntry(entry) { if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl); if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl); }
function resetResults() {
  elements.results.hidden = true;
  for (const entry of entries) {
    if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
    Object.assign(entry, { resultBlob: null, resultUrl: null, outputFormat: null, status: "ready", error: null });
  }
}

async function addFiles(fileList) {
  if (running) return;
  let rejected = false, duplicate = false;
  for (const file of fileList) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (entries.some(entry => entry.key === key)) { duplicate = true; continue; }
    try {
      if (isSvg(file)) {
        const source = sanitizeSvg(await file.text());
        entries.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, key, file, format: "svg", source, previewUrl: URL.createObjectURL(new Blob([source], { type: "image/svg+xml" })), status: "ready" });
      } else {
        const format = detectImageFormat(await file.slice(0, 64).arrayBuffer());
        if (!["png", "jpeg", "webp"].includes(format)) { rejected = true; continue; }
        entries.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, key, file, format, previewUrl: URL.createObjectURL(file), status: "ready" });
      }
    } catch { showToast(copy.invalidSvg(file.name)); }
  }
  if (rejected) showToast(copy.unsupported); else if (duplicate) showToast(copy.duplicate);
  elements.input.value = ""; resetResults(); render();
}

function removeEntry(id) { if (running) return; const index = entries.findIndex(entry => entry.id === id); if (index < 0) return; disposeEntry(entries[index]); entries.splice(index, 1); resetResults(); render(); }
function clearEntries() { if (running) return; entries.forEach(disposeEntry); entries = []; elements.results.hidden = true; render(); }

function render() {
  const mode = selectedMode();
  elements.targetControls.hidden = !["transparent", "replace"].includes(mode);
  elements.replacementField.hidden = mode !== "replace";
  elements.thresholdField.hidden = mode !== "monochrome";
  elements.toleranceValue.textContent = `±${elements.tolerance.value}`;
  elements.thresholdValue.textContent = elements.threshold.value;
  elements.quality.disabled = elements.outputFormat.value !== "webp" || running;
  elements.queue.hidden = entries.length === 0; elements.count.textContent = copy.files(entries.length); elements.run.disabled = !entries.length || running;
  for (const element of [elements.select, elements.add, elements.clear, elements.removeAll, elements.target, elements.targetHex, elements.replacement, elements.replacementHex, elements.tolerance, elements.threshold, elements.outputFormat]) element.disabled = running;
  elements.modeGrid.disabled = running; elements.cancel.hidden = !running; elements.run.hidden = running;
  elements.list.innerHTML = entries.map(entry => {
    const output = entry.resultBlob ? `${entry.outputFormat.toUpperCase()} · ${formatBytes(entry.resultBlob.size, locale)}` : `${formatLabel(entry.format)} · ${formatBytes(entry.file.size, locale)}`;
    const action = entry.resultBlob ? `<div class="file-result"><button class="button button-light file-download" type="button" data-download="${entry.id}">${copy.download}</button></div>` : `<button class="icon-button" type="button" data-remove="${entry.id}" aria-label="${copy.remove}">×</button>`;
    return `<article class="file-row converter-file-row ${entry.resultBlob ? "has-result" : ""}"><img class="file-thumb" src="${entry.resultUrl || entry.previewUrl}" alt=""><div class="file-main"><span class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span><span class="file-meta">${escapeHtml(output)}</span>${entry.error ? `<small class="converter-error">${escapeHtml(entry.error)}</small>` : ""}</div><span class="file-status ${entry.status}">${copy.status[entry.status] || copy.status.ready}</span>${action}</article>`;
  }).join("");
}

async function encodeCanvas(canvas, format) {
  const mime = format === "webp" ? "image/webp" : "image/png";
  const blob = await encodeBrowserCanvas(canvas, mime, Number(elements.quality.value) / 100).catch(() => { throw new Error(copy.encodeFailed); });
  if (format === "webp" && blob.type !== mime) throw new Error(copy.webpUnsupported);
  return blob;
}

async function processEntry(entry, settings) {
  entry.status = "processing"; render(); await new Promise(resolve => requestAnimationFrame(resolve));
  if (entry.format === "svg") {
    const source = transformSvg(entry.source, settings);
    entry.resultBlob = new Blob([source], { type: "image/svg+xml" });
    entry.outputFormat = "svg";
  } else {
    const canvas = await decodeBrowserImage(entry.file, { willReadFrequently: true });
    if (canvas.width > 32767 || canvas.height > 32767 || canvas.width * canvas.height > 100_000_000) throw new Error(copy.tooLarge);
    const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    imageData.data.set(processColorPixels(imageData.data, settings)); context.putImageData(imageData, 0, 0);
    entry.outputFormat = elements.outputFormat.value;
    entry.resultBlob = await encodeCanvas(canvas, entry.outputFormat);
  }
  entry.resultUrl = URL.createObjectURL(entry.resultBlob); entry.status = "done";
}

function outputFiles(done) {
  const names = new Map();
  return done.map(entry => {
    let name = colorOutputName(entry.file.name, entry.outputFormat), seen = names.get(name) || 0;
    names.set(name, seen + 1); if (seen) name = name.replace(/(\.[^.]*)$/, `-${seen + 1}$1`);
    return new File([entry.resultBlob], name, { type: entry.resultBlob.type });
  });
}

async function run() {
  if (!entries.length || running) return;
  resetResults(); running = true; cancelRequested = false; elements.cancel.disabled = false; render();
  let completed = 0;
  for (const entry of entries) {
    if (cancelRequested) break;
    try { await processEntry(entry, options()); completed += 1; } catch (error) { entry.status = "error"; entry.error = error instanceof Error ? error.message : String(error); }
    elements.progress.textContent = copy.progress(completed, entries.length); render();
  }
  running = false; const done = entries.filter(entry => entry.status === "done"); render();
  if (cancelRequested) showToast(copy.cancelled); if (!done.length) return;
  elements.resultStatus.textContent = copy.completed(done.length, entries.length);
  elements.before.textContent = formatBytes(done.reduce((sum, entry) => sum + entry.file.size, 0), locale);
  elements.after.textContent = formatBytes(done.reduce((sum, entry) => sum + entry.resultBlob.size, 0), locale);
  elements.resultCount.textContent = copy.files(done.length); elements.results.hidden = false; elements.results.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: outputFiles(done), source: "color-tool-result" } }));
}

function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function downloadAll() { const files = outputFiles(entries.filter(entry => entry.status === "done")), zipEntries = []; for (const file of files) zipEntries.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) }); if (zipEntries.length) downloadBlob(createZipBlob(zipEntries), "shiagent-color-results.zip"); }

function setMode(mode) { const radio = document.querySelector(`input[name="colorMode"][value="${mode}"]`); if (radio) radio.checked = true; resetResults(); render(); }
function syncColor(input, text) { text.value = input.value.toUpperCase(); }
function applyHex(text, input) { if (/^#[0-9a-f]{6}$/i.test(text.value.trim())) { input.value = text.value.trim(); resetResults(); render(); } else text.value = input.value.toUpperCase(); }

elements.select.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); }); elements.add.addEventListener("click", () => elements.input.click());
elements.input.addEventListener("change", () => addFiles(elements.input.files).catch(error => showToast(error.message)));
elements.drop.addEventListener("click", event => { if (!event.target.closest("button")) elements.input.click(); }); elements.drop.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); elements.input.click(); } });
elements.drop.addEventListener("dragover", event => { event.preventDefault(); elements.drop.classList.add("is-over"); }); elements.drop.addEventListener("dragleave", () => elements.drop.classList.remove("is-over")); elements.drop.addEventListener("drop", event => { event.preventDefault(); elements.drop.classList.remove("is-over"); addFiles(event.dataTransfer.files).catch(error => showToast(error.message)); });
elements.clear.addEventListener("click", clearEntries); elements.removeAll.addEventListener("click", clearEntries); elements.run.addEventListener("click", run); elements.cancel.addEventListener("click", () => { cancelRequested = true; elements.cancel.disabled = true; }); elements.downloadAll.addEventListener("click", downloadAll);
elements.modeGrid.addEventListener("change", () => { resetResults(); render(); }); elements.outputFormat.addEventListener("change", () => { resetResults(); render(); }); elements.quality.addEventListener("change", () => { resetResults(); render(); });
elements.target.addEventListener("input", () => { syncColor(elements.target, elements.targetHex); resetResults(); }); elements.replacement.addEventListener("input", () => { syncColor(elements.replacement, elements.replacementHex); resetResults(); });
elements.targetHex.addEventListener("change", () => applyHex(elements.targetHex, elements.target)); elements.replacementHex.addEventListener("change", () => applyHex(elements.replacementHex, elements.replacement));
elements.tolerance.addEventListener("input", () => { resetResults(); render(); }); elements.threshold.addEventListener("input", () => { resetResults(); render(); });
elements.whitePreset.addEventListener("click", () => { elements.target.value = "#ffffff"; syncColor(elements.target, elements.targetHex); setMode("transparent"); });
elements.blackPreset.addEventListener("click", () => { elements.target.value = "#000000"; elements.replacement.value = "#ff3b30"; syncColor(elements.target, elements.targetHex); syncColor(elements.replacement, elements.replacementHex); setMode("replace"); });
elements.list.addEventListener("click", event => { const remove = event.target.closest("[data-remove]"); if (remove) removeEntry(remove.dataset.remove); const download = event.target.closest("[data-download]"); if (download) { const entry = entries.find(item => item.id === download.dataset.download); if (entry?.resultBlob) downloadBlob(entry.resultBlob, colorOutputName(entry.file.name, entry.outputFormat)); } });
window.addEventListener("beforeunload", () => entries.forEach(disposeEntry)); render();
