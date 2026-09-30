import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const outputSave = await readFile(new URL("../assets/js/output-save.js", import.meta.url), "utf8");
const browserRuntime = await readFile(new URL("../assets/js/browser-runtime.js", import.meta.url), "utf8");
const agentBridge = await readFile(new URL("../assets/js/agent-bridge.js", import.meta.url), "utf8");
const outputName = await readFile(new URL("../assets/js/output-name.js", import.meta.url), "utf8");

test("every active tool installs the shared direct-folder save action", () => {
  assert.match(agentBridge, /installOutputSaving\(\)/);
  assert.doesNotMatch(outputSave, /id="outputDirectSave"/);
  assert.match(outputSave, /フォルダにすべて直接保存/);
  assert.match(outputSave, /chooseOutputDirectory\(window, "downloads"\)/);
  assert.match(outputSave, /writeFilesToDirectory\(directory, files/);
  assert.match(outputSave, /latestFiles = outputItems/);
  assert.match(outputSave, /control\.hidden = true/);
  assert.match(outputSave, /shiagent:output-options-ready/);
  assert.match(outputName, /dataset\.outputNameControl/);
  assert.match(outputName, /document\.querySelector\("\.download-row"\)/);
  assert.match(outputSave, /document\.querySelector\("\.download-row"\)/);
  assert.match(outputName, /control\.nextElementSibling !== note/);
  assert.match(outputSave, /row\.insertBefore\(control, suffix\)/);
  assert.match(agentBridge, /notifyOutputOptionsIfReady/);
  assert.match(agentBridge, /download && !download\.disabled && isVisible\(download\)/);
  assert.match(agentBridge, /element\.closest\("\[hidden\]"\)/);
});

test("ZIP blobs retain their individual files for direct folder saving", () => {
  assert.match(browserRuntime, /Symbol\.for\("shiagent\.outputFiles"\)/);
  assert.match(browserRuntime, /prepared\.map\(entry => \(\{ name: entry\.name, blob:/);
  assert.match(outputSave, /blob\?\.\[BATCH_FILES\]/);
});
