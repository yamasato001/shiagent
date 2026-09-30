import { PDFDocument, degrees } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import { createZipBlob } from "../assets/js/browser-runtime.js";
import { chooseOutputDirectory, supportsFolderDownload, writeFilesToDirectory } from "../assets/js/folder-download.js";
import { detectRasterOrientation, detectTextOrientation, rotateAngle, safePdfName } from "../assets/js/pdf-core.js";
import { pageNumberCandidatesFromText, resolvePageNumberSequence, sequenceIssues, sortPagesByDetectedNumber } from "../assets/js/pdf-page-number-core.js";
import { recognizeEdgePageNumbers } from "../assets/js/pdf-edge-ocr.js";
import { clearPdfTray, mountPdfTray, readPdfTray, replacePdfTray } from "../assets/js/pdf-tray.js";

GlobalWorkerOptions.workerSrc = "/assets/dist/pdf.worker.min.mjs";

const root = document.querySelector("#pdfPageOrderRoot");
const ja = document.documentElement.lang === "ja";
const copy = ja ? {
  drop: "PDFをここにドロップ", or: "または", choose: "PDFを選択", note: "複数PDF対応・ファイルは端末の外へ送信されません。",
  files: "処理するPDF", add: "PDFを追加", clear: "すべてクリア", run: "一括ワークフローを実行", running: "解析中…", downloadAll: "結果をまとめてダウンロード", folder: "フォルダに直接保存", folderSaving: (done, total) => `フォルダへ保存中… ${done}/${total}`, folderDone: count => `${count}件をフォルダへ保存しました`,
  ready: "待機中", processing: "処理中", done: "完了", error: "エラー", pages: count => `${count}ページ`, progress: (name, page, total) => `${name}：${page}/${total}ページを解析中`,
  detected: "検出番号", unknown: "未検出", high: "高", medium: "中", low: "要確認", rotateLeft: "左回転", rotateRight: "右回転", download: "PDFを保存",
  summary: (detected, total) => `${total}ページ中${detected}ページの番号を検出`, unresolved: count => `未検出 ${count}`, duplicate: values => `重複 ${values.join(", ")}`, gaps: values => `飛び番 ${values.map(([a, b]) => a === b ? a : `${a}-${b}`).join(", ")}`,
  complete: "向き補正とページ番号順への並べ替えが完了しました。赤い項目を確認してから保存してください。", failed: "PDFを処理できませんでした。破損やパスワード保護を確認してください。",
  noNumber: "番号なし", manualHint: "番号を修正すると、並び順へすぐ反映されます。空欄は番号なしとして扱います。"
} : {
  drop: "Drop PDFs here", or: "or", choose: "Choose PDFs", note: "Multiple PDFs supported. Files never leave your device.",
  files: "PDFs to process", add: "Add PDFs", clear: "Clear all", run: "Run the workflow", running: "Analyzing…", downloadAll: "Download all results", folder: "Save directly to folder", folderSaving: (done, total) => `Saving to folder… ${done}/${total}`, folderDone: count => `Saved ${count} files to the folder`,
  ready: "Ready", processing: "Processing", done: "Complete", error: "Error", pages: count => `${count} pages`, progress: (name, page, total) => `${name}: analyzing page ${page} of ${total}`,
  detected: "Detected number", unknown: "Not detected", high: "High", medium: "Medium", low: "Review", rotateLeft: "Rotate left", rotateRight: "Rotate right", download: "Save PDF",
  summary: (detected, total) => `Detected page numbers on ${detected} of ${total} pages`, unresolved: count => `${count} unresolved`, duplicate: values => `Duplicates: ${values.join(", ")}`, gaps: values => `Gaps: ${values.map(([a, b]) => a === b ? a : `${a}-${b}`).join(", ")}`,
  complete: "Orientation correction and page-number sorting are complete. Review red items before saving.", failed: "Could not process the PDF. Check whether it is damaged or password-protected.",
  noNumber: "No number", manualHint: "Editing a number updates the order immediately. Leave it blank for an unnumbered page."
};

