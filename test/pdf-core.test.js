import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cropBoxFromMargins, detectRasterOrientation, detectTextOrientation, detectWhiteContentBounds, fitInsideBox, interleaveGroups, nUpGrid, nearestQuarterTurn, pageNumberLabel, parsePageRange, PDF_MODE_FEATURES, positionInBox, rotateAngle, safePdfName, selectPageIndexes } from "../assets/js/pdf-core.js";

test("interleaves PDFs while preserving each document order", () => {
  assert.deepEqual(interleaveGroups([["a1", "a2", "a3"], ["b1", "b2"]]), ["a1", "b1", "a2", "b2", "a3"]);
});

test("merge page exposes sequential and interleaved methods", async () => {
  const source = await readFile(new URL("../src/pdf-workspace.js", import.meta.url), "utf8");
  assert.match(source, /id="pdfMergeMethod"/);
  assert.match(source, /value="sequential"/);
  assert.match(source, /value="interleave"/);
});

test("parses page ranges, odd/even pages and selected pages", () => {
  assert.deepEqual(parsePageRange("1-3, 7, 3, 99", 8), [0, 1, 2, 6]);
  assert.deepEqual(selectPageIndexes(6, "odd"), [0, 2, 4]);
  assert.deepEqual(selectPageIndexes(6, "even"), [1, 3, 5]);
  assert.deepEqual(selectPageIndexes(6, "selected", "", [4, 1, 4, -1]), [1, 4]);
});

test("normalizes rotation and safe PDF names", () => {
  assert.equal(rotateAngle(0, -90), 270);
  assert.equal(rotateAngle(270, 180), 90);
  assert.equal(safePdfName("report:final.pdf"), "reportfinal.pdf");
});

test("positions page labels and formats their numbers", () => {
  assert.equal(pageNumberLabel(2, 8, "number", 1), "3");
  assert.equal(pageNumberLabel(2, 8, "page", 1), "Page 3");
  assert.equal(pageNumberLabel(2, 8, "total", 1), "3 / 8");
  assert.deepEqual(positionInBox(600, 800, 40, 12, "bottom-center", 20), { x: 280, y: 20 });
  assert.deepEqual(positionInBox(600, 800, 40, 12, "top-right", 20), { x: 540, y: 768 });
});

test("calculates manual and automatic PDF crop margins", () => {
  assert.deepEqual(cropBoxFromMargins({ x: 0, y: 0, width: 600, height: 800 }, { left: 10, right: 20, top: 30, bottom: 40 }), { x: 10, y: 40, width: 570, height: 730 });
  const data = new Uint8ClampedArray(10 * 10 * 4).fill(255);
  for (let y = 2; y <= 7; y += 1) for (let x = 1; x <= 8; x += 1) {
    const offset = (y * 10 + x) * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = 0;
  }
  const bounds = detectWhiteContentBounds({ data, width: 10, height: 10 });
  assert.deepEqual(bounds, { left: 0.1, top: 0.2, right: 0.1, bottom: 0.2 });
});

test("calculates N-up grids and centered page fitting", () => {
  assert.deepEqual(nUpGrid("2"), { columns: 1, rows: 2, count: 2 });
  assert.deepEqual(nUpGrid("4"), { columns: 2, rows: 2, count: 4 });
  assert.deepEqual(nUpGrid("6"), { columns: 2, rows: 3, count: 6 });
  assert.deepEqual(fitInsideBox(400, 200, 200, 200), { width: 200, height: 100, x: 0, y: 50, scale: 0.5 });
});

