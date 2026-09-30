import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function toolPages(directory, prefix = "") {
  const pages = [];
  for (const name of await readdir(new URL(directory, root))) {
    if ([".agents", ".codex", ".git", ".vscode", "assets", "design", "dist", "node_modules", "pages", "public", "scripts", "src", "test", "tmp"].includes(name)) continue;
    const path = `${directory}${name}/`;
    if (!(await stat(new URL(path, root))).isDirectory()) continue;
    try {
      await stat(new URL(`${path}index.html`, root));
      pages.push(`${prefix}${path}index.html`);
    } catch { /* not a page directory */ }
    pages.push(...await toolPages(path, prefix));
  }
  return pages;
}

test("every tool page has an FAQ section", async () => {
  // /ja/index.html is the Japanese home page, not a tool page.
  // PDF entry pages are intentionally focused workspaces; their explanatory
  // content lives on the shared /pdf/ category page instead.
  const pages = (await toolPages("")).filter(page =>
    page !== "ja/index.html"
    && !/(^|\/)pdf\//.test(page)
    && !/(^|\/)(terms|privacy|contact)\/index\.html$/.test(page)
  );
  assert.ok(pages.length >= 20, `found only ${pages.length} tool pages`);
  for (const page of pages) {
    const html = await readFile(new URL(page, root), "utf8");
    if (/http-equiv="refresh"/i.test(html)) continue;
    if (!/data-seo="software-application"/.test(html)) continue;
    assert.match(html, /class="content-section faq-section"/, `${page} has no FAQ`);
    assert.match(html, /<details><summary>/, `${page} FAQ has no questions`);
  }
});
