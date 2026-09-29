import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  WEB_IMAGE_PRESETS, downscaleSteps, fitLongSide, optimizedName,
  presetSettings, renamedOutputNames, resolvedOutputFormat, validLongSide, validStartNumber
} from "../assets/js/phone-photo-workflow-core.js";

test("web presets match Blog, Thumbnail and Original size requirements", () => {
  assert.deepEqual(WEB_IMAGE_PRESETS.blog, { resize: true, longSide: 1200, format: "webp", quality: "standard", crop: "none" });
  assert.deepEqual(WEB_IMAGE_PRESETS.thumbnail, { resize: true, longSide: 640, format: "webp", quality: "compact", crop: "none" });
  assert.deepEqual(WEB_IMAGE_PRESETS.original, { resize: false, longSide: null, format: "source", quality: "standard", crop: "none" });
  assert.deepEqual(presetSettings("blog"), WEB_IMAGE_PRESETS.blog);
  assert.equal(presetSettings("missing"), null);
});

test("long-side resizing never upscales and Original size keeps dimensions", () => {
  assert.deepEqual(fitLongSide(4032, 3024, 1200), { width: 1200, height: 900, scaled: true });
  assert.deepEqual(fitLongSide(800, 600, 1200), { width: 800, height: 600, scaled: false });
  assert.deepEqual(fitLongSide(4032, 3024, null, false), { width: 4032, height: 3024, scaled: false });
  assert.equal(validLongSide("640"), 640);
  assert.equal(validLongSide("0"), null);
});

test("large downscales use staged halving", () => {
  assert.deepEqual(downscaleSteps(4032, 3024, { width: 1200, height: 900 }), [{ width: 2016, height: 1512 }, { width: 1200, height: 900 }]);
});

test("source format is preserved when exportable and otherwise becomes WebP", () => {
  assert.equal(resolvedOutputFormat("jpeg", "source"), "jpeg");
  assert.equal(resolvedOutputFormat("png", "source"), "png");
  assert.equal(resolvedOutputFormat("heic", "source"), "webp");
  assert.equal(resolvedOutputFormat("jpeg", "webp"), "webp");
  assert.equal(optimizedName("My photo.HEIC", "webp"), "My photo-web.webp");
});

test("optional rename creates padded sequential names in each output format", () => {
  assert.deepEqual(renamedOutputNames(["webp", "jpeg", "png"], "blog", 9), ["blog_09.webp", "blog_10.jpg", "blog_11.png"]);
  assert.deepEqual(renamedOutputNames(["webp"], "a/b:c*", 1), ["abc_01.webp"]);
  assert.equal(validStartNumber("1"), 1);
  assert.equal(validStartNumber("0"), null);
});

test("Web Image Optimizer exposes presets and the complete processing flow", async () => {
  for (const path of ["../workflows/web-image-optimizer/index.html", "../ja/workflows/web-image-optimizer/index.html"]) {
    const html = await readFile(new URL(path, import.meta.url), "utf8");
    for (const value of ["blog", "thumbnail", "original"]) assert.match(html, new RegExp(`name="webPreset" value="${value}"`));
    for (const id of ["cropInput", "resizeInput", "longSideInput", "formatInput", "qualityInput", "renameInput", "baseNameInput", "startNumberInput", "namePreview", "runButton"]) assert.match(html, new RegExp(`id="${id}"`));
    for (const step of ["Crop", "Resize", "Convert", "Compress", "Metadata", "Rename"]) assert.match(html, new RegExp(step));
    assert.match(html, /workflow-pipeline-seven/);
    assert.match(html, /id="renameInput" type="checkbox"/);
    assert.match(html, /phone-photo-workflow\.js/);
    assert.match(html, /workflow-handoff\.js/);
  }
});

test("Web Image Optimizer re-encodes outputs, strips metadata and losslessly optimizes PNG", async () => {
  const script = await readFile(new URL("../assets/js/phone-photo-workflow.js", import.meta.url), "utf8");
  assert.match(script, /canvas\.toBlob/);
  assert.match(script, /png-optimizer-worker\.js/);
  assert.match(script, /format === "png" \? await optimizePng/);
  assert.doesNotMatch(script, /captureTimeFromBytes|shiagent-phone-photo-sequences-v1/);
});
