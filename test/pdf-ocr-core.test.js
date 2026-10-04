import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hasUsefulPdfText, pdfOcrOutputName, pdfOcrPageIndexes, summarizePdfOcr } from "../assets/js/pdf-ocr-core.js";

test("OCR output names preserve a useful base name", () => {
  assert.equal(pdfOcrOutputName("scan.pdf"), "scan-searchable.pdf");
  assert.equal(pdfOcrOutputName("document"), "document-searchable.pdf");
});

test("OCR page selection supports all pages and ranges", () => {
  assert.deepEqual(pdfOcrPageIndexes("all", "", 4), [0, 1, 2, 3]);
  assert.deepEqual(pdfOcrPageIndexes("range", "1-2, 4", 4), [0, 1, 3]);
});

test("existing PDF text is detected before OCR", () => {
  assert.equal(hasUsefulPdfText([{ str: "短い" }]).useful, false);
  assert.equal(hasUsefulPdfText([{ str: "This page already has searchable text." }]).useful, true);
});

test("OCR results summarize recognized and preserved pages", () => {
  assert.deepEqual(summarizePdfOcr([{ type: "ocr", characters: 20, confidence: 90 }, { type: "preserved" }, { type: "ocr", characters: 10, confidence: 70 }]), { pages: 3, recognized: 2, preserved: 1, characters: 30, confidence: 80 });
});

test("OCR pages expose private local processing and PDF download", async () => {
  const source = await readFile(new URL("../src/pdf-ocr.js", import.meta.url), "utf8");
  assert.match(source, /id="pdfOcrDrop"/);
  assert.match(source, /addEventListener\("drop"/);
  for (const path of ["pdf/ocr/index.html", "ja/pdf/ocr/index.html"]) {
    const html = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(html, /pdf-ocr\.js/);
    assert.match(html, /pdfOcrInput/);
    assert.match(html, /pdfOcrDownload/);
  }
});
