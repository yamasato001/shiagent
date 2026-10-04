import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField, StandardFonts, degrees, rgb } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import { createZipBlob } from "../assets/js/browser-runtime.js";
import { cropBoxFromMargins, detectRasterOrientation, detectTextOrientation, detectWhiteContentBounds, fitInsideBox, interleaveGroups, nUpGrid, pageNumberLabel, PDF_MODE_FEATURES, positionInBox, rotateAngle, safePdfName, selectPageIndexes } from "../assets/js/pdf-core.js";
import { clearPdfTray, mountPdfTray, readPdfTray, replacePdfTray } from "../assets/js/pdf-tray.js";
import { readTray, replaceTray } from "../assets/js/work-tray.js";
import { chooseOutputDirectory, supportsFolderDownload, writeFilesToDirectory } from "../assets/js/folder-download.js";

GlobalWorkerOptions.workerSrc = "/assets/dist/pdf.worker.min.mjs";

const root = document.querySelector("#pdfWorkspaceRoot");
const lang = document.documentElement.lang === "ja" ? "ja" : "en";
const mode = document.body.dataset.pdfMode || "merge";
const ja = lang === "ja";
const text = ja ? {
  add: "PDF・画像を追加", drop: "PDFをここにドロップ", dropImage: "画像をここにドロップ", or: "または", choose: "ファイルを選択",
  mergeMethod: "結合方法", mergeSequential: "ファイル順に結合", mergeInterleave: "ページを交互に結合",
  note: "PDFは端末内で処理され、サーバーには送信されません。", pages: "ページ", clear: "すべてクリア", empty: "PDFを追加するとページがここに表示されます。",
  select: "出力ページ", all: "すべて", selected: "選択中", odd: "奇数ページ", even: "偶数ページ", range: "ページ指定", rangeHelp: "例: 1-3, 7, 10",
  output: "出力方法", combined: "1つのPDF", separate: "1ページずつZIP", filename: "保存名", reverse: "出力を逆順にする", pageSize: "画像の用紙", auto: "画像サイズ", a4p: "A4 縦", a4l: "A4 横",
  targetPages: "対象ページ", imageFormat: "画像形式", resolution: "解像度", imageQuality: "画質", png: "PNG（高画質）", jpeg: "JPEG（写真向け）", webp: "WebP（軽量）",
  numberStart: "開始番号", numberStyle: "番号の形式", numberOnly: "1", numberPage: "Page 1", numberTotal: "1 / 全ページ", position: "位置", fontSize: "文字サイズ", margin: "端からの余白（mm）",
  positions: { "top-left": "左上", "top-center": "上中央", "top-right": "右上", center: "中央", "bottom-left": "左下", "bottom-center": "下中央", "bottom-right": "右下" },
  watermarkText: "透かし文字", watermarkImage: "画像透かし（PNG・JPEG、任意）", opacity: "透明度", rotation: "角度", watermarkSize: "大きさ（ページ幅に対する%）",
  cropMode: "クロップ方法", cropManual: "四辺を数値指定", cropAuto: "白い余白を自動検出", cropTop: "上（mm）", cropRight: "右（mm）", cropBottom: "下（mm）", cropLeft: "左（mm）", cropPadding: "内容の周囲に残す余白（mm）",
  nUpLayout: "1枚あたりのページ数", nUpPaper: "用紙", nUpGap: "ページ間隔（mm）", nUpBorder: "ページ境界線を表示", formFields: "入力できるフォーム項目", formEmpty: "入力可能なフォーム項目が見つかりません。", formFlatten: "入力内容を固定して編集不可にする", signatureText: "文字で署名", signatureImage: "署名画像（PNG・JPEG、任意）", signatureDraw: "手書き署名", signatureClear: "手書きを消去", signatureSize: "署名サイズ（ページ幅に対する%）", signatureNotice: "これは見た目として配置する署名です。電子証明書を使うデジタル署名ではありません。", metadataNotice: "文書情報を取り除いた新しいPDFを作成します。ページ内容は維持されますが、フォームなどの対話機能は保持されない場合があります。",
  finishPadding: "内容の周囲に残す余白（mm）", renameBase: "整理後のファイル名", renameStart: "開始番号", renameDigits: "桁数", finishNotice: "白余白を検出し、向きを自動補正してページ番号を追加します。文書情報を除去した新しいPDFを、連番名で保存します。",
  export: "PDFを書き出す", exporting: "PDFを作成中…", load: "ページを読み込み中…", rotateLeft: "左回転", rotateRight: "右回転", remove: "削除",
  autoOrient: "文章の上下を自動判定", autoHelp: "文字情報を優先し、画像PDFは画素配置から判定します。低確信度のページは確認してください。", analyzing: "文章の向きを解析中…", analyzed: (count, review) => `${count}ページを自動補正しました${review ? ` · ${review}ページは要確認` : ""}`, confidence: { high: "高", medium: "中", low: "要確認" }, detected: "自動判定",
  exportModes: { merge: "PDFを結合", split: "PDFを分割", reorder: "並べ替えて保存", interleave: "交互結合して保存", rotate: "回転して保存", "delete-pages": "削除して保存", "images-to-pdf": "PDFを作成", "pdf-to-images": "画像を書き出す", "page-numbers": "ページ番号を追加", watermark: "透かしを追加", crop: "クロップして保存", "metadata-cleaner": "文書情報を削除", "n-up": "面付けPDFを作成", "form-fill": "入力済みPDFを保存", signature: "署名を配置", "pdf-finisher": "PDFを一括仕上げ" },
  invalid: "出力するページがありません。", failed: "PDFを処理できませんでした。破損やパスワード保護を確認してください。", imageFailed: "この画像をPDFへ変換できませんでした。",
  complete: count => `${count}ページを書き出しました`, imageComplete: count => `${count}枚の画像を書き出し、画像トレイへ保存しました`, count: count => `${count}ページ`, trayLoaded: count => `PDF作業トレイから${count}件を読み込みました`,
  folderExport: "フォルダに直接保存", folderSaving: (done, total) => `フォルダへ保存中… ${done}/${total}`, folderComplete: count => `${count}件をフォルダへ保存しました`,
  modes: { merge: "PDF結合", split: "PDF分割", reorder: "PDFページ並べ替え", interleave: "PDF交互結合", rotate: "PDF向き自動判定・回転", "delete-pages": "PDFページ削除", "images-to-pdf": "画像 → PDF", "pdf-to-images": "PDF → 画像", "page-numbers": "ページ番号を追加", watermark: "PDFへ透かしを追加", crop: "PDFの余白をクロップ", "metadata-cleaner": "PDF文書情報削除", "n-up": "PDFを複数ページ／1枚に配置", "form-fill": "PDFフォーム入力", signature: "PDFへ署名を配置", "pdf-finisher": "PDF一括仕上げ" }
} : {
  add: "Add PDFs or images", drop: "Drop PDFs here", dropImage: "Drop images here", or: "or", choose: "Choose files",
  mergeMethod: "Merge method", mergeSequential: "Append files in order", mergeInterleave: "Interleave pages",
  note: "PDFs are processed on your device and never uploaded.", pages: "Pages", clear: "Clear all", empty: "Add a PDF to see its pages here.",
  select: "Pages to export", all: "All pages", selected: "Selected pages", odd: "Odd pages", even: "Even pages", range: "Page range", rangeHelp: "e.g. 1-3, 7, 10",
  output: "Output", combined: "One PDF", separate: "One PDF per page (ZIP)", filename: "File name", reverse: "Reverse output order", pageSize: "Image page size", auto: "Image size", a4p: "A4 portrait", a4l: "A4 landscape",
  targetPages: "Target pages", imageFormat: "Image format", resolution: "Resolution", imageQuality: "Quality", png: "PNG (high quality)", jpeg: "JPEG (photos)", webp: "WebP (compact)",
  numberStart: "Starting number", numberStyle: "Number format", numberOnly: "1", numberPage: "Page 1", numberTotal: "1 / total", position: "Position", fontSize: "Font size", margin: "Edge margin (mm)",
  positions: { "top-left": "Top left", "top-center": "Top center", "top-right": "Top right", center: "Center", "bottom-left": "Bottom left", "bottom-center": "Bottom center", "bottom-right": "Bottom right" },
  watermarkText: "Watermark text", watermarkImage: "Image watermark (PNG or JPEG, optional)", opacity: "Opacity", rotation: "Angle", watermarkSize: "Size (% of page width)",
  cropMode: "Crop method", cropManual: "Enter four margins", cropAuto: "Detect white margins", cropTop: "Top (mm)", cropRight: "Right (mm)", cropBottom: "Bottom (mm)", cropLeft: "Left (mm)", cropPadding: "Padding around content (mm)",
  nUpLayout: "Pages per sheet", nUpPaper: "Paper", nUpGap: "Page gap (mm)", nUpBorder: "Show page borders", formFields: "Fillable form fields", formEmpty: "No fillable form fields were found.", formFlatten: "Flatten values to prevent further editing", signatureText: "Typed signature", signatureImage: "Signature image (PNG or JPEG, optional)", signatureDraw: "Draw signature", signatureClear: "Clear drawing", signatureSize: "Signature size (% of page width)", signatureNotice: "This places a visual signature only. It is not a certificate-based digital signature.", metadataNotice: "Creates a new PDF without document metadata. Page content is kept, but interactive features such as forms may not be preserved.",
  finishPadding: "Padding around content (mm)", renameBase: "Organized file name", renameStart: "Starting number", renameDigits: "Digits", finishNotice: "Detects white margins, corrects orientation and adds page numbers. It then removes document metadata and saves new PDFs with sequential names.",
  export: "Export PDF", exporting: "Building PDF…", load: "Loading pages…", rotateLeft: "Rotate left", rotateRight: "Rotate right", remove: "Delete",
  autoOrient: "Auto-detect text orientation", autoHelp: "Uses the text layer first, then page pixels for scanned PDFs. Review low-confidence pages.", analyzing: "Analyzing text orientation…", analyzed: (count, review) => `Auto-corrected ${count} pages${review ? ` · review ${review}` : ""}`, confidence: { high: "High", medium: "Medium", low: "Review" }, detected: "Auto",
  exportModes: { merge: "Merge PDF", split: "Split PDF", reorder: "Save reordered PDF", interleave: "Save interleaved PDF", rotate: "Save rotated PDF", "delete-pages": "Save without deleted pages", "images-to-pdf": "Create PDF", "pdf-to-images": "Export images", "page-numbers": "Add page numbers", watermark: "Add watermark", crop: "Crop and save", "metadata-cleaner": "Remove metadata", "n-up": "Create N-up PDF", "form-fill": "Save filled PDF", signature: "Place signature", "pdf-finisher": "Finish PDFs" },
  invalid: "There are no pages to export.", failed: "Could not process this PDF. Check whether it is damaged or password-protected.", imageFailed: "Could not convert this image to PDF.",
  complete: count => `Exported ${count} pages`, imageComplete: count => `Exported ${count} images and saved them to the image tray`, count: count => `${count} pages`, trayLoaded: count => `Loaded ${count} files from the PDF tray`,
  folderExport: "Save directly to folder", folderSaving: (done, total) => `Saving to folder… ${done}/${total}`, folderComplete: count => `Saved ${count} files to the folder`,
  modes: { merge: "Merge PDF", split: "Split PDF", reorder: "Reorder PDF Pages", interleave: "Interleave PDFs", rotate: "Auto Detect & Rotate PDF", "delete-pages": "Delete PDF Pages", "images-to-pdf": "Images to PDF", "pdf-to-images": "PDF to Images", "page-numbers": "Add Page Numbers", watermark: "Add Watermark", crop: "Crop PDF Margins", "metadata-cleaner": "Remove PDF Metadata", "n-up": "Multiple Pages per Sheet", "form-fill": "Fill PDF Forms", signature: "Place a Signature on PDF", "pdf-finisher": "PDF Finishing Workflow" }
};

