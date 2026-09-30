import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function findPublicPages(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    if ([".agents", ".codex", ".git", ".vscode", "assets", "design", "dist", "logo_data", "node_modules", "pages", "public", "scripts", "src", "test", "tmp"].includes(entry.name)) continue;
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) pages.push(...await findPublicPages(new URL(`${entry.name}/`, directory), relative));
    else if (entry.name === "index.html" || relative === "404.html" || relative === "ja/404.html") pages.push(relative);
  }
  return pages;
}

test("every public page uses the SHIAGENT mark and complete favicon set", async () => {
  const pages = await findPublicPages(root);
  assert.ok(pages.length >= 90, "expected the complete bilingual public site");

  for (const page of pages) {
    const html = await readFile(new URL(page, root), "utf8");
    assert.match(html, /<header class="site-header">[\s\S]*?<img class="brand-mark" src="\/assets\/brand\/shiagent-mark-black\.svg"/, `${page} needs the header mark`);
    assert.match(html, /<link rel="icon" href="\/assets\/brand\/favicon\.svg" type="image\/svg\+xml" data-brand-icon>/, `${page} needs the SVG favicon`);
    assert.equal((html.match(/data-brand-icon/g) || []).length, 5, `${page} needs one complete favicon set`);
    if (/<footer/.test(html)) {
      assert.match(html, /class="brand footer-brand"[\s\S]*?<img class="brand-mark"/, `${page} needs the footer mark`);
    }
  }
});

test("brand assets and PWA icon declarations are publishable", async () => {
  for (const name of [
    "apple-touch-icon.png",
    "favicon-16.png",
    "favicon-32.png",
    "favicon.ico",
    "favicon.svg",
    "icon-192.png",
    "icon-512.png",
    "shiagent-mark-black.svg",
  ]) {
    const info = await stat(new URL(`../assets/brand/${name}`, import.meta.url));
    assert.ok(info.size > 100, `${name} should not be empty`);
  }

  const manifest = JSON.parse(await readFile(new URL("../site.webmanifest", import.meta.url), "utf8"));
  assert.deepEqual(manifest.icons, [
    { src: "/assets/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/assets/brand/icon-512.png", sizes: "512x512", type: "image/png" },
  ]);
});

test("browser favicons use the full canvas without an outer margin", async () => {
  const svg = await readFile(new URL("../assets/brand/favicon.svg", import.meta.url), "utf8");
  assert.match(svg, /<path d="M0,0 H16 V16 H32 V32 H0 Z"/);
  assert.doesNotMatch(svg, /M2,2|H30 V30/);
  const generator = await readFile(new URL("../scripts/generate-brand-favicons.mjs", import.meta.url), "utf8");
  assert.match(generator, /return px < 16 \|\| py >= 16/);
});
