import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("image compressor defaults to Recommended and hides alternative modes in advanced settings", async () => {
  const [ja, en] = await Promise.all([
    read("ja/image-compressor/index.html"),
    read("image-compressor/index.html")
  ]);

  for (const html of [ja, en]) {
    assert.match(html, /name="mode" value="recommended" checked/);
    assert.doesNotMatch(html, /name="mode" value="auto"/);
    assert.match(html, /<details class="advanced">[\s\S]*name="mode" value="exact"[\s\S]*name="mode" value="balanced"[\s\S]*name="mode" value="smallest"[\s\S]*name="mode" value="lineart"/);
  }
  assert.match(ja, /<b>おすすめ<\/b>/);
  assert.match(ja, /<b>Smallest<\/b><small>容量を最優先/);
  assert.match(en, /<b>Recommended<\/b>/);
  assert.match(en, /<b>Smallest<\/b><small>Prioritize file size/);
});

test("Recommended evaluates multiple candidates while Smallest remains the aggressive option", async () => {
  const script = await read("assets/js/png-compressor.js");
  assert.match(script, /const qualities = \[0\.5, 0\.56, 0\.62, 0\.68, 0\.72, 0\.76, 0\.8, 0\.84, 0\.88, 0\.92, 0\.95, 0\.97\]/);
  assert.match(script, /perceptualSimilarity/);
  assert.match(script, /similarity >= threshold && edges >= edgeThreshold/);
  assert.match(script, /requestedMode === "recommended" \? analysis\.preset : requestedMode/);
  assert.match(script, /requestedMode === "recommended"[\s\S]*encodeRecommendedRaster/);
  assert.match(script, /denseColorPng[\s\S]*\? \[256, 128, 64, 32, 16, 12\][\s\S]*: \[12, 16, 32, 64, 128, 256\]/);
  assert.match(script, /encodeRecommendedPng/);
  assert.match(script, /if \(!denseColorPng \|\| savings >= 80\) return result/);
  assert.match(script, /if \(safeFallback\) return safeFallback/);
});

test("compressor switches the primary action to retry and resets after real file additions", async () => {
  const script = await read("assets/js/png-compressor.js");
  assert.match(script, /retry: "やり直す"/);
  assert.match(script, /ready: "Ready"/);
  assert.match(script, /entries\.some\(entry => entry\.status === "done"\) \? copy\.retry : copy\.start/);
  assert.match(script, /if \(added\) resetResults\(\)/);
  assert.doesNotMatch(script, /modeInputs\)[\s\S]{0,100}addEventListener\("change"[\s\S]{0,100}resetResults/);
  assert.doesNotMatch(script, /effort\.addEventListener\("change"[\s\S]{0,100}resetResults/);
});
