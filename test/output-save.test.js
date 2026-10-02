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
  assert.match(outputSave, /chooseOutputDirectory\(window, preferredOutputStartIn\(\) \|\| "downloads"\)/);
  assert.match(outputSave, /installSourceFileTracking\(window, document\)/);
  assert.match(outputSave, /clearPreferredOutputStartIn\(\)/);
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

test("Google Drive is offered next to the file chooser and the folder save", async () => {
  const drive = await readFile(new URL("../assets/js/google-drive.js", import.meta.url), "utf8");
  const driveInput = await readFile(new URL("../assets/js/drive-input.js", import.meta.url), "utf8");
  const { GOOGLE_DRIVE } = await import("../assets/js/google-drive-config.js");
  // Only files the visitor picks or this site creates are reachable.
  assert.match(drive, /auth\/drive\.file"/);
  assert.doesNotMatch(drive, /auth\/drive"/);
  // Google scripts load on hover/focus, never on page load.
  assert.match(driveInput, /"pointerenter", preload/);
  assert.match(outputSave, /"pointerenter", preload/);
  assert.match(agentBridge, /installDriveInput\(tool\.automation\?\.input\)/);
  assert.match(driveInput, /#selectButton, #pdfChoose, #pdfOrderChoose/);
  assert.match(outputSave, /Google Driveに保存/);
  assert.match(outputSave, /driveConfigured\(\) \?/);
  assert.equal(typeof GOOGLE_DRIVE.clientId, "string");
});

test("Picker MIME filters keep only exact types from accept", async () => {
  const { pickerMimeTypes } = await import("../assets/js/google-drive.js");
  assert.deepEqual(pickerMimeTypes("image/png, image/jpeg,.png,image/*,IMAGE/PNG"), ["image/png", "image/jpeg"]);
  assert.deepEqual(pickerMimeTypes(""), []);
});

test("ZIP blobs retain their individual files for direct folder saving", () => {
  assert.match(browserRuntime, /Symbol\.for\("shiagent\.outputFiles"\)/);
  assert.match(browserRuntime, /prepared\.map\(entry => \(\{ name: entry\.name, blob:/);
  assert.match(outputSave, /blob\?\.\[BATCH_FILES\]/);
});
