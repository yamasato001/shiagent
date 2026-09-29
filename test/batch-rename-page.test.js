import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const renameHtml = await readFile(new URL("../ja/batch-rename/index.html", import.meta.url), "utf8");
const splitterHtml = await readFile(new URL("../ja/image-splitter/index.html", import.meta.url), "utf8");
const vectorHtml = await readFile(new URL("../ja/image-to-svg/index.html", import.meta.url), "utf8");
const compressorHtml = await readFile(new URL("../ja/image-compressor/index.html", import.meta.url), "utf8");
const converterHtml = await readFile(new URL("../ja/image-converter/index.html", import.meta.url), "utf8");
const resizerHtml = await readFile(new URL("../ja/image-resizer/index.html", import.meta.url), "utf8");
const cropperHtml = await readFile(new URL("../ja/image-cropper/index.html", import.meta.url), "utf8");
const paddingHtml = await readFile(new URL("../ja/canvas-padding/index.html", import.meta.url), "utf8");
const joinerHtml = await readFile(new URL("../ja/image-joiner/index.html", import.meta.url), "utf8");
const metadataHtml = await readFile(new URL("../ja/metadata-cleaner/index.html", import.meta.url), "utf8");
const rasterizerHtml = await readFile(new URL("../ja/svg-to-image/index.html", import.meta.url), "utf8");
const colorHtml = await readFile(new URL("../ja/color-tool/index.html", import.meta.url), "utf8");
const faviconHtml = await readFile(new URL("../ja/favicon-generator/index.html", import.meta.url), "utf8");
const whiteFillHtml = await readFile(new URL("../ja/svg-white-fill/index.html", import.meta.url), "utf8");
const cleanerHtml = await readFile(new URL("../ja/svg-cleaner/index.html", import.meta.url), "utf8");
const whiteFillEditorHtml = await readFile(new URL("../ja/svg-white-fill/editor/index.html", import.meta.url), "utf8");
const siteCss = await readFile(new URL("../assets/css/site.css", import.meta.url), "utf8");
const workTrayCss = await readFile(new URL("../assets/css/work-tray.css", import.meta.url), "utf8");
const queueDropJs = await readFile(new URL("../assets/js/queue-drop.js", import.meta.url), "utf8");
const workflowHandoffJs = await readFile(new URL("../assets/js/workflow-handoff.js", import.meta.url), "utf8");
const workTrayJs = await readFile(new URL("../assets/js/work-tray.js", import.meta.url), "utf8");
const whiteFillEditorJs = await readFile(new URL("../assets/js/svg-white-fill-editor.js", import.meta.url), "utf8");

test("batch rename exposes naming controls and both next-tool actions", () => {
  for (const id of ["prefixInput", "baseInput", "startInput", "digitsInput", "suffixInput", "separatorInput"]) assert.match(renameHtml, new RegExp(`id="${id}"`));
  assert.match(renameHtml, /id="toSplitterButton"/);
  assert.match(renameHtml, /id="toSvgButton"/);
  assert.match(renameHtml, /<input id="fileInput" type="file" multiple hidden>/);
  assert.doesNotMatch(renameHtml, /id="fileInput"[^>]*accept=/);
  assert.match(renameHtml, /あらゆるファイルをここにドロップ/);
  assert.match(workflowHandoffJs, /path: localPath\("\/batch-rename\/"\), accepts: \(\) => true/);
});

test("every production tool loads the shared work tray", () => {
  assert.match(splitterHtml, /workflow-handoff\.js/);
  assert.match(vectorHtml, /workflow-handoff\.js/);
  assert.match(compressorHtml, /workflow-handoff\.js/);
  assert.match(converterHtml, /workflow-handoff\.js/);
  assert.match(resizerHtml, /workflow-handoff\.js/);
  assert.match(cropperHtml, /workflow-handoff\.js/);
  assert.match(paddingHtml, /workflow-handoff\.js/);
  assert.match(joinerHtml, /workflow-handoff\.js/);
  assert.match(metadataHtml, /workflow-handoff\.js/);
  assert.match(rasterizerHtml, /workflow-handoff\.js/);
  assert.match(colorHtml, /workflow-handoff\.js/);
  assert.match(faviconHtml, /workflow-handoff\.js/);
  assert.match(renameHtml, /workflow-handoff\.js/);
  assert.match(whiteFillHtml, /workflow-handoff\.js/);
  assert.match(cleanerHtml, /workflow-handoff\.js/);
});

