import { PDFDocument } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import { createWorker } from "tesseract.js";
import { hasUsefulPdfText, pdfOcrOutputName, pdfOcrPageIndexes, summarizePdfOcr } from "../assets/js/pdf-ocr-core.js";
import { mountPdfTray, readPdfTray, replacePdfTray } from "../assets/js/pdf-tray.js";

GlobalWorkerOptions.workerSrc = "/assets/dist/pdf.worker.min.mjs";

const root = document.querySelector("#pdfOcrRoot");
const trayRoot = document.querySelector("#pdfTrayRoot");
const language = document.documentElement.lang === "ja" ? "ja" : "en";
const ja = language === "ja";
const copy = ja ? {
  file: "PDFをここにドロップ", or: "または", note: "PDF・1ファイル・端末内処理", choose: "PDFを選択", replace: "変更", settings: "OCR設定", languages: "認識言語", japaneseEnglish: "日本語＋英語", japanese: "日本語", english: "英語", resolution: "OCR解像度", pages: "対象ページ", all: "すべてのページ", range: "ページ範囲", rangeHint: "例：1-5, 8, 10-12", skip: "既に検索可能なページは処理しない", run: "検索可能PDFを作成", stop: "中止", preparing: "OCRエンジンを準備しています", rendering: page => `${page}ページ目を描画しています`, recognizing: page => `${page}ページ目を認識しています`, preserving: page => `${page}ページ目の既存文字層を保持しています`, assembling: "PDFを組み立てています", ready: "検索可能PDFを作成しました", download: "PDFを保存", again: "別のPDFを処理", local: "PDF、OCRエンジン、言語モデルを含め、すべて端末内だけで処理されます。外部通信は行いません。", noFile: "PDFを選択してください。", invalidRange: "有効なページ範囲を入力してください。", failed: "OCR処理に失敗しました。PDFの破損またはパスワード保護を確認してください。", cancelled: "OCR処理を中止しました。", result: summary => `${summary.recognized}ページをOCR・${summary.preserved}ページを原本保持・${summary.characters.toLocaleString("ja-JP")}文字を認識`, confidence: value => `平均信頼度 ${Math.round(value)}%`, tray: "PDF作業トレイから読み込みました。", progress: value => `OCR ${Math.round(value * 100)}%`
} : {
  file: "Drop a PDF here", or: "or", note: "One PDF · processed on this device", choose: "Choose PDF", replace: "Replace", settings: "OCR settings", languages: "Recognition languages", japaneseEnglish: "Japanese + English", japanese: "Japanese", english: "English", resolution: "OCR resolution", pages: "Pages", all: "All pages", range: "Page range", rangeHint: "Example: 1-5, 8, 10-12", skip: "Preserve pages that already contain searchable text", run: "Create searchable PDF", stop: "Stop", preparing: "Preparing the OCR engine", rendering: page => `Rendering page ${page}`, recognizing: page => `Recognizing page ${page}`, preserving: page => `Preserving the existing text layer on page ${page}`, assembling: "Assembling the PDF", ready: "Your searchable PDF is ready", download: "Save PDF", again: "Process another PDF", local: "The PDF, OCR engine and language models all run on this device with no external connection.", noFile: "Choose a PDF first.", invalidRange: "Enter a valid page range.", failed: "OCR failed. Check for damage or password protection.", cancelled: "OCR was stopped.", result: summary => `${summary.recognized} pages OCRed · ${summary.preserved} pages preserved · ${summary.characters.toLocaleString("en-US")} characters recognized`, confidence: value => `Average confidence ${Math.round(value)}%`, tray: "Loaded a PDF from the work tray.", progress: value => `OCR ${Math.round(value * 100)}%`
};

