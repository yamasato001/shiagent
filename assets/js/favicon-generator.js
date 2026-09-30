import { formatBytes } from "./png-core.js";
import { createZipBlob, decodeBrowserImage, encodeBrowserCanvas } from "./browser-runtime.js";
import { detectImageFormat, formatLabel } from "./image-converter-core.js";
import { parseSvgSize } from "./svg-rasterizer-core.js";
import { createIco, createManifest, faviconLinks, iconPlacement, ICON_SPECS } from "./favicon-generator-core.js";
import { locale, pick } from "./i18n.js";
import faviconText from "./i18n/favicon-generator.js";

const copy = pick(faviconText);
const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), drop: $("#dropZone"), select: $("#selectButton"), clear: $("#clearButton"), source: $("#sourcePanel"), sourcePreview: $("#sourcePreview"), sourceName: $("#sourceName"), sourceMeta: $("#sourceMeta"),
  generate: $("#generateButton"), progress: $("#progressText"), results: $("#resultsPanel"), status: $("#resultStatus"), list: $("#resultList"), count: $("#generatedCount"), total: $("#generatedTotal"), downloadAll: $("#downloadAllButton"),
  fit: $("#fitMode"), padding: $("#paddingInput"), paddingValue: $("#paddingValue"), background: $("#backgroundMode"), colorField: $("#customColorField"), color: $("#backgroundColor"), appName: $("#appName"), themeColor: $("#themeColor"), snippet: $("#linkSnippet"), copy: $("#copySnippetButton"), toast: $("#toast")
};

let sourceEntry = null;
let results = [];
let running = false;
let toastTimer;
const selectedFit = () => document.querySelector('input[name="fitMode"]:checked')?.value || "cover";
const selectedBackground = () => document.querySelector('input[name="backgroundMode"]:checked')?.value || "white";

function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2800); }