const acceptsImages = mode === "images-to-pdf";
const features = PDF_MODE_FEATURES[mode] || PDF_MODE_FEATURES.merge;
const positionOptions = selected => Object.entries(text.positions).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
const modeControls = mode === "merge" || mode === "interleave" ? `
    <label>${text.mergeMethod}<select id="pdfMergeMethod"><option value="sequential" ${mode === "merge" ? "selected" : ""}>${text.mergeSequential}</option><option value="interleave" ${mode === "interleave" ? "selected" : ""}>${text.mergeInterleave}</option></select></label>`
  : mode === "pdf-to-images" ? `
    <label>${text.imageFormat}<select id="pdfImageFormat"><option value="png">${text.png}</option><option value="jpeg">${text.jpeg}</option><option value="webp" selected>${text.webp}</option></select></label>
    <label>${text.resolution}<select id="pdfImageDpi"><option value="96">96 DPI</option><option value="150" selected>150 DPI</option><option value="300">300 DPI</option></select></label>
    <label>${text.imageQuality}<select id="pdfImageQuality"><option value="0.8">80%</option><option value="0.9" selected>90%</option><option value="0.95">95%</option></select></label>`
  : mode === "page-numbers" ? `
    <label>${text.numberStart}<input id="pdfNumberStart" type="number" value="1" min="0" max="999999"></label>
    <label>${text.numberStyle}<select id="pdfNumberStyle"><option value="number">${text.numberOnly}</option><option value="page">${text.numberPage}</option><option value="total">${text.numberTotal}</option></select></label>
    <label>${text.position}<select id="pdfPosition">${positionOptions("bottom-center")}</select></label>
    <label>${text.fontSize}<input id="pdfFontSize" type="number" value="11" min="6" max="72"></label>
    <label>${text.margin}<input id="pdfMargin" type="number" value="10" min="0" max="100" step="0.5"></label>`
  : mode === "watermark" ? `
    <label>${text.watermarkText}<input id="pdfWatermarkText" type="text" value="CONFIDENTIAL" maxlength="120"></label>
    <label>${text.watermarkImage}<input id="pdfWatermarkImage" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg"></label>
    <label>${text.position}<select id="pdfPosition">${positionOptions("center")}</select></label>
    <label>${text.opacity}<input id="pdfOpacity" type="number" value="0.18" min="0.05" max="1" step="0.05"></label>
    <label>${text.rotation}<input id="pdfWatermarkRotation" type="number" value="-35" min="-180" max="180"></label>
    <label>${text.watermarkSize}<input id="pdfWatermarkSize" type="number" value="55" min="5" max="100"></label>`
  : mode === "crop" ? `
    <label>${text.cropMode}<select id="pdfCropMode"><option value="auto" selected>${text.cropAuto}</option><option value="manual">${text.cropManual}</option></select></label>
    <div id="pdfManualCrop" class="pdf-option-grid" hidden>
      <label>${text.cropTop}<input id="pdfCropTop" type="number" value="0" min="0" max="300" step="0.5"></label>
      <label>${text.cropRight}<input id="pdfCropRight" type="number" value="0" min="0" max="300" step="0.5"></label>
      <label>${text.cropBottom}<input id="pdfCropBottom" type="number" value="0" min="0" max="300" step="0.5"></label>
      <label>${text.cropLeft}<input id="pdfCropLeft" type="number" value="0" min="0" max="300" step="0.5"></label>
    </div>
    <label id="pdfCropPaddingWrap">${text.cropPadding}<input id="pdfCropPadding" type="number" value="3" min="0" max="100" step="0.5"></label>`
  : mode === "metadata-cleaner" ? `<p class="pdf-option-note">${text.metadataNotice}</p>`
  : mode === "n-up" ? `
    <label>${text.nUpLayout}<select id="pdfNUpLayout"><option value="2">2</option><option value="4" selected>4</option><option value="6">6</option></select></label>
    <label>${text.nUpPaper}<select id="pdfNUpPaper"><option value="a4p">${text.a4p}</option><option value="a4l" selected>${text.a4l}</option></select></label>
    <label>${text.margin}<input id="pdfNUpMargin" type="number" value="8" min="0" max="50" step="0.5"></label>
    <label>${text.nUpGap}<input id="pdfNUpGap" type="number" value="4" min="0" max="50" step="0.5"></label>
    <label class="pdf-check"><input id="pdfNUpBorder" type="checkbox"><span>${text.nUpBorder}</span></label>`
  : mode === "form-fill" ? `
    <div class="pdf-form-wrap"><strong>${text.formFields}</strong><div id="pdfFormFields" class="pdf-form-fields"><p>${text.formEmpty}</p></div></div>
    <label class="pdf-check"><input id="pdfFormFlatten" type="checkbox"><span>${text.formFlatten}</span></label>`
  : mode === "signature" ? `
    <label>${text.signatureText}<input id="pdfSignatureText" type="text" maxlength="100" autocomplete="name"></label>
    <label>${text.signatureImage}<input id="pdfSignatureImage" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg"></label>
    <div class="pdf-signature-wrap"><strong>${text.signatureDraw}</strong><canvas id="pdfSignatureCanvas" class="pdf-signature-pad" width="440" height="140" aria-label="${text.signatureDraw}"></canvas><button class="text-button" id="pdfSignatureClear" type="button">${text.signatureClear}</button></div>
    <label>${text.position}<select id="pdfPosition">${positionOptions("bottom-right")}</select></label>
    <label>${text.signatureSize}<input id="pdfSignatureSize" type="number" value="24" min="5" max="80"></label>
    <label>${text.margin}<input id="pdfMargin" type="number" value="12" min="0" max="100" step="0.5"></label>
    <p class="pdf-option-note">${text.signatureNotice}</p>`
  : mode === "pdf-finisher" ? `
    <p class="pdf-option-note">${text.finishNotice}</p>
    <label>${text.finishPadding}<input id="pdfCropPadding" type="number" value="3" min="0" max="100" step="0.5"></label>
    <label>${text.numberStart}<input id="pdfNumberStart" type="number" value="1" min="0" max="999999"></label>
    <label>${text.numberStyle}<select id="pdfNumberStyle"><option value="number">${text.numberOnly}</option><option value="page">${text.numberPage}</option><option value="total" selected>${text.numberTotal}</option></select></label>
    <label>${text.position}<select id="pdfPosition">${positionOptions("bottom-center")}</select></label>
    <label>${text.fontSize}<input id="pdfFontSize" type="number" value="11" min="6" max="72"></label>
    <label>${text.margin}<input id="pdfMargin" type="number" value="8" min="0" max="100" step="0.5"></label>
    <label>${text.renameBase}<input id="pdfRenameBase" type="text" value="document" maxlength="80"></label>
    <div class="pdf-option-grid"><label>${text.renameStart}<input id="pdfRenameStart" type="number" value="1" min="0" max="999999"></label><label>${text.renameDigits}<select id="pdfRenameDigits"><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option></select></label></div>` : "";
