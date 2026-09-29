import test from "node:test";
import assert from "node:assert/strict";
import { createRenamedFiles, sanitizeStem, splitFileName } from "../assets/js/batch-rename-core.js";

test("batch rename keeps extensions and applies padded numbering", () => {
  const files = [
    new File(["a"], "first.PNG", { type: "image/png" }),
    new File(["b"], "second.svg", { type: "image/svg+xml" })
  ];
  const renamed = createRenamedFiles(files, { prefix: "grade1", base: "apple", start: 7, digits: 3, suffix: "line" });
  assert.deepEqual(renamed.map(file => file.name), ["grade1_apple_007_line.PNG", "grade1_apple_008_line.svg"]);
});

test("batch rename sanitizes Windows-invalid filename characters", () => {
  assert.equal(sanitizeStem('a\\b/:*?"<>| .'), "ab");
  assert.deepEqual(splitFileName("drawing.final.PNG"), { stem: "drawing.final", extension: ".PNG" });
});

test("batch rename supports arbitrary file types and files without extensions", async () => {
  const files = [
    new File(["pdf"], "report.PDF", { type: "application/pdf", lastModified: 123456789 }),
    new File(["zip"], "archive.zip", { type: "application/zip" }),
    new File(["text"], "README", { type: "text/plain" })
  ];
  const renamed = createRenamedFiles(files, { base: "document", start: 1, digits: 2 });
  assert.deepEqual(renamed.map(file => file.name), ["document_01.PDF", "document_02.zip", "document_03"]);
  assert.deepEqual(renamed.map(file => file.type), ["application/pdf", "application/zip", "text/plain"]);
  assert.equal(renamed[0].lastModified, 123456789);
  assert.deepEqual(await Promise.all(renamed.map(file => file.text())), ["pdf", "zip", "text"]);
});

test("batch rename supports hyphen and no separator", () => {
  const files = [new File(["a"], "a.jpg", { type: "image/jpeg" })];
  assert.equal(createRenamedFiles(files, { base: "item", start: 2, digits: 2, separator: "-" })[0].name, "item-02.jpg");
  assert.equal(createRenamedFiles(files, { base: "item", start: 2, digits: 2, separator: "none" })[0].name, "item02.jpg");
});
