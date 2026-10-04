import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("scanned PDF optimizer exposes the complete local workflow", async () => {
  const source = await readFile(new URL("../src/scan-pdf-optimizer-workflow.js", import.meta.url), "utf8");
  assert.match(source, /detectRasterOrientation/);
  assert.match(source, /detectWhiteContentBounds/);
  assert.match(source, /worker\.recognize/);
  assert.match(source, /setAuthor\(""\)/);
  assert.match(source, /replacePdfTray/);
});

test("scanned PDF optimizer pages expose controls, pipeline and bundle", async () => {
  for (const path of ["workflows/scan-pdf-optimizer/index.html", "ja/workflows/scan-pdf-optimizer/index.html"]) {
    const html = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(html, /scan-pdf-optimizer-workflow\.js/);
    assert.match(html, /workflow-pipeline-seven/);
    assert.match(html, /id="scanPdfWorkflowRoot"/);
    assert.match(html, /id="scanPdfInput"/);
    assert.match(html, /id="scanPdfRun"/);
    assert.match(html, /id="scanPdfDownloadAll"/);
  }
});

test("workflow catalog links to the scanned PDF optimizer", async () => {
  for (const path of ["tools/index.html", "ja/tools/index.html"]) {
    const html = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(html, /workflows\/scan-pdf-optimizer\//);
    assert.match(html, /tab-workflows[\s\S]*?<span>7<\/span>/);
  }
});