root.innerHTML = `<section class="pdf-workspace" aria-labelledby="pdfWorkspaceTitle">
  <div class="pdf-drop" id="pdfDrop" tabindex="0" role="button"><input id="pdfInput" type="file" accept="${acceptsImages ? "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" : "application/pdf,.pdf"}" multiple hidden><span aria-hidden="true">＋</span><h2 id="pdfWorkspaceTitle">${acceptsImages ? text.dropImage : text.drop}</h2><p>${text.or}</p><button class="button button-dark" id="pdfChoose" type="button">${text.choose}</button><small>${text.note}</small><p class="pdf-load-status" id="pdfLoadStatus" role="status"></p></div>
  <div class="pdf-toolbar" hidden><div><strong>${text.modes[mode]}</strong><span id="pdfPageCount"></span></div><div><button class="button button-light" id="pdfAdd" type="button">＋ ${text.add}</button><button class="text-button" id="pdfClear" type="button">${text.clear}</button></div></div>
  <div class="pdf-body" hidden><aside class="pdf-options">
    <label ${features.selection ? "" : "hidden"}>${features.preserveAll ? text.targetPages : text.select}<select id="pdfSelection"><option value="all">${text.all}</option><option value="selected">${text.selected}</option><option value="odd">${text.odd}</option><option value="even">${text.even}</option><option value="range">${text.range}</option></select></label>
    <label id="pdfRangeWrap" hidden>${text.range}<input id="pdfRange" type="text" placeholder="${text.rangeHelp}"></label>
    <label ${features.output ? "" : "hidden"}>${text.output}<select id="pdfOutput"><option value="combined">${text.combined}</option><option value="separate" ${mode === "split" ? "selected" : ""}>${text.separate}</option></select></label>
    <label ${features.finishWorkflow ? "hidden" : ""}>${text.filename}<input id="pdfName" type="text" value="shiagent" maxlength="80"></label>
    ${acceptsImages ? `<label>${text.pageSize}<select id="pdfImageSize"><option value="auto">${text.auto}</option><option value="a4p">${text.a4p}</option><option value="a4l">${text.a4l}</option></select></label>` : ""}
    ${modeControls}
    <label class="pdf-check" ${features.reverse ? "" : "hidden"}><input id="pdfReverse" type="checkbox"><span>${text.reverse}</span></label>
    ${features.autoOrient ? `<div class="pdf-auto-orient"><button class="button button-light" id="pdfAutoOrient" type="button">↥ ${text.autoOrient}</button><small>${text.autoHelp}</small></div>` : ""}
    <button class="button button-accent" id="pdfExport" type="button">${text.exportModes[mode] || text.export} <span>→</span></button>${mode === "split" && supportsFolderDownload(window) ? `<button class="button button-light" id="pdfFolderExport" type="button">${text.folderExport}</button>` : ""}<p id="pdfStatus" role="status"></p>
  </aside><section class="pdf-pages-wrap"><p class="pdf-empty" id="pdfEmpty">${text.empty}</p><div class="pdf-pages" id="pdfPages"></div></section></div>
</section>`;

