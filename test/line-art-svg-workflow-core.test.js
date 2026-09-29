import test from "node:test";
import assert from "node:assert/strict";
import { whiteFillMode, workflowOutputName, workflowSteps } from "../assets/js/line-art-svg-workflow-core.js";

test("line art workflow supports no, automatic and manual white fill", () => {
  assert.equal(whiteFillMode("none", "auto"), "none");
  assert.equal(whiteFillMode("yes", "auto"), "auto");
  assert.equal(whiteFillMode("yes", "manual"), "manual");
});

test("line art workflow includes cleanup after the selected fill branch", () => {
  assert.deepEqual(workflowSteps("none"), ["trim", "background", "vectorize", "clean"]);
  assert.deepEqual(workflowSteps("auto"), ["trim", "background", "vectorize", "auto-fill", "clean"]);
  assert.deepEqual(workflowSteps("manual"), ["trim", "background", "vectorize", "manual-fill", "clean"]);
});

test("line art workflow creates safe SVG output names", () => {
  assert.equal(workflowOutputName("rabbit.PNG", "none"), "rabbit.svg");
  assert.equal(workflowOutputName("rabbit.PNG", "auto"), "rabbit-white-filled.svg");
  assert.equal(workflowOutputName('bad:name?.jpg', "manual"), "badname-white-filled.svg");
});
