import { PDFDocument } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import { createWorker } from "tesseract.js";
import { createZipBlob } from "../assets/js/browser-runtime.js";
import { detectRasterOrientation, detectTextOrientation, detectWhiteContentBounds, rotateAngle, safePdfName } from "../assets/js/pdf-core.js";
import { mountPdfTray, readPdfTray, replacePdfTray } from "../assets/js/pdf-tray.js";
import { readTray } from "../assets/js/work-tray.js";

GlobalWorkerOptions.workerSrc = "/assets/dist/pdf.worker.min.mjs";

const root = document.querySelector("#scanPdfWorkflowRoot");
const trayRoot = document.querySelector("#pdfTrayRoot");
const ja = document.documentElement.lang === "ja";
const copy = ja ? {
  drop: "スキャンPDF・画像をここにドロップ", or: "または", choose: "ファイルを選択", note: "PDF / PNG / JPEG / WebP・複数ファイル対応・端末内処理",
  settings: "仕上げ設定", language: "OCR言語", both: "日本語＋英語", japanese: "日本語", english: "英語", quality: "出力品質", recommended: "おすすめ・150 DPI", high: "画質優先・200 DPI", padding: "内容の周囲に残す余白（mm）", base: "保存ファイル名", start: "開始番号", digits: "桁数",
  files: "処理するファイル", add: "追加", clear: "すべてクリア", run: "検索・共有用PDFを作成", processing: "処理中", ready: "Ready", done: "完了", failed: "エラー", remove: "削除",
  preparing: "OCRエンジンを準備しています", rendering: (name, page, total) => `${name}：${page}/${total}ページを整えています`, recognizing: (page, total) => `${page}/${total}ページをOCRしています`, assembling: "PDFを組み立てています", complete: count => `${count}件の検索可能PDFを作成しました`, error: "処理できませんでした。破損・パスワード保護・非対応形式を確認してください。",
  download: "PDFを保存", downloadAll: "結果をまとめて保存", result: "処理結果", local: "向き補正、余白除去、OCR、軽量化、文書情報削除はすべて端末内で行われます。",
  imageGroup: "画像をまとめたPDF", pages: count => `${count}ページ`, size: bytes => formatBytes(bytes, "ja-JP")
} : {
  drop: "Drop scanned PDFs or images here", or: "or", choose: "Choose files", note: "PDF / PNG / JPEG / WebP · multiple files · on-device",
  settings: "Finishing settings", language: "OCR language", both: "Japanese + English", japanese: "Japanese", english: "English", quality: "Output quality", recommended: "Recommended · 150 DPI", high: "Quality first · 200 DPI", padding: "Padding around content (mm)", base: "Output file name", start: "Starting number", digits: "Digits",
  files: "Files to process", add: "Add", clear: "Clear all", run: "Create searchable PDFs", processing: "Processing", ready: "Ready", done: "Complete", failed: "Error", remove: "Remove",
  preparing: "Preparing the OCR engine", rendering: (name, page, total) => `${name}: refining page ${page} of ${total}`, recognizing: (page, total) => `OCR page ${page} of ${total}`, assembling: "Assembling PDF", complete: count => `Created ${count} searchable PDFs`, error: "Could not process the files. Check for damage, password protection or an unsupported format.",
  download: "Save PDF", downloadAll: "Download all results", result: "Results", local: "Orientation, cropping, OCR, compression and metadata cleanup all run on this device.",
  imageGroup: "Combined image PDF", pages: count => `${count} pages`, size: bytes => formatBytes(bytes, "en-US")
};

