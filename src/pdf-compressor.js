import encodeJpeg, { init as initJpeg } from "@jsquash/jpeg/encode";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import { formatPdfBytes, pdfCompressedName, pdfCompressionPreset, pdfSavingsPercent } from "../assets/js/pdf-compressor-core.js";
import { mountPdfTray, readPdfTray, replacePdfTray } from "../assets/js/pdf-tray.js";

GlobalWorkerOptions.workerSrc = "/assets/dist/pdf.worker.min.mjs";
let jpegReady = null;
function prepareJpeg() {
  if (!jpegReady) jpegReady = initJpeg({ locateFile: path => path === "mozjpeg_enc.wasm" ? "/assets/dist/mozjpeg_enc.wasm" : path });
  return jpegReady;
}

const root = document.querySelector("#pdfCompressorRoot");
const trayRoot = document.querySelector("#pdfTrayRoot");
const language = document.documentElement.lang === "ja" ? "ja" : "en";
const ja = language === "ja";
const locale = ja ? "ja-JP" : "en-US";
const copy = ja ? {
  file: "PDFをここにドロップ", or: "または", note: "PDF・1ファイル・端末内処理", choose: "PDFを選択", settings: "圧縮方式", quality: "画質優先", qualityNote: "200 DPI・高画質。文字とベクターを保持", recommended: "おすすめ", recommendedNote: "150 DPI・バランス。文字とベクターを保持", maximum: "最大圧縮", maximumNote: "120 DPI。全ページを画像化して最小化", warning: "最大圧縮では文字の検索・選択、リンク、フォームが失われます。", run: "PDFを圧縮", stop: "中止", analyzing: "PDF内の画像を解析しています", image: (done, total) => `埋め込み画像を再圧縮しています ${done}/${total}`, page: (done, total) => `ページを再圧縮しています ${done}/${total}`, assembling: "圧縮PDFを組み立てています", noFile: "PDFを選択してください。", failed: "PDFを圧縮できませんでした。破損またはパスワード保護を確認してください。", cancelled: "圧縮を中止しました。", ready: "圧縮が完了しました", original: "圧縮前", output: "圧縮後", reduced: "削減率", images: count => `${count}個の埋め込み画像を再圧縮`, skipped: count => `${count}個の非対応画像は原本保持`, preserved: "文字・リンク・ベクターを保持", flattened: "全ページを画像化", unchanged: "元より小さくならなかったため原本を保持しました。", save: "PDFを保存", again: "別のPDFを処理", local: "PDFは端末内だけで処理され、外部へ送信されません。"
} : {
  file: "Drop a PDF here", or: "or", note: "One PDF · processed on this device", choose: "Choose PDF", settings: "Compression method", quality: "Quality first", qualityNote: "200 DPI, high quality. Keeps text and vectors", recommended: "Recommended", recommendedNote: "150 DPI, balanced. Keeps text and vectors", maximum: "Maximum", maximumNote: "120 DPI. Rasterizes every page for the smallest file", warning: "Maximum compression removes searchable/selectable text, links and forms.", run: "Compress PDF", stop: "Stop", analyzing: "Analyzing embedded PDF images", image: (done, total) => `Recompressing embedded images ${done}/${total}`, page: (done, total) => `Recompressing pages ${done}/${total}`, assembling: "Assembling compressed PDF", noFile: "Choose a PDF first.", failed: "Could not compress the PDF. Check for damage or password protection.", cancelled: "Compression stopped.", ready: "Compression complete", original: "Before", output: "After", reduced: "Reduction", images: count => `${count} embedded images recompressed`, skipped: count => `${count} unsupported images preserved`, preserved: "Text, links and vectors preserved", flattened: "Every page rasterized", unchanged: "The original was kept because compression did not make it smaller.", save: "Save PDF", again: "Process another PDF", local: "The PDF is processed only on this device and is never uploaded."
};

