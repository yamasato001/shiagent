import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const published = new URL("../", import.meta.url);
const readPublished = path => readFile(new URL(path, published), "utf8");
const renameHtml = await readPublished("ja/batch-rename/index.html");
const splitterHtml = await readPublished("ja/image-splitter/index.html");
const vectorHtml = await readPublished("ja/image-to-svg/index.html");
const compressorHtml = await readPublished("ja/image-compressor/index.html");
const converterHtml = await readPublished("ja/image-converter/index.html");
const resizerHtml = await readPublished("ja/image-resizer/index.html");
const cropperHtml = await readPublished("ja/image-cropper/index.html");
const paddingHtml = await readPublished("ja/canvas-padding/index.html");
const joinerHtml = await readPublished("ja/image-joiner/index.html");
const metadataHtml = await readPublished("ja/metadata-cleaner/index.html");
const rasterizerHtml = await readPublished("ja/svg-to-image/index.html");
const colorHtml = await readPublished("ja/color-tool/index.html");
const faviconHtml = await readPublished("ja/favicon-generator/index.html");
const whiteFillHtml = await readPublished("ja/svg-white-fill/index.html");
const cleanerHtml = await readPublished("ja/svg-cleaner/index.html");
const whiteFillEditorHtml = await readPublished("ja/svg-white-fill/editor/index.html");
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
  assert.match(workTrayJs, /SOURCE_HANDLE_ID/);
  assert.match(workTrayJs, /preferredOutputStartIn\(\)/);
  assert.match(workTrayJs, /export async function readTraySourceHandle\(\)/);
  assert.match(workflowHandoffJs, /rememberSourceFileHandle\(sourceHandle\)/);
  assert.match(workflowHandoffJs, /assets\/css\/work-tray\.css/);
  assert.match(workTrayCss, /\.work-tray-heading > \.work-tray-heading-actions \{[^}]*flex-direction: row/);
  assert.match(workTrayCss, /\.work-tray \.work-tray-clear \{[^}]*width: auto[^}]*white-space: nowrap/);
});

test("work tray stays inside small viewports", () => {
  assert.match(workTrayCss, /\.work-tray-panel \{[^}]*max-height: calc\(100dvh - 99px\)[^}]*overflow-y: auto/);
  assert.match(workTrayCss, /\.work-tray-heading \{[^}]*position: sticky[^}]*top: 0/);
  assert.match(workTrayCss, /@media \(max-width: 430px\) \{[\s\S]*?\.work-tray \{[^}]*right: max\(10px, env\(safe-area-inset-right\)\)[^}]*left: max\(10px, env\(safe-area-inset-left\)\)[^}]*width: auto/);
  assert.match(workTrayCss, /@media \(max-height: 520px\) \{[\s\S]*?max-height: calc\(100dvh - 78px\)/);
});

