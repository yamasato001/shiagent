import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import { createZipBlob } from "../assets/js/browser-runtime.js";
import { comparePdfPixels, pdfCompareOutputName, pdfDifferenceLabel } from "../assets/js/pdf-compare-core.js";
import { readPdfTray } from "../assets/js/pdf-tray.js";
import { replaceTray } from "../assets/js/work-tray.js";

GlobalWorkerOptions.workerSrc = "/assets/dist/pdf.worker.min.mjs";

const root = document.querySelector("#pdfCompareRoot");
const language = document.documentElement.lang === "ja" ? "ja" : "en";
const ja = language === "ja";
const copy = ja ? {
  first: "比較元PDFをここにドロップ", second: "比較先PDFをここにドロップ", or: "または", noteA: "変更前・原本", noteB: "変更後・改訂版", choose: "PDFを選択", replace: "変更", settings: "比較設定", sensitivity: "差分の感度", precise: "細かい差も検出", balanced: "標準", broad: "大きな差だけ", resolution: "比較解像度", compare: "PDFを比較", comparing: "比較中…", page: "ページ", missing: "ページなし", pages: count => `${count}ページを比較`, changed: count => `${count}ページに差分`, identical: "表示上の差分は見つかりませんでした", side: "左右", overlay: "重ね合わせ", difference: "差分強調", download: "差分画像をZIP保存", local: "PDFは端末内だけで比較され、サーバーへ送信されません。", failed: "PDFを比較できませんでした。破損やパスワード保護を確認してください。", needTwo: "比較するPDFを2つ選択してください。", tray: "PDF作業トレイの先頭2件を読み込みました。"
} : {
  first: "Drop the original PDF here", second: "Drop the revised PDF here", or: "or", noteA: "Before · original", noteB: "After · revised", choose: "Choose PDF", replace: "Replace", settings: "Comparison settings", sensitivity: "Difference sensitivity", precise: "Detect fine changes", balanced: "Balanced", broad: "Major changes only", resolution: "Comparison resolution", compare: "Compare PDFs", comparing: "Comparing…", page: "Page", missing: "Missing page", pages: count => `Compared ${count} pages`, changed: count => `${count} pages changed`, identical: "No visible differences were found", side: "Side by side", overlay: "Overlay", difference: "Highlight differences", download: "Download differences as ZIP", local: "PDFs are compared only on your device and are never uploaded.", failed: "Could not compare these PDFs. Check for damage or password protection.", needTwo: "Choose two PDFs to compare.", tray: "Loaded the first two files from the PDF tray."
};

root.innerHTML = `<section class="pdf-compare-workspace">
  <div class="pdf-compare-inputs">
    <div class="pdf-drop pdf-compare-drop" id="pdfCompareDropA" tabindex="0" role="button"><input id="pdfCompareA" type="file" accept="application/pdf,.pdf" hidden><span aria-hidden="true">＋</span><h2>${copy.first}</h2><p>${copy.or}</p><button class="button button-dark" id="pdfCompareChooseA" type="button">${copy.choose}</button><small>${copy.noteA}</small><strong class="pdf-selected-file" id="pdfCompareAName"></strong></div>
    <div class="pdf-drop pdf-compare-drop" id="pdfCompareDropB" tabindex="0" role="button"><input id="pdfCompareB" type="file" accept="application/pdf,.pdf" hidden><span aria-hidden="true">＋</span><h2>${copy.second}</h2><p>${copy.or}</p><button class="button button-dark" id="pdfCompareChooseB" type="button">${copy.choose}</button><small>${copy.noteB}</small><strong class="pdf-selected-file" id="pdfCompareBName"></strong></div>
  </div>
  <div class="settings-panel pdf-compare-settings">
    <div class="setting-heading"><div><span class="setting-number">02</span><h2>${copy.settings}</h2></div></div>
    <div class="pdf-compare-setting-grid"><label>${copy.sensitivity}<select id="pdfCompareThreshold"><option value="8">${copy.precise}</option><option value="18" selected>${copy.balanced}</option><option value="32">${copy.broad}</option></select></label><label>${copy.resolution}<select id="pdfCompareDpi"><option value="96">96 DPI</option><option value="144" selected>144 DPI</option><option value="192">192 DPI</option></select></label><button class="button button-accent" id="pdfCompareRun" type="button">${copy.compare} <span>→</span></button></div>
    <p id="pdfCompareStatus" role="status"></p><small>${copy.local}</small>
  </div>
  <section class="pdf-compare-results" id="pdfCompareResults" hidden><header><div><strong id="pdfCompareSummary"></strong><span id="pdfCompareChanged"></span></div><div class="pdf-compare-view" role="group" aria-label="View"><button type="button" data-view="side" class="is-active">${copy.side}</button><button type="button" data-view="overlay">${copy.overlay}</button><button type="button" data-view="difference">${copy.difference}</button></div></header><div id="pdfComparePages"></div><button class="button button-dark" id="pdfCompareDownload" type="button">${copy.download}</button></section>
</section>`;