root.innerHTML = `<section class="pdf-compressor-workspace">
  <div class="pdf-drop pdf-special-drop" id="pdfCompressorDrop" tabindex="0" role="button"><input id="pdfCompressorInput" type="file" accept="application/pdf,.pdf" hidden><span aria-hidden="true">＋</span><h2>${copy.file}</h2><p>${copy.or}</p><button class="button button-dark" id="pdfCompressorChoose" type="button">${copy.choose}</button><small>${copy.note}</small><strong class="pdf-selected-file" id="pdfCompressorFileName"></strong></div>
  <div class="settings-panel pdf-compressor-settings">
    <div class="setting-heading" id="pdfCompressorSettingTitle"><div><span class="setting-number">02</span><h2>${copy.settings}</h2></div></div>
    <fieldset class="pdf-compressor-presets" aria-labelledby="pdfCompressorSettingTitle">
      <legend class="sr-only">${copy.settings}</legend>
      <label><input type="radio" name="pdfCompressionLevel" value="quality"><span><strong>${copy.quality}</strong><small>${copy.qualityNote}</small></span></label>
      <label><input type="radio" name="pdfCompressionLevel" value="recommended" checked><span><strong>${copy.recommended}</strong><small>${copy.recommendedNote}</small></span></label>
      <label><input type="radio" name="pdfCompressionLevel" value="maximum"><span><strong>${copy.maximum}</strong><small>${copy.maximumNote}</small></span></label>
    </fieldset>
  </div>
  <p class="pdf-compressor-warning" id="pdfCompressorWarning" hidden>${copy.warning}</p>
  <small class="pdf-compressor-local">${copy.local}</small>
  <div class="pdf-compressor-actions"><button class="button button-accent" id="pdfCompressorRun" type="button">${copy.run} <span>→</span></button><button class="button pdf-compressor-stop" id="pdfCompressorStop" type="button" hidden>${copy.stop}</button></div>
  <section class="pdf-compressor-progress" id="pdfCompressorProgress" hidden><div><strong id="pdfCompressorStatus"></strong><span id="pdfCompressorCounter"></span></div><progress id="pdfCompressorProgressBar" max="1" value="0"></progress></section>
  <section class="pdf-compressor-result" id="pdfCompressorResult" hidden><span>03 · RESULT</span><h2>${copy.ready}</h2><div class="pdf-compressor-metrics"><div><small>${copy.original}</small><strong id="pdfCompressorOriginal"></strong></div><div><small>${copy.output}</small><strong id="pdfCompressorOutput"></strong></div><div><small>${copy.reduced}</small><strong id="pdfCompressorSavings"></strong></div></div><p id="pdfCompressorDetail"></p><div><button class="button button-dark" id="pdfCompressorDownload" type="button">${copy.save}</button><button class="button" id="pdfCompressorAgain" type="button">${copy.again}</button></div></section>
</section>`;

const elements = {
  drop: root.querySelector("#pdfCompressorDrop"), choose: root.querySelector("#pdfCompressorChoose"), input: root.querySelector("#pdfCompressorInput"), name: root.querySelector("#pdfCompressorFileName"), warning: root.querySelector("#pdfCompressorWarning"), run: root.querySelector("#pdfCompressorRun"), stop: root.querySelector("#pdfCompressorStop"), progress: root.querySelector("#pdfCompressorProgress"), status: root.querySelector("#pdfCompressorStatus"), counter: root.querySelector("#pdfCompressorCounter"), bar: root.querySelector("#pdfCompressorProgressBar"), result: root.querySelector("#pdfCompressorResult"), original: root.querySelector("#pdfCompressorOriginal"), output: root.querySelector("#pdfCompressorOutput"), savings: root.querySelector("#pdfCompressorSavings"), detail: root.querySelector("#pdfCompressorDetail"), download: root.querySelector("#pdfCompressorDownload"), again: root.querySelector("#pdfCompressorAgain")
};
let sourceFile = null, outputFile = null, running = false, cancelled = false;

