import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("home page links to every available production tool", () => {
  assert.match(html, /href="\/ja\/png-compressor\/"/);
  assert.match(html, /href="\/ja\/png-to-svg\/"/);
  assert.match(html, /href="\/ja\/image-splitter\/"/);
  assert.match(html, /href="\/ja\/batch-rename\/"/);
  assert.match(html, /href="\/ja\/svg-white-fill\/"/);
  assert.match(html, /href="\/ja\/svg-cleaner\/"/);
  assert.match(html, /href="\/ja\/svg-white-fill\/editor\/"/);
  assert.match(html, /workflow-handoff\.js/);
});

test("home page is a real index instead of a redirect", () => {
  assert.doesNotMatch(html, /http-equiv="refresh"/i);
  assert.match(html, /<h1[^>]*>[\s\S]*つくる。[\s\S]*整える。[\s\S]*仕上げる。/);
  assert.match(html, /id="tools"/);
});

test("home page keeps the requested minimal tool index", () => {
  assert.match(html, /<h2 id="tools-title">ツール一覧<\/h2>/);
  assert.match(html, /<h3>PNG圧縮<\/h3>/);
  assert.doesNotMatch(html, /type="search"|role="tablist"/);
  assert.match(html, /<span>シアゲント<\/span>/);
});
