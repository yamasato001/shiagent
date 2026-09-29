import { PDFDocument, degrees } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import { createZip } from "../assets/js/png-core.js";
import { detectRasterOrientation, detectTextOrientation, interleaveGroups, PDF_MODE_FEATURES, rotateAngle, safePdfName, selectPageIndexes } from "../assets/js/pdf-core.js";
import { clearPdfTray, mountPdfTray, readPdfTray, replacePdfTray } from "../assets/js/pdf-tray.js";
import { readTray } from "../assets/js/work-tray.js";
import { chooseOutputDirectory, supportsFolderDownload, writeFilesToDirectory } from "../assets/js/folder-download.js";

GlobalWorkerOptions.workerSrc = "/assets/dist/pdf.worker.min.mjs";

const root = document.querySelector("#pdfWorkspaceRoot");
const lang = document.documentElement.lang === "ja" ? "ja" : "en";
const mode = document.body.dataset.pdfMode || "merge";
const ja = lang === "ja";
const text = ja ? {
  add: "PDF・画像を追加", drop: "PDFをここにドロップ", dropImage: "画像をここにドロップ", or: "または", choose: "ファイルを選択",
  note: "PDFは端末内で処理され、サーバーには送信されません。", pages: "ページ", clear: "すべてクリア", empty: "PDFを追加するとページがここに表示されます。",
  select: "出力ページ", all: "すべて", selected: "選択中", odd: "奇数ページ", even: "偶数ページ", range: "ページ指定", rangeHelp: "例: 1-3, 7, 10",
  output: "出力方法", combined: "1つのPDF", separate: "1ページずつZIP", filename: "保存名", reverse: "出力を逆順にする", pageSize: "画像の用紙", auto: "画像サイズ", a4p: "A4 縦", a4l: "A4 横",
  export: "PDFを書き出す", exporting: "PDFを作成中…", load: "ページを読み込み中…", rotateLeft: "左回転", rotateRight: "右回転", remove: "削除",
  autoOrient: "文章の上下を自動判定", autoHelp: "文字情報を優先し、画像PDFは画素配置から判定します。低確信度のページは確認してください。", analyzing: "文章の向きを解析中…", analyzed: (count, review) => `${count}ページを自動補正しました${review ? ` · ${review}ページは要確認` : ""}`, confidence: { high: "高", medium: "中", low: "要確認" }, detected: "自動判定",
  exportModes: { merge: "PDFを結合", split: "PDFを分割", reorder: "並べ替えて保存", interleave: "交互結合して保存", rotate: "回転して保存", "delete-pages": "削除して保存", "images-to-pdf": "PDFを作成" },
  invalid: "出力するページがありません。", failed: "PDFを処理できませんでした。破損やパスワード保護を確認してください。", imageFailed: "この画像をPDFへ変換できませんでした。",
  complete: count => `${count}ページを書き出しました`, count: count => `${count}ページ`, trayLoaded: count => `PDF作業トレイから${count}件を読み込みました`,
  folderExport: "フォルダに直接保存", folderSaving: (done, total) => `フォルダへ保存中… ${done}/${total}`, folderComplete: count => `${count}件をフォルダへ保存しました`,
  modes: { merge: "PDF結合", split: "PDF分割", reorder: "PDFページ並べ替え", interleave: "PDF交互結合", rotate: "PDF向き自動判定・回転", "delete-pages": "PDFページ削除", "images-to-pdf": "画像 → PDF" }
} : {
  add: "Add PDFs or images", drop: "Drop PDFs here", dropImage: "Drop images here", or: "or", choose: "Choose files",
  note: "PDFs are processed on your device and never uploaded.", pages: "Pages", clear: "Clear all", empty: "Add a PDF to see its pages here.",
  select: "Pages to export", all: "All pages", selected: "Selected pages", odd: "Odd pages", even: "Even pages", range: "Page range", rangeHelp: "e.g. 1-3, 7, 10",
  output: "Output", combined: "One PDF", separate: "One PDF per page (ZIP)", filename: "File name", reverse: "Reverse output order", pageSize: "Image page size", auto: "Image size", a4p: "A4 portrait", a4l: "A4 landscape",
  export: "Export PDF", exporting: "Building PDF…", load: "Loading pages…", rotateLeft: "Rotate left", rotateRight: "Rotate right", remove: "Delete",
  autoOrient: "Auto-detect text orientation", autoHelp: "Uses the text layer first, then page pixels for scanned PDFs. Review low-confidence pages.", analyzing: "Analyzing text orientation…", analyzed: (count, review) => `Auto-corrected ${count} pages${review ? ` · review ${review}` : ""}`, confidence: { high: "High", medium: "Medium", low: "Review" }, detected: "Auto",
  exportModes: { merge: "Merge PDF", split: "Split PDF", reorder: "Save reordered PDF", interleave: "Save interleaved PDF", rotate: "Save rotated PDF", "delete-pages": "Save without deleted pages", "images-to-pdf": "Create PDF" },
  invalid: "There are no pages to export.", failed: "Could not process this PDF. Check whether it is damaged or password-protected.", imageFailed: "Could not convert this image to PDF.",
  complete: count => `Exported ${count} pages`, count: count => `${count} pages`, trayLoaded: count => `Loaded ${count} files from the PDF tray`,
  folderExport: "Save directly to folder", folderSaving: (done, total) => `Saving to folder… ${done}/${total}`, folderComplete: count => `Saved ${count} files to the folder`,
  modes: { merge: "Merge PDF", split: "Split PDF", reorder: "Reorder PDF Pages", interleave: "Interleave PDFs", rotate: "Auto Detect & Rotate PDF", "delete-pages": "Delete PDF Pages", "images-to-pdf": "Images to PDF" }
};

