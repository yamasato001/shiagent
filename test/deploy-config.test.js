import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [headers, htaccess, robots, workflow] = await Promise.all([read("_headers"), read(".htaccess"), read("robots.txt"), read(".github/workflows/deploy.yml")]);

test(".htaccess sends the same headers as _headers", () => {
  const siteWide = headers.split(/\n\s*\n/)[0].split("\n").slice(1).map(line => line.trim()).filter(Boolean);
  assert.ok(siteWide.length > 5);
  for (const line of siteWide) {
    const [name, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    assert.ok(htaccess.includes(`Header always set ${name} "${value}"`) || htaccess.includes(`Header set ${name} "${value}"`), `${name} missing or different in .htaccess`);
  }
});

test("only brand images are cached without revalidation", () => {
  // CSS, JS and WASM are not fingerprinted: a long cache would let a deploy mix
  // new and stale files (and Xserver's front cache would keep serving old ones).
  assert.match(headers, /\/assets\/brand\/\*\n\s*Cache-Control: public, max-age=86400/);
  assert.doesNotMatch(headers, /^\/assets\/\*$/m);
  assert.match(htaccess, /m#\^\/assets\/brand\/#">\n\s*Header set Cache-Control "public, max-age=86400"/);
  assert.doesNotMatch(htaccess, /m#\^\/assets\/#"/);
  assert.match(htaccess, /Header set Cache-Control "public, max-age=0, must-revalidate"/);
});

test(".htaccess hides repository and development paths", () => {
  const blocked = htaccess.match(/RedirectMatch 404 \^\/\(([^)]*)\)\(\/\|\$\)/)[1].split("|").map(entry => entry.replace(/\\/g, ""));
  for (const path of [".git", ".github", "node_modules", ...robots.matchAll(/^Disallow: \/([^/\s]+)\//gm)].map(entry => Array.isArray(entry) ? entry[1] : entry)) {
    assert.ok(blocked.includes(path), `${path} is not blocked`);
  }
  assert.match(htaccess, /ErrorDocument 404 \/404\.html/);
  assert.match(htaccess, /RewriteCond %\{HTTP_HOST\} \^www\\\.\(\.\+\)\$ \[NC\]\n\s*RewriteRule \^ https:\/\/%1%\{REQUEST_URI\} \[R=301,L\]/);
  assert.match(htaccess, /AddType application\/wasm \.wasm/);
});

test("pushing to main deploys only after tests pass", () => {
  assert.match(workflow, /on:\n  push:\n    branches: \[main\]/);
  assert.match(workflow, /run: node --test/);
  assert.match(workflow, /deploy:\n    needs: verify/);
  assert.match(workflow, /git reset --hard origin\/main/);
});
