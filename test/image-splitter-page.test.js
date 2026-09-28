import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../ja/image-splitter/index.html", import.meta.url), "utf8");

test("image splitter exposes Matopuri split presets and local exports", () => {
  assert.match(html, /name="split" value="fine"/);
  assert.match(html, /name="split" value="standard" checked/);
  assert.match(html, /name="split" value="grouped"/);
  assert.match(html, /すべてダウンロード/);
  assert.match(html, /image\/jpeg/);
});