const acceptsImages = mode === "images-to-pdf";
const features = PDF_MODE_FEATURES[mode] || PDF_MODE_FEATURES.merge;
root.innerHTML = `<section class="pdf-workspace" aria-labelledby="pdfWorkspaceTitle">
  <div class="pdf-drop" id="pdfDrop" tabindex="0" role="button"><input id="pdfInput" type="file" accept="${acceptsImages ? "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" : "application/pdf,.pdf"}" multiple hidden><span aria-hidden="true">＋</span><h2 id="pdfWorkspaceTitle">${acceptsImages ? text.dropImage : text.drop}</h2><p>${text.or}</p><button class="button button-dark" id="pdfChoose" type="button">${text.choose}</button><small>${text.note}</small><p class="pdf-load-status" id="pdfLoadStatus" role="status"></p></div>
  <div class="pdf-toolbar" hidden><div><strong>${text.modes[mode]}</strong><span id="pdfPageCount"></span></div><div><button class="button button-light" id="pdfAdd" type="button">＋ ${text.add}</button><button class="text-button" id="pdfClear" type="button">${text.clear}</button></div></div>
  <div class="pdf-body" hidden><aside class="pdf-options">
    <label ${features.selection ? "" : "hidden"}>${text.select}<select id="pdfSelection"><option value="all">${text.all}</option><option value="selected">${text.selected}</option><option value="odd">${text.odd}</option><option value="even">${text.even}</option><option value="range">${text.range}</option></select></label>
    <label id="pdfRangeWrap" hidden>${text.range}<input id="pdfRange" type="text" placeholder="${text.rangeHelp}"></label>
    <label ${features.output ? "" : "hidden"}>${text.output}<select id="pdfOutput"><option value="combined">${text.combined}</option><option value="separate" ${mode === "split" ? "selected" : ""}>${text.separate}</option></select></label>
    <label>${text.filename}<input id="pdfName" type="text" value="shiagent" maxlength="80"></label>
    ${acceptsImages ? `<label>${text.pageSize}<select id="pdfImageSize"><option value="auto">${text.auto}</option><option value="a4p">${text.a4p}</option><option value="a4l">${text.a4l}</option></select></label>` : ""}
    <label class="pdf-check" ${features.reverse ? "" : "hidden"}><input id="pdfReverse" type="checkbox"><span>${text.reverse}</span></label>
    ${features.autoOrient ? `<div class="pdf-auto-orient"><button class="button button-light" id="pdfAutoOrient" type="button">↥ ${text.autoOrient}</button><small>${text.autoHelp}</small></div>` : ""}
    <button class="button button-accent" id="pdfExport" type="button">${text.exportModes[mode] || text.export} <span>→</span></button>${mode === "split" && supportsFolderDownload(window) ? `<button class="button button-light" id="pdfFolderExport" type="button">${text.folderExport}</button>` : ""}<p id="pdfStatus" role="status"></p>
  </aside><section class="pdf-pages-wrap"><p class="pdf-empty" id="pdfEmpty">${text.empty}</p><div class="pdf-pages" id="pdfPages"></div></section></div>
</section>`;

