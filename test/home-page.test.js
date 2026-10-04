import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const japaneseHome = await readFile(new URL("../ja/index.html", import.meta.url), "utf8");
const englishHome = await readFile(new URL("../index.html", import.meta.url), "utf8");
const japaneseCatalog = await readFile(new URL("../ja/tools/index.html", import.meta.url), "utf8");
const englishCatalog = await readFile(new URL("../tools/index.html", import.meta.url), "utf8");
const japaneseUseCases = await readFile(new URL("../ja/use-cases/index.html", import.meta.url), "utf8");
const englishUseCases = await readFile(new URL("../use-cases/index.html", import.meta.url), "utf8");
const toolSlugs = ["image-compressor", "image-converter", "image-resizer", "image-cropper", "canvas-padding", "image-joiner", "metadata-cleaner", "image-to-svg", "svg-to-image", "color-tool", "favicon-generator", "image-splitter", "background-remover", "batch-rename", "svg-white-fill", "svg-cleaner", "svg-white-fill/editor", "svg-style-editor", "pdf"];

test("home keeps its supporting sections around the compact catalog", () => {
  for (const page of [japaneseHome, englishHome]) {
    assert.match(page, /<section class="hero"/);
    assert.match(page, /<section class="workflow"/);
    assert.match(page, /<section class="local-first"/);
  }
});

test("hero makes free unlimited on-device batch processing explicit", () => {
  assert.match(japaneseHome, /class="hero-benefit">無料・枚数制限なし。ファイルをアップロードせず、ブラウザで一括処理。/);
  assert.match(englishHome, /class="hero-benefit">Free\. Unlimited batches\. Process files in your browser without uploading them\./);
});

test("home catalog shows six popular tools and three recommended workflows", () => {
  for (const page of [japaneseHome, englishHome]) {
    const popular = page.match(/id="popular-tools"[\s\S]*?<\/section>/)?.[0];
    const recommended = page.match(/id="recommended-workflows"[\s\S]*?<\/section>/)?.[0];
    assert.ok(popular);
    assert.ok(recommended);
    assert.equal((popular.match(/class="tool-card"/g) ?? []).length, 6);
    assert.equal((recommended.match(/class="tool-card"/g) ?? []).length, 3);
    assert.doesNotMatch(page, /role="tablist"/);
  }
  for (const label of ["画像圧縮", "形式変換", "Resize", "Crop", "PNG → SVG", "PDF"]) {
    assert.match(japaneseHome, new RegExp(`>${label}<`));
  }
  assert.match(japaneseHome, /href="\/ja\/tools\/#tools">もっと見る/);
  assert.match(japaneseHome, /href="\/ja\/tools\/\?tab=workflows#tools">もっと見る/);
});

test("complete tool and workflow tabs live on the catalog pages", () => {
  for (const [page, prefix] of [[japaneseCatalog, "/ja"], [englishCatalog, ""]]) {
    assert.match(page, /role="tablist"/);
    assert.match(page, /role="tab" id="tab-tools" aria-controls="panel-tools" aria-selected="true"/);
    assert.match(page, /role="tab" id="tab-workflows" aria-controls="panel-workflows" aria-selected="false"/);
    assert.match(page, /id="panel-tools" role="tabpanel"/);
    assert.match(page, /id="panel-workflows" role="tabpanel"[^>]*hidden/);
    assert.match(page, /home-tabs\.js/);
    for (const slug of toolSlugs) assert.match(page, new RegExp(`href="${prefix}/${slug}/"`));
  }
});

test("catalog pages expose a home breadcrumb", () => {
  assert.match(japaneseCatalog, /class="breadcrumb"[\s\S]*href="\/ja\/">ホーム<\/a>[\s\S]*ツール・ワークフロー/);
  assert.match(englishCatalog, /class="breadcrumb"[\s\S]*href="\/">Home<\/a>[\s\S]*Tools &amp; Workflows/);
});

test("home shows six use cases and links to the complete use-case pages", () => {
  for (const [home, fullPage, href] of [[japaneseHome, japaneseUseCases, "/ja/use-cases/"], [englishHome, englishUseCases, "/use-cases/"]]) {
    const homeList = home.match(/<ol class="workflow-list">([\s\S]*?)<\/ol>/)?.[1];
    const fullList = fullPage.match(/<ol class="workflow-list">([\s\S]*?)<\/ol>/)?.[1];
    assert.equal((homeList?.match(/<li>/g) ?? []).length, 6);
    assert.equal((fullList?.match(/<li>/g) ?? []).length, 16);
    assert.match(home, new RegExp(`href="${href}"`));
  }
});

