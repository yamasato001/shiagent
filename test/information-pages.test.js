import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const slugs = ["about", "specifications", "local-processing", "faq", "changelog", "status", "feedback", "examples", "accessibility"];

test("trust information is published as complete bilingual page pairs", async () => {
  for (const slug of slugs) {
    for (const prefix of ["", "ja/"]) {
      const page = await readFile(new URL(`${prefix}${slug}/index.html`, root), "utf8");
      assert.match(page, /<h1>/, `${prefix}${slug} needs a heading`);
      assert.match(page, /<link rel="canonical" href="https:\/\/shiagent\.com\//, `${prefix}${slug} needs a canonical URL`);
      assert.match(page, /<a class="skip-link" href="#main-content">/, `${prefix}${slug} needs a skip link`);
      assert.match(page, /href="\/(?:ja\/)?about\/"/, `${prefix}${slug} footer needs trust navigation`);
    }
  }
});

test("every active tool publishes a localized practical example", async () => {
  const catalog = JSON.parse(await readFile(new URL("ai/tools.json", root), "utf8"));
  for (const tool of catalog.tools.filter(tool => tool.status === "active")) {
    for (const locale of ["en", "ja"]) {
      const relative = `${tool.paths[locale].replace(/^\//, "")}index.html`;
      const html = await readFile(new URL(relative, root), "utf8");
      assert.match(html, /data-site-example/, `${tool.id} (${locale}) needs a usage example`);
    }
  }
});

test("examples, status, feedback and accessibility are concrete rather than placeholder claims", async () => {
  for (const asset of ["outline-source.svg", "outline-clean.svg", "background-before.svg", "background-after.svg", "sheet-before.svg", "sheet-after.svg"]) {
    assert.ok((await stat(new URL(`assets/examples/${asset}`, root))).size > 100, `${asset} is missing`);
  }
  const status = JSON.parse(await readFile(new URL("status/status.json", root), "utf8"));
  assert.equal(status.monitoring, "release-status-not-live-monitoring");
  assert.equal(status.components.find(item => item.id === "local-ai-line-art")?.status, "pending");
  const feedback = await readFile(new URL("../assets/js/feedback.js", import.meta.url), "utf8");
  assert.match(feedback, /formsubmit\.co\/ajax/);
  assert.doesNotMatch(feedback, /fileInput|new File\(|shiagent-tray/);
  const siteCss = await readFile(new URL("../assets/css/site.css", import.meta.url), "utf8");
  const homeCss = await readFile(new URL("../assets/css/home.css", import.meta.url), "utf8");
  for (const css of [siteCss, homeCss]) {
    assert.match(css, /:focus-visible/);
    assert.match(css, /prefers-reduced-motion/);
  }
});
