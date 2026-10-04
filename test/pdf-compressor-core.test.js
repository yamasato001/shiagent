import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatPdfBytes, pdfCompressedName, pdfCompressionPreset, pdfSavingsPercent } from "../assets/js/pdf-compressor-core.js";

test("PDF compression presets distinguish text-preserving and raster modes", () => {
  assert.equal(pdfCompressionPreset("recommended").strategy, "images");
  assert.equal(pdfCompressionPreset("recommended").textPreserved, true);
  assert.equal(pdfCompressionPreset("maximum").strategy, "raster");
  assert.equal(pdfCompressionPreset("maximum").textPreserved, false);
});

test("PDF compression formats names, bytes and savings", () => {
  assert.equal(pdfCompressedName("report.pdf"), "report-compressed.pdf");
  assert.equal(formatPdfBytes(1024, "en-US"), "1 KB");
  assert.equal(pdfSavingsPercent(1000, 250), 75);
});

test("PDF compression pages expose three methods and local PDF export", async () => {
  const source = await readFile(new URL("../src/pdf-compressor.js", import.meta.url), "utf8");
  assert.match(source, /value="quality"/);
  assert.match(source, /value="recommended"/);
  assert.match(source, /value="maximum"/);
  assert.match(source, /id="pdfCompressorDrop"/);
  assert.match(source, /addEventListener\("drop"/);
  for (const path of ["pdf/compress/index.html", "ja/pdf/compress/index.html"]) {
    const html = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(html, /pdf-compressor\.js/);
    assert.match(html, /pdfCompressorDownload/);
  }
});