root.innerHTML = `<section class="pdf-ocr-workspace">
  <div class="pdf-drop pdf-special-drop" id="pdfOcrDrop" tabindex="0" role="button"><input id="pdfOcrInput" type="file" accept="application/pdf,.pdf" hidden><span aria-hidden="true">＋</span><h2>${copy.file}</h2><p>${copy.or}</p><button class="button button-dark" id="pdfOcrChoose" type="button">${copy.choose}</button><small>${copy.note}</small><strong class="pdf-selected-file" id="pdfOcrFileName"></strong></div>
  <div class="settings-panel pdf-ocr-settings">
    <div class="setting-heading"><div><span class="setting-number">02</span><h2>${copy.settings}</h2></div></div>
    <div class="pdf-ocr-setting-grid">
      <label>${copy.languages}<select id="pdfOcrLanguage"><option value="jpn+eng">${copy.japaneseEnglish}</option><option value="jpn">${copy.japanese}</option><option value="eng">${copy.english}</option></select></label>
      <label>${copy.resolution}<select id="pdfOcrDpi"><option value="150">150 DPI</option><option value="200" selected>200 DPI</option><option value="300">300 DPI</option></select></label>
      <label>${copy.pages}<select id="pdfOcrPageMode"><option value="all">${copy.all}</option><option value="range">${copy.range}</option></select></label>
      <label class="pdf-ocr-range" hidden><span>${copy.range}</span><input id="pdfOcrRange" type="text" inputmode="numeric" placeholder="${copy.rangeHint}"></label>
    </div>
    <label class="pdf-ocr-check"><input id="pdfOcrSkipText" type="checkbox" checked><span>${copy.skip}</span></label>
    <small>${copy.local}</small>
  </div>
  <div class="pdf-ocr-actions"><button class="button button-accent" id="pdfOcrRun" type="button">${copy.run} <span>→</span></button><button class="button pdf-ocr-stop" id="pdfOcrStop" type="button" hidden>${copy.stop}</button></div>
  <section class="pdf-ocr-progress" id="pdfOcrProgress" hidden aria-live="polite"><div><strong id="pdfOcrStatus"></strong><span id="pdfOcrCounter"></span></div><progress id="pdfOcrProgressBar" max="1" value="0"></progress></section>
  <section class="pdf-ocr-result" id="pdfOcrResult" hidden><span>03 · READY</span><h2>${copy.ready}</h2><p id="pdfOcrSummary"></p><small id="pdfOcrConfidence"></small><div><button class="button button-dark" id="pdfOcrDownload" type="button">${copy.download}</button><button class="button" id="pdfOcrAgain" type="button">${copy.again}</button></div></section>
</section>`;

const elements = {
  drop: root.querySelector("#pdfOcrDrop"), choose: root.querySelector("#pdfOcrChoose"), input: root.querySelector("#pdfOcrInput"), fileName: root.querySelector("#pdfOcrFileName"), language: root.querySelector("#pdfOcrLanguage"), dpi: root.querySelector("#pdfOcrDpi"), pageMode: root.querySelector("#pdfOcrPageMode"), rangeWrap: root.querySelector(".pdf-ocr-range"), range: root.querySelector("#pdfOcrRange"), skip: root.querySelector("#pdfOcrSkipText"), run: root.querySelector("#pdfOcrRun"), stop: root.querySelector("#pdfOcrStop"), progress: root.querySelector("#pdfOcrProgress"), status: root.querySelector("#pdfOcrStatus"), counter: root.querySelector("#pdfOcrCounter"), bar: root.querySelector("#pdfOcrProgressBar"), result: root.querySelector("#pdfOcrResult"), summary: root.querySelector("#pdfOcrSummary"), confidence: root.querySelector("#pdfOcrConfidence"), download: root.querySelector("#pdfOcrDownload"), again: root.querySelector("#pdfOcrAgain")
};

let sourceFile = null;
let outputFile = null;
let worker = null;
let cancelled = false;
let running = false;

function setSource(file, fromTray = false) {
  if (!file) return;
  sourceFile = file;
  outputFile = null;
  elements.fileName.textContent = file.name;
  elements.result.hidden = true;
  elements.status.textContent = fromTray ? copy.tray : "";
}

function download(file) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = file.name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function setBusy(value) {
  running = value;
  elements.run.disabled = value;
  elements.input.disabled = value;
  elements.stop.hidden = !value;
  elements.progress.hidden = !value;
}

function status(text, page = "") {
  elements.status.textContent = text;
  elements.counter.textContent = page;
}

async function renderPage(pdf, pageNumber, requestedDpi) {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  let scale = requestedDpi / 72;
  const maxScale = Math.min(4200 / Math.max(base.width, base.height), Math.sqrt(14_000_000 / Math.max(1, base.width * base.height)));
  scale = Math.max(1, Math.min(scale, maxScale));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, background: "#fff" }).promise;
  page.cleanup();
  return { canvas, dpi: Math.round(72 * scale) };
}

async function preservePage(output, input, index) {
  const [page] = await output.copyPages(input, [index]);
  output.addPage(page);
}

async function verifySearchableText(bytes) {
  const documentProxy = await getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  let characters = 0;
  try {
    for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
      const page = await documentProxy.getPage(pageNumber);
      const content = await page.getTextContent();
      characters += content.items.reduce((sum, item) => sum + String(item?.str || "").replace(/\s/g, "").length, 0);
      page.cleanup();
    }
  } finally {
    if (typeof documentProxy.cleanup === "function") documentProxy.cleanup();
  }
  return characters;
}