const $ = selector => root.querySelector(selector);
const elements = {
  input: $("#pdfInput"), drop: $("#pdfDrop"), choose: $("#pdfChoose"), add: $("#pdfAdd"), clear: $("#pdfClear"), toolbar: $(".pdf-toolbar"), body: $(".pdf-body"),
  pages: $("#pdfPages"), empty: $("#pdfEmpty"), count: $("#pdfPageCount"), selection: $("#pdfSelection"), range: $("#pdfRange"), rangeWrap: $("#pdfRangeWrap"),
  output: $("#pdfOutput"), name: $("#pdfName"), reverse: $("#pdfReverse"), imageSize: $("#pdfImageSize"), autoOrient: $("#pdfAutoOrient"), export: $("#pdfExport"), folderExport: $("#pdfFolderExport"), status: $("#pdfStatus"), loadStatus: $("#pdfLoadStatus"),
  mergeMethod: $("#pdfMergeMethod"), imageFormat: $("#pdfImageFormat"), imageDpi: $("#pdfImageDpi"), imageQuality: $("#pdfImageQuality"),
  numberStart: $("#pdfNumberStart"), numberStyle: $("#pdfNumberStyle"), position: $("#pdfPosition"), fontSize: $("#pdfFontSize"), margin: $("#pdfMargin"),
  watermarkText: $("#pdfWatermarkText"), watermarkImage: $("#pdfWatermarkImage"), opacity: $("#pdfOpacity"), watermarkRotation: $("#pdfWatermarkRotation"), watermarkSize: $("#pdfWatermarkSize"),
  cropMode: $("#pdfCropMode"), manualCrop: $("#pdfManualCrop"), cropPaddingWrap: $("#pdfCropPaddingWrap"), cropPadding: $("#pdfCropPadding"), cropTop: $("#pdfCropTop"), cropRight: $("#pdfCropRight"), cropBottom: $("#pdfCropBottom"), cropLeft: $("#pdfCropLeft"),
  nUpLayout: $("#pdfNUpLayout"), nUpPaper: $("#pdfNUpPaper"), nUpMargin: $("#pdfNUpMargin"), nUpGap: $("#pdfNUpGap"), nUpBorder: $("#pdfNUpBorder"),
  formFields: $("#pdfFormFields"), formFlatten: $("#pdfFormFlatten"), signatureText: $("#pdfSignatureText"), signatureImage: $("#pdfSignatureImage"), signatureCanvas: $("#pdfSignatureCanvas"), signatureClear: $("#pdfSignatureClear"), signatureSize: $("#pdfSignatureSize"),
  renameBase: $("#pdfRenameBase"), renameStart: $("#pdfRenameStart"), renameDigits: $("#pdfRenameDigits")
};
let sources = [];
let pages = [];
let sourceId = 0;
let pageId = 0;
let busy = false;
let draggedId = null;
let formFieldModels = [];
let signatureDrawn = false;

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
      if (mode === "merge" || mode === "interleave") syncPdfPages();
      else pages.push(model);
      render();
    }
  } catch (error) {
    sources = sources.filter(item => item !== source);
    if (mode === "merge" || mode === "interleave") syncPdfPages();
    else pages = pages.filter(page => page.sourceId !== source.id);
    throw error;
  } finally {
    if (typeof previewDocument.destroy === "function") await previewDocument.destroy();
    else if (typeof previewDocument.cleanup === "function") previewDocument.cleanup();
  }
}