const $ = selector => root.querySelector(selector);
const elements = {
  input: $("#pdfInput"), drop: $("#pdfDrop"), choose: $("#pdfChoose"), add: $("#pdfAdd"), clear: $("#pdfClear"), toolbar: $(".pdf-toolbar"), body: $(".pdf-body"),
  pages: $("#pdfPages"), empty: $("#pdfEmpty"), count: $("#pdfPageCount"), selection: $("#pdfSelection"), range: $("#pdfRange"), rangeWrap: $("#pdfRangeWrap"),
  output: $("#pdfOutput"), name: $("#pdfName"), reverse: $("#pdfReverse"), imageSize: $("#pdfImageSize"), autoOrient: $("#pdfAutoOrient"), export: $("#pdfExport"), folderExport: $("#pdfFolderExport"), status: $("#pdfStatus"), loadStatus: $("#pdfLoadStatus")
};
let sources = [];
let pages = [];
let sourceId = 0;
let pageId = 0;
let busy = false;
let draggedId = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function setStatus(message, error = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("is-error", error);
  elements.loadStatus.textContent = message;
  elements.loadStatus.classList.toggle("is-error", error);
}

function setBusy(value) {
  busy = value;
  for (const control of root.querySelectorAll("button, input, select")) control.disabled = value;
}

function render() {
  const active = pages.length > 0;
  elements.drop.hidden = active;
  elements.toolbar.hidden = !active;
  elements.body.hidden = !active;
  elements.empty.hidden = active;
  elements.count.textContent = text.count(pages.length);
  elements.pages.innerHTML = pages.map((page, index) => {
    const confidence = page.orientation?.confidence >= 0.85 ? "high" : page.orientation?.confidence >= 0.6 ? "medium" : "low";
    const actions = features.actions.map(action => action === "left" ? `<button type="button" data-action="left" title="${text.rotateLeft}" aria-label="${text.rotateLeft}">↶</button>` : action === "right" ? `<button type="button" data-action="right" title="${text.rotateRight}" aria-label="${text.rotateRight}">↷</button>` : `<button type="button" data-action="remove" title="${text.remove}" aria-label="${text.remove}">×</button>`).join("");
    return `<article class="pdf-page ${page.selected ? "is-selected" : ""} ${features.draggable ? "is-draggable" : ""}" draggable="${features.draggable}" data-id="${page.id}" tabindex="0" aria-label="${text.pages} ${index + 1}">
    <div class="pdf-page-preview"><img src="${page.thumbnail}" alt="" style="transform:rotate(${page.rotation}deg)"><span>${index + 1}</span>${page.orientation ? `<b class="pdf-orientation-badge is-${confidence}">${text.detected} · ${text.confidence[confidence]}</b>` : ""}</div><strong title="${escapeHtml(page.sourceName)}">${escapeHtml(page.sourceName)}</strong><small>${page.sourceType === "pdf" ? `${page.sourcePage + 1}` : `${page.width} × ${page.height}`}${page.rotation ? ` · ${page.rotation}°` : ""}</small>
    ${actions ? `<div class="pdf-page-actions" style="--pdf-actions:${features.actions.length}">${actions}</div>` : ""}
  </article>`;
  }).join("");
}

async function orientationForPdfPage(pdfPage) {
  const viewport = pdfPage.getViewport({ scale: 1 });
  const content = await pdfPage.getTextContent({ disableNormalization: false });
  const textResult = detectTextOrientation(content.items, viewport.transform);
  if (textResult.usable) return textResult;
  const scale = Math.min(1.35, 720 / viewport.width, 920 / viewport.height);
  const rasterViewport = pdfPage.getViewport({ scale });
  const canvas = root.ownerDocument.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(rasterViewport.width));
  canvas.height = Math.max(1, Math.ceil(rasterViewport.height));
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  await pdfPage.render({ canvasContext: context, viewport: rasterViewport }).promise;
  return detectRasterOrientation(context.getImageData(0, 0, canvas.width, canvas.height));
}