function selectedLevel() { return root.querySelector('input[name="pdfCompressionLevel"]:checked')?.value || "recommended"; }
function setSource(file, fromTray = false) { if (!file) return; sourceFile = file; outputFile = null; elements.name.textContent = file.name; elements.result.hidden = true; if (fromTray) elements.status.textContent = ja ? "PDF作業トレイから読み込みました。" : "Loaded from the PDF work tray."; }
function setBusy(value) { running = value; elements.input.disabled = value; elements.run.disabled = value; elements.stop.hidden = !value; elements.progress.hidden = !value; }
function status(text, counter = "") { elements.status.textContent = text; elements.counter.textContent = counter; }
function checkCancelled() { if (cancelled) throw new Error("CANCELLED"); }
function resolveObject(context, value) { return value instanceof PDFRef ? context.lookup(value) : value; }
function numberValue(context, dict, key) { const value = resolveObject(context, dict.get(PDFName.of(key))); return value instanceof PDFNumber ? value.asNumber() : 0; }
function filterNames(context, dict) { const filter = resolveObject(context, dict.get(PDFName.of("Filter"))); if (!filter) return []; if (filter instanceof PDFArray) return filter.asArray().map(value => String(resolveObject(context, value) || value)); return [String(filter)]; }
function colorSpace(context, dict) { const value = resolveObject(context, dict.get(PDFName.of("ColorSpace"))); return value instanceof PDFName ? String(value) : null; }

function listImages(document) {
  const output = [];
  for (const [ref, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    const subtype = resolveObject(document.context, object.dict.get(PDFName.of("Subtype")));
    if (!(subtype instanceof PDFName) || String(subtype) !== "/Image") continue;
    const filters = filterNames(document.context, object.dict);
    const space = colorSpace(document.context, object.dict);
    const safe = filters.length === 1 && filters[0] === "/DCTDecode" && !object.dict.get(PDFName.of("SMask")) && !object.dict.get(PDFName.of("Mask")) && space !== "/DeviceCMYK";
    output.push({ ref, stream: object, width: numberValue(document.context, object.dict, "Width"), height: numberValue(document.context, object.dict, "Height"), safe });
  }
  return output;
}

async function jpegImageData(bytes, maxSide) {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
  try {
    let width = bitmap.width, height = bitmap.height;
    if (Math.max(width, height) > maxSide) { const ratio = maxSide / Math.max(width, height); width = Math.max(1, Math.round(width * ratio)); height = Math.max(1, Math.round(height * ratio)); }
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true }); context.fillStyle = "#fff"; context.fillRect(0, 0, width, height); context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally { bitmap.close(); }
}

async function encodeImage(data, quality) { await prepareJpeg(); return new Uint8Array(await encodeJpeg(data, { quality })); }

async function recompressEmbedded(input, preset) {
  const document = await PDFDocument.load(input, { updateMetadata: false, throwOnInvalidObject: false });
  const images = listImages(document), targets = images.filter(image => image.safe);
  let replaced = 0;
  for (let index = 0; index < targets.length; index += 1) {
    checkCancelled(); status(copy.image(index + 1, targets.length), `${index + 1}/${targets.length}`); elements.bar.value = (index + 1) / Math.max(1, targets.length);
    const image = targets[index];
    try {
      const imageData = await jpegImageData(image.stream.contents, Math.round(preset.dpi * 11.7));
      const jpeg = await encodeImage(imageData, preset.quality);
      if (jpeg.byteLength < image.stream.contents.length) {
        const dict = image.stream.dict; dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode")); dict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceRGB")); dict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8)); dict.set(PDFName.of("Width"), PDFNumber.of(imageData.width)); dict.set(PDFName.of("Height"), PDFNumber.of(imageData.height)); dict.set(PDFName.of("Length"), PDFNumber.of(jpeg.length)); dict.delete(PDFName.of("DecodeParms")); dict.delete(PDFName.of("Decode")); document.context.assign(image.ref, PDFRawStream.of(dict, jpeg)); replaced += 1;
      }
    } catch (error) { console.warn("Skipped PDF image", error); }
  }
  status(copy.assembling);
  return { bytes: await document.save({ useObjectStreams: true }), pages: document.getPageCount(), replaced, skipped: images.length - targets.length, textPreserved: true };
}

