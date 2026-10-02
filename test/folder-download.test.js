import test from "node:test";
import assert from "node:assert/strict";
import { chooseOutputDirectory, clearPreferredOutputStartIn, pickerTypesFromAccept, preferredOutputStartIn, rememberSourceFileHandle, safeFolderFileName, supportsFolderDownload, writeFilesToDirectory } from "../assets/js/folder-download.js";

test("folder saving is shown only when the directory picker is available", () => {
  assert.equal(supportsFolderDownload({ showDirectoryPicker() {} }), true);
  assert.equal(supportsFolderDownload({}), false);
});

test("folder file names remove path and operating-system separators", () => {
  assert.equal(safeFolderFileName("before/after:01.png"), "beforeafter01.png");
  assert.equal(safeFolderFileName("   ", 2), "file_03");
});

test("folder picker can start in the source file's parent directory", async () => {
  const sourceHandle = { kind: "file", name: "source.svg" };
  let received;
  const scope = { async showDirectoryPicker(options) { received = options; return { name: "output" }; } };
  await chooseOutputDirectory(scope, sourceHandle);
  assert.equal(received.startIn, sourceHandle);
  assert.equal(received.mode, "readwrite");
  assert.equal(received.id, undefined);
});

test("source file handles are retained only as an opaque starting location", () => {
  const sourceHandle = { kind: "file", name: "source.png" };
  rememberSourceFileHandle(sourceHandle);
  assert.equal(preferredOutputStartIn(), sourceHandle);
  clearPreferredOutputStartIn();
  assert.equal(preferredOutputStartIn(), null);
});

test("file picker filters are derived from accepted extensions", () => {
  assert.deepEqual(pickerTypesFromAccept("image/png,image/jpeg,.png,.jpg,.jpeg"), [{
    description: "Supported files",
    accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] }
  }]);
  assert.equal(pickerTypesFromAccept(""), undefined);
});

test("one directory permission writes every output and avoids duplicate overwrites", async () => {
  const written = [];
  const directory = { async getFileHandle(name) { return { async createWritable() { return { async write(blob) { written.push([name, await blob.text()]); }, async close() {} }; } }; } };
  const count = await writeFilesToDirectory(directory, [
    { name: "asset.png", blob: new Blob(["one"]) },
    { name: "asset.png", blob: new Blob(["two"]) }
  ]);
  assert.equal(count, 2);
  assert.deepEqual(written, [["asset.png", "one"], ["asset_2.png", "two"]]);
});
