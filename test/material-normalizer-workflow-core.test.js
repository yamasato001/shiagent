import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assetNormalizerNames, assetNormalizerPlacement, materialNames, validCanvasSize, validOccupancy, validPadding, workflowPlacement } from "../assets/js/material-normalizer-workflow-core.js";

test("centers trimmed content with proportional padding on an exact canvas", () => {
  const result = workflowPlacement({ x: 20, y: 30, width: 200, height: 100 }, 512, 512, 10, "percent");
  assert.deepEqual({ width: result.canvasWidth, height: result.canvasHeight }, { width: 512, height: 512 });
  assert.equal(result.x, 43);
  assert.equal(result.y, 149);
  assert.equal(result.width, 427);
  assert.equal(result.height, 213);
});

test("validates canvas size and padding limits", () => {
  assert.deepEqual(validCanvasSize(512, 512), { width: 512, height: 512 });
  assert.equal(validCanvasSize(9000, 10), null);
  assert.equal(validCanvasSize(8000, 8000), null);
  assert.equal(validPadding(10, "percent"), 10);
  assert.equal(validPadding(201, "percent"), null);
});

test("creates clean sequential names in the selected output format", () => {
  assert.deepEqual(materialNames(3, "AI/asset", 8, "webp"), ["AIasset_08.webp", "AIasset_09.webp", "AIasset_10.webp"]);
});

test("AI Asset Prep exposes trim, normalize, resize, rename and compression in both languages", async () => {
  for (const path of ["../workflows/ai-asset-prep/index.html", "../ja/workflows/ai-asset-prep/index.html"]) {
    const html = await readFile(new URL(path, import.meta.url), "utf8");
    for (const id of ["trimBackground", "paddingInput", "widthInput", "formatInput", "baseNameInput", "runButton"]) assert.match(html, new RegExp(`id="${id}"`));
    assert.match(html, path.includes("/ja/") ? /AI画像素材一括仕上げ/ : /AI Asset Prep/);
    assert.match(html, /workflow-pipeline-six/);
    assert.match(html, /id="paddingInput"[^>]*value="5"/);
    assert.match(html, /Auto Trim/);
    assert.match(html, /Compress/);
    assert.match(html, /material-normalizer-workflow\.js/);
    assert.match(html, /workflow-handoff\.js/);
  }
});

test("AI Asset Prep losslessly optimizes PNG output", async () => {
  const script = await readFile(new URL("../assets/js/material-normalizer-workflow.js", import.meta.url), "utf8");
  assert.match(script, /png-optimizer-worker\.js/);
  assert.match(script, /format\.value === "png" \? await optimizePng/);
});

test("Asset Normalizer enforces object occupancy and canvas padding together", () => {
  const occupancyLimited = assetNormalizerPlacement({ x: 0, y: 0, width: 200, height: 100 }, 512, 512, 80, 10, "percent");
  assert.deepEqual({ x: occupancyLimited.x, y: occupancyLimited.y, width: occupancyLimited.width, height: occupancyLimited.height }, { x: 51, y: 154, width: 410, height: 205 });
  const paddingLimited = assetNormalizerPlacement({ x: 0, y: 0, width: 100, height: 100 }, 512, 512, 100, 20, "percent");
  assert.deepEqual({ x: paddingLimited.x, y: paddingLimited.y, width: paddingLimited.width, height: paddingLimited.height }, { x: 103, y: 103, width: 307, height: 307 });
  assert.equal(validOccupancy(80), 80);
  assert.equal(validOccupancy(0), null);
});

test("Asset Normalizer creates hyphenated three-digit sequence names", () => {
  assert.deepEqual(assetNormalizerNames(3, "asset", 1, "png"), ["asset-001.png", "asset-002.png", "asset-003.png"]);
});

test("Asset Normalizer exposes the complete batch specification in both languages", async () => {
  for (const path of ["../workflows/asset-normalizer/index.html", "../ja/workflows/asset-normalizer/index.html"]) {
    const html = await readFile(new URL(path, import.meta.url), "utf8");
    for (const id of ["trimBackground", "widthInput", "heightInput", "occupancyInput", "paddingInput", "backgroundInput", "formatInput", "baseNameInput", "runButton"]) assert.match(html, new RegExp(`id="${id}"`));
    assert.match(html, /Asset Normalizer/);
    assert.match(html, /asset-001\.png/);
    assert.match(html, /data-workflow="asset-normalizer"/);
    assert.match(html, /workflow-handoff\.js/);
  }
});
