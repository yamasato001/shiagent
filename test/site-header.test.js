import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const slugs = ["background-remover/", "batch-rename/", "canvas-padding/", "color-tool/", "favicon-generator/", "image-compressor/", "image-converter/", "image-cropper/", "image-joiner/", "image-resizer/", "metadata-cleaner/", "image-splitter/", "image-to-svg/", "svg-to-image/", "line-art-generator/", "svg-cleaner/", "svg-white-fill/", "svg-white-fill/editor/", "svg-style-editor/", "pdf/", "pdf/merge/", "pdf/split/", "pdf/reorder/", "pdf/interleave/", "pdf/rotate/", "pdf/delete-pages/", "pdf/images-to-pdf/", "pdf/sort-by-page-number/", "workflows/web-image-optimizer/", "workflows/line-art-to-svg/", "workflows/ai-asset-prep/", "workflows/asset-normalizer/", "workflows/custom/"];
const read = path => readFile(new URL(`../${path}index.html`, import.meta.url), "utf8");

// The language switch links to the page's own counterpart, so it is compared separately.
const headerOf = html => html.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0]
  .replace(/<div class="language"[\s\S]*?<\/div>(?=\s*<\/div>\s*<\/header>)/, "LANGUAGE");

for (const [language, prefix, other, otherPrefix, nav] of [
  ["Japanese", "ja/", "en", "", /href="\/ja\/tools\/#tools">ツール<\/a><a href="\/ja\/tools\/\?tab=workflows#tools">ワークフロー<\/a>/],
  ["English", "", "ja", "ja/", /href="\/tools\/#tools">Tools<\/a><a href="\/tools\/\?tab=workflows#tools">Workflows<\/a>/]
]) {
  test(`every ${language} page shares the ${language} home page header`, async () => {
    const home = await read(prefix);
    const expected = headerOf(home);
    assert.ok(expected, "home page header not found");
    assert.match(expected, nav);
    for (const slug of ["", ...slugs]) {
      const html = await read(`${prefix}${slug}`);
      if (slug) assert.equal(headerOf(html), expected, `${prefix}${slug} header differs`);
      assert.match(html, /\/assets\/css\/header\.css/);
      const switchLink = new RegExp(`<div class="language"[^>]*>[\\s\\S]*?<a href="/${otherPrefix}${slug}" hreflang="${other}"`);
      assert.match(html, switchLink, `${prefix}${slug} language switch`);
    }
  });
}

test("tool content and shared footer use the same site grid", async () => {
  const [header, site, pdf, pdfOrder] = await Promise.all([
    readFile(new URL("../assets/css/header.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/css/site.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/css/pdf.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/css/pdf-page-order.css", import.meta.url), "utf8")
  ]);
  assert.match(header, /width: min\(100%, 1160px\)[^}]*padding: 12px clamp\(20px, 4vw, 48px\)/);
  assert.match(header, /\.site-header \.language > \[aria-current="page"\][^{]*\{[^}]*border: 1px solid #141414/);
  assert.match(header, /\.site-header \.language > a[^}]*align-items: center[^}]*justify-content: center/);
  assert.match(site, /\.tool-hero \{ width: min\(100%, var\(--max\)\)[^}]*padding: 34px clamp\(20px, 4vw, 48px\) 88px/);
  assert.match(site, /\.content-section \{ width: min\(100%, var\(--max\)\)[^}]*padding: 95px clamp\(20px, 4vw, 48px\)/);
  assert.match(header, /footer \{ width: min\(100%, 1160px\)[^}]*padding: 55px clamp\(20px, 4vw, 48px\) 35px/);
  assert.match(header, /html \{ scrollbar-gutter: stable; \}/);
  assert.match(header, /\.site-header \{[^}]*line-height: 1\.2;[^}]*letter-spacing: normal/);
  assert.match(header, /footer \{[^}]*line-height: 1\.4;[^}]*letter-spacing: normal/);
  assert.doesNotMatch(site, /footer \{/);
  assert.match(pdf, /\.pdf-hero \{ width: min\(100%, 1160px\)[^}]*clamp\(20px, 4vw, 48px\)/);
  assert.match(pdfOrder, /\.pdf-order-shell \.tool-hero \{ width: min\(100%, 1160px\)[^}]*clamp\(20px, 4vw, 48px\)/);
});

test("every footer uses one overflow-safe mobile layout", async () => {
  const [header, home, site] = await Promise.all([
    readFile(new URL("../assets/css/header.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/css/home.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/css/site.css", import.meta.url), "utf8"),
  ]);
  const mobileFooter = /@media \(max-width: 760px\) \{[\s\S]*?footer \{[^}]*width: auto;[^}]*margin: 0 18px;[^}]*padding-left: 0;[^}]*padding-right: 0;[^}]*grid-template-columns: 1fr;[^}]*\}/;
  assert.match(header, mobileFooter);
  assert.doesNotMatch(home, /footer \{/);
  assert.doesNotMatch(site, /footer \{/);
});