async function processPdf() {
  if (running) return;
  if (!sourceFile) { elements.progress.hidden = false; status(copy.noFile); return; }
  cancelled = false; outputFile = null; elements.result.hidden = true; elements.bar.value = 0; setBusy(true); status(copy.preparing);
  let pdf = null;
  try {
    const bytes = await sourceFile.arrayBuffer();
    pdf = await getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
    const input = await PDFDocument.load(bytes.slice(0), { ignoreEncryption: false });
    const indexes = pdfOcrPageIndexes(elements.pageMode.value, elements.range.value, pdf.numPages);
    if (!indexes.length) throw new Error("INVALID_RANGE");
    const selected = new Set(indexes);
    const output = await PDFDocument.create();
    const results = [];
    const totalOcr = indexes.length;
    let currentOcr = 0;
    worker = await createWorker(elements.language.value.split("+"), 1, {
      workerPath: "/assets/dist/ocr/worker.min.js",
      corePath: "/assets/dist/ocr/core",
      langPath: "/assets/dist/ocr/lang",
      cacheMethod: "write",
      logger(message) {
        if (message.status === "recognizing text") {
          const value = (currentOcr + (Number(message.progress) || 0)) / Math.max(1, totalOcr);
          elements.bar.value = value;
          elements.counter.textContent = copy.progress(message.progress || 0);
        }
      }
    });
    for (let index = 0; index < pdf.numPages; index += 1) {
      if (cancelled) throw new Error("CANCELLED");
      const pageNumber = index + 1;
      if (!selected.has(index)) {
        await preservePage(output, input, index); results.push({ type: "preserved" }); continue;
      }
      const page = await pdf.getPage(pageNumber);
      const text = hasUsefulPdfText((await page.getTextContent()).items);
      page.cleanup();
      if (elements.skip.checked && text.useful) {
        status(copy.preserving(pageNumber), `${pageNumber}/${pdf.numPages}`);
        await preservePage(output, input, index); results.push({ type: "preserved" }); currentOcr += 1; elements.bar.value = currentOcr / totalOcr; continue;
      }
      status(copy.rendering(pageNumber), `${pageNumber}/${pdf.numPages}`);
      const rendered = await renderPage(pdf, pageNumber, Number(elements.dpi.value));
      await worker.setParameters({ user_defined_dpi: String(rendered.dpi), preserve_interword_spaces: "1" });
      status(copy.recognizing(pageNumber), `${pageNumber}/${pdf.numPages}`);
      const recognized = await worker.recognize(rendered.canvas, { pdfTitle: sourceFile.name, pdfTextOnly: false }, { pdf: true, text: true });
      if (cancelled) throw new Error("CANCELLED");
      const pagePdf = await PDFDocument.load(new Uint8Array(recognized.data.pdf));
      await preservePage(output, pagePdf, 0);
      results.push({ type: "ocr", characters: String(recognized.data.text || "").replace(/\s/g, "").length, confidence: recognized.data.confidence || 0 });
      rendered.canvas.width = 1; rendered.canvas.height = 1;
      currentOcr += 1; elements.bar.value = currentOcr / totalOcr;
    }
    status(copy.assembling);
    output.setTitle(sourceFile.name.replace(/\.pdf$/i, ""));
    output.setProducer("SHIAGENT local OCR");
    const outputBytes = await output.save({ useObjectStreams: true });
    const searchableCharacters = await verifySearchableText(outputBytes);
    if (results.some(result => result.type === "ocr") && searchableCharacters === 0) throw new Error("NO_TEXT_LAYER");
    outputFile = new File([outputBytes], pdfOcrOutputName(sourceFile.name), { type: "application/pdf" });
    await replacePdfTray([outputFile]);
    const summary = summarizePdfOcr(results);
    elements.summary.textContent = copy.result(summary);
    elements.confidence.textContent = summary.recognized ? copy.confidence(summary.confidence) : "";
    elements.result.hidden = false; elements.progress.hidden = true;
  } catch (error) {
    console.error(error);
    elements.progress.hidden = false;
    status(error?.message === "CANCELLED" ? copy.cancelled : error?.message === "INVALID_RANGE" ? copy.invalidRange : copy.failed);
  } finally {
    if (worker) await worker.terminate().catch(() => {});
    worker = null;
    if (pdf && typeof pdf.cleanup === "function") pdf.cleanup();
    setBusy(false);
  }
}

elements.input.addEventListener("change", () => setSource(elements.input.files[0]));
elements.choose.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); });
elements.drop.addEventListener("click", event => { if (!event.target.closest("button")) elements.input.click(); });
elements.drop.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.input.click(); } });
for (const name of ["dragenter", "dragover"]) elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.add("is-over"); });
for (const name of ["dragleave", "drop"]) elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.remove("is-over"); });
elements.drop.addEventListener("drop", event => setSource([...event.dataTransfer.files].find(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name))));
elements.pageMode.addEventListener("change", () => { elements.rangeWrap.hidden = elements.pageMode.value !== "range"; });
elements.run.addEventListener("click", processPdf);
elements.stop.addEventListener("click", async () => { cancelled = true; status(copy.cancelled); if (worker) await worker.terminate().catch(() => {}); worker = null; });
elements.download.addEventListener("click", () => { if (outputFile) download(outputFile); });
elements.again.addEventListener("click", () => { elements.input.click(); });

mountPdfTray(trayRoot, { lang: language });
readPdfTray().then(files => { if (files[0]) setSource(files[0], true); }).catch(() => {});
