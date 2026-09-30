import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const run = promisify(execFile);

// Runs analytics.js once in a child process with a minimal fake browser,
// because the module reads the page language and storage when it is imported.
async function simulate({ lang, choice = null, hostname = "shiagent.com", search = "" }) {
  const script = `
    const appended = { head: [], body: [] };
    const store = new Map(${JSON.stringify(choice === null ? [] : [["shiagent-analytics", choice]])});
    const element = tag => ({ tag, children: [], setAttribute() {}, addEventListener() {}, append(...nodes) { this.children.push(...nodes); }, remove() {} });
    globalThis.window = globalThis;
    globalThis.localStorage = { getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, value) };
    globalThis.location = { hostname: ${JSON.stringify(hostname)}, origin: "https://" + ${JSON.stringify(hostname)}, pathname: "/image-compressor/", search: ${JSON.stringify(search)} };
    globalThis.document = {
      documentElement: { lang: ${JSON.stringify(lang)} }, referrer: "https://example.com/page?secret=1",
      createElement: element, querySelector: () => null,
      head: { append: node => appended.head.push(node) }, body: { append: node => appended.body.push(node) }
    };
    await import(${JSON.stringify(new URL("assets/js/analytics.js", root).href)});
    const config = (globalThis.dataLayer || []).map(entry => Array.from(entry)).find(entry => entry[0] === "config");
    console.log(JSON.stringify({
      scripts: appended.head.map(node => node.src), banner: appended.body.some(node => node.className === "analytics-consent"), config
    }));`;
  const { stdout } = await run(process.execPath, ["--input-type=module", "-e", script]);
  return JSON.parse(stdout.trim().split("\n").at(-1));
}

test("Japanese pages measure by default and respect the opt-out", async () => {
  const on = await simulate({ lang: "ja" });
  assert.deepEqual(on.scripts, ["https://www.googletagmanager.com/gtag/js?id=G-9W13K3S1GQ"]);
  assert.equal(on.banner, false);
  const off = await simulate({ lang: "ja", choice: "denied" });
  assert.deepEqual(off.scripts, []);
  assert.equal(off.banner, false);
});

test("English pages ask first and measure only after consent", async () => {
  const asking = await simulate({ lang: "en" });
  assert.deepEqual(asking.scripts, []);
  assert.equal(asking.banner, true);
  const granted = await simulate({ lang: "en", choice: "granted" });
  assert.equal(granted.scripts.length, 1);
  assert.equal(granted.banner, false);
  const denied = await simulate({ lang: "en", choice: "denied" });
  assert.deepEqual(denied.scripts, []);
  assert.equal(denied.banner, false);
});

test("only the page path is reported and ad features are off", async () => {
  const { config } = await simulate({ lang: "ja", search: "?customWorkflow=private-data" });
  assert.equal(config[1], "G-9W13K3S1GQ");
  assert.equal(config[2].page_location, "https://shiagent.com/image-compressor/");
  assert.equal(config[2].page_referrer, "https://example.com/page");
  assert.equal(config[2].allow_google_signals, false);
  assert.equal(config[2].allow_ad_personalization_signals, false);
});

test("nothing is reported outside the production host", async () => {
  const local = await simulate({ lang: "ja", hostname: "localhost" });
  assert.deepEqual(local.scripts, []);
});

async function publicPages(directory = "") {
  const pages = [];
  for (const entry of await readdir(new URL(directory || ".", root), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if ([".git", ".github", ".vscode", ".pnpm-store", "assets", "design", "logo_data", "node_modules", "scripts", "src", "test", "tmp"].includes(entry.name)) continue;
      pages.push(...await publicPages(`${directory}${entry.name}/`));
    } else if (entry.name.endsWith(".html")) pages.push(`${directory}${entry.name}`);
  }
  return pages;
}

test("every public page loads the analytics script exactly once", async () => {
  const pages = await publicPages();
  assert.ok(pages.length >= 80, `found only ${pages.length} pages`);
  for (const page of pages) {
    const count = (await read(page)).split('<script type="module" src="/assets/js/analytics.js"></script>').length - 1;
    assert.equal(count, 1, `${page} loads analytics.js ${count} times`);
  }
});

test("CSP allows Google Analytics and the privacy policy discloses it", async () => {
  const headers = await read("_headers");
  assert.match(headers, /script-src 'self' 'wasm-unsafe-eval' https:\/\/www\.googletagmanager\.com;/);
  assert.match(headers, /connect-src [^;]*https:\/\/\*\.google-analytics\.com/);
  for (const [page, name] of [["ja/privacy/index.html", "Google アナリティクス"], ["privacy/index.html", "Google Analytics"]]) {
    const html = await read(page);
    assert.ok(html.includes(name), `${page} should name the analytics service`);
    assert.match(html, /data-analytics-toggle/);
    assert.match(html, /data-analytics-status/);
  }
});
