import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const required = [
  "index.html", "ja/index.html", "404.html", "ja/404.html", "robots.txt", "sitemap.xml",
  "privacy/index.html", "ja/privacy/index.html", "terms/index.html", "ja/terms/index.html",
  "contact/index.html", "ja/contact/index.html", "_headers", "ai/tools.json", "llms.txt",
];

for (const path of required) assert.ok((await read(path)).length > 20, `${path} is missing or empty`);

const catalog = JSON.parse(await read("ai/tools.json"));
assert.ok(catalog.tools.length >= 30, "tool catalog is unexpectedly small");
const sitemap = await read("sitemap.xml");
for (const path of ["/contact/", "/ja/contact/", "/privacy/", "/ja/privacy/", "/terms/", "/ja/terms/"]) {
  assert.ok(sitemap.includes(`https://shiagent.com${path}`), `sitemap is missing ${path}`);
}
const headers = await read("_headers");
for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
  assert.ok(headers.includes(`${header}:`), `_headers is missing ${header}`);
}
const contact = await read("assets/js/contact.js");
assert.ok(contact.includes("formsubmit.co/ajax/yamamotoshiki@yahoo.co.jp"), "contact delivery endpoint is not configured");
const privacy = await read("ja/privacy/index.html");
for (const disclosure of ["FormSubmit", "Yahoo! JAPAN", "原則1年以内", "sessionStorage"]) assert.ok(privacy.includes(disclosure), `privacy policy is missing ${disclosure}`);

const home = await read("index.html");
const warnings = [];
if (!home.includes('name="google-site-verification"')) warnings.push("Google Search Console verification is not embedded. Set GOOGLE_SITE_VERIFICATION during the production build.");
if (!home.includes('name="msvalidate.01"')) warnings.push("Bing verification is not embedded. Set BING_SITE_VERIFICATION during the production build.");
console.log(`Launch checks passed (${required.length} required files, ${catalog.tools.length} tools).`);
for (const warning of warnings) console.warn(`NOTICE: ${warning}`);