root.innerHTML = `<section class="pdf-order-workspace">
  <div class="pdf-drop" id="pdfOrderDrop" tabindex="0" role="button"><input id="pdfOrderInput" type="file" accept="application/pdf,.pdf" multiple hidden><span aria-hidden="true">＋</span><h2>${copy.drop}</h2><p>${copy.or}</p><button class="button button-dark" id="pdfOrderChoose" type="button">${copy.choose}</button><small>${copy.note}</small></div>
  <div class="pdf-order-main" id="pdfOrderMain" hidden>
    <div class="pdf-order-toolbar"><div><strong>${copy.files}</strong><span id="pdfOrderCount"></span></div><div><button class="button button-light" id="pdfOrderAdd" type="button">＋ ${copy.add}</button><button class="text-button" id="pdfOrderClear" type="button">${copy.clear}</button></div></div>
    <div class="pdf-order-files" id="pdfOrderFiles"></div>
    <div class="pdf-order-run"><p id="pdfOrderStatus" role="status"></p><button class="button button-accent" id="pdfOrderRun" type="button">${copy.run} <span>→</span></button></div>
    <section class="pdf-order-results" id="pdfOrderResults" hidden><div class="pdf-order-result-head"><div><h2>${ja ? "判定・並べ替え結果" : "Detection & sorting results"}</h2><p>${copy.manualHint}</p></div><div class="pdf-order-result-actions"><button class="button button-accent" id="pdfOrderDownloadAll" type="button">${copy.downloadAll}</button>${supportsFolderDownload(window) ? `<button class="button button-light" id="pdfOrderFolder" type="button">${copy.folder}</button>` : ""}</div></div><div id="pdfOrderDocuments"></div></section>
  </div>
</section>`;

const $ = selector => root.querySelector(selector);
const elements = { drop: $("#pdfOrderDrop"), input: $("#pdfOrderInput"), choose: $("#pdfOrderChoose"), main: $("#pdfOrderMain"), count: $("#pdfOrderCount"), add: $("#pdfOrderAdd"), clear: $("#pdfOrderClear"), files: $("#pdfOrderFiles"), run: $("#pdfOrderRun"), status: $("#pdfOrderStatus"), results: $("#pdfOrderResults"), documents: $("#pdfOrderDocuments"), downloadAll: $("#pdfOrderDownloadAll"), folder: $("#pdfOrderFolder") };
let sources = [];
let nextSourceId = 0;
let running = false;

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function setStatus(value, error = false) { elements.status.textContent = value; elements.status.classList.toggle("is-error", error); }
function setBusy(value) { running = value; for (const control of root.querySelectorAll("button,input")) control.disabled = value; }

async function thumbnail(pdfPage) {
  const base = pdfPage.getViewport({ scale: 1 });
  const viewport = pdfPage.getViewport({ scale: Math.min(.48, 180 / base.width) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  await pdfPage.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport }).promise;
  return canvas.toDataURL("image/jpeg", .72);
}

async function addFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await getDocument({ data: bytes.slice() }).promise;
  const source = { id: ++nextSourceId, file, bytes, pageCount: document.numPages, status: "ready", originalPages: [], pages: [], issues: null, error: null };
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    setStatus(copy.progress(file.name, pageNumber, document.numPages));
    const page = await document.getPage(pageNumber);
    source.originalPages.push({ sourcePage: pageNumber - 1, thumbnail: await thumbnail(page), rotation: 0, detection: null, candidates: [] });
    page.cleanup();
  }
  source.pages = [...source.originalPages];
  if (typeof document.destroy === "function") await document.destroy();
  else if (typeof document.cleanup === "function") document.cleanup();
  sources.push(source);
}

async function addFiles(fileList, fromTray = false) {
  if (running) return;
  setBusy(true);
  try {
    for (const file of fileList) {
      if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) continue;
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (sources.some(source => source.key === key)) continue;
      await addFile(file);
      sources.at(-1).key = key;
    }
    if (!fromTray) await replacePdfTray(sources.map(source => source.file));
    setStatus("");
  } catch (error) {
    console.error(error); setStatus(copy.failed, true);
  } finally {
    elements.input.value = ""; setBusy(false); render();
  }
}

function confidenceName(value) { return value >= .85 ? "high" : value >= .6 ? "medium" : "low"; }
function issueSummary(source) {
  if (!source.issues) return "";
  const parts = [copy.summary(source.issues.detected, source.pageCount)];
  if (source.issues.unresolved) parts.push(copy.unresolved(source.issues.unresolved));
  if (source.issues.duplicates.length) parts.push(copy.duplicate(source.issues.duplicates));
  if (source.issues.gaps.length) parts.push(copy.gaps(source.issues.gaps));
  return parts.join(" · ");
}

