import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CUSTOM_WORKFLOW_STORAGE_KEY, canAppend, moveStep, readCustomWorkflows, validateWorkflow, writeCustomWorkflows } from "../assets/js/custom-workflow-core.js";

test("custom workflow compatibility blocks impossible chains", () => {
  assert.equal(canAppend("raster", [], "image-resizer"), true);
  assert.equal(canAppend("raster", ["image-to-svg"], "svg-cleaner"), true);
  assert.equal(canAppend("raster", ["image-to-svg"], "image-compressor"), false);
  assert.equal(canAppend("pdf", ["pdf-rotate"], "pdf-split"), true);
  assert.equal(validateWorkflow("svg", ["svg-cleaner", "svg-to-image", "image-compressor"]).valid, true);
});

test("reorder accepts valid chains and refuses invalid ones", () => {
  assert.equal(moveStep("raster", ["image-to-svg", "svg-cleaner", "svg-to-image"], 2, 0), null);
  assert.deepEqual(moveStep("raster", ["image-cropper", "image-resizer", "image-compressor"], 0, 1), ["image-resizer", "image-cropper", "image-compressor"]);
});

test("workflow definitions are saved locally", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const workflows = [{ id: "one", name: "Publish", inputType: "raster", steps: ["image-resizer"] }];
  writeCustomWorkflows(workflows, storage);
  assert.ok(values.has(CUSTOM_WORKFLOW_STORAGE_KEY));
  assert.deepEqual(readCustomWorkflows(storage), workflows);
});

test("custom workflow pages expose matching builder contracts", async () => {
  const [en, ja] = await Promise.all([readFile(new URL("../workflows/custom/index.html", import.meta.url), "utf8"), readFile(new URL("../ja/workflows/custom/index.html", import.meta.url), "utf8")]);
  for (const html of [en, ja]) {
    assert.match(html, /id="customWorkflowBuilder"/);
    assert.match(html, /id="toolPalette"/);
    assert.match(html, /id="workflowSteps"/);
    assert.match(html, /id="savedWorkflows"/);
    assert.match(html, /id="clearWorkflow"/);
    assert.doesNotMatch(html, /builder-format-legend/);
    assert.match(html, /custom-workflow-tabs\.css/);
    assert.match(html, /custom-workflow-builder\.js/);
  }
  assert.match(ja, /<h1>ワークフローを自分で作る<\/h1>/);
});

test("tool categories use accessible tabs and clear affects the current draft", async () => {
  const script = await readFile(new URL("../assets/js/custom-workflow-builder.js", import.meta.url), "utf8");
  assert.match(script, /role="tablist"/);
  assert.match(script, /role="tab"/);
  assert.match(script, /aria-selected/);
  assert.match(script, /state\.steps = \[\]/);
  assert.match(script, /clearWorkflow\.addEventListener/);
  assert.match(script, /inputType: ""/);
  assert.match(script, /if \(!state\.inputType\)/);
});
