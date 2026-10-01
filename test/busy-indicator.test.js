import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

// Minimal DOM: just what busy-indicator.js touches. Like a real browser, writing
// `hidden` or an attribute queues a mutation record even when nothing changes.
let pendingMutations = [];
class Element {
  constructor(classes = "", id = "") {
    this.className = classes; this.id = id; this._hidden = false; this.disabled = false;
    this.children = []; this.parentElement = null; this.attributes = new Map(); this.text = "";
  }
  get hidden() { return this._hidden; }
  set hidden(value) {
    if (value || this._hidden) pendingMutations.push({ target: this, attributeName: "hidden" });
    this._hidden = value;
  }
  matches(selector) {
    return selector.split(",").map(part => part.trim()).some(part =>
      part === "[hidden]" ? this.hidden
        : part.startsWith("#") ? this.id === part.slice(1)
          : this.className.split(" ").includes(part.slice(1)));
  }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  querySelector(selector) { for (const child of this.children) { if (child.matches(selector)) return child; const found = child.querySelector(selector); if (found) return found; } return null; }
  add(child) { child.parentElement = this; this.children.push(child); return child; }
  prepend(child) { child.parentElement = this; this.children.unshift(child); }
  append(text) { this.text += text; }
  setAttribute(name, value) { pendingMutations.push({ target: this, attributeName: name }); this.attributes.set(name, value); }
  removeAttribute(name) { if (this.attributes.has(name)) pendingMutations.push({ target: this, attributeName: name }); this.attributes.delete(name); }
}

async function mount({ cancel = false, progressText = false }) {
  const body = new Element("body");
  const panel = body.add(new Element("queue-panel"));
  const actions = panel.add(new Element("run-actions"));
  if (progressText) actions.add(new Element("vector-progress"));
  const run = actions.add(new Element("button button-accent", "runButton"));
  const cancelButton = cancel ? actions.add(new Element("button button-light", "cancelButton")) : null;
  if (cancelButton) cancelButton.hidden = true;
  const observers = [];
  globalThis.document = {
    body, documentElement: { lang: "ja" },
    querySelectorAll: selector => (selector === ".run-actions" ? [actions] : []),
    createElement: () => new Element()
  };
  globalThis.MutationObserver = class { constructor(callback) { observers.push(callback); } observe() {} };
  pendingMutations = [];
  await import(`../assets/js/busy-indicator.js?case=${Math.random()}`);
  const indicator = actions.children[0];
  // Deliver queued mutations the way MutationObserver would, until the page settles.
  // A handler that keeps writing would never settle: that froze every tool page once.
  const settle = () => {
    for (let round = 0; round < 50; round += 1) {
      if (!pendingMutations.length) return round;
      const records = pendingMutations;
      pendingMutations = [];
      observers.forEach(callback => callback(records));
    }
    throw new Error("mutation loop: the page would freeze");
  };
  const refresh = () => { pendingMutations.push({ target: run, attributeName: "disabled" }); settle(); };
  return { panel, run, cancelButton, indicator, refresh, settle };
}

test("loading a page and idling never loops on its own mutations", async () => {
  const { indicator, refresh, settle } = await mount({ cancel: true, progressText: true });
  assert.ok(settle() <= 1);
  for (let i = 0; i < 5; i += 1) refresh();
  assert.equal(indicator.hidden, true);
});

test("a visible Cancel button shows the spinner (compressor, converter, workflows)", async () => {
  const { panel, run, cancelButton, indicator, refresh } = await mount({ cancel: true });
  assert.equal(indicator.className, "busy-indicator busy-indicator-labelled");
  assert.equal(indicator.text, "処理中…");
  assert.equal(indicator.hidden, true);
  run.hidden = true; cancelButton.hidden = false; refresh();
  assert.equal(indicator.hidden, false);
  assert.equal(panel.attributes.get("aria-busy"), "true");
  run.hidden = false; cancelButton.hidden = true; refresh();
  assert.equal(indicator.hidden, true);
  assert.equal(panel.attributes.has("aria-busy"), false);
});

test("a disabled run button with queued files shows the spinner next to the progress text", async () => {
  const { panel, run, indicator, refresh } = await mount({ progressText: true });
  assert.equal(indicator.className, "busy-indicator");
  assert.equal(indicator.attributes.get("aria-hidden"), "true");
  run.disabled = true; refresh();
  assert.equal(indicator.hidden, false);
  // No files: the queue panel is hidden and the disabled button does not mean busy.
  panel.hidden = true; refresh();
  assert.equal(indicator.hidden, true);
});

test("every tool page with a run button loads the spinner and styles it", async () => {
  const handoff = await readFile(new URL("assets/js/workflow-handoff.js", root), "utf8");
  assert.match(handoff, /import "\.\/busy-indicator\.js";/);
  const css = await readFile(new URL("assets/css/site.css", root), "utf8");
  assert.match(css, /\.busy-indicator::before, \.file-status\.processing::before \{[^}]*animation: busy-spin/);
  assert.match(css, /\.file-row \.progress-bar \{[^}]*animation: busy-sweep/);
  const compressor = await readFile(new URL("assets/js/png-compressor.js", root), "utf8");
  assert.match(compressor, /entry\.status === "processing" \? "processing"/);

  const pages = [];
  const walk = async directory => {
    for (const entry of await readdir(new URL(directory || ".", root), { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && !["assets", "design", "logo_data", "node_modules", "scripts", "src", "test", "tmp"].includes(entry.name)) await walk(`${directory}${entry.name}/`);
      else if (entry.name === "index.html") pages.push(`${directory}index.html`);
    }
  };
  await walk("");
  let tools = 0;
  for (const page of pages) {
    const html = await readFile(new URL(page, root), "utf8");
    if (!html.includes('class="run-actions"')) continue;
    tools += 1;
    assert.match(html, /\/assets\/js\/workflow-handoff\.js/, `${page} does not load the spinner`);
  }
  assert.ok(tools >= 30, `found only ${tools} tool pages`);
});
