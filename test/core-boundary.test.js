import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const CORE_DIRECTORY = new URL("../assets/js/", import.meta.url);
const BROWSER_GLOBAL = /\b(?:document|window|navigator|localStorage|sessionStorage)\b|\bcreateImageBitmap\s*\(|\bnew\s+(?:Blob|File|ImageData|Worker)\b|\bURL\.createObjectURL\s*\(/;

test("processing core modules do not depend on browser I/O globals", async () => {
  const files = (await readdir(CORE_DIRECTORY)).filter(name => name.endsWith("-core.js"));
  const violations = [];
  for (const file of files) {
    const source = await readFile(new URL(file, CORE_DIRECTORY), "utf8");
    const match = source.match(BROWSER_GLOBAL);
    if (match) violations.push(`${file}: ${match[0]}`);
  }
  assert.deepEqual(violations, []);
});

test("browser adapter owns browser file, canvas and zip wrapping", async () => {
  const source = await readFile(new URL("../assets/js/browser-runtime.js", import.meta.url), "utf8");
  for (const boundary of ["new Blob", "new File", "new ImageData", "createImageBitmap", "canvas.toBlob"]) {
    assert.ok(source.includes(boundary), `${boundary} should be isolated in browser-runtime.js`);
  }
});