async function autoOrientPages() {
  if (busy || !pages.length) return;
  setBusy(true);
  const documents = new Map();
  const results = new Map();
  let corrected = 0;
  let review = 0;
  try {
    for (let index = 0; index < pages.length; index += 1) {
      const model = pages[index];
      if (model.sourceType !== "pdf") continue;
      setStatus(`${text.analyzing} ${index + 1}/${pages.length}`);
      const key = `${model.sourceId}:${model.sourcePage}`;
      let result = results.get(key);
      if (!result) {
        const source = sources.find(item => item.id === model.sourceId);
        if (!documents.has(source.id)) documents.set(source.id, await getDocument({ data: source.bytes.slice() }).promise);
        const pdfPage = await documents.get(source.id).getPage(model.sourcePage + 1);
        result = await orientationForPdfPage(pdfPage);
        pdfPage.cleanup();
        results.set(key, result);
      }
      model.rotation = result.usable ? result.correction : 0;
      model.orientation = result;
      if (model.rotation) corrected += 1;
      if (!result.usable || result.confidence < 0.6) review += 1;
      render();
    }
    setStatus(text.analyzed(corrected, review));
  } catch (error) {
    console.error(error);
    setStatus(text.failed, true);
  } finally {
    for (const document of documents.values()) {
      if (typeof document.destroy === "function") await document.destroy().catch(() => {});
      else if (typeof document.cleanup === "function") document.cleanup();
    }
    setBusy(false);
    render();
  }
}

async function thumbnailForPdf(document, pageNumber) {
  const page = await document.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(0.5, 180 / base.width) });
  const target = root.ownerDocument.createElement("canvas");
  target.width = Math.ceil(viewport.width);
  target.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: target.getContext("2d", { alpha: false }), viewport }).promise;
  page.cleanup();
  return { thumbnail: target.toDataURL("image/jpeg", 0.72), width: base.width, height: base.height };
}

async function addPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const previewDocument = await getDocument({ data: bytes.slice() }).promise;
  const source = { id: ++sourceId, file, bytes, models: [] };
  sources.push(source);
  try {
    for (let pageNumber = 1; pageNumber <= previewDocument.numPages; pageNumber += 1) {
      setStatus(`${text.load} ${pageNumber}/${previewDocument.numPages}`);
      const preview = await thumbnailForPdf(previewDocument, pageNumber);
      const model = { id: ++pageId, sourceId: source.id, sourceType: "pdf", sourceName: file.name, sourcePage: pageNumber - 1, rotation: 0, selected: false, ...preview };
      source.models.push(model);
      if (mode === "interleave") syncPdfPages();
      else pages.push(model);
      render();
    }
  } catch (error) {
    sources = sources.filter(item => item !== source);
    if (mode === "interleave") syncPdfPages();
    else pages = pages.filter(page => page.sourceId !== source.id);
    throw error;
  } finally {
    if (typeof previewDocument.destroy === "function") await previewDocument.destroy();
    else if (typeof previewDocument.cleanup === "function") previewDocument.cleanup();
  }
}

function syncPdfPages() {
  pages = interleaveGroups(sources.filter(source => source.models).map(source => source.models));
}

async function addImage(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const bitmap = await createImageBitmap(file);
  const canvas = root.ownerDocument.createElement("canvas");
  const scale = Math.min(1, 180 / bitmap.width, 220 / bitmap.height);
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const source = { id: ++sourceId, file, bytes, mime: file.type, width: bitmap.width, height: bitmap.height };
  sources.push(source);
  pages.push({ id: ++pageId, sourceId: source.id, sourceType: "image", sourceName: file.name, sourcePage: 0, rotation: 0, selected: false, thumbnail: canvas.toDataURL("image/jpeg", 0.75), width: bitmap.width, height: bitmap.height });
  bitmap.close();
}