const elements = {
  dropA: root.querySelector("#pdfCompareDropA"), dropB: root.querySelector("#pdfCompareDropB"), chooseA: root.querySelector("#pdfCompareChooseA"), chooseB: root.querySelector("#pdfCompareChooseB"), inputA: root.querySelector("#pdfCompareA"), inputB: root.querySelector("#pdfCompareB"), nameA: root.querySelector("#pdfCompareAName"), nameB: root.querySelector("#pdfCompareBName"), threshold: root.querySelector("#pdfCompareThreshold"), dpi: root.querySelector("#pdfCompareDpi"), run: root.querySelector("#pdfCompareRun"), status: root.querySelector("#pdfCompareStatus"), results: root.querySelector("#pdfCompareResults"), summary: root.querySelector("#pdfCompareSummary"), changed: root.querySelector("#pdfCompareChanged"), pages: root.querySelector("#pdfComparePages"), download: root.querySelector("#pdfCompareDownload")
};
let files = [null, null];
let results = [];
let busy = false;

function setFile(index, file) {
  if (!file) return;
  files[index] = file;
  (index === 0 ? elements.nameA : elements.nameB).textContent = file.name;
}

async function canvasBlob(canvas, type = "image/png") {
  return new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(copy.failed)), type));
}

function blankCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width); canvas.height = Math.max(1, height);
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

async function renderPage(documentProxy, pageNumber, scale) {
  if (!documentProxy || pageNumber > documentProxy.numPages) return null;
  const page = await documentProxy.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const effective = Math.min(scale, 1800 / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale: effective });
  const canvas = blankCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport, background: "#ffffff" }).promise;
  page.cleanup();
  return canvas;
}

function normalizedCanvas(source, width, height) {
  if (!source) return blankCanvas(width, height);
  if (source.width === width && source.height === height) return source;
  const canvas = blankCanvas(width, height);
  canvas.getContext("2d", { alpha: false }).drawImage(source, 0, 0);
  return canvas;
}

function resultImage(canvas, label, className) {
  const figure = document.createElement("figure");
  figure.className = className;
  const image = document.createElement("img"); image.src = canvas.toDataURL("image/jpeg", 0.9); image.alt = label;
  const caption = document.createElement("figcaption"); caption.textContent = label;
  figure.append(image, caption);
  return figure;
}

function renderResults(view = "side") {
  elements.pages.replaceChildren();
  for (const result of results) {
    const article = document.createElement("article");
    article.className = `pdf-compare-page is-${view}`;
    const heading = document.createElement("header");
    heading.innerHTML = `<strong>${copy.page} ${result.pageNumber}</strong><span>${pdfDifferenceLabel(result.ratio, language)}</span>`;
    const visual = document.createElement("div"); visual.className = "pdf-compare-visual";
    if (view === "side") {
      visual.append(resultImage(result.a, result.hasA ? "A" : copy.missing, "is-a"), resultImage(result.b, result.hasB ? "B" : copy.missing, "is-b"));
    } else if (view === "overlay") visual.append(resultImage(result.overlay, copy.overlay, "is-overlay"));
    else visual.append(resultImage(result.diff, copy.difference, "is-difference"));
    article.append(heading, visual); elements.pages.append(article);
  }
}