function sanitizeSvg(source, size) {
  const documentNode = new DOMParser().parseFromString(source, "image/svg+xml");
  if (documentNode.querySelector("parsererror") || documentNode.documentElement.localName !== "svg") throw new Error(copy.invalidSvg);
  const root = documentNode.documentElement;
  for (const element of [...root.querySelectorAll("script,foreignObject,iframe,object,embed,audio,video")]) element.remove();
  for (const element of [root, ...root.querySelectorAll("*")]) for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase(), value = attribute.value.trim();
    if (name.startsWith("on") || ((name === "href" || name === "xlink:href") && !/^(?:#|data:image\/)/i.test(value)) || (name === "style" && /(?:@import|url\(\s*['\"]?(?:https?:|\/\/))/i.test(value))) element.removeAttribute(attribute.name);
  }
  for (const style of root.querySelectorAll("style")) style.textContent = style.textContent.replace(/@import[\s\S]*?;/gi, "").replace(/url\(\s*(['\"]?)(?:https?:|\/\/)[^)]+\)/gi, "none");
  root.setAttribute("width", String(size.width)); root.setAttribute("height", String(size.height));
  if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", size.viewBox.join(" "));
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(root);
}

function disposeSource() { if (sourceEntry?.previewUrl) URL.revokeObjectURL(sourceEntry.previewUrl); sourceEntry = null; }
function disposeResults() { results.forEach(result => { if (result.url) URL.revokeObjectURL(result.url); }); results = []; }

async function addFile(file) {
  if (!file || running) return;
  disposeSource(); disposeResults();
  try {
    if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
      const original = await file.text(), size = parseSvgSize(original), source = sanitizeSvg(original, size);
      const blob = new Blob([source], { type: "image/svg+xml" });
      sourceEntry = { file, format: "svg", width: size.width, height: size.height, previewUrl: URL.createObjectURL(blob) };
    } else {
      const format = detectImageFormat(await file.slice(0, 64).arrayBuffer());
      if (!["png", "jpeg", "webp"].includes(format)) throw new Error(copy.unsupported);
      const rasterCanvas = await decodeBrowserImage(file);
      if (rasterCanvas.width * rasterCanvas.height > 100_000_000) throw new Error(copy.tooLarge);
      sourceEntry = { file, format, width: rasterCanvas.width, height: rasterCanvas.height, rasterCanvas, previewUrl: URL.createObjectURL(file) };
    }
  } catch (error) { disposeSource(); showToast(error instanceof Error ? error.message : copy.unsupported); }
  elements.input.value = ""; render();
}

function clearAll() { if (running) return; disposeSource(); disposeResults(); elements.results.hidden = true; render(); }
function resetResults() { if (running) return; disposeResults(); elements.results.hidden = true; render(); }

function render() {
  elements.source.hidden = !sourceEntry;
  elements.generate.disabled = !sourceEntry || running;
  elements.clear.disabled = !sourceEntry || running;
  elements.colorField.hidden = selectedBackground() !== "custom";
  elements.paddingValue.textContent = `${elements.padding.value}%`;
  for (const element of [elements.select, elements.fit, elements.padding, elements.background, elements.color, elements.appName, elements.themeColor]) element.disabled = running;
  if (sourceEntry) {
    elements.sourcePreview.src = sourceEntry.previewUrl;
    elements.sourceName.textContent = sourceEntry.file.name;
    elements.sourceMeta.textContent = `${formatLabel(sourceEntry.format)} · ${Math.round(sourceEntry.width)} × ${Math.round(sourceEntry.height)}px · ${formatBytes(sourceEntry.file.size, locale)}`;
  } else elements.sourcePreview.removeAttribute("src");
}

function loadSvgImage(url) {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(copy.invalidSvg)); image.src = url; });
}

async function drawableSource() {
  if (sourceEntry.rasterCanvas) return sourceEntry.rasterCanvas;
  return loadSvgImage(sourceEntry.previewUrl);
}

function canvasToPng(canvas) { return encodeBrowserCanvas(canvas, "image/png").catch(() => { throw new Error(copy.encodeFailed); }); }

async function makeIcon(drawable, spec) {
  const canvas = document.createElement("canvas"); canvas.width = spec.size; canvas.height = spec.size;
  const context = canvas.getContext("2d", { alpha: selectedBackground() === "transparent" });
  const background = selectedBackground();
  if (background !== "transparent") { context.fillStyle = background === "white" ? "#ffffff" : elements.color.value; context.fillRect(0, 0, spec.size, spec.size); }
  const padding = Math.max(Number(elements.padding.value), spec.padding || 0);
  const placement = iconPlacement(sourceEntry.width, sourceEntry.height, spec.size, { fit: selectedFit(), padding });
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
  context.drawImage(drawable, placement.sx, placement.sy, placement.sw, placement.sh, placement.dx, placement.dy, placement.dw, placement.dh);
  const blob = await canvasToPng(canvas);
  return { ...spec, blob, url: URL.createObjectURL(blob), type: "image/png" };
}

async function generate() {
  if (!sourceEntry || running) return;
  disposeResults(); running = true; elements.progress.textContent = copy.processing; render();
  try {
    const drawable = await drawableSource();
    for (const spec of ICON_SPECS) { results.push(await makeIcon(drawable, spec)); elements.progress.textContent = `${results.length} / ${ICON_SPECS.length}`; await new Promise(resolve => requestAnimationFrame(resolve)); }
    const faviconPngs = [];
    for (const size of [16, 32, 48]) { const result = results.find(item => item.size === size && item.group === "favicon"); faviconPngs.push({ size, data: new Uint8Array(await result.blob.arrayBuffer()) }); }
    const icoBytes = createIco(faviconPngs);
    results.unshift({ name: "favicon.ico", size: 48, group: "ico", blob: new Blob([icoBytes], { type: "image/x-icon" }), url: results.find(item => item.size === 48 && item.group === "favicon").url, type: "image/x-icon", sharedUrl: true });
    const backgroundColor = selectedBackground() === "transparent" ? "#ffffff" : selectedBackground() === "white" ? "#ffffff" : elements.color.value;
    const manifest = createManifest({ name: elements.appName.value.trim() || "My App", themeColor: elements.themeColor.value, backgroundColor });
    results.push({ name: "site.webmanifest", group: "file", blob: new Blob([manifest], { type: "application/manifest+json" }), type: "application/manifest+json" });
    results.push({ name: "favicon-links.html", group: "file", blob: new Blob([faviconLinks()], { type: "text/html" }), type: "text/html" });
    elements.snippet.value = faviconLinks(); renderResults();
    document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: outputFiles(), source: "favicon-generator-result" } }));
  } catch (error) { console.error(error); showToast(error instanceof Error ? error.message : copy.encodeFailed); }
  finally { running = false; elements.progress.textContent = ""; render(); }
}