async function addFiles(fileList, fromTray = false) {
  if (busy) return;
  setBusy(true);
  setStatus(text.load);
  const files = [...fileList];
  const pdfFiles = files.filter(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name));
  try {
    for (const file of files) {
      if (acceptsImages && file.type.startsWith("image/")) await addImage(file);
      else if (!acceptsImages && (file.type === "application/pdf" || /\.pdf$/i.test(file.name))) await addPdf(file);
    }
    if (!acceptsImages) {
      if (mode === "interleave") syncPdfPages();
      if (!fromTray && pdfFiles.length) await replacePdfTray(sources.filter(source => source.file?.type === "application/pdf").map(source => source.file));
    }
    setStatus(fromTray ? text.trayLoaded(pdfFiles.length) : "");
  } catch (error) {
    console.error(error);
    setStatus(acceptsImages ? text.imageFailed : text.failed, true);
  } finally {
    elements.input.value = "";
    setBusy(false);
    render();
  }
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function pngBytes(source) {
  if (source.mime === "image/png") return source.bytes;
  const bitmap = await createImageBitmap(source.file);
  const canvas = root.ownerDocument.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(text.imageFailed)), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

function imagePageBox(source) {
  if (elements.imageSize?.value === "a4p") return [595.28, 841.89];
  if (elements.imageSize?.value === "a4l") return [841.89, 595.28];
  return [source.width, source.height];
}

async function buildPdf(models) {
  const output = await PDFDocument.create();
  const loaded = new Map();
  for (const model of models) {
    const source = sources.find(item => item.id === model.sourceId);
    if (model.sourceType === "pdf") {
      if (!loaded.has(source.id)) loaded.set(source.id, await PDFDocument.load(source.bytes, { ignoreEncryption: false }));
      const [page] = await output.copyPages(loaded.get(source.id), [model.sourcePage]);
      page.setRotation(degrees(rotateAngle(page.getRotation().angle, model.rotation)));
      output.addPage(page);
    } else {
      const image = source.mime === "image/jpeg" ? await output.embedJpg(source.bytes) : await output.embedPng(await pngBytes(source));
      const [width, height] = imagePageBox(source);
      const page = output.addPage([width, height]);
      const scale = Math.min(width / image.width, height / image.height);
      const drawWidth = image.width * scale, drawHeight = image.height * scale;
      page.drawImage(image, { x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight });
      page.setRotation(degrees(model.rotation));
    }
  }
  output.setProducer("SHIAGENT");
  output.setCreator("SHIAGENT PDF Tools");
  return new Uint8Array(await output.save({ useObjectStreams: true }));
}

async function exportPdf() {
  if (!pages.length || busy) return;
  let indexes = selectPageIndexes(pages.length, elements.selection.value, elements.range.value, pages.map((page, index) => page.selected ? index : -1));
  if (features.reverse && elements.reverse.checked) indexes.reverse();
  const models = indexes.map(index => pages[index]).filter(Boolean);
  if (!models.length) { setStatus(text.invalid, true); return; }
  setBusy(true);
  setStatus(text.exporting);
  try {
    const name = safePdfName(elements.name.value);
    const trayFiles = [];
    if (elements.output.value === "separate") {
      const files = [];
      for (let index = 0; index < models.length; index += 1) {
        const outputName = name.replace(/\.pdf$/, `_${String(index + 1).padStart(2, "0")}.pdf`);
        const data = await buildPdf([models[index]]);
        files.push({ name: outputName, data });
        trayFiles.push(new File([data], outputName, { type: "application/pdf" }));
      }
      download(createZip(files), name.replace(/\.pdf$/, ".zip"));
    } else {
      const data = await buildPdf(models);
      download(new Blob([data], { type: "application/pdf" }), name);
      trayFiles.push(new File([data], name, { type: "application/pdf" }));
    }
    await replacePdfTray(trayFiles);
    setStatus(text.complete(models.length));
  } catch (error) {
    console.error(error);
    setStatus(text.failed, true);
  } finally {
    setBusy(false);
  }
}