root.innerHTML = `<section class="scan-pdf-workspace">
  <div class="pdf-drop" id="scanPdfDrop" tabindex="0" role="button"><input id="scanPdfInput" type="file" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" multiple hidden><span aria-hidden="true">＋</span><h2>${copy.drop}</h2><p>${copy.or}</p><button class="button button-dark" id="scanPdfChoose" type="button">${copy.choose}</button><small>${copy.note}</small></div>
  <div class="scan-pdf-main" id="scanPdfMain" hidden>
    <div class="pdf-toolbar"><div><strong>${copy.files}</strong><span id="scanPdfCount"></span></div><div><button class="button button-light" id="scanPdfAdd" type="button">＋ ${copy.add}</button><button class="text-button" id="scanPdfClear" type="button">${copy.clear}</button></div></div>
    <div class="scan-pdf-files" id="scanPdfFiles"></div>
    <div class="settings-panel scan-pdf-settings">
      <div class="setting-heading"><div><span class="setting-number">02</span><h2>${copy.settings}</h2></div></div>
      <div class="scan-pdf-setting-grid">
        <label>${copy.language}<select id="scanPdfLanguage"><option value="jpn+eng">${copy.both}</option><option value="jpn">${copy.japanese}</option><option value="eng">${copy.english}</option></select></label>
        <label>${copy.quality}<select id="scanPdfQuality"><option value="150" selected>${copy.recommended}</option><option value="200">${copy.high}</option></select></label>
        <label>${copy.padding}<input id="scanPdfPadding" type="number" value="3" min="0" max="30" step="0.5"></label>
        <label>${copy.base}<input id="scanPdfBase" type="text" value="scan" maxlength="80"></label>
        <label>${copy.start}<input id="scanPdfStart" type="number" value="1" min="0" max="999999"></label>
        <label>${copy.digits}<select id="scanPdfDigits"><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option></select></label>
      </div>
      <small>${copy.local}</small>
    </div>
    <div class="scan-pdf-actions"><div><strong id="scanPdfStatus"></strong><progress id="scanPdfProgress" max="1" value="0"></progress></div><button class="button button-accent" id="scanPdfRun" type="button">${copy.run}<span>→</span></button></div>
    <section class="scan-pdf-results" id="scanPdfResults" hidden><div class="results-heading"><div><span class="setting-number">03</span><h2>${copy.result}</h2></div><button class="button button-dark" id="scanPdfDownloadAll" type="button">${copy.downloadAll}</button></div><div id="scanPdfResultList"></div></section>
  </div>
</section>`;

const $ = selector => root.querySelector(selector);
const elements = { drop: $("#scanPdfDrop"), input: $("#scanPdfInput"), choose: $("#scanPdfChoose"), main: $("#scanPdfMain"), count: $("#scanPdfCount"), add: $("#scanPdfAdd"), clear: $("#scanPdfClear"), files: $("#scanPdfFiles"), language: $("#scanPdfLanguage"), quality: $("#scanPdfQuality"), padding: $("#scanPdfPadding"), base: $("#scanPdfBase"), start: $("#scanPdfStart"), digits: $("#scanPdfDigits"), run: $("#scanPdfRun"), status: $("#scanPdfStatus"), progress: $("#scanPdfProgress"), results: $("#scanPdfResults"), resultList: $("#scanPdfResultList"), downloadAll: $("#scanPdfDownloadAll") };
let sources = [];
let results = [];
let running = false;
let worker = null;

function formatBytes(bytes, locale) { return bytes < 1024 ** 2 ? `${(bytes / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} KB` : `${(bytes / 1024 ** 2).toLocaleString(locale, { maximumFractionDigits: 2 })} MB`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function isPdf(file) { return file.type === "application/pdf" || /\.pdf$/i.test(file.name); }
function isImage(file) { return /^image\/(png|jpeg|webp)$/i.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name); }
function status(value) { elements.status.textContent = value; }
function setBusy(value) { running = value; for (const control of root.querySelectorAll("button,input,select")) control.disabled = value; }
function outputName(index) { const base = String(elements.base.value || "scan").trim().replace(/[\\/:*?"<>|]+/g, "-") || "scan"; const number = String(Number(elements.start.value || 1) + index).padStart(Number(elements.digits.value || 3), "0"); return safePdfName(`${base}-${number}`); }

function render() {
  const active = sources.length > 0;
  elements.drop.hidden = active; elements.main.hidden = !active; elements.count.textContent = String(sources.length);
  elements.files.innerHTML = sources.map((source, index) => `<article class="scan-pdf-file"><div><strong>${escapeHtml(source.name)}</strong><small>${source.kind === "images" ? copy.pages(source.files.length) : copy.size(source.files[0].size)}</small></div><span class="is-${source.status}">${copy[source.status]}</span><button type="button" data-remove="${index}" aria-label="${copy.remove}">×</button></article>`).join("");
  elements.results.hidden = results.length === 0;
  elements.resultList.innerHTML = results.map((result, index) => `<article><div><strong>${escapeHtml(result.file.name)}</strong><small>${copy.pages(result.pages)} · ${copy.size(result.file.size)}</small></div><button class="button button-light" type="button" data-download="${index}">${copy.download}</button></article>`).join("");
}

function addFiles(fileList) {
  if (running) return;
  const accepted = [...fileList].filter(file => isPdf(file) || isImage(file));
  const pdfs = accepted.filter(isPdf);
  const images = accepted.filter(isImage);
  for (const file of pdfs) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!sources.some(source => source.key === key)) sources.push({ key, kind: "pdf", name: file.name, files: [file], status: "ready" });
  }
  if (images.length) {
    const fresh = images.filter(file => !sources.some(source => source.files.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)));
    if (fresh.length) {
      const group = sources.find(source => source.kind === "images");
      if (group) group.files.push(...fresh);
      else sources.push({ key: "images", kind: "images", name: copy.imageGroup, files: fresh, status: "ready" });
    }
  }
  results = []; elements.input.value = ""; render();
}

