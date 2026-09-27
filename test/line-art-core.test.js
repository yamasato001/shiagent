import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, createLatents, parsePromptList, tensorToLineArt, toFixedTokenIds } from "../assets/js/line-art-core.js";

test("prompt list trims blanks and applies a safe batch limit", () => {
  const prompts = parsePromptList(" cat \n\n dog\n bird ", 2);
  assert.deepEqual(prompts, ["cat", "dog"]);
});

test("style instructions are appended to the user's prompt", () => {
  const prompt = buildPrompt("  a small fox  ", "icon");
  assert.match(prompt, /^a small fox,/);
  assert.match(prompt, /outline icon/);
});

test("token ids are padded or truncated to the UNet sequence length", () => {
  assert.deepEqual(Array.from(toFixedTokenIds([1, 2, 3], 5, 9)), [1, 2, 3, 9, 9]);
  assert.deepEqual(Array.from(toFixedTokenIds([1, 2, 3, 4], 3, 0)), [1, 2, 3]);
});

test("seeded latents are deterministic", () => {
  assert.deepEqual(createLatents([1, 4, 2, 2], 1, 42), createLatents([1, 4, 2, 2], 1, 42));
  assert.notDeepEqual(createLatents([1, 4, 2, 2], 1, 42), createLatents([1, 4, 2, 2], 1, 43));
});

test("tensor conversion outputs opaque grayscale pixels", () => {
  const result = tensorToLineArt(new Float32Array([0, 1, 0, 1, 0, 1]), 2, 1);
  assert.equal(result.length, 8);
  assert.equal(result[0], result[1]);
  assert.equal(result[1], result[2]);
  assert.equal(result[3], 255);
  assert.equal(result[7], 255);
});
