import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { normalizeQuery, searchSite } from "../assets/js/site-search-core.js";
import { SEARCH_ENTRIES } from "../assets/js/site-search-data.js";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const decode = text => text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const top = query => searchSite(query)[0]?.path;

// Every published HTML page (no git needed, so it also runs in a plain copy).
async function publicPages(directory = "") {
  const pages = [];
  for (const entry of await readdir(new URL(directory || ".", root), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || ["assets", "design", "logo_data", "node_modules", "scripts", "src", "test", "tmp"].includes(entry.name)) continue;
      pages.push(...await publicPages(`${directory}${entry.name}/`));
    } else if (entry.name.endsWith(".html")) pages.push(`${directory}${entry.name}`);
  }
  return pages;
}

test("phrases describing a task find the right tool", () => {
  // The examples from the request.
  assert.equal(top("画像を軽くしたい"), "/image-compressor/");
  assert.equal(top("余白を消したい"), "/image-cropper/");
  assert.equal(top("PNGをSVGにしたい"), "/image-to-svg/");
  // Variations of the same intents.
  assert.equal(top("画像のサイズを小さくしたい"), "/image-compressor/");
  assert.equal(top("余白消したい"), "/image-cropper/");
  assert.equal(top("ＰＮＧからＳＶＧ"), "/image-to-svg/");
  assert.equal(top("png to svg"), "/image-to-svg/");
  assert.equal(top("make images smaller"), "/image-compressor/");
  // Similar words that must lead elsewhere.
  assert.equal(top("余白を追加したい"), "/canvas-padding/");
  assert.equal(top("SVGをPNGにしたい"), "/svg-to-image/");
  assert.equal(top("svg to png"), "/svg-to-image/");
  assert.equal(top("svgを軽くしたい"), "/svg-cleaner/");
  assert.equal(top("背景を透明にしたい"), "/background-remover/");
  assert.equal(top("HEICをJPGに"), "/image-converter/");
  assert.equal(top("PDFを結合"), "/pdf/merge/");
  assert.equal(top("画像をPDFにしたい"), "/pdf/images-to-pdf/");
  assert.equal(top("写真の位置情報を消したい"), "/metadata-cleaner/");
  assert.equal(top("ファイル名をそろえたい"), "/batch-rename/");
});

test("plain keywords and names match regardless of script or width", () => {
  assert.equal(top("トリミング"), "/image-cropper/");
  assert.equal(top("とりみんぐ"), "/image-cropper/");
  assert.equal(top("圧縮"), "/image-compressor/");
  assert.equal(top("crop"), "/image-cropper/");
  assert.equal(top("resize"), "/image-resizer/");
  assert.equal(normalizeQuery("ＰＮＧ　トリミング"), "png とりみんぐ");
  assert.deepEqual(searchSite(""), []);
  assert.deepEqual(searchSite("zzzz"), []);
  assert.ok(searchSite("画像").length <= 6);
});

test("every home page card is searchable under the same name", async () => {
  for (const [page, lang, prefix] of [["ja/index.html", "ja", "/ja"], ["index.html", "en", ""]]) {
    const html = await read(page);
    const cards = [...html.matchAll(/<a class="tool-card[^"]*" href="([^"]+)"[\s\S]*?<h[23]>([^<]*)<\/h[23]>/g)];
    assert.equal(cards.length, 9, `${page}: expected the compact 6 + 3 card index`);
    for (const [, href, name] of cards) {
      const entry = SEARCH_ENTRIES.find(item => `${prefix}${item.path}` === href);
      assert.ok(entry, `${href} is missing from the search data`);
      assert.ok(decode(name), `${href} needs a visible card name`);
    }
  }
});

test("every search result points to an existing page in both languages", async () => {
  for (const entry of SEARCH_ENTRIES) {
    for (const prefix of ["", "ja/"]) await stat(new URL(`${prefix}${entry.path.slice(1)}index.html`, root));
    assert.ok(["tool", "workflow"].includes(entry.kind));
    for (const field of ["name", "description"]) assert.ok(entry[field].ja && entry[field].en, `${entry.path} ${field}`);
  }
});

test("every page has one header search box and loads the search script", async () => {
  const pages = await publicPages();
  assert.ok(pages.length >= 80, `found only ${pages.length} pages`);
  for (const page of pages) {
    const html = await read(page);
    if (!html.includes('<header class="site-header">')) continue;
    const header = html.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
    assert.equal(header.split("data-site-search").length - 1, 1, `${page} header search`);
    assert.match(header, /<input class="site-search-input" id="siteSearchInput" type="search" name="q"/);
    assert.equal(html.split('<script type="module" src="/assets/js/site-search.js"></script>').length - 1, 1, `${page} script`);
  }
});

test("the header stays at the top and other sticky bars sit below it", async () => {
  const [header, workflow] = await Promise.all([read("assets/css/header.css"), read("assets/css/custom-workflow.css")]);
  assert.match(header, /\.site-header \{ position: sticky; top: 0; z-index: 50;/);
  assert.match(header, /scroll-padding-top: calc\(var\(--site-header-height/);
  assert.match(workflow, /\.custom-workflow-runner\{position:sticky;top:var\(--site-header-height,0px\);/);
});