async function imageCanvas(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true }); context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0); bitmap.close();
  return canvas;
}

function rotatedCanvas(source, degrees) {
  const turn = ((degrees % 360) + 360) % 360;
  if (!turn) return source;
  const swap = turn === 90 || turn === 270;
  const canvas = document.createElement("canvas"); canvas.width = swap ? source.height : source.width; canvas.height = swap ? source.width : source.height;
  const context = canvas.getContext("2d", { alpha: false }); context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.translate(canvas.width / 2, canvas.height / 2); context.rotate(turn * Math.PI / 180); context.drawImage(source, -source.width / 2, -source.height / 2);
  source.width = 1; source.height = 1; return canvas;
}

function croppedCanvas(source, paddingMm, dpi) {
  const context = source.getContext("2d", { alpha: false, willReadFrequently: true });
  const bounds = detectWhiteContentBounds(context.getImageData(0, 0, source.width, source.height));
  if (!bounds) return source;
  const padding = Math.round(Number(paddingMm || 0) * dpi / 25.4);
  const left = Math.max(0, Math.floor(bounds.left * source.width) - padding), top = Math.max(0, Math.floor(bounds.top * source.height) - padding);
  const right = Math.min(source.width, Math.ceil((1 - bounds.right) * source.width) + padding), bottom = Math.min(source.height, Math.ceil((1 - bounds.bottom) * source.height) + padding);
  if (left === 0 && top === 0 && right === source.width && bottom === source.height) return source;
  const canvas = document.createElement("canvas"); canvas.width = Math.max(1, right - left); canvas.height = Math.max(1, bottom - top);
  const target = canvas.getContext("2d", { alpha: false }); target.fillStyle = "#fff"; target.fillRect(0, 0, canvas.width, canvas.height); target.drawImage(source, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  source.width = 1; source.height = 1; return canvas;
}

async function pdfPageCanvas(documentProxy, pageNumber, dpi) {
  const page = await documentProxy.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const content = await page.getTextContent({ disableNormalization: false });
  let orientation = detectTextOrientation(content.items, base.transform);
  if (!orientation.usable) {
    const probeViewport = page.getViewport({ scale: Math.min(1.2, 800 / Math.max(base.width, base.height)) });
    const probe = document.createElement("canvas"); probe.width = Math.ceil(probeViewport.width); probe.height = Math.ceil(probeViewport.height);
    const probeContext = probe.getContext("2d", { alpha: false, willReadFrequently: true }); probeContext.fillStyle = "#fff"; probeContext.fillRect(0, 0, probe.width, probe.height); await page.render({ canvasContext: probeContext, viewport: probeViewport, background: "#fff" }).promise;
    orientation = detectRasterOrientation(probeContext.getImageData(0, 0, probe.width, probe.height)); probe.width = 1; probe.height = 1;
  }
  let scale = dpi / 72; scale = Math.min(scale, 3600 / Math.max(base.width, base.height), Math.sqrt(12_000_000 / Math.max(1, base.width * base.height)));
  const viewport = page.getViewport({ scale, rotation: rotateAngle(page.rotate, orientation.usable ? orientation.correction : 0) });
  const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false }); context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); await page.render({ canvasContext: context, viewport, background: "#fff" }).promise; page.cleanup();
  return canvas;
}

