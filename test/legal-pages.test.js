import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function publicPages(directory = root, prefix = "") {
  const pages = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".agents", ".codex", ".git", ".vscode", "assets", "design", "dist", "node_modules", "pages", "public", "scripts", "src", "test", "tmp"].includes(entry.name)) continue;
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) pages.push(...await publicPages(new URL(`${entry.name}/`, directory), relative));
    else if (entry.name === "index.html") pages.push(relative);
  }
  return pages;
}

test("legal pages describe the actual local-first data flow", async () => {
  const privacy = await readFile(new URL("../ja/privacy/index.html", import.meta.url), "utf8");
  const terms = await readFile(new URL("../ja/terms/index.html", import.meta.url), "utf8");
  for (const term of ["ブラウザ内", "IndexedDB", "localStorage", "アクセスログ", "第三者アクセス解析"]) {
    assert.ok(privacy.includes(term), `privacy policy should mention ${term}`);
  }
  for (const term of ["ローカル処理", "禁止事項", "権利の帰属", "消費者契約法"]) {
    assert.ok(terms.includes(term), `terms should mention ${term}`);
  }
});

test("every public footer links to terms, privacy and contact", async () => {
  for (const page of await publicPages()) {
    const html = await readFile(new URL(page, root), "utf8");
    const footer = html.match(/<footer(?:\s[^>]*)?>([\s\S]*?)<\/footer>/)?.[1];
    assert.ok(footer, `${page} needs a footer`);
    const ja = page.startsWith("ja/");
    assert.ok(footer.includes(ja ? 'href="/ja/terms/"' : 'href="/terms/"'), `${page} needs Terms`);
    assert.ok(footer.includes(ja ? 'href="/ja/privacy/"' : 'href="/privacy/"'), `${page} needs Privacy`);
    assert.ok(footer.includes(ja ? 'href="/ja/contact/"' : 'href="/contact/"'), `${page} needs Contact`);
    assert.doesNotMatch(footer, /href="#[^"]*"|href="\/(?:ja\/)?#local-first"/, `${page} retains an old footer section link`);
  }
});
