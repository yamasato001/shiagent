import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

test("AI discovery publishes a bilingual, local-first tool contract", async () => {
  const catalog = JSON.parse(await read("ai/tools.json"));
  assert.equal(catalog.version, "1.0");
  assert.equal(catalog.browserApi.global, "window.SHIAGENT");
  assert.ok(catalog.tools.length >= 30);
  assert.equal(new Set(catalog.tools.map(tool => tool.id)).size, catalog.tools.length);

  for (const tool of catalog.tools) {
    assert.ok(tool.paths.en?.startsWith("/"), `${tool.id} needs an English path`);
    assert.ok(tool.paths.ja?.startsWith("/ja/"), `${tool.id} needs a Japanese path`);
    assert.ok(tool.name.en && tool.name.ja, `${tool.id} needs bilingual names`);
    assert.ok(Array.isArray(tool.accepts) && Array.isArray(tool.outputs));
    assert.equal(tool.localProcessing, true);
    assert.equal(tool.automation.events.ready, "shiagent:ready");
    if (tool.status === "active") assert.ok(tool.automation.action, `${tool.id} needs a primary action`);
  }

  assert.equal(catalog.tools.find(tool => tool.id === "line-art-generator")?.status, "pending");
  assert.ok(catalog.tools.reduce((sum, tool) => sum + tool.automation.controls.length, 0) >= 190);

  const editor = catalog.tools.find(tool => tool.id === "svg-white-fill-editor");
  assert.equal(editor.automation.action, "#nextButton");
  assert.equal(editor.automation.result, "#editorCanvas");
  assert.equal(editor.automation.status, "#fileStatus");

  const custom = catalog.tools.find(tool => tool.id === "workflows-custom");
  assert.equal(custom.automation.result, "#workflowSteps");
  assert.ok(custom.automation.controls.some(control => control.selector === "#inputType"));

  const split = catalog.tools.find(tool => tool.id === "pdf-split");
  for (const selector of ["#pdfSelection", "#pdfRange", "#pdfOutput", "#pdfName"]) {
    assert.ok(split.automation.controls.some(control => control.selector === selector));
  }

  const rotate = catalog.tools.find(tool => tool.id === "pdf-rotate");
  assert.equal(rotate.automation.controls.find(control => control.selector === "#pdfAutoOrient")?.action, "click");

  assert.deepEqual(catalog.tools.find(tool => tool.id === "svg-to-image").outputs, ["image/png", "image/webp", "application/zip"]);
  assert.ok(catalog.tools.find(tool => tool.id === "color-tool").outputs.includes("image/svg+xml"));
});

test("public pages expose the invisible agent bridge and structured app data", async () => {
  for (const page of ["index.html", "ja/index.html", "image-compressor/index.html", "ja/pdf/merge/index.html"]) {
    const html = await read(page);
    assert.match(html, /<link rel="alternate" type="application\/json" href="\/ai\/tools\.json"/);
    assert.match(html, /<link rel="help" href="\/llms\.txt">/);
    assert.match(html, /<script type="module" src="\/assets\/js\/agent-bridge\.js" data-agent-bridge><\/script>/);
  }
  const compressor = await read("ja/image-compressor/index.html");
  assert.match(compressor, /data-seo="software-application"/);
  assert.match(compressor, /"@type":"WebApplication"/);
  assert.match(compressor, /"price":"0"/);
});

test("published static control selectors resolve on every configurable tool page", async () => {
  const catalog = JSON.parse(await read("ai/tools.json"));
  const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? null;
  for (const tool of catalog.tools.filter(item => item.status === "active" && item.category !== "pdf")) {
    const html = await read(`${tool.paths.en.slice(1)}index.html`);
    for (const key of ["input", "action", "result", "download", "status"]) {
      const selector = tool.automation[key];
      if (selector?.startsWith("#")) assert.match(html, new RegExp(`\\bid="${selector.slice(1)}"`), `${tool.id}: ${key} ${selector}`);
    }
    const actualSelectors = [
      ...html.matchAll(/<input\b[^>]*>/gi),
      ...html.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi),
      ...html.matchAll(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi),
    ].map(match => {
      const tag = match[0];
      const element = tag.match(/^<(input|select|textarea)\b/i)?.[1].toLowerCase();
      const type = element === "input" ? (attribute(tag, "type") || "text") : element;
      if (type === "file" || type === "hidden") return null;
      const id = attribute(tag, "id");
      if (id) return `#${id}`;
      const name = attribute(tag, "name");
      const value = attribute(tag.match(/^<[^>]*>/)?.[0] || tag, "value");
      return name && type === "radio" && value !== null ? `input[name="${name}"][value="${value}"]` : null;
    }).filter(Boolean);
    const publishedSelectors = tool.automation.controls.map(control => control.selector);
    assert.deepEqual(new Set(publishedSelectors), new Set(actualSelectors), `${tool.id}: every visible setting must be published`);
    for (const control of tool.automation.controls) {
      if (control.selector.startsWith("#")) {
        assert.match(html, new RegExp(`\\bid="${control.selector.slice(1)}"`), `${tool.id}: ${control.selector}`);
        continue;
      }
      const radio = control.selector.match(/^input\[name="([^"]+)"\]\[value="([^"]+)"\]$/);
      assert.ok(radio, `${tool.id}: unsupported selector ${control.selector}`);
      assert.match(html, new RegExp(`<input\\b(?=[^>]*\\bname="${radio[1]}")(?=[^>]*\\bvalue="${radio[2]}")[^>]*>`), `${tool.id}: ${control.selector}`);
    }
  }
});

test("AI crawler policy and human-readable automation guide are explicit", async () => {
  const robots = await read("robots.txt");
  const shortGuide = await read("llms.txt");
  const fullGuide = await read("llms-full.txt");
  assert.match(robots, /^User-agent: OAI-SearchBot\r?\nAllow: \/$/m);
  assert.match(robots, /^User-agent: GPTBot\r?\nAllow: \/$/m);
  assert.match(shortGuide, /ai\/tools\.json/);
  assert.match(fullGuide, /window\.SHIAGENT/);
  assert.match(fullGuide, /Never claim success solely because a button was clicked/);
});

test("agent bridge exposes file loading, options, execution, verification, and handoff", async () => {
  const bridge = await read("assets/js/agent-bridge.js");
  for (const method of ["getCatalog", "getContract", "getState", "loadFiles", "setValue", "setValues", "click", "reportError", "run", "download", "waitFor", "navigate"]) {
    assert.match(bridge, new RegExp(`\\b${method}\\b`));
  }
  assert.match(bridge, /\["", "0", "false", "off", "no"\]/);
  assert.match(bridge, /shiagent:error/);
  const tray = await read("assets/js/workflow-handoff.js");
  assert.match(tray, /shiagent:traychange/);
  assert.match(tray, /files: accepted\.map/);
});