test("detects quarter-turn corrections from PDF text transforms", () => {
  const viewport = [1, 0, 0, -1, 0, 500];
  const upright = detectTextOrientation([{ str: "SHIAGENT", transform: [12, 0, 0, 12, 20, 20] }], viewport);
  const clockwise = detectTextOrientation([{ str: "SHIAGENT", transform: [0, 12, -12, 0, 20, 20] }], viewport);
  const upsideDown = detectTextOrientation([{ str: "SHIAGENT", transform: [-12, 0, 0, -12, 20, 20] }], viewport);
  assert.equal(upright.correction, 0);
  assert.equal(clockwise.correction, 90);
  assert.equal(upsideDown.correction, 180);
  assert.equal(upright.usable, true);
  assert.equal(nearestQuarterTurn(-89), 270);
});

test("marks blank raster pages as unavailable for automatic orientation", () => {
  const blank = { width: 20, height: 30, data: new Uint8ClampedArray(20 * 30 * 4).fill(255) };
  const result = detectRasterOrientation(blank);
  assert.equal(result.usable, false);
  assert.equal(result.correction, 0);
});

test("PDF tools expose separate URLs and a dedicated local tray", async () => {
  const modes = ["merge", "split", "reorder", "interleave", "rotate", "delete-pages", "images-to-pdf", "pdf-to-images", "page-numbers", "watermark", "crop", "metadata-cleaner", "n-up", "form-fill", "signature"];
  for (const mode of modes) {
    for (const prefix of ["", "ja/"]) {
      const html = await readFile(new URL(`../${prefix}pdf/${mode}/index.html`, import.meta.url), "utf8");
      assert.match(html, new RegExp(`data-pdf-mode="${mode}"`));
      assert.match(html, /pdf-workspace\.js/);
      assert.match(html, /id="pdfTrayRoot"/);
    }
  }
  const tray = await readFile(new URL("../assets/js/pdf-tray.js", import.meta.url), "utf8");
  assert.match(tray, /shiagent-pdf-tray/);
  assert.doesNotMatch(tray, /shiagent-work-tray/);
});

test("PDF tools expose only the controls required by each purpose", () => {
  assert.deepEqual(PDF_MODE_FEATURES.merge.actions, []);
  assert.equal(PDF_MODE_FEATURES.merge.draggable, true);
  assert.equal(PDF_MODE_FEATURES.split.selection, true);
  assert.equal(PDF_MODE_FEATURES.split.output, true);
  assert.equal(PDF_MODE_FEATURES.split.selectable, true);
  assert.equal(PDF_MODE_FEATURES.reorder.reverse, true);
  assert.deepEqual(PDF_MODE_FEATURES.rotate.actions, ["left", "right"]);
  assert.equal(PDF_MODE_FEATURES.rotate.autoOrient, true);
  assert.deepEqual(PDF_MODE_FEATURES["delete-pages"].actions, ["remove"]);
  assert.deepEqual(PDF_MODE_FEATURES["images-to-pdf"].actions, ["remove"]);
  assert.equal(PDF_MODE_FEATURES["pdf-to-images"].imageOutput, true);
  assert.equal(PDF_MODE_FEATURES["page-numbers"].preserveAll, true);
  assert.equal(PDF_MODE_FEATURES.watermark.preserveAll, true);
  assert.equal(PDF_MODE_FEATURES.crop.preserveAll, true);
  assert.equal(PDF_MODE_FEATURES["n-up"].nUpOutput, true);
  assert.equal(PDF_MODE_FEATURES["form-fill"].formOutput, true);
  assert.equal(PDF_MODE_FEATURES.signature.preserveAll, true);
  assert.equal(PDF_MODE_FEATURES["pdf-finisher"].finishWorkflow, true);
});