function render() {
  const active = sources.length > 0;
  elements.drop.hidden = active; elements.main.hidden = !active; elements.results.hidden = !sources.some(source => source.status === "done");
  elements.count.textContent = `${sources.length}`;
  elements.files.innerHTML = sources.map(source => `<article class="pdf-order-file"><div><strong title="${escapeHtml(source.file.name)}">${escapeHtml(source.file.name)}</strong><small>${copy.pages(source.pageCount)}</small></div><span class="is-${source.status}">${copy[source.status]}</span><button type="button" data-remove-source="${source.id}" aria-label="${ja ? "削除" : "Remove"}">×</button></article>`).join("");
  elements.documents.innerHTML = sources.filter(source => source.status === "done").map(source => `<article class="pdf-order-document" data-source-id="${source.id}"><header><div><h3>${escapeHtml(source.file.name)}</h3><p class="${source.issues?.unresolved || source.issues?.duplicates.length ? "has-warning" : ""}">${escapeHtml(issueSummary(source))}</p></div><button class="button button-light" type="button" data-download-source="${source.id}">${copy.download}</button></header><div class="pdf-order-pages">${source.pages.map((page, index) => {
    const confidence = confidenceName(page.detection?.confidence || 0);
    const shownNumber = page.detection?.style === "roman" ? page.detection.raw : page.detection?.number;
    return `<article class="pdf-order-page" data-page="${page.sourcePage}"><div class="pdf-page-preview"><img src="${page.thumbnail}" alt="" style="transform:rotate(${page.rotation}deg)"><span>${index + 1}</span>${page.detection ? `<b class="pdf-orientation-badge is-${confidence}">${copy.detected} ${escapeHtml(shownNumber)} · ${copy[confidence]}</b>` : `<b class="pdf-orientation-badge is-low">${copy.unknown}</b>`}</div><label>${copy.detected}<input type="number" min="0" step="1" value="${page.detection?.number ?? ""}" placeholder="—" data-page-number ${running ? "disabled" : ""}></label><div class="pdf-order-page-actions"><button type="button" data-rotate="-90" title="${copy.rotateLeft}" ${running ? "disabled" : ""}>↶</button><button type="button" data-rotate="90" title="${copy.rotateRight}" ${running ? "disabled" : ""}>↷</button></div></article>`;
  }).join("")}</div></article>`).join("");
}

async function orientationForPage(page) {
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent({ disableNormalization: false });
  const textResult = detectTextOrientation(textContent.items, viewport.transform);
  if (textResult.usable) return { result: textResult, textContent };
  const scale = Math.min(1.25, 680 / viewport.width, 880 / viewport.height);
  const rasterViewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(rasterViewport.width); canvas.height = Math.ceil(rasterViewport.height);
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  await page.render({ canvasContext: context, viewport: rasterViewport }).promise;
  return { result: detectRasterOrientation(context.getImageData(0, 0, canvas.width, canvas.height)), textContent };
}

async function pageNumberCandidates(page, correction, textContent) {
  const rotation = rotateAngle(page.rotate, correction);
  const viewport = page.getViewport({ scale: 1, rotation });
  const textCandidates = pageNumberCandidatesFromText(textContent.items, viewport.transform, viewport.width, viewport.height);
  if (textCandidates.length) return textCandidates;
  const scale = Math.min(2.2, 1350 / viewport.width, 1650 / viewport.height);
  const rasterViewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(rasterViewport.width); canvas.height = Math.ceil(rasterViewport.height);
  await page.render({ canvasContext: canvas.getContext("2d", { alpha: false, willReadFrequently: true }), viewport: rasterViewport }).promise;
  return recognizeEdgePageNumbers(canvas);
}

function reorderSource(source) {
  const detections = source.originalPages.map(page => page.detection);
  source.pages = sortPagesByDetectedNumber(source.originalPages, detections).map(entry => entry.page);
  source.issues = sequenceIssues(detections);
}

async function processSource(source) {
  source.status = "processing"; source.error = null; render();
  const document = await getDocument({ data: source.bytes.slice() }).promise;
  try {
    const candidateLists = [];
    for (let index = 0; index < source.originalPages.length; index += 1) {
      setStatus(copy.progress(source.file.name, index + 1, source.pageCount));
      const pdfPage = await document.getPage(index + 1);
      const orientation = await orientationForPage(pdfPage);
      const model = source.originalPages[index];
      model.rotation = orientation.result.usable ? orientation.result.correction : 0;
      model.orientation = orientation.result;
      model.candidates = await pageNumberCandidates(pdfPage, model.rotation, orientation.textContent);
      candidateLists.push(model.candidates);
      pdfPage.cleanup(); render();
    }
    const detections = resolvePageNumberSequence(candidateLists);
    source.originalPages.forEach((page, index) => { page.detection = detections[index]; });
    reorderSource(source); source.status = "done";
  } finally {
    if (typeof document.destroy === "function") await document.destroy().catch(() => {});
    else if (typeof document.cleanup === "function") document.cleanup();
  }
}