async function compare() {
  if (busy) return;
  if (!files[0] || !files[1]) { elements.status.textContent = copy.needTwo; elements.status.classList.add("is-error"); return; }
  busy = true; elements.run.disabled = true; elements.status.classList.remove("is-error"); elements.status.textContent = copy.comparing; elements.results.hidden = true; results = [];
  const documents = [];
  try {
    documents[0] = await getDocument({ data: new Uint8Array(await files[0].arrayBuffer()) }).promise;
    documents[1] = await getDocument({ data: new Uint8Array(await files[1].arrayBuffer()) }).promise;
    const count = Math.max(documents[0].numPages, documents[1].numPages);
    const scale = (Number(elements.dpi.value) || 144) / 72;
    for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
      elements.status.textContent = `${copy.comparing} ${pageNumber}/${count}`;
      const [rawA, rawB] = await Promise.all([renderPage(documents[0], pageNumber, scale), renderPage(documents[1], pageNumber, scale)]);
      const width = Math.max(rawA?.width || 1, rawB?.width || 1), height = Math.max(rawA?.height || 1, rawB?.height || 1);
      const a = normalizedCanvas(rawA, width, height), b = normalizedCanvas(rawB, width, height);
      const contextA = a.getContext("2d", { willReadFrequently: true }), contextB = b.getContext("2d", { willReadFrequently: true });
      const comparison = comparePdfPixels(contextA.getImageData(0, 0, width, height), contextB.getImageData(0, 0, width, height), elements.threshold.value);
      const diff = blankCanvas(width, height); diff.getContext("2d").putImageData(new ImageData(comparison.data, width, height), 0, 0);
      const overlay = blankCanvas(width, height); const overlayContext = overlay.getContext("2d"); overlayContext.globalAlpha = 0.5; overlayContext.drawImage(a, 0, 0); overlayContext.drawImage(b, 0, 0); overlayContext.globalAlpha = 1;
      results.push({ pageNumber, a, b, diff, overlay, ratio: comparison.ratio, hasA: Boolean(rawA), hasB: Boolean(rawB) });
    }
    const changed = results.filter(result => result.ratio > 0).length;
    elements.summary.textContent = copy.pages(results.length); elements.changed.textContent = changed ? copy.changed(changed) : copy.identical;
    renderResults(); elements.results.hidden = false; elements.status.textContent = "";
  } catch (error) { console.error(error); elements.status.textContent = copy.failed; elements.status.classList.add("is-error"); }
  finally {
    for (const documentProxy of documents) if (documentProxy) {
      if (typeof documentProxy.destroy === "function") await documentProxy.destroy().catch(() => {});
      else if (typeof documentProxy.cleanup === "function") documentProxy.cleanup();
    }
    busy = false; elements.run.disabled = false;
  }
}

async function downloadDifferences() {
  if (!results.length) return;
  const outputFiles = [];
  const entries = [];
  for (const result of results) {
    const name = pdfCompareOutputName(result.pageNumber); const blob = await canvasBlob(result.diff);
    entries.push({ name, data: new Uint8Array(await blob.arrayBuffer()) }); outputFiles.push(new File([blob], name, { type: "image/png" }));
  }
  const zip = createZipBlob(entries); const url = URL.createObjectURL(zip); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "pdf-differences.zip"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  await replaceTray(outputFiles, "pdf-compare");
  document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: outputFiles, source: "pdf-compare" } }));
}

elements.inputA.addEventListener("change", () => setFile(0, elements.inputA.files[0]));
elements.inputB.addEventListener("change", () => setFile(1, elements.inputB.files[0]));
function connectDrop(drop, choose, input, index) {
  choose.addEventListener("click", event => { event.stopPropagation(); input.click(); });
  drop.addEventListener("click", event => { if (!event.target.closest("button")) input.click(); });
  drop.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.click(); } });
  for (const name of ["dragenter", "dragover"]) drop.addEventListener(name, event => { event.preventDefault(); drop.classList.add("is-over"); });
  for (const name of ["dragleave", "drop"]) drop.addEventListener(name, event => { event.preventDefault(); drop.classList.remove("is-over"); });
  drop.addEventListener("drop", event => setFile(index, [...event.dataTransfer.files].find(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name))));
}
connectDrop(elements.dropA, elements.chooseA, elements.inputA, 0);
connectDrop(elements.dropB, elements.chooseB, elements.inputB, 1);
elements.run.addEventListener("click", compare);
elements.download.addEventListener("click", downloadDifferences);
root.querySelector(".pdf-compare-view").addEventListener("click", event => {
  const button = event.target.closest("[data-view]"); if (!button) return;
  for (const item of root.querySelectorAll("[data-view]")) item.classList.toggle("is-active", item === button);
  renderResults(button.dataset.view);
});

readPdfTray().then(trayFiles => {
  if (trayFiles[0]) setFile(0, trayFiles[0]); if (trayFiles[1]) setFile(1, trayFiles[1]);
  if (trayFiles.length >= 2) elements.status.textContent = copy.tray;
}).catch(() => {});