test("local-first summary is compact and promises no batch limits", () => {
  assert.match(japaneseHome, /<span>03<\/span>枚数制限なし/);
  assert.match(englishHome, /<span>03<\/span>No batch limits/);
  const japaneseLocal = japaneseHome.match(/<section class="local-first"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.doesNotMatch(japaneseLocal, /<dd>/);
});

test("catalog category filters can hide cards", async () => {
  const css = await readFile(new URL("../assets/css/home.css", import.meta.url), "utf8");
  const script = await readFile(new URL("../assets/js/home-tabs.js", import.meta.url), "utf8");
  assert.match(css, /\.tool-card\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(script, /path\.includes\("svg"\).*return "vector"/s);
  assert.match(script, /path\.includes\("batch-rename"\).*return "file"/s);
  assert.match(script, /card\.hidden\s*=\s*category !== "all"/);
});

test("card badges use one consistent vocabulary", () => {
  const allowed = new Set(["ON DEVICE", "BATCH", "WORKFLOW", "BETA"]);
  for (const page of [japaneseHome, englishHome, japaneseCatalog, englishCatalog]) {
    const badges = [...page.matchAll(/<span class="badge">([^<]+)<\/span>/g)].map(match => match[1]);
    assert.ok(badges.length > 0);
    for (const badge of badges) assert.ok(allowed.has(badge), `unexpected badge: ${badge}`);
  }
});

test("footer groups become three mobile accordions", async () => {
  for (const page of [japaneseHome, englishHome]) {
    assert.equal((page.match(/<details class="footer-group">/g) ?? []).length, 3);
  }
  for (const label of ["SHIAGENTについて", "サポート", "リーガル"]) assert.match(japaneseHome, new RegExp(`<summary>${label}<\\/summary>`));
  const css = await readFile(new URL("../assets/css/header.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.footer-group:not\(\[open\]\) > \.footer-links \{ display: none; \}/);
  assert.match(css, /\.footer-groups \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(css, /\.footer-group summary \{[^}]*pointer-events: none/);
});

test("mobile layout uses a hamburger, two-column cards and compact workflow headers", async () => {
  const [homeCss, headerCss, siteCss, pdfCss, pdfOrderCss, mobileNav] = await Promise.all([
    readFile(new URL("../assets/css/home.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/css/header.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/css/site.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/css/pdf.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/css/pdf-page-order.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/js/mobile-nav.js", import.meta.url), "utf8"),
  ]);
  assert.match(japaneseHome, /class="menu-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="siteNavigation"/);
  assert.match(japaneseHome, /\/assets\/js\/mobile-nav\.js/);
  assert.match(headerCss, /@media \(max-width: 760px\)[\s\S]*\.site-header \.site-search \{ grid-column: 2; grid-row: 1; width: 36px;[^}]*display: block;/);
  assert.match(headerCss, /\.site-header \.site-search:focus-within \{ position: fixed;[^}]*right: 12px;[^}]*left: 12px;[^}]*width: auto;/);
  assert.match(headerCss, /\.site-header \.site-search:focus-within \.site-search-input \{[^}]*font-size: 16px;/);
  assert.doesNotMatch(headerCss, /\.site-header \.site-search, \.site-search-results \{ display: none !important; \}/);
  assert.match(headerCss, /\.site-header \.menu-toggle \{[^}]*border: 0;[^}]*background: transparent;/);
  assert.match(headerCss, /\.site-header nav \{ position: absolute;[^}]*width: min\(220px, 52vw\);[^}]*padding: 50px 16px 12px;[^}]*display: none;/);
  assert.match(headerCss, /\.site-header \.language \{ position: absolute;[^}]*width: 92px;[^}]*display: none;/);
  assert.match(headerCss, /\.site-header\.is-menu-open nav \{ display: flex; \}/);
  assert.match(mobileNav, /aria-expanded/);
  assert.match(homeCss, /@media \(max-width: 720px\)[\s\S]*\.tool-grid, \.home-tool-grid, \.home-workflow-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(siteCss, /@media \(max-width: 760px\)[\s\S]*\.tool-hero h1 \{ font-size: 28px/);
  assert.match(siteCss, /\.workflow-pipeline, \.workflow-pipeline-five, \.workflow-pipeline-six, \.workflow-pipeline-seven \{ display: flex;[^}]*overflow-x: auto/);
  assert.match(siteCss, /\.workflow-pipeline span, \.workflow-pipeline small \{ display: none; \}/);
  assert.match(pdfCss, /\.pdf-hero h1, \.pdf-category h1 \{ font-size: 30px/);
  assert.match(pdfCss, /@media \(max-width: 500px\)[\s\S]*\.pdf-tool-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 10px; \}/);
  assert.match(pdfOrderCss, /\.pdf-order-shell h1 \{ font-size: 30px/);
});
