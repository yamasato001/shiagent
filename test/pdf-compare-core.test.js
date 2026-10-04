import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { comparePdfPixels, pdfCompareOutputName, pdfDifferenceLabel } from "../assets/js/pdf-compare-core.js";

function image(width, height, color = [255, 255, 255, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) data.set(color, offset);
  return { width, height, data };
}

test("PDF pixel comparison ignores tiny color noise and highlights real changes", () => {
  const first = image(2, 1, [250, 250, 250, 255]);
  const second = image(2, 1, [245, 245, 245, 255]);
  second.data.set([20, 20, 20, 255], 4);
  const result = comparePdfPixels(first, second, 18);
  assert.equal(result.changed, 1);
  assert.equal(result.ratio, 0.5);
  assert.deepEqual([...result.data.slice(4, 7)], [225, 38, 38]);
});

test("PDF pixel comparison treats a missing page area as different", () => {
  const result = comparePdfPixels(image(1, 1, [0, 0, 0, 255]), image(2, 1), 18);
  assert.equal(result.width, 2);
  assert.equal(result.changed, 1);
});

test("PDF comparison formats labels and output names", () => {
  assert.equal(pdfDifferenceLabel(0.125, "ja"), "差分 12.50%");
  assert.equal(pdfDifferenceLabel(0.125, "en"), "12.50% different");
  assert.equal(pdfCompareOutputName(7), "pdf-difference-007.png");
});

test("PDF comparison pages expose local visual comparison and ZIP export", async () => {
  for (const path of ["../pdf/compare/index.html", "../ja/pdf/compare/index.html"]) {
    const html = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(html, /pdf-compare\.js/);
    assert.match(html, /id="pdfCompareRoot"/);
    assert.match(html, /faq-section/);
  }
  const source = await readFile(new URL("../src/pdf-compare.js", import.meta.url), "utf8");
  assert.match(source, /comparePdfPixels/);
  assert.match(source, /data-view="side"/);
  assert.match(source, /data-view="overlay"/);
  assert.match(source, /data-view="difference"/);
  assert.match(source, /createZipBlob/);
  assert.match(source, /replaceTray\(outputFiles, "pdf-compare"\)/);
  assert.match(source, /id="pdfCompareDropA"/);
  assert.match(source, /id="pdfCompareDropB"/);
  assert.equal((source.match(/connectDrop\(elements\.drop/g) ?? []).length, 2);
});

test("PDF catalog cards include a distinct line illustration", async () => {
  for (const path of ["../pdf/index.html", "../ja/pdf/index.html"]) {
    const html = await readFile(new URL(path, import.meta.url), "utf8");
    assert.equal((html.match(/class="pdf-tool-card"/g) ?? []).length, 17);
    assert.equal((html.match(/class="pdf-tool-illustration"/g) ?? []).length, 17);
    assert.doesNotMatch(html, /pdf\/interleave\//);
  }
});