function syncPdfPages() {
  const groups = sources.filter(source => source.models).map(source => source.models);
  pages = elements.mergeMethod?.value === "interleave" || mode === "interleave" ? interleaveGroups(groups) : groups.flat();
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

async function renderFormFields() {
  if (mode !== "form-fill" || !elements.formFields) return;
  elements.formFields.replaceChildren();
  formFieldModels = [];
  const source = sources[0];
  if (!source) return;
  const document = await PDFDocument.load(source.bytes, { ignoreEncryption: false });
  const fields = document.getForm().getFields();
  if (!fields.length) {
    const empty = root.ownerDocument.createElement("p");
    empty.textContent = text.formEmpty;
    elements.formFields.append(empty);
    return;
  }
  fields.forEach((field, index) => {
    const row = root.ownerDocument.createElement("label");
    row.className = "pdf-form-field";
    const title = root.ownerDocument.createElement("span");
    title.textContent = field.getName();
    row.append(title);
    let control;
    let type = "unsupported";
    if (field instanceof PDFTextField) {
      type = "text";
      control = root.ownerDocument.createElement(field.isMultiline() ? "textarea" : "input");
      if (control instanceof HTMLInputElement) control.type = "text";
      control.value = field.getText() || "";
    } else if (field instanceof PDFCheckBox) {
      type = "checkbox";
      control = root.ownerDocument.createElement("input");
      control.type = "checkbox";
      control.checked = field.isChecked();
    } else if (field instanceof PDFDropdown || field instanceof PDFRadioGroup || field instanceof PDFOptionList) {
      type = field instanceof PDFDropdown ? "dropdown" : field instanceof PDFRadioGroup ? "radio" : "option";
      control = root.ownerDocument.createElement("select");
      const selected = field.getSelected();
      const selectedValues = Array.isArray(selected) ? selected : [selected];
      if (field instanceof PDFOptionList && field.isMultiselect()) control.multiple = true;
      for (const value of field.getOptions()) {
        const option = root.ownerDocument.createElement("option");
        option.value = value;
        option.textContent = value;
        option.selected = selectedValues.includes(value);
        control.append(option);
      }
    } else {
      control = root.ownerDocument.createElement("small");
      control.textContent = ja ? "この形式は表示のみです" : "This field type is read-only here";
    }
    if (type !== "unsupported") {
      control.dataset.pdfFormField = String(index);
      formFieldModels.push({ index, name: field.getName(), type });
    }
    row.append(control);
    elements.formFields.append(row);
  });
}

async function addFiles(fileList, fromTray = false) {
  if (busy) return;
  if (mode === "form-fill" && fileList.length) {
    sources = [];
    pages = [];
    formFieldModels = [];
  }
  setBusy(true);
  setStatus(text.load);
  const files = mode === "form-fill" ? [...fileList].slice(0, 1) : [...fileList];
  const pdfFiles = files.filter(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name));
  try {
    for (const file of files) {
      if (acceptsImages && file.type.startsWith("image/")) await addImage(file);
      else if (!acceptsImages && (file.type === "application/pdf" || /\.pdf$/i.test(file.name))) await addPdf(file);
    }
    if (!acceptsImages) {
      if (mode === "merge" || mode === "interleave") syncPdfPages();
      if (!fromTray && pdfFiles.length) await replacePdfTray(sources.filter(source => source.file?.type === "application/pdf").map(source => source.file));
    }
    await renderFormFields();
    setStatus(fromTray ? text.trayLoaded(pdfFiles.length) : "");
  } catch (error) {
    console.error(error);
    setStatus(acceptsImages ? text.imageFailed : text.failed, true);
  } finally {
    elements.input.value = "";
    setBusy(false);
    render();
    if (pages.length) document.dispatchEvent(new CustomEvent("shiagent:output-options-ready"));
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

const mmToPoints = value => Math.max(0, Number(value) || 0) * 72 / 25.4;

function setupSignaturePad() {
  const canvas = elements.signatureCanvas;
  if (!canvas) return;
  const context = canvas.getContext("2d");
  context.lineWidth = 3;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#111";
  let drawing = false;
  const point = event => {
    const box = canvas.getBoundingClientRect();
    return { x: (event.clientX - box.left) * canvas.width / box.width, y: (event.clientY - box.top) * canvas.height / box.height };
  };
  canvas.addEventListener("pointerdown", event => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const start = point(event);
    context.beginPath();
    context.moveTo(start.x, start.y);
  });
  canvas.addEventListener("pointermove", event => {
    if (!drawing) return;
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
    signatureDrawn = true;
  });
  const stop = () => { drawing = false; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  elements.signatureClear?.addEventListener("click", () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    signatureDrawn = false;
  });
}

async function signatureAsset(output) {
  const file = elements.signatureImage?.files?.[0];
  if (file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return file.type === "image/png" || /\.png$/i.test(file.name) ? output.embedPng(bytes) : output.embedJpg(bytes);
  }
  if (signatureDrawn && elements.signatureCanvas) {
    const blob = await new Promise((resolve, reject) => elements.signatureCanvas.toBlob(value => value ? resolve(value) : reject(new Error(text.failed)), "image/png"));
    return output.embedPng(new Uint8Array(await blob.arrayBuffer()));
  }
  const label = elements.signatureText?.value.trim();
  if (!label) throw new Error(ja ? "署名文字・署名画像・手書き署名のいずれかを指定してください。" : "Enter, upload or draw a signature first.");
  const canvas = root.ownerDocument.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = "italic 64px cursive";
  canvas.width = Math.max(220, Math.ceil(context.measureText(label).width + 48));
  canvas.height = 112;
  const draw = canvas.getContext("2d");
  draw.font = "italic 64px cursive";
  draw.fillStyle = "#111";
  draw.textAlign = "center";
  draw.textBaseline = "middle";
  draw.fillText(label, canvas.width / 2, canvas.height / 2);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(text.failed)), "image/png"));
  return output.embedPng(new Uint8Array(await blob.arrayBuffer()));
}