test("new PDF tools expose rendering, numbering, watermark and crop controls", async () => {
  const workspace = await readFile(new URL("../src/pdf-workspace.js", import.meta.url), "utf8");
  assert.match(workspace, /id="pdfImageFormat"/);
  assert.match(workspace, /replaceTray\(files, "pdf-to-images"\)/);
  assert.match(workspace, /id="pdfNumberStart"/);
  assert.match(workspace, /pageNumberLabel\(/);
  assert.match(workspace, /id="pdfWatermarkImage"/);
  assert.match(workspace, /drawImage\(image/);
  assert.match(workspace, /id="pdfCropMode"/);
  assert.match(workspace, /detectWhiteContentBounds\(/);
  assert.match(workspace, /page\.setCropBox\(/);
});

test("PDF utility tools expose metadata, N-up, form and visual signature workflows", async () => {
  const workspace = await readFile(new URL("../src/pdf-workspace.js", import.meta.url), "utf8");
  assert.match(workspace, /metadata-cleaner/);
  assert.match(workspace, /id="pdfNUpLayout"/);
  assert.match(workspace, /buildNUpPdf/);
  assert.match(workspace, /id="pdfFormFields"/);
  assert.match(workspace, /buildFormPdf/);
  assert.match(workspace, /id="pdfSignatureCanvas"/);
  assert.match(workspace, /signatureAsset/);
  assert.match(workspace, /電子証明書/);
});

test("PDF finisher runs the six requested operations as one local workflow", async () => {
  for (const path of ["../workflows/pdf-finisher/index.html", "../ja/workflows/pdf-finisher/index.html"]) {
    const html = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(html, /data-pdf-mode="pdf-finisher"/);
    assert.match(html, /workflow-pipeline-six/);
    assert.match(html, /pdf-workspace\.js/);
  }
  const workspace = await readFile(new URL("../src/pdf-workspace.js", import.meta.url), "utf8");
  assert.match(workspace, /await autoOrientPages\(\)/);
  assert.match(workspace, /await prepareAutoCrops\(pages, targetIds\)/);
  assert.match(workspace, /applyCrop\(page, model\); applyPageNumber/);
  assert.match(workspace, /pdfRenameBase/);
  assert.match(workspace, /replacePdfTray\(trayFiles\)/);
});

test("PDF loading gives visible progress and renders pages progressively", async () => {
  const workspace = await readFile(new URL("../src/pdf-workspace.js", import.meta.url), "utf8");
  assert.match(workspace, /id="pdfLoadStatus"/);
  assert.match(workspace, /setStatus\(`\$\{text\.load\} \$\{pageNumber\}\/\$\{previewDocument\.numPages\}`\)/);
  assert.match(workspace, /pages\.push\(model\);\s*render\(\);/);
});

test("split PDF can save every page directly into one selected folder", async () => {
  const workspace = await readFile(new URL("../src/pdf-workspace.js", import.meta.url), "utf8");
  assert.match(workspace, /mode === "split" && supportsFolderDownload\(window\)/);
  assert.match(workspace, /id="pdfFolderExport"/);
  assert.match(workspace, /chooseOutputDirectory\(window\)/);
  assert.match(workspace, /writeFilesToDirectory\(directory, files/);
});

test("rotate pages advertise automatic text orientation", async () => {
  const ja = await readFile(new URL("../ja/pdf/rotate/index.html", import.meta.url), "utf8");
  const en = await readFile(new URL("../pdf/rotate/index.html", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../src/pdf-workspace.js", import.meta.url), "utf8");
  assert.match(ja, /文章の上下/);
  assert.match(en, /Auto Rotate PDF/);
  assert.match(workspace, /pdfAutoOrient/);
  assert.match(workspace, /detectTextOrientation/);
  assert.match(workspace, /detectRasterOrientation/);
});

test("PDF.js cleanup stays compatible when document proxies do not expose destroy", async () => {
  for (const path of ["../src/pdf-workspace.js", "../src/pdf-page-order-workflow.js"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /typeof document\.destroy === "function"/);
    assert.match(source, /typeof document\.cleanup === "function"/);
  }
  const workspace = await readFile(new URL("../src/pdf-workspace.js", import.meta.url), "utf8");
  assert.match(workspace, /typeof previewDocument\.destroy === "function"/);
  assert.match(workspace, /typeof previewDocument\.cleanup === "function"/);
});

