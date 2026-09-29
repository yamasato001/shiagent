import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pageNumberCandidatesFromText, parsePageNumberText, resolvePageNumberSequence, romanToNumber, sequenceIssues, sortPagesByDetectedNumber } from "../assets/js/pdf-page-number-core.js";

test("parses common Arabic and Roman page-number formats", () => {
  assert.deepEqual(parsePageNumberText("- 12 -"), { number: 12, style: "plain", strength: .88 });
  assert.deepEqual(parsePageNumberText("Page 7"), { number: 7, style: "explicit", strength: 1 });
  assert.deepEqual(parsePageNumberText("3 / 24"), { number: 3, style: "fraction", strength: .96 });
  assert.deepEqual(parsePageNumberText("xiv"), { number: 14, style: "roman", strength: .72 });
  assert.equal(parsePageNumberText("2026"), null);
  assert.equal(romanToNumber("xix"), 19);
});

test("only accepts page numbers found around the page perimeter", () => {
  const viewport = [1, 0, 0, -1, 0, 800];
  const items = [
    { str: "12", transform: [10, 0, 0, 10, 300, 20] },
    { str: "99", transform: [10, 0, 0, 10, 300, 400] }
  ];
  const candidates = pageNumberCandidatesFromText(items, viewport, 600, 800);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].number, 12);
  assert.equal(candidates[0].zone, "bottom-center");
});

test("resolves a consistent footer sequence and reports review issues", () => {
  const footer = number => [{ number, style: "plain", strength: .88, edge: "bottom", zone: "bottom-center", positionScore: 1, confidence: .88, method: "text" }];
  const detections = resolvePageNumberSequence([footer(3), footer(1), [], footer(2), footer(2)]);
  assert.deepEqual(detections.map(item => item?.number ?? null), [3, 1, null, 2, 2]);
  const issues = sequenceIssues(detections);
  assert.equal(issues.unresolved, 1);
  assert.deepEqual(issues.duplicates, [2]);
});

test("sorts numbered pages while keeping unnumbered companions attached", () => {
  const pages = ["cover", "p3", "insert", "p1", "p2"];
  const detections = [null, { number: 3 }, null, { number: 1 }, { number: 2 }];
  assert.deepEqual(sortPagesByDetectedNumber(pages, detections).map(item => item.page), ["cover", "p1", "p2", "p3", "insert"]);
});

test("keeps Roman front matter before Arabic body pages", () => {
  const pages = ["body2", "front2", "body1", "front1"];
  const detections = [{ number: 2, style: "plain" }, { number: 2, style: "roman" }, { number: 1, style: "plain" }, { number: 1, style: "roman" }];
  assert.deepEqual(sortPagesByDetectedNumber(pages, detections).map(item => item.page), ["front1", "front2", "body1", "body2"]);
  assert.deepEqual(sequenceIssues(detections).duplicates, []);
});

test("page-order workflow exposes batch OCR controls in both languages", async () => {
  const ja = await readFile(new URL("../ja/pdf/sort-by-page-number/index.html", import.meta.url), "utf8");
  const en = await readFile(new URL("../pdf/sort-by-page-number/index.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../src/pdf-page-order-workflow.js", import.meta.url), "utf8");
  assert.match(ja, /向き判定 → 外周OCR → 並べ替え|外周を検索/);
  assert.match(en, /Sort PDF by Page Number/);
  assert.match(source, /recognizeEdgePageNumbers/);
  assert.match(source, /multiple hidden/);
  assert.match(source, /createZip/);
});

test("page-order workflow offers direct folder saving in supported browsers", async () => {
  const source = await readFile(new URL("../src/pdf-page-order-workflow.js", import.meta.url), "utf8");
  assert.match(source, /supportsFolderDownload\(window\)/);
  assert.match(source, /id="pdfOrderFolder"/);
  assert.match(source, /writeFilesToDirectory\(directory, files/);
});