function previewLabel(result) {
  if (result.group === "ico") return "ICO · 16 / 32 / 48px";
  if (result.group === "file") return result.type.includes("manifest") ? "PWA manifest" : "HTML snippet";
  return `${result.size} × ${result.size}px${result.group === "maskable" ? " · MASKABLE" : ""}`;
}

function renderResults() {
  elements.results.hidden = false; elements.status.textContent = copy.completed(results.length); elements.count.textContent = String(results.length);
  elements.total.textContent = formatBytes(results.reduce((sum, result) => sum + result.blob.size, 0), locale);
  elements.list.innerHTML = results.map((result, index) => `<article class="favicon-result-card"><div class="favicon-preview ${result.group === "file" ? "is-file" : ""}">${result.url ? `<img src="${result.url}" alt="">` : `<span>${result.name.endsWith("manifest") ? "JSON" : "HTML"}</span>`}</div><div><strong>${result.name}</strong><small>${previewLabel(result)} · ${formatBytes(result.blob.size, locale)}</small><button class="button button-light" type="button" data-download="${index}">${copy.download}</button></div></article>`).join("");
  elements.results.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function outputFiles() { return results.map(result => new File([result.blob], result.name, { type: result.type || result.blob.type })); }
function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function downloadAll() { const entries = []; for (const file of outputFiles()) entries.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) }); if (entries.length) downloadBlob(createZipBlob(entries, undefined, { applySuffix: false }), "shiagent-favicon-package.zip"); }

elements.select.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); }); elements.input.addEventListener("change", () => addFile(elements.input.files?.[0]));
elements.drop.addEventListener("click", event => { if (!event.target.closest("button")) elements.input.click(); }); elements.drop.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); elements.input.click(); } });
elements.drop.addEventListener("dragover", event => { event.preventDefault(); elements.drop.classList.add("is-over"); }); elements.drop.addEventListener("dragleave", () => elements.drop.classList.remove("is-over")); elements.drop.addEventListener("drop", event => { event.preventDefault(); elements.drop.classList.remove("is-over"); addFile(event.dataTransfer.files?.[0]); });
elements.clear.addEventListener("click", clearAll); elements.generate.addEventListener("click", generate); elements.downloadAll.addEventListener("click", downloadAll);
for (const element of [elements.fit, elements.padding, elements.background, elements.color, elements.appName, elements.themeColor]) element.addEventListener("change", resetResults);
elements.padding.addEventListener("input", render); elements.background.addEventListener("change", render);
elements.list.addEventListener("click", event => { const button = event.target.closest("[data-download]"); if (button) { const result = results[Number(button.dataset.download)]; if (result) downloadBlob(result.blob, result.name); } });
elements.copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(elements.snippet.value); showToast(copy.copied); } catch { showToast(copy.copyFailed); } });
window.addEventListener("beforeunload", () => { disposeSource(); disposeResults(); }); render();
