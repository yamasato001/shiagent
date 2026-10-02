import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const slugs = ["", "background-remover/", "batch-rename/", "canvas-padding/", "color-tool/", "favicon-generator/", "image-compressor/", "image-converter/", "image-cropper/", "image-joiner/", "image-resizer/", "metadata-cleaner/", "image-splitter/", "image-to-svg/", "svg-to-image/", "line-art-generator/", "svg-cleaner/", "svg-white-fill/", "svg-white-fill/editor/", "svg-style-editor/", "pdf/", "pdf/merge/", "pdf/split/", "pdf/reorder/", "pdf/interleave/", "pdf/rotate/", "pdf/delete-pages/", "pdf/images-to-pdf/", "workflows/web-image-optimizer/", "workflows/line-art-to-svg/", "workflows/ai-asset-prep/", "workflows/asset-normalizer/", "workflows/custom/"];
const read = path => readFile(new URL(`../${path}index.html`, import.meta.url), "utf8");
const JAPANESE = /[぀-ヿ一-鿿]/;
const ORIGIN = "https://shiagent.com";

const ids = html => [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]).sort();
const choices = html => [...html.matchAll(/<input[^>]*\sname="([^"]+)"[^>]*\svalue="([^"]*)"/g)].map(match => `${match[1]}=${match[2]}`).sort();
const scripts = html => [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(match => match[1]).sort();

for (const slug of slugs) {
  test(`/${slug} and /ja/${slug} are a matching language pair`, async () => {
    const [en, ja] = await Promise.all([read(slug), read(`ja/${slug}`)]);
    assert.match(en, /<html lang="en"/);
    assert.match(ja, /<html lang="ja"/);
    for (const [html, self] of [[en, `/${slug}`], [ja, `/ja/${slug}`]]) {
      assert.match(html, new RegExp(`<link rel="canonical" href="${ORIGIN}${self}">`));
      assert.match(html, new RegExp(`<link rel="alternate" hreflang="en" href="${ORIGIN}/${slug}">`));
      assert.match(html, new RegExp(`<link rel="alternate" hreflang="ja" href="${ORIGIN}/ja/${slug}">`));
      assert.match(html, new RegExp(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/${slug}">`));
    }
    // Same markup contract, so the shared scripts work on both.
    assert.deepEqual(ids(en), ids(ja), "element ids differ");
    assert.deepEqual(choices(en), choices(ja), "form choices differ");
    assert.deepEqual(scripts(en), scripts(ja), "scripts differ");
    assert.ok(scripts(en).includes("/assets/js/language.js"));
  });

  test(`/${slug} has no untranslated Japanese`, async () => {
    const text = (await read(slug))
      .replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, "")
      .replace(/<a [^>]*hreflang="ja"[^>]*>日本語<\/a>/g, "")
      .replace(/<span>シアゲント<\/span>/g, "");
    const leftover = text.split("\n").find(line => JAPANESE.test(line));
    assert.equal(leftover, undefined);
  });
}

function shape(value) {
  if (typeof value === "function") return "function";
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, shape(value[key])]));
  return typeof value;
}

test("every i18n dictionary has the same keys in Japanese and English", async () => {
  const directory = new URL("../assets/js/i18n/", import.meta.url);
  const files = (await readdir(directory)).filter(name => name.endsWith(".js"));
  assert.ok(files.length > 0);
  for (const name of files) {
    const dictionary = (await import(new URL(name, directory))).default;
    assert.deepEqual(shape(dictionary.en), shape(dictionary.ja), `${name} keys differ`);
  }
});
