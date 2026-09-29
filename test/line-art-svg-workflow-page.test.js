import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../ja/workflows/line-art-to-svg/index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../src/line-art-svg-workflow.js", import.meta.url), "utf8");
const editor = await readFile(new URL("../assets/js/svg-white-fill-editor.js", import.meta.url), "utf8");
const handoff = await readFile(new URL("../assets/js/workflow-handoff.js", import.meta.url), "utf8");

test("line art workflow exposes white fill off, automatic and manual choices", () => {
  assert.match(html, /name="whiteFill" value="none"/);
  assert.match(html, /name="whiteFill" value="yes"/);
  assert.match(html, /name="fillMethod" value="auto"/);
  assert.match(html, /name="fillMethod" value="manual"/);
});

test("line art workflow runs trim, background, vectorization, fill and cleanup", () => {
  for (const label of ["トリミング", "背景処理", "画像 → SVG", "白フィル", "SVGクリーナー"]) assert.match(html, new RegExp(label));
  assert.match(html, /白フィル（塗りつぶし）/);
  assert.match(script, /contentBounds/);
  assert.match(script, /processBackground/);
  assert.match(script, /potrace/);
  assert.match(script, /addAutoFill/);
  assert.match(script, /cleanSvg/);
});

test("manual branch hands SVGs to the editor and cleans edited workflow output", () => {
  assert.match(script, /workflow=line-art-to-svg/);
  assert.match(script, /replaceTray/);
  assert.match(editor, /lineArtWorkflow/);
  assert.match(editor, /lineArtWorkflow \? cleanSvg\(filledSvg\)\.svg : filledSvg/);
  assert.match(handoff, /url\.searchParams\.delete\("tray"\)/);
});
