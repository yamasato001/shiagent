import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

test("contact forms deliver through the declared processor without file attachments", async () => {
  const script = await read("assets/js/contact.js");
  const ja = await read("ja/contact/index.html");
  const en = await read("contact/index.html");
  assert.match(script, /https:\/\/formsubmit\.co\/ajax\/yamamotoshiki@yahoo\.co\.jp/);
  assert.match(script, /diagnostics\.checked/);
  for (const page of [ja, en]) {
    assert.match(page, /id="contactForm"/);
    assert.match(page, /name="email" type="email"/);
    assert.match(page, /name="privacy_agreed"/);
    assert.doesNotMatch(page, /type="file"/);
  }
});

test("privacy policy discloses contact delivery, retention and opt-in diagnostics", async () => {
  const privacy = await read("ja/privacy/index.html");
  for (const term of ["FormSubmit", "Yahoo! JAPAN", "原則1年以内", "sessionStorage", "明示的に選択"]) {
    assert.ok(privacy.includes(term), `privacy policy should mention ${term}`);
  }
});

test("production hosting policy includes the minimum launch security headers", async () => {
  const headers = await read("_headers");
  for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
    assert.match(headers, new RegExp(`^  ${header}:`, "m"));
  }
  assert.match(headers, /connect-src 'self' blob: https:\/\/formsubmit\.co/);
  assert.match(headers, /worker-src 'self' blob:/);
});

test("custom 404 pages are non-indexable and preserve the work tray", async () => {
  for (const path of ["404.html", "ja/404.html"]) {
    const page = await read(path);
    assert.match(page, /name="robots" content="noindex,follow"/);
    assert.match(page, /Work Tray|作業トレイ/);
  }
});

test("diagnostics are sanitized, bounded and never sent automatically", async () => {
  const script = await read("assets/js/site-observability.js");
  assert.match(script, /MAX_EVENTS = 30/);
  assert.match(script, /\[local-path\]/);
  assert.match(script, /\[email\]/);
  assert.match(script, /sessionStorage/);
  assert.doesNotMatch(script, /fetch\(|sendBeacon\(/);
});