async function sourceCanvases(source, dpi) {
  if (source.kind === "images") return Promise.all(source.files.map(imageCanvas));
  const bytes = new Uint8Array(await source.files[0].arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;
  const canvases = [];
  try { for (let page = 1; page <= pdf.numPages; page += 1) { status(copy.rendering(source.name, page, pdf.numPages)); canvases.push(await pdfPageCanvas(pdf, page, dpi)); elements.progress.value = page / Math.max(1, pdf.numPages) * .35; } }
  finally { if (typeof pdf.destroy === "function") await pdf.destroy().catch(() => {}); else if (typeof pdf.cleanup === "function") pdf.cleanup(); }
  return canvases;
}

async function processSource(source, sourceIndex) {
  source.status = "processing"; render();
  const dpi = Number(elements.quality.value || 150);
  const rawCanvases = await sourceCanvases(source, dpi);
  const output = await PDFDocument.create();
  for (let index = 0; index < rawCanvases.length; index += 1) {
    let canvas = rawCanvases[index];
    if (source.kind === "images") {
      const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
      const orientation = detectRasterOrientation(context.getImageData(0, 0, canvas.width, canvas.height));
      canvas = rotatedCanvas(canvas, orientation.usable ? orientation.correction : 0);
    }
    canvas = croppedCanvas(canvas, elements.padding.value, dpi);
    status(copy.recognizing(index + 1, rawCanvases.length));
    await worker.setParameters({ user_defined_dpi: String(dpi), preserve_interword_spaces: "1" });
    const recognized = await worker.recognize(canvas, { pdfTitle: outputName(sourceIndex), pdfTextOnly: false }, { pdf: true, text: true });
    const pagePdf = await PDFDocument.load(new Uint8Array(recognized.data.pdf));
    const [page] = await output.copyPages(pagePdf, [0]); output.addPage(page);
    canvas.width = 1; canvas.height = 1;
    elements.progress.value = .35 + (index + 1) / Math.max(1, rawCanvases.length) * .65;
  }
  status(copy.assembling);
  output.setTitle(""); output.setAuthor(""); output.setSubject(""); output.setKeywords([]); output.setCreator("SHIAGENT"); output.setProducer("SHIAGENT local scan optimizer");
  const bytes = await output.save({ useObjectStreams: true });
  const file = new File([bytes], outputName(sourceIndex), { type: "application/pdf" });
  source.status = "done"; return { file, pages: rawCanvases.length };
}

async function run() {
  if (running || !sources.length) return;
  results = []; setBusy(true); elements.progress.value = 0; status(copy.preparing);
  try {
    worker = await createWorker(elements.language.value.split("+"), 1, { workerPath: "/assets/dist/ocr/worker.min.js", corePath: "/assets/dist/ocr/core", langPath: "/assets/dist/ocr/lang", cacheMethod: "write" });
    for (let index = 0; index < sources.length; index += 1) {
      try { results.push(await processSource(sources[index], index)); }
      catch (error) { console.error(error); sources[index].status = "failed"; }
      render();
    }
    if (!results.length) throw new Error("NO_RESULTS");
    await replacePdfTray(results.map(result => result.file)); status(copy.complete(results.length)); render();
  } catch (error) { console.error(error); status(copy.error); }
  finally { if (worker) await worker.terminate().catch(() => {}); worker = null; setBusy(false); render(); }
}

function download(blob, name = blob.name) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
function downloadAll() { if (results.length === 1) return download(results[0].file); download(createZipBlob(results.map(result => ({ name: result.file.name, data: result.file }))), "shiagent-searchable-pdfs.zip"); }

elements.choose.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); });
elements.add.addEventListener("click", () => elements.input.click());
elements.input.addEventListener("change", () => addFiles(elements.input.files));
elements.drop.addEventListener("click", event => { if (!event.target.closest("button")) elements.input.click(); });
elements.drop.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.input.click(); } });
for (const name of ["dragenter", "dragover"]) elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.add("is-over"); });
for (const name of ["dragleave", "drop"]) elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.remove("is-over"); });
elements.drop.addEventListener("drop", event => addFiles(event.dataTransfer.files));
elements.clear.addEventListener("click", () => { if (!running) { sources = []; results = []; status(""); render(); } });
elements.files.addEventListener("click", event => { const index = Number(event.target.closest("[data-remove]")?.dataset.remove); if (Number.isInteger(index) && !running) { sources.splice(index, 1); results = []; render(); } });
elements.resultList.addEventListener("click", event => { const index = Number(event.target.closest("[data-download]")?.dataset.download); if (results[index]) download(results[index].file); });
elements.run.addEventListener("click", run); elements.downloadAll.addEventListener("click", downloadAll);

mountPdfTray(trayRoot, { lang: ja ? "ja" : "en" }); render();
Promise.all([readPdfTray().catch(() => []), new URLSearchParams(location.search).has("tray") ? readTray().catch(() => []) : Promise.resolve([])]).then(([pdfs, images]) => addFiles([...pdfs, ...images]));