async function watermarkAsset(output) {
  const file = elements.watermarkImage?.files?.[0];
  if (file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return file.type === "image/png" || /\.png$/i.test(file.name) ? output.embedPng(bytes) : output.embedJpg(bytes);
  }
  const label = elements.watermarkText?.value.trim() || "CONFIDENTIAL";
  const canvas = root.ownerDocument.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = "700 64px sans-serif";
  canvas.width = Math.max(160, Math.ceil(context.measureText(label).width + 32));
  canvas.height = 96;
  const draw = canvas.getContext("2d");
  draw.font = "700 64px sans-serif";
  draw.fillStyle = "#666";
  draw.textAlign = "center";
  draw.textBaseline = "middle";
  draw.fillText(label, canvas.width / 2, canvas.height / 2);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(text.failed)), "image/png"));
  return output.embedPng(new Uint8Array(await blob.arrayBuffer()));
}

function applyPageNumber(page, font, ordinal, total) {
  const size = Math.max(6, Math.min(72, Number(elements.fontSize?.value) || 11));
  const label = pageNumberLabel(ordinal, total, elements.numberStyle?.value, Number(elements.numberStart?.value) || 0);
  const width = font.widthOfTextAtSize(label, size);
  const margin = mmToPoints(elements.margin?.value);
  const box = page.getCropBox();
  const point = positionInBox(box.width, box.height, width, size, elements.position?.value, margin);
  page.drawText(label, { x: box.x + point.x, y: box.y + point.y, size, font, color: rgb(0.12, 0.12, 0.12) });
}

function applyWatermark(page, image) {
  const opacity = Math.max(0.05, Math.min(1, Number(elements.opacity?.value) || 0.18));
  const angle = Number(elements.watermarkRotation?.value) || 0;
  const rotation = degrees(angle);
  const ratio = Math.max(0.05, Math.min(1, (Number(elements.watermarkSize?.value) || 55) / 100));
  const pageWidth = page.getWidth(), pageHeight = page.getHeight();
  const width = pageWidth * ratio;
  const height = width * image.height / image.width;
  const point = positionInBox(pageWidth, pageHeight, width, height, elements.position?.value, 18);
  const radians = angle * Math.PI / 180;
  const centerX = point.x + width / 2, centerY = point.y + height / 2;
  const x = centerX - Math.cos(radians) * width / 2 + Math.sin(radians) * height / 2;
  const y = centerY - Math.sin(radians) * width / 2 - Math.cos(radians) * height / 2;
  page.drawImage(image, { x, y, width, height, opacity, rotate: rotation });
}

function applySignature(page, image) {
  const ratio = Math.max(0.05, Math.min(0.8, (Number(elements.signatureSize?.value) || 24) / 100));
  const width = page.getWidth() * ratio;
  const height = width * image.height / image.width;
  const point = positionInBox(page.getWidth(), page.getHeight(), width, height, elements.position?.value, mmToPoints(elements.margin?.value));
  page.drawImage(image, { ...point, width, height });
}

function applyCrop(page, model) {
  const box = page.getCropBox();
  let margins;
  if ((mode === "pdf-finisher" || elements.cropMode?.value === "auto") && model.autoCrop) {
    const padding = mmToPoints(elements.cropPadding?.value);
    margins = {
      left: Math.max(0, model.autoCrop.left * box.width - padding),
      right: Math.max(0, model.autoCrop.right * box.width - padding),
      top: Math.max(0, model.autoCrop.top * box.height - padding),
      bottom: Math.max(0, model.autoCrop.bottom * box.height - padding)
    };
  } else {
    margins = { top: mmToPoints(elements.cropTop?.value), right: mmToPoints(elements.cropRight?.value), bottom: mmToPoints(elements.cropBottom?.value), left: mmToPoints(elements.cropLeft?.value) };
  }
  const cropped = cropBoxFromMargins(box, margins);
  page.setCropBox(cropped.x, cropped.y, cropped.width, cropped.height);
}