test("mobile work tray stays compact and minimizes when empty", () => {
  assert.match(workflowHandoffJs, /dock\.classList\.toggle\("is-empty", isEmpty\)/);
  assert.doesNotMatch(workTrayCss, /@media \(max-width: 760px\) \{[\s\S]*?\n  \.work-tray-toggle \{/);
  assert.match(workTrayCss, /\.work-tray\.is-empty:not\(\.is-open\) \{[^}]*width: 40px/);
});

test("work tray shows only compatible next tools", () => {
  assert.match(workflowHandoffJs, /\.filter\(\(\{ tool, count \}\) => tool !== currentTool && count > 0\)/);
  assert.match(workflowHandoffJs, /toolList\.hidden = availableTools\.length === 0/);
  assert.match(workflowHandoffJs, /workTrayToolsEmpty/);
  assert.doesNotMatch(workflowHandoffJs, /is-disabled|aria-disabled/);
  assert.equal((workflowHandoffJs.match(/path: localPath\("\/favicon-generator\/"\)/g) || []).length, 1);
  assert.match(workTrayCss, /\.work-tray-tools\[hidden\] \{ display: none; \}/);
});

test("work tray closes when the user clicks outside it", () => {
  assert.match(workflowHandoffJs, /document\.addEventListener\("pointerdown"/);
  assert.match(workflowHandoffJs, /!panel\.hidden && !dock\.contains\(event\.target\)/);
});

test("supported browsers can save a completed batch directly into one folder", () => {
  assert.match(workflowHandoffJs, /supportsFolderDownload\(window\)/);
  assert.match(workflowHandoffJs, /chooseOutputDirectory\(window, preferredOutputStartIn\(\) \|\| "downloads"\)/);
  assert.match(workflowHandoffJs, /clearPreferredOutputStartIn\(\)/);
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
  assert.match(whiteFillEditorHtml, /id="nextButton"/);
  assert.match(whiteFillEditorHtml, /id="clearAllButton"[^>]*>すべてをクリア</);
  assert.match(whiteFillEditorHtml, /id="clearAllButton"[\s\S]*id="downloadButton"/);
  assert.doesNotMatch(whiteFillEditorHtml, /saveNextButton|確定して次へ/);
  assert.match(whiteFillEditorJs, /async function moveNext\(\)[\s\S]*await ensureFinalResult\(session\)/);
  assert.match(whiteFillEditorJs, /state\.completed = true/);
  assert.match(whiteFillEditorJs, /state\.completed = false;[\s\S]*state\.index = 0/);
  assert.match(whiteFillEditorJs, /function clearAll\(\)/);
});

test("manual white-fill editor offers ZIP or shared direct-folder saving", () => {
  assert.match(whiteFillEditorHtml, /id="downloadAllButton"/);
  assert.match(whiteFillEditorHtml, /id="editedSuffixInput"[^>]*checked/);
  assert.match(whiteFillEditorHtml, /id="downloadAllButton"[\s\S]*id="editedSuffixInput"/);
  assert.match(whiteFillEditorJs, /showOpenFilePicker/);
  assert.match(whiteFillEditorJs, /sourceHandle/);
  assert.match(whiteFillEditorJs, /applyConfiguredOutputSuffix\(`\$\{stem\}\.svg`\)/);
  assert.match(whiteFillEditorJs, /async function downloadAll\(\)/);
  assert.match(whiteFillEditorJs, /createZipBlob\(entries, undefined, \{ applySuffix: false \}\)/);
  assert.match(whiteFillEditorHtml, /class="editor-topbar"[\s\S]*id="downloadAllButton"[\s\S]*id="editedSuffixInput"[\s\S]*class="editor-nav"/);
  assert.doesNotMatch(whiteFillEditorHtml, /class="editor-sidebar"[\s\S]*id="downloadAllButton"/);
  assert.match(whiteFillEditorHtml, /class="editor-workspace"[^>]*>[\s\S]*class="editor-zoom"/);
  assert.doesNotMatch(whiteFillEditorHtml, /class="editor-topbar"[\s\S]*class="editor-zoom"[\s\S]*class="editor-layout"/);
});

test("manual white-fill usage example does not shrink the editor workspace", async () => {
  for (const html of [whiteFillEditorHtml, await readPublished("svg-white-fill/editor/index.html")]) {
    assert.match(html, /<\/main><section class="content-section tool-example"/);
    assert.doesNotMatch(html, /<main class="svg-editor"[\s\S]*<section class="content-section tool-example"[\s\S]*<\/main>/);
  }
});

test("manual white-fill editor exposes touch gestures and compact mobile controls", () => {
  assert.match(whiteFillEditorHtml, /editor-help-touch[^>]*>タップ: 編集/);
  assert.match(whiteFillEditorHtml, /editor-help-touch[^>]*>ピンチ: 拡大縮小/);
  assert.match(siteCss, /\.editor-canvas-wrap canvas \{[^}]*touch-action: none/);
  assert.match(siteCss, /@media \(max-width: 760px\) \{[\s\S]*?\.editor-mode-group \{[^}]*grid-template-columns: repeat\(3/);
  assert.match(siteCss, /\.editor-help-touch \{ display: inline; \}/);
  assert.match(whiteFillEditorJs, /addEventListener\("pointerdown", touchPointerDown\)/);
  assert.match(whiteFillEditorJs, /touchGesture\.zoom \* distance \/ touchGesture\.distance/);
  assert.match(whiteFillEditorJs, /Math\.hypot\(dx, dy\) > 6/);
});

test("manual white-fill editor uses fast cached previews and full-resolution exports", () => {
  assert.match(whiteFillEditorJs, /const PREVIEW_LONG_SIDE = 768/);
  assert.match(whiteFillEditorJs, /analysisCache: new Map\(\)/);
  assert.match(whiteFillEditorJs, /session\.analysisCache\.has\(longSide\)/);
  assert.match(whiteFillEditorJs, /Math\.min\(PREVIEW_LONG_SIDE, selected\.longSide\)/);
  assert.match(whiteFillEditorJs, /calculateAtResolution\(session, selected, selected\.longSide\)/);
  assert.match(whiteFillEditorJs, /await ensureFinalResult\(session\)/);
});

test("manual white-fill editor auto-fills only SVGs without an existing white fill", () => {
  assert.match(whiteFillEditorJs, /autoFillClosedRegions: null/);
  assert.match(whiteFillEditorJs, /session\.autoFillClosedRegions = !managedFillMask && !hasWhiteFill/);
  assert.match(whiteFillEditorJs, /newlyClosedRegionMask\(mask, originalMask\)/);
  assert.match(whiteFillEditorJs, /excludeMaskRegions\(mask, width, height, excludedPoints\)/);
  assert.match(whiteFillEditorJs, /const managedSvg = managedFillSvg\(parsed\)/);
});

test("close-gap mode supports drag-release guide lines and keeps two-tap input", () => {
  assert.match(whiteFillEditorHtml, /ドラッグまたは2点タップ/);
  assert.match(whiteFillEditorJs, /function commitGuideLine\(session, start, end\)/);
  assert.match(whiteFillEditorJs, /state\.dragLine = \{ session, start, end: start/);
  assert.match(whiteFillEditorJs, /commitGuideLine\(gesture\.session, gesture\.start, gesture\.end\)/);
  assert.match(whiteFillEditorJs, /if \(!session\.pending\) \{ session\.pending = point/);
});

test("close-gap mode supports continuous click polylines", () => {
  assert.match(whiteFillEditorHtml, /data-close-method=\"polyline\"/);
  assert.match(whiteFillEditorHtml, /data-tooltip=\"クリックごとに線をつなぎ/);
  assert.match(whiteFillEditorJs, /closeMethod: \"segment\"/);
  assert.match(whiteFillEditorJs, /sameCanvasPoint\(session\.pending, point\)/);
  assert.match(whiteFillEditorJs, /session\.pending = closeMethod\(\) === \"polyline\" \? point : null/);
  assert.match(siteCss, /\.editor-close-methods button:hover::after/);
  assert.doesNotMatch(whiteFillEditorJs, /editor-group editor-close-methods/);
});
