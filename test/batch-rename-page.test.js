import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const renameHtml = await readFile(new URL("../ja/batch-rename/index.html", import.meta.url), "utf8");
const splitterHtml = await readFile(new URL("../ja/image-splitter/index.html", import.meta.url), "utf8");
const vectorHtml = await readFile(new URL("../ja/png-to-svg/index.html", import.meta.url), "utf8");
const compressorHtml = await readFile(new URL("../ja/png-compressor/index.html", import.meta.url), "utf8");
const whiteFillHtml = await readFile(new URL("../ja/svg-white-fill/index.html", import.meta.url), "utf8");
const cleanerHtml = await readFile(new URL("../ja/svg-cleaner/index.html", import.meta.url), "utf8");
const whiteFillEditorHtml = await readFile(new URL("../ja/svg-white-fill/editor/index.html", import.meta.url), "utf8");

test("batch rename exposes naming controls and both next-tool actions", () => {
  for (const id of ["prefixInput", "baseInput", "startInput", "digitsInput", "suffixInput", "separatorInput"]) assert.match(renameHtml, new RegExp(`id="${id}"`));
  assert.match(renameHtml, /id="toSplitterButton"/);
  assert.match(renameHtml, /id="toSvgButton"/);
});

test("every production tool loads the shared work tray", () => {
  assert.match(splitterHtml, /workflow-handoff\.js/);
  assert.match(vectorHtml, /workflow-handoff\.js/);
  assert.match(compressorHtml, /workflow-handoff\.js/);
  assert.match(renameHtml, /workflow-handoff\.js/);
  assert.match(whiteFillHtml, /workflow-handoff\.js/);
  assert.match(cleanerHtml, /workflow-handoff\.js/);
});

test("manual white-fill editor exposes close, exclude, erase and preview controls", () => {
  assert.match(whiteFillEditorHtml, /value="close"/);
  assert.match(whiteFillEditorHtml, /value="exclude"/);
  assert.match(whiteFillEditorHtml, /value="erase"/);
  assert.match(whiteFillEditorHtml, /id="undoButton"/);
  assert.match(whiteFillEditorHtml, /id="previewButton"/);
});

