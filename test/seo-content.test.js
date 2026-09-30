import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function findPages(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    if ([".agents", ".codex", ".git", ".vscode", "assets", "dist", "node_modules", "pages", "public", "scripts", "src", "test", "tmp"].includes(entry.name)) continue;
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) pages.push(...await findPages(new URL(`${entry.name}/`, directory), relative));
    else if (entry.name === "index.html") pages.push(relative);
  }
  return pages;
}

test("every public page has unique, useful search and sharing metadata", async () => {
  const titles = new Map();
  const descriptions = new Map();

  for (const page of await findPages(root)) {
    const html = await readFile(new URL(page, root), "utf8");
    const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
    const description = html.match(/<meta name="description" content="([^"]*)">/)?.[1]?.trim();

    assert.ok(title, `${page} needs a title`);
    assert.ok(description && description.length >= 40, `${page} needs a useful meta description`);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${page} needs exactly one h1`);
    assert.match(html, /<link rel="canonical" href="https:\/\/shiagent\.com\/[^"]*">/, `${page} needs an absolute production canonical link`);
    assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/shiagent\.com\/[^"]*">/, `${page} needs an absolute x-default link`);
    assert.match(html, /<meta property="og:title" content="[^"]+">/, `${page} needs an Open Graph title`);
    assert.match(html, /<meta property="og:description" content="[^"]+">/, `${page} needs an Open Graph description`);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`), `${page} needs a matching Open Graph URL`);
    assert.doesNotMatch(html, /<meta name="keywords"/i, `${page} must not use obsolete meta keywords`);
    assert.doesNotMatch(html, /href="#"/, `${page} contains a non-crawlable placeholder link`);

    assert.ok(!titles.has(title), `${page} duplicates the title from ${titles.get(title)}`);
    assert.ok(!descriptions.has(description), `${page} duplicates the description from ${descriptions.get(description)}`);
    titles.set(title, page);
    descriptions.set(description, page);
  }
});

test("production discovery files expose only canonical indexable pages", async () => {
  const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");
  const robots = await readFile(new URL("../robots.txt", import.meta.url), "utf8");
  const home = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.ok(sitemap.includes("https://shiagent.com/ja/image-compressor/"));
  assert.ok(sitemap.includes('hreflang="ja" href="https://shiagent.com/ja/'));
  assert.ok(sitemap.includes('hreflang="en" href="https://shiagent.com/'));
  assert.ok(!sitemap.includes("line-art-generator"), "pending tools must stay out of the sitemap");
  const indexablePageCount = (await findPages(root)).length - 2; // bilingual pending line-art pages are noindex
  assert.equal(new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url)).size, indexablePageCount);
  assert.ok(sitemap.includes("https://shiagent.com/ja/terms/"));
  assert.ok(sitemap.includes("https://shiagent.com/ja/privacy/"));

  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Sitemap: https:\/\/shiagent\.com\/sitemap\.xml$/m);
  assert.match(home, /<script type="application\/ld\+json" data-seo="website">/);
  assert.match(home, /"name":"SHIAGENT"/);
  assert.match(home, /"url":"https:\/\/shiagent\.com\/"/);
});

test("Japanese search-intent pages use the terms people need to identify the tool", async () => {
  const expectations = {
    "ja/image-compressor/index.html": ["PNG", "JPEG", "WebP", "圧縮"],
    "ja/image-converter/index.html": ["HEIC", "JPG", "変換"],
    "ja/image-cropper/index.html": ["トリミング", "余白", "自動"],
    "ja/metadata-cleaner/index.html": ["EXIF", "GPS", "削除"],
    "ja/image-to-svg/index.html": ["PNG", "JPEG", "WebP", "SVG"],
    "ja/svg-to-image/index.html": ["SVG", "PNG", "WebP"],
  };

  for (const [page, terms] of Object.entries(expectations)) {
    const html = await readFile(new URL(page, root), "utf8");
    const primaryCopy = [
      html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "",
      html.match(/<meta name="description" content="([^"]*)">/)?.[1] || "",
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || "",
      html.match(/<p class="lead">([\s\S]*?)<\/p>/)?.[1] || "",
    ].join(" ");
    for (const term of terms) assert.ok(primaryCopy.includes(term), `${page} should naturally identify ${term}`);
  }
});
