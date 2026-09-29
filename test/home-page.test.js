import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// English lives at "/", Japanese at "/ja/".
const html = await readFile(new URL("../ja/index.html", import.meta.url), "utf8");
const englishHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const toolSlugs = ["image-compressor", "image-converter", "image-resizer", "image-cropper", "canvas-padding", "image-joiner", "metadata-cleaner", "image-to-svg", "svg-to-image", "color-tool", "favicon-generator", "image-splitter", "background-remover", "batch-rename", "svg-white-fill", "svg-cleaner", "svg-white-fill/editor", "pdf"];

test("home page links to every available production tool", () => {
  for (const slug of toolSlugs) {
    assert.match(html, new RegExp(`href="/ja/${slug}/"`));
    assert.match(englishHtml, new RegExp(`href="/${slug}/"`));
  }
  assert.match(html, /workflow-handoff\.js/);
  assert.match(englishHtml, /workflow-handoff\.js/);
});

test("home page is a real index instead of a redirect", () => {
  assert.doesNotMatch(html, /http-equiv="refresh"/i);
  assert.match(html, /<h1[^>]*>[\s\S]*つくる。[\s\S]*整える。[\s\S]*仕上げる。/);
  assert.match(html, /id="tools"/);
  assert.match(englishHtml, /<h1[^>]*>[\s\S]*Generate\.[\s\S]*Refine\.[\s\S]*Finish\./);
  assert.match(englishHtml, /id="tools"/);
});

test("home page keeps the requested minimal tool index", () => {
  assert.match(html, /<h2 id="tools-title">ツール一覧<\/h2>/);
  assert.match(html, /<h3>画像圧縮<\/h3>/);
  assert.match(html, /<h3>画像形式変換<\/h3>/);
  assert.match(html, /<h3>画像リサイズ<\/h3>/);
  assert.match(html, /<h3>画像トリミング<\/h3>/);
  assert.match(html, /<h3>余白追加<\/h3>/);
  assert.match(html, /<h3>画像結合<\/h3>/);
  assert.match(html, /<h3>メタデータ削除<\/h3>/);
  assert.match(html, /<h3>SVG → 画像<\/h3>/);
  assert.match(html, /<h3>色置換・白黒化・透明化<\/h3>/);
  assert.match(html, /<h3>Favicon・App Icon生成<\/h3>/);
  assert.match(html, /<h3>画像 → SVG変換<\/h3>/);
  assert.match(html, /<h3>SVG自動白塗り<\/h3>/);
  assert.match(html, /<h3>SVG手動白塗り<\/h3>/);
  assert.match(englishHtml, /<h3>SVG to Image<\/h3>/);
  assert.match(englishHtml, /<h3>Automatic SVG White Fill<\/h3>/);
  assert.match(englishHtml, /<h3>Manual SVG White Fill<\/h3>/);
  assert.match(html, /<h3>PDFツール<\/h3>/);
  assert.doesNotMatch(html, /type="search"/);
  for (const category of ["all", "image", "vector", "pdf", "file"]) assert.match(html, new RegExp(`data-category="${category}"`));
  assert.match(html, /<span>シアゲント<\/span>/);
});

test("home page switches between tool and workflow tabs", () => {
  for (const [page, prefix] of [[html, "/ja"], [englishHtml, ""]]) {
    assert.match(page, /role="tablist"/);
    assert.match(page, /role="tab" id="tab-tools" aria-controls="panel-tools" aria-selected="true"/);
    assert.match(page, /role="tab" id="tab-workflows" aria-controls="panel-workflows" aria-selected="false"/);
    assert.match(page, /id="panel-tools" role="tabpanel"/);
    const workflows = page.match(/<div class="tool-grid" id="panel-workflows" role="tabpanel"[^>]*hidden>([\s\S]*?)\n      <\/div>/)?.[1];
    assert.ok(workflows, "workflow panel missing");
    assert.match(workflows, new RegExp(`href="${prefix}/workflows/web-image-optimizer/"`));
    assert.match(workflows, new RegExp(`href="${prefix}/workflows/line-art-to-svg/"`));
    assert.match(workflows, new RegExp(`href="${prefix}/workflows/ai-asset-prep/"`));
    assert.match(workflows, new RegExp(`href="${prefix}/workflows/asset-normalizer/"`));
    assert.match(workflows, new RegExp(`href="${prefix}/workflows/custom/"`));
    assert.match(workflows, prefix ? /<h3>AI画像素材一括仕上げ<\/h3>/ : /<h3>AI Asset Prep<\/h3>/);
    assert.match(workflows, prefix ? /<h3>画像素材の規格統一<\/h3>/ : /<h3>Asset Normalizer<\/h3>/);
    assert.match(workflows, prefix ? /<h3>Web画像最適化<\/h3>/ : /<h3>Web Image Optimizer<\/h3>/);
    assert.match(workflows, prefix ? /<h3>オリジナル<\/h3>/ : /<h3>Original<\/h3>/);
    assert.match(page, /home-tabs\.js/);
  }
});

test("category filters can hide cards with the hidden attribute", async () => {
  const css = await readFile(new URL("../assets/css/home.css", import.meta.url), "utf8");
  const script = await readFile(new URL("../assets/js/home-tabs.js", import.meta.url), "utf8");
  assert.match(css, /\.tool-card\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(script, /path\.includes\("svg"\).*return "vector"/s);
  assert.match(script, /path\.includes\("batch-rename"\).*return "file"/s);
  assert.match(script, /card\.hidden\s*=\s*category !== "all"/);
});
