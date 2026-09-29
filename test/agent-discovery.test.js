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
  for (const method of ["getCatalog", "getContract", "getState", "loadFiles", "setValue", "run", "download", "waitFor", "navigate"]) {
    assert.match(bridge, new RegExp(`\\b${method}\\b`));
  }
  const tray = await read("assets/js/workflow-handoff.js");
  assert.match(tray, /shiagent:traychange/);
  assert.match(tray, /files: accepted\.map/);
});