async function runWorkflow() {
  if (running || !sources.length) return;
  setBusy(true); setStatus(copy.running);
  for (const source of sources) {
    try { await processSource(source); }
    catch (error) { console.error(error); source.status = "error"; source.error = error; }
    render();
  }
  const failed = sources.filter(source => source.status === "error").length;
  setStatus(failed ? copy.failed : copy.complete, failed > 0);
  setBusy(false); render();
  elements.results.hidden = !sources.some(source => source.status === "done");
  if (!elements.results.hidden) document.dispatchEvent(new CustomEvent("shiagent:output-options-ready"));
  if (!elements.results.hidden) elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function outputBytes(source) {
  const input = await PDFDocument.load(source.bytes, { ignoreEncryption: false });
  const output = await PDFDocument.create();
  for (const model of source.pages) {
    const [page] = await output.copyPages(input, [model.sourcePage]);
    page.setRotation(degrees(rotateAngle(page.getRotation().angle, model.rotation)));
    output.addPage(page);
  }
  output.setProducer("SHIAGENT"); output.setCreator("SHIAGENT PDF Page Order Workflow");
  return new Uint8Array(await output.save({ useObjectStreams: true }));
}

function outputName(source) { return safePdfName(source.file.name.replace(/\.pdf$/i, "") + "_sorted"); }
function download(blob, name) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1500); }
async function downloadSource(source) { download(new Blob([await outputBytes(source)], { type: "application/pdf" }), outputName(source)); }
async function downloadAll() {
  const done = sources.filter(source => source.status === "done");
  if (done.length === 1) return downloadSource(done[0]);
  const files = [];
  for (const source of done) files.push({ name: outputName(source), data: await outputBytes(source) });
  download(createZipBlob(files), "shiagent_sorted_pdfs.zip");
}
async function downloadFolder() {
  const done = sources.filter(source => source.status === "done");
  if (!done.length || running) return;
  let directory;
  try { directory = await chooseOutputDirectory(window); }
  catch (error) { if (error?.name !== "AbortError") setStatus(copy.failed, true); return; }
  elements.folder.disabled = true;
  try {
    const files = [];
    for (const source of done) files.push({ name: outputName(source), blob: new Blob([await outputBytes(source)], { type: "application/pdf" }) });
    const count = await writeFilesToDirectory(directory, files, (written, total) => setStatus(copy.folderSaving(written, total)));
    setStatus(copy.folderDone(count));
  } catch (error) { console.error(error); setStatus(copy.failed, true); }
  finally { elements.folder.disabled = false; }
}

async function clearAll() { if (running) return; sources = []; await clearPdfTray().catch(() => {}); setStatus(""); render(); }
elements.choose.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); });
elements.add.addEventListener("click", () => elements.input.click());
elements.input.addEventListener("change", () => addFiles(elements.input.files));
elements.drop.addEventListener("click", () => elements.input.click());
elements.drop.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.input.click(); } });
for (const name of ["dragenter", "dragover"]) elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.add("is-over"); });
for (const name of ["dragleave", "drop"]) elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.remove("is-over"); });
elements.drop.addEventListener("drop", event => addFiles(event.dataTransfer.files));
elements.clear.addEventListener("click", clearAll); elements.run.addEventListener("click", runWorkflow); elements.downloadAll.addEventListener("click", downloadAll);
elements.folder?.addEventListener("click", downloadFolder);
elements.files.addEventListener("click", event => { const id = Number(event.target.closest("[data-remove-source]")?.dataset.removeSource); if (!id || running) return; sources = sources.filter(source => source.id !== id); replacePdfTray(sources.map(source => source.file)).catch(() => {}); render(); });
elements.documents.addEventListener("click", event => {
  const source = sources.find(item => item.id === Number(event.target.closest("[data-source-id]")?.dataset.sourceId));
  if (!source) return;
  const downloadButton = event.target.closest("[data-download-source]"); if (downloadButton) { downloadSource(source); return; }
  const card = event.target.closest("[data-page]"); const delta = Number(event.target.closest("[data-rotate]")?.dataset.rotate);
  if (card && delta) { const page = source.originalPages.find(item => item.sourcePage === Number(card.dataset.page)); page.rotation = rotateAngle(page.rotation, delta); page.orientation = null; render(); }
});
elements.documents.addEventListener("change", event => {
  const input = event.target.closest("[data-page-number]"); if (!input) return;
  const source = sources.find(item => item.id === Number(input.closest("[data-source-id]")?.dataset.sourceId));
  const page = source?.originalPages.find(item => item.sourcePage === Number(input.closest("[data-page]")?.dataset.page));
  if (!page) return;
  const number = input.value === "" ? null : Number(input.value);
  page.detection = Number.isInteger(number) && number >= 0 ? { number, confidence: 1, method: "manual", edge: "manual", zone: "manual" } : null;
  reorderSource(source); render();
});

mountPdfTray(document.querySelector("#pdfTrayRoot"), { lang: ja ? "ja" : "en" });
render();
readPdfTray().then(files => { if (files.length) addFiles(files, true); }).catch(() => {});
