import test from "node:test";
import assert from "node:assert/strict";
import { createRenamedFiles, sanitizeStem, splitFileName } from "../assets/js/batch-rename-core.js";

test("batch rename keeps extensions and applies padded numbering", () => {
  const files = [
    new File(["a"], "first.PNG", { type: "image/png" }),
    new File(["b"], "second.svg", { type: "image/svg+xml" })
  ];
  const renamed = createRenamedFiles(files, { prefix: "grade1", base: "apple", start: 7, digits: 3, suffix: "line" });
  assert.deepEqual(renamed.map(file => file.name), ["grade1_apple_007_line.png", "grade1_apple_008_line.svg"]);
});

test("batch rename sanitizes Windows-invalid filename characters", () => {
  assert.equal(sanitizeStem('a\\b/:*?"<>| .'), "ab");
  assert.deepEqual(splitFileName("drawing.final.PNG"), { stem: "drawing.final", extension: ".png" });
});

test("batch rename supports hyphen and no separator", () => {
  const files = [new File(["a"], "a.jpg", { type: "image/jpeg" })];
  assert.equal(createRenamedFiles(files, { base: "item", start: 2, digits: 2, separator: "-" })[0].name, "item-02.jpg");
  assert.equal(createRenamedFiles(files, { base: "item", start: 2, digits: 2, separator: "none" })[0].name, "item02.jpg");
});