async function renderCanvas(pdf, pageNumber, dpi) {
  const page = await pdf.getPage(pageNumber), base = page.getViewport({ scale: 1 });
  let scale = dpi / 72; scale = Math.min(scale, 3600 / Math.max(base.width, base.height), Math.sqrt(12_000_000 / Math.max(1, base.width * base.height)));
  const viewport = page.getViewport({ scale }), canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true }); context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, background: "#fff" }).promise; const data = context.getImageData(0, 0, canvas.width, canvas.height); page.cleanup();
  return { data, width: base.width, height: base.height, canvas };
}

async function rasterize(input, preset) {
  const pdf = await getDocument({ data: input.slice() }).promise, output = await PDFDocument.create();
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      checkCancelled(); status(copy.page(pageNumber, pdf.numPages), `${pageNumber}/${pdf.numPages}`); elements.bar.value = pageNumber / pdf.numPages;
      const rendered = await renderCanvas(pdf, pageNumber, preset.dpi), jpeg = await encodeImage(rendered.data, preset.quality), embedded = await output.embedJpg(jpeg), page = output.addPage([rendered.width, rendered.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: rendered.width, height: rendered.height }); rendered.canvas.width = 1; rendered.canvas.height = 1;
    }
    return { bytes: await output.save({ useObjectStreams: true }), pages: pdf.numPages, replaced: pdf.numPages, skipped: 0, textPreserved: false };
  } finally { if (typeof pdf.cleanup === "function") pdf.cleanup(); }
}

async function compress() {
  if (running) return;
  if (!sourceFile) { elements.progress.hidden = false; status(copy.noFile); return; }
  running = true; cancelled = false; outputFile = null; elements.result.hidden = true; elements.bar.value = 0; setBusy(true); status(copy.analyzing);
  try {
    const original = new Uint8Array(await sourceFile.arrayBuffer()), preset = pdfCompressionPreset(selectedLevel());
    let result = preset.strategy === "raster" ? await rasterize(original, preset) : await recompressEmbedded(original, preset);
    checkCancelled();
    let unchanged = result.bytes.byteLength >= original.byteLength;
    const bytes = unchanged ? original : result.bytes;
    await PDFDocument.load(bytes, { ignoreEncryption: false });
    outputFile = new File([bytes], pdfCompressedName(sourceFile.name), { type: "application/pdf" }); await replacePdfTray([outputFile]);
    elements.original.textContent = formatPdfBytes(original.byteLength, locale); elements.output.textContent = formatPdfBytes(bytes.byteLength, locale); elements.savings.textContent = `${pdfSavingsPercent(original.byteLength, bytes.byteLength).toFixed(1)}%`;
    const details = unchanged ? [copy.unchanged] : [preset.strategy === "images" ? copy.images(result.replaced) : copy.flattened, preset.strategy === "images" && result.skipped ? copy.skipped(result.skipped) : "", result.textPreserved ? copy.preserved : ""].filter(Boolean);
    elements.detail.textContent = details.join(" · "); elements.result.hidden = false; elements.progress.hidden = true;
  } catch (error) { console.error(error); elements.progress.hidden = false; status(error?.message === "CANCELLED" ? copy.cancelled : copy.failed); }
  finally { setBusy(false); running = false; }
}

function download(file) { const url = URL.createObjectURL(file), anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
elements.input.addEventListener("change", () => setSource(elements.input.files[0]));
elements.choose.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); });
elements.drop.addEventListener("click", event => { if (!event.target.closest("button")) elements.input.click(); });
elements.drop.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.input.click(); } });
for (const name of ["dragenter", "dragover"]) elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.add("is-over"); });
for (const name of ["dragleave", "drop"]) elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.remove("is-over"); });
elements.drop.addEventListener("drop", event => setSource([...event.dataTransfer.files].find(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name))));
root.querySelector(".pdf-compressor-presets").addEventListener("change", () => { elements.warning.hidden = selectedLevel() !== "maximum"; });
elements.run.addEventListener("click", compress); elements.stop.addEventListener("click", () => { cancelled = true; status(copy.cancelled); }); elements.download.addEventListener("click", () => { if (outputFile) download(outputFile); }); elements.again.addEventListener("click", () => elements.input.click());
mountPdfTray(trayRoot, { lang: language }); readPdfTray().then(files => { if (files[0]) setSource(files[0], true); }).catch(() => {});