async function buildPdf(models, targetIds = null) {
  const output = await PDFDocument.create();
  const loaded = new Map();
  const font = mode === "page-numbers" || mode === "pdf-finisher" ? await output.embedFont(StandardFonts.Helvetica) : null;
  const watermark = mode === "watermark" ? await watermarkAsset(output) : null;
  const signature = mode === "signature" ? await signatureAsset(output) : null;
  const targetModels = targetIds ? models.filter(model => targetIds.has(model.id)) : models;
  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];
    const source = sources.find(item => item.id === model.sourceId);
    let page;
    if (model.sourceType === "pdf") {
      if (!loaded.has(source.id)) loaded.set(source.id, await PDFDocument.load(source.bytes, { ignoreEncryption: false }));
      [page] = await output.copyPages(loaded.get(source.id), [model.sourcePage]);
      page.setRotation(degrees(rotateAngle(page.getRotation().angle, model.rotation)));
      output.addPage(page);
    } else {
      const image = source.mime === "image/jpeg" ? await output.embedJpg(source.bytes) : await output.embedPng(await pngBytes(source));
      const [width, height] = imagePageBox(source);
      page = output.addPage([width, height]);
      const scale = Math.min(width / image.width, height / image.height);
      const drawWidth = image.width * scale, drawHeight = image.height * scale;
      page.drawImage(image, { x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight });
      page.setRotation(degrees(model.rotation));
    }
    if (!targetIds || targetIds.has(model.id)) {
      const ordinal = Math.max(0, targetModels.findIndex(item => item.id === model.id));
      if (mode === "page-numbers") applyPageNumber(page, font, ordinal, targetModels.length);
      else if (mode === "watermark") applyWatermark(page, watermark);
      else if (mode === "crop") applyCrop(page, model);
      else if (mode === "signature") applySignature(page, signature);
      else if (mode === "pdf-finisher") { applyCrop(page, model); applyPageNumber(page, font, ordinal, targetModels.length); }
    }
  }
  output.setProducer("SHIAGENT");
  output.setCreator("SHIAGENT PDF Tools");
  return new Uint8Array(await output.save({ useObjectStreams: true }));
}

async function buildNUpPdf(models) {
  const output = await PDFDocument.create();
  const loaded = new Map();
  const grid = nUpGrid(elements.nUpLayout?.value);
  const [sheetWidth, sheetHeight] = elements.nUpPaper?.value === "a4p" ? [595.28, 841.89] : [841.89, 595.28];
  const margin = mmToPoints(elements.nUpMargin?.value);
  const gap = mmToPoints(elements.nUpGap?.value);
  const cellWidth = (sheetWidth - margin * 2 - gap * (grid.columns - 1)) / grid.columns;
  const cellHeight = (sheetHeight - margin * 2 - gap * (grid.rows - 1)) / grid.rows;
  for (let offset = 0; offset < models.length; offset += grid.count) {
    const sheet = output.addPage([sheetWidth, sheetHeight]);
    const group = models.slice(offset, offset + grid.count);
    for (let slot = 0; slot < group.length; slot += 1) {
      const model = group[slot];
      const source = sources.find(item => item.id === model.sourceId);
      if (!loaded.has(source.id)) loaded.set(source.id, await PDFDocument.load(source.bytes, { ignoreEncryption: false }));
      const sourcePage = loaded.get(source.id).getPage(model.sourcePage);
      const embedded = await output.embedPage(sourcePage);
      const fitted = fitInsideBox(sourcePage.getWidth(), sourcePage.getHeight(), cellWidth, cellHeight);
      const column = slot % grid.columns;
      const row = Math.floor(slot / grid.columns);
      const cellX = margin + column * (cellWidth + gap);
      const cellY = sheetHeight - margin - (row + 1) * cellHeight - row * gap;
      sheet.drawPage(embedded, { x: cellX + fitted.x, y: cellY + fitted.y, width: fitted.width, height: fitted.height });
      if (elements.nUpBorder?.checked) sheet.drawRectangle({ x: cellX, y: cellY, width: cellWidth, height: cellHeight, borderColor: rgb(0.65, 0.65, 0.65), borderWidth: 0.5 });
    }
  }
  output.setProducer("SHIAGENT");
  output.setCreator("SHIAGENT PDF Tools");
  return new Uint8Array(await output.save({ useObjectStreams: true }));
}

async function buildFormPdf() {
  const source = sources[0];
  if (!source) throw new Error(text.invalid);
  const output = await PDFDocument.load(source.bytes, { ignoreEncryption: false });
  const form = output.getForm();
  const fields = form.getFields();
  for (const model of formFieldModels) {
    const field = fields[model.index];
    const control = elements.formFields?.querySelector(`[data-pdf-form-field="${model.index}"]`);
    if (!field || !control) continue;
    if (model.type === "text") field.setText(control.value);
    else if (model.type === "checkbox") control.checked ? field.check() : field.uncheck();
    else if (model.type === "option") field.select([...control.selectedOptions].map(option => option.value));
    else if (control.value) field.select(control.value);
  }
  if (elements.formFlatten?.checked) form.flatten();
  output.setProducer("SHIAGENT");
  output.setCreator("SHIAGENT PDF Tools");
  return new Uint8Array(await output.save({ useObjectStreams: true }));
}

async function prepareAutoCrops(models, targetIds) {
  if (!((mode === "crop" && elements.cropMode?.value === "auto") || mode === "pdf-finisher")) return;
  const documents = new Map();
  try {
    const targets = models.filter(model => targetIds.has(model.id));
    for (let index = 0; index < targets.length; index += 1) {
      const model = targets[index];
      const source = sources.find(item => item.id === model.sourceId);
      if (!documents.has(source.id)) documents.set(source.id, await getDocument({ data: source.bytes.slice() }).promise);
      setStatus(`${text.exporting} ${index + 1}/${targets.length}`);
      const pdfPage = await documents.get(source.id).getPage(model.sourcePage + 1);
      const base = pdfPage.getViewport({ scale: 1, rotation: 0 });
      const viewport = pdfPage.getViewport({ scale: Math.min(2, 1200 / Math.max(base.width, base.height)), rotation: 0 });
      const canvas = root.ownerDocument.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
      await pdfPage.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
      model.autoCrop = detectWhiteContentBounds(context.getImageData(0, 0, canvas.width, canvas.height));
      pdfPage.cleanup();
    }
  } finally {
    for (const document of documents.values()) {
      if (typeof document.destroy === "function") await document.destroy().catch(() => {});
      else if (typeof document.cleanup === "function") document.cleanup();
    }
  }
}

