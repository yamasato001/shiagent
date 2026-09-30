import test from "node:test";
import assert from "node:assert/strict";
import { planRenames, sanitizeStem, splitFileName } from "../assets/js/batch-rename-core.js";

test("batch rename keeps extensions and applies padded numbering", () => {
  const files = [
    { name: "first.PNG", type: "image/png" },
    { name: "second.svg", type: "image/svg+xml" }
  ];
  const renamed = planRenames(files, { prefix: "grade1", base: "apple", start: 7, digits: 3, suffix: "line" });
  assert.deepEqual(renamed.map(item => item.name), ["grade1_apple_007_line.PNG", "grade1_apple_008_line.svg"]);
});

test("batch rename sanitizes Windows-invalid filename characters", () => {
  assert.equal(sanitizeStem('a\\b/:*?"<>| .'), "ab");
  assert.deepEqual(splitFileName("drawing.final.PNG"), { stem: "drawing.final", extension: ".PNG" });
});

test("batch rename supports arbitrary file types and files without extensions", () => {
  const files = [
    { name: "report.PDF", type: "application/pdf", lastModified: 123456789 },
    { name: "archive.zip", type: "application/zip" },
    { name: "README", type: "text/plain" }
  ];
  const renamed = planRenames(files, { base: "document", start: 1, digits: 2 });
  assert.deepEqual(renamed.map(item => item.name), ["document_01.PDF", "document_02.zip", "document_03"]);
  assert.deepEqual(renamed.map(item => item.source.type), ["application/pdf", "application/zip", "text/plain"]);
  assert.equal(renamed[0].source.lastModified, 123456789);
});

test("batch rename supports hyphen and no separator", () => {
  const files = [{ name: "a.jpg", type: "image/jpeg" }];
  assert.equal(planRenames(files, { base: "item", start: 2, digits: 2, separator: "-" })[0].name, "item-02.jpg");
  assert.equal(planRenames(files, { base: "item", start: 2, digits: 2, separator: "none" })[0].name, "item02.jpg");
});
