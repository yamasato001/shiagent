import assert from "node:assert/strict";
import test from "node:test";
import { appendOutputSuffix, sanitizeOutputSuffix } from "../assets/js/output-name-core.js";

test("normalizes a user suffix and removes unsafe filename characters", () => {
  assert.equal(sanitizeOutputSuffix(" final version "), "_final-version");
  assert.equal(sanitizeOutputSuffix("_edited"), "_edited");
  assert.equal(sanitizeOutputSuffix("../bad:name"), "_badname");
});

test("appends the suffix before the extension and never duplicates it", () => {
  assert.equal(appendOutputSuffix("photo.png", "_edited"), "photo_edited.png");
  assert.equal(appendOutputSuffix("photo_edited.png", "edited"), "photo_edited.png");
  assert.equal(appendOutputSuffix("archive", "final"), "archive_final");
});