async function exportImages() {
  const indexes = selectPageIndexes(pages.length, elements.selection.value, elements.range.value, pages.map((page, index) => page.selected ? index : -1));
  const models = indexes.map(index => pages[index]).filter(Boolean);
  if (!models.length) { setStatus(text.invalid, true); return; }
  setBusy(true);
  setStatus(text.exporting);
  const documents = new Map();
  try {
    const format = elements.imageFormat?.value || "webp";
    const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    const quality = Number(elements.imageQuality?.value) || 0.9;
    const scale = (Number(elements.imageDpi?.value) || 150) / 72;
    const baseName = safePdfName(elements.name.value).replace(/\.pdf$/, "");
    const files = [];
    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];
      const source = sources.find(item => item.id === model.sourceId);
      if (!documents.has(source.id)) documents.set(source.id, await getDocument({ data: source.bytes.slice() }).promise);
      setStatus(`${text.exporting} ${index + 1}/${models.length}`);
      const pdfPage = await documents.get(source.id).getPage(model.sourcePage + 1);
      const baseRotation = Number(pdfPage.rotate) || 0;
      const viewport = pdfPage.getViewport({ scale, rotation: rotateAngle(baseRotation, model.rotation) });
      const canvas = root.ownerDocument.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      await pdfPage.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport, background: "#ffffff" }).promise;
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(text.failed)), mime, quality));
      const name = `${baseName}_${String(index + 1).padStart(3, "0")}.${format === "jpeg" ? "jpg" : format}`;
      files.push(new File([blob], name, { type: mime }));
      pdfPage.cleanup();
    }
    if (files.length === 1) download(files[0], files[0].name);
    else {
      const entries = [];
      for (const file of files) entries.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
      download(createZipBlob(entries), `${baseName}.zip`);
    }
    await replaceTray(files, "pdf-to-images");
    setStatus(text.imageComplete(files.length));
  } catch (error) {
    console.error(error);
    setStatus(text.failed, true);
  } finally {
    for (const document of documents.values()) {
      if (typeof document.destroy === "function") await document.destroy().catch(() => {});
      else if (typeof document.cleanup === "function") document.cleanup();
    }
    setBusy(false);
  }
}

async function exportFinishedPdfs() {
  if (!pages.length || busy) return;
  await autoOrientPages();
  setBusy(true);
  setStatus(text.exporting);
  try {
    const targetIds = new Set(pages.map(page => page.id));
    await prepareAutoCrops(pages, targetIds);
    const base = safePdfName(elements.renameBase?.value || "document").replace(/\.pdf$/i, "");
    const start = Math.max(0, Number(elements.renameStart?.value) || 0);
    const digits = Math.max(2, Math.min(4, Number(elements.renameDigits?.value) || 3));
    const files = [];
    const trayFiles = [];
    const pdfSources = sources.filter(source => source.models?.length);
    for (let index = 0; index < pdfSources.length; index += 1) {
      const source = pdfSources[index];
      const name = `${base}-${String(start + index).padStart(digits, "0")}.pdf`;
      const data = await buildPdf(source.models);
      files.push({ name, data });
      trayFiles.push(new File([data], name, { type: "application/pdf" }));
      setStatus(`${text.exporting} ${index + 1}/${pdfSources.length}`);
    }
    if (files.length === 1) download(new Blob([files[0].data], { type: "application/pdf" }), files[0].name);
    else download(createZipBlob(files), `${base}.zip`);
    await replacePdfTray(trayFiles);
    setStatus(text.complete(pages.length));
  } catch (error) {
    console.error(error);
    setStatus(error?.message || text.failed, true);
  } finally {
    setBusy(false);
  }
}

async function exportPdf() {
  if (!pages.length || busy) return;
  if (features.finishWorkflow) { await exportFinishedPdfs(); return; }
  if (features.imageOutput) { await exportImages(); return; }
  let indexes = selectPageIndexes(pages.length, elements.selection.value, elements.range.value, pages.map((page, index) => page.selected ? index : -1));
  if (features.reverse && elements.reverse.checked) indexes.reverse();
  const selectedModels = indexes.map(index => pages[index]).filter(Boolean);
  if (!selectedModels.length) { setStatus(text.invalid, true); return; }
  const models = features.preserveAll ? pages : selectedModels;
  const targetIds = features.preserveAll ? new Set(selectedModels.map(model => model.id)) : null;
  setBusy(true);
  setStatus(text.exporting);
  try {
    if (features.formOutput) {
      const name = safePdfName(elements.name.value);
      const data = await buildFormPdf();
      download(new Blob([data], { type: "application/pdf" }), name);
      await replacePdfTray([new File([data], name, { type: "application/pdf" })]);
      setStatus(text.complete(pages.length));
      return;
    }
    if (features.nUpOutput) {
      const name = safePdfName(elements.name.value);
      const data = await buildNUpPdf(selectedModels);
      download(new Blob([data], { type: "application/pdf" }), name);
      await replacePdfTray([new File([data], name, { type: "application/pdf" })]);
      setStatus(text.complete(selectedModels.length));
      return;
    }
    await prepareAutoCrops(models, targetIds);
    const name = safePdfName(elements.name.value);
    const trayFiles = [];
    if (elements.output.value === "separate") {
      const files = [];
      for (let index = 0; index < models.length; index += 1) {
        const outputName = name.replace(/\.pdf$/, `_${String(index + 1).padStart(2, "0")}.pdf`);
        const data = await buildPdf([models[index]], targetIds);
        files.push({ name: outputName, data });
        trayFiles.push(new File([data], outputName, { type: "application/pdf" }));
      }
      download(createZipBlob(files), name.replace(/\.pdf$/, ".zip"));
    } else {
      const data = await buildPdf(models, targetIds);
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
  formFieldModels = [];
  elements.formFields?.replaceChildren();
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
elements.mergeMethod?.addEventListener("change", () => {
  syncPdfPages();
  elements.export.innerHTML = `${elements.mergeMethod.value === "interleave" ? text.exportModes.interleave : text.exportModes.merge} <span>→</span>`;
  render();
});
elements.cropMode?.addEventListener("change", () => {
  const manual = elements.cropMode.value === "manual";
  elements.manualCrop.hidden = !manual;
  elements.cropPaddingWrap.hidden = manual;
});
setupSignaturePad();
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