test("work tray exposes a clear control backed by IndexedDB cleanup", () => {
  assert.match(workflowHandoffJs, /id="workTrayClear"/);
  assert.match(workflowHandoffJs, /await clearTray\(\)/);
  assert.match(workTrayJs, /export async function clearTray\(\)/);
  assert.match(workflowHandoffJs, /assets\/css\/work-tray\.css/);
  assert.match(workTrayCss, /\.work-tray-heading > \.work-tray-heading-actions \{[^}]*flex-direction: row/);
  assert.match(workTrayCss, /\.work-tray \.work-tray-clear \{[^}]*width: auto[^}]*white-space: nowrap/);
});

test("work tray closes when the user clicks outside it", () => {
  assert.match(workflowHandoffJs, /document\.addEventListener\("pointerdown"/);
  assert.match(workflowHandoffJs, /!panel\.hidden && !dock\.contains\(event\.target\)/);
});

test("supported browsers can save a completed batch directly into one folder", () => {
  assert.match(workflowHandoffJs, /supportsFolderDownload\(window\)/);
  assert.match(workflowHandoffJs, /chooseOutputDirectory\(window\)/);
  assert.match(workflowHandoffJs, /writeFilesToDirectory\(directory, files/);
  assert.match(workflowHandoffJs, /folder-download-button/);
});

test("file queues replace the drop zone and stay above settings after selection", () => {
  assert.match(siteCss, /\.compressor-card > \.queue-panel \{ order: 1; \}/);
  assert.match(siteCss, /\.compressor-card > \.settings-panel \{ order: 2; \}/);
  assert.match(siteCss, /\.compressor-card:has\(> \.queue-panel:not\(\[hidden\]\)\) > \.drop-zone \{ display: none; \}/);
});

test("visible file queues accept repeated drag-and-drop additions", () => {
  assert.match(queueDropJs, /queuePanel\.addEventListener\("drop"/);
  assert.match(queueDropJs, /fileInput\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
  assert.match(queueDropJs, /dropEffect = "copy"/);
  assert.match(siteCss, /\.queue-panel\.is-over::after/);
});

test("compressor accepts PNG, JPEG and WebP in the same picker", () => {
  assert.match(compressorHtml, /accept="image\/png,image\/jpeg,image\/webp,\.png,\.jpg,\.jpeg,\.webp"/);
  assert.match(compressorHtml, /PNG・JPEG・WebP/);
  assert.match(compressorHtml, /形式は自動判別/);
});

test("vectorizer accepts PNG, JPEG and WebP in the same picker", () => {
  assert.match(vectorHtml, /accept="image\/png,image\/jpeg,image\/webp,\.png,\.jpg,\.jpeg,\.webp"/);
  assert.match(vectorHtml, /画像をSVGに変換（PNG・JPEG・WebP対応）/);
  assert.match(vectorHtml, /形式を自動判別/);
});

test("renamed JPEG and WebP files can continue to the image-to-SVG tool", () => {
  assert.match(renameHtml, /対応する画像だけを画像ツールへ渡す/);
  assert.match(renameHtml, /画像 → SVG変換へ/);
});

test("renamed tool pages expose their new canonical URLs", () => {
  assert.match(compressorHtml, /rel="canonical" href="https:\/\/shiagent\.com\/ja\/image-compressor\/"/);
  assert.match(vectorHtml, /rel="canonical" href="https:\/\/shiagent\.com\/ja\/image-to-svg\/"/);
  assert.doesNotMatch(compressorHtml + vectorHtml, /\/ja\/(?:png-compressor|png-to-svg)\//);
});

test("image converter exposes HEIC input and unified output choices", () => {
  assert.match(converterHtml, /image\/heic/);
  assert.match(converterHtml, /\.heif/);
  for (const format of ["png", "jpeg", "webp"]) assert.match(converterHtml, new RegExp(`name="outputFormat" value="${format}"`));
});

test("image resizer exposes pixel and percentage modes", () => {
  assert.match(resizerHtml, /name="resizeMode" value="pixels"/);
  assert.match(resizerHtml, /name="resizeMode" value="percent"/);
  assert.match(resizerHtml, /id="widthInput"/);
  assert.match(resizerHtml, /id="heightInput"/);
  assert.match(resizerHtml, /id="percentInput"/);
  assert.match(resizerHtml, /id="keepAspectInput"/);
  assert.match(resizerHtml, /先頭画像の縦横比を基準に自動連動/);
  assert.match(resizerHtml, /image\/heic/);
});

test("image cropper exposes manual, auto trim and normalize modes", () => {
  for (const mode of ["manual", "auto", "normalize"]) assert.match(cropperHtml, new RegExp(`name="cropMode" value="${mode}"`));
  for (const id of ["backgroundMode", "toleranceInput", "safeEdgeInput", "paddingInput", "canvasWidth", "canvasHeight", "occupancyInput", "cropCanvas"]) assert.match(cropperHtml, new RegExp(`id="${id}"`));
});

test("canvas padding exposes relative and fixed canvas modes", () => {
  for (const mode of ["relative", "fixed"]) assert.match(paddingHtml, new RegExp(`name="paddingMode" value="${mode}"`));
  for (const id of ["paddingInput", "paddingUnit", "canvasWidth", "canvasHeight", "backgroundSelect", "paddingButton"]) assert.match(paddingHtml, new RegExp(`id="${id}"`));
  assert.match(paddingHtml, /image\/heic/);
});

test("metadata cleaner accepts PNG, JPEG and WebP and exposes batch cleaning", () => {
  assert.match(metadataHtml, /accept="image\/png,image\/jpeg,image\/webp,\.png,\.jpg,\.jpeg,\.webp"/);
  assert.match(metadataHtml, /id="cleanButton"/);
  assert.match(metadataHtml, /GPS/);
  assert.match(metadataHtml, /再エンコードしない/);
});

test("SVG rasterizer exposes PNG, WebP, sizing, DPI and background controls", () => {
  assert.match(rasterizerHtml, /<h1>SVG → 画像<\/h1>/);
  assert.match(rasterizerHtml, /accept="image\/svg\+xml,\.svg"/);
  for (const value of ["scale", "pixels", "dpi"]) assert.match(rasterizerHtml, new RegExp(`name="sizeMode" value="${value}"`));
  for (const id of ["widthInput", "heightInput", "dpiInput", "backgroundColor", "rasterizeButton"]) assert.match(rasterizerHtml, new RegExp(`id="${id}"`));
  for (const format of ["png", "webp"]) assert.match(rasterizerHtml, new RegExp(`<option value="${format}"`));
});

test("color tool exposes replacement, transparency and black-and-white controls", () => {
  assert.match(colorHtml, /accept="image\/png,image\/jpeg,image\/webp,image\/svg\+xml/);
  for (const mode of ["transparent", "replace", "grayscale", "monochrome"]) assert.match(colorHtml, new RegExp(`name="colorMode" value="${mode}"`));
  for (const id of ["targetColor", "replacementColor", "toleranceInput", "thresholdInput", "processButton"]) assert.match(colorHtml, new RegExp(`id="${id}"`));
});

test("favicon generator exposes ICO, Apple and PWA output settings", () => {
  assert.match(faviconHtml, /accept="image\/png,image\/jpeg,image\/webp,image\/svg\+xml/);
  for (const id of ["fitMode", "paddingInput", "backgroundMode", "appName", "themeColor", "generateButton"]) assert.match(faviconHtml, new RegExp(`id="${id}"`));
  assert.match(faviconHtml, /favicon\.ico/);
  assert.match(faviconHtml, /Apple Touch Icon/);
  assert.match(faviconHtml, /maskable/);
});

test("image joiner exposes horizontal, vertical and grid layouts", () => {
  for (const mode of ["horizontal", "vertical", "grid"]) assert.match(joinerHtml, new RegExp(`name="joinMode" value="${mode}"`));
  for (const id of ["columnsInput", "gapInput", "paddingInput", "backgroundSelect", "outputFormat", "joinButton"]) assert.match(joinerHtml, new RegExp(`id="${id}"`));
  assert.match(joinerHtml, /image\/heic/);
});

test("manual white-fill editor auto-updates close, exclude and erase operations", () => {
  assert.match(whiteFillEditorHtml, /value="close"/);
  assert.match(whiteFillEditorHtml, /value="exclude"/);
  assert.match(whiteFillEditorHtml, /value="erase"/);
  assert.match(whiteFillEditorHtml, /id="undoButton"/);
  assert.doesNotMatch(whiteFillEditorHtml, /id="previewButton"|プレビュー更新/);
  assert.match(whiteFillEditorHtml, /操作のたびに自動更新/);
  assert.match(whiteFillEditorJs, /for \(const session of state\.sessions\) await requestPreview\(session\)/);
  assert.match(whiteFillEditorJs, /function markStale\(session\)[\s\S]*requestPreview\(session\)/);
});