async function exportPdfFolder() {
  if (!pages.length || busy || !elements.folderExport) return;
  let directory;
  try { directory = await chooseOutputDirectory(window); }
  catch (error) { if (error?.name !== "AbortError") setStatus(text.failed, true); return; }
  const indexes = selectPageIndexes(pages.length, elements.selection.value, elements.range.value, pages.map((page, index) => page.selected ? index : -1));
  const models = indexes.map(index => pages[index]).filter(Boolean);
  if (!models.length) { setStatus(text.invalid, true); return; }
  setBusy(true);
  try {
    const base = safePdfName(elements.name.value);
    const files = [];
    for (let index = 0; index < models.length; index += 1) files.push({ name: base.replace(/\.pdf$/, `_${String(index + 1).padStart(2, "0")}.pdf`), blob: new Blob([await buildPdf([models[index]])], { type: "application/pdf" }) });
    const count = await writeFilesToDirectory(directory, files, (done, total) => setStatus(text.folderSaving(done, total)));
    setStatus(text.folderComplete(count));
  } catch (error) { console.error(error); setStatus(text.failed, true); }
  finally { setBusy(false); }
}

async function clearAll() {
  if (busy) return;
  sources = [];
  pages = [];
  if (!acceptsImages) await clearPdfTray().catch(() => {});
  setStatus("");
  render();
}

elements.choose.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); });
elements.add.addEventListener("click", () => elements.input.click());
elements.input.addEventListener("change", () => addFiles(elements.input.files));
elements.drop.addEventListener("click", () => elements.input.click());
elements.drop.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") elements.input.click(); });
for (const eventName of ["dragenter", "dragover"]) elements.drop.addEventListener(eventName, event => { event.preventDefault(); elements.drop.classList.add("is-over"); });
for (const eventName of ["dragleave", "drop"]) elements.drop.addEventListener(eventName, event => { event.preventDefault(); elements.drop.classList.remove("is-over"); });
elements.drop.addEventListener("drop", event => addFiles(event.dataTransfer.files));
elements.clear.addEventListener("click", clearAll);
elements.selection.addEventListener("change", () => { elements.rangeWrap.hidden = elements.selection.value !== "range"; });
elements.export.addEventListener("click", exportPdf);
elements.folderExport?.addEventListener("click", exportPdfFolder);
elements.output.addEventListener("change", () => { if (elements.folderExport) elements.folderExport.hidden = elements.output.value !== "separate"; });
elements.autoOrient?.addEventListener("click", autoOrientPages);
elements.pages.addEventListener("click", event => {
  const card = event.target.closest(".pdf-page");
  if (!card || busy) return;
  const index = pages.findIndex(page => page.id === Number(card.dataset.id));
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "remove") {
    const [removed] = pages.splice(index, 1);
    const source = sources.find(item => item.id === removed?.sourceId);
    if (source?.models) source.models = source.models.filter(model => model.id !== removed.id);
  }
  else if (action === "left") { pages[index].rotation = rotateAngle(pages[index].rotation, -90); pages[index].orientation = null; }
  else if (action === "right") { pages[index].rotation = rotateAngle(pages[index].rotation, 90); pages[index].orientation = null; }
  else if (features.selectable) pages[index].selected = !pages[index].selected;
  render();
});
elements.pages.addEventListener("dragstart", event => { if (!features.draggable) { event.preventDefault(); return; } draggedId = Number(event.target.closest(".pdf-page")?.dataset.id); });
elements.pages.addEventListener("dragover", event => { if (features.draggable) event.preventDefault(); });
elements.pages.addEventListener("drop", event => {
  if (!features.draggable) return;
  event.preventDefault();
  const targetId = Number(event.target.closest(".pdf-page")?.dataset.id);
  const from = pages.findIndex(page => page.id === draggedId), to = pages.findIndex(page => page.id === targetId);
  if (from >= 0 && to >= 0 && from !== to) pages.splice(to, 0, pages.splice(from, 1)[0]);
  render();
});

mountPdfTray(document.querySelector("#pdfTrayRoot"), { lang });
render();
if (!acceptsImages) readPdfTray().then(files => { if (files.length) addFiles(files, true); }).catch(() => {});
else if (new URLSearchParams(location.search).has("tray")) readTray().then(files => { if (files.length) addFiles(files, true); }).catch(() => {});
