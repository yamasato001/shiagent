import test from "node:test";
import assert from "node:assert/strict";
import { convertedName, detectImageFormat, formatLabel, outputQuality, requiresSoftwareDecoder, sameFormatNotice } from "../assets/js/image-converter-core.js";

const bytes = text => new TextEncoder().encode(text);

test("converter detects common raster signatures instead of trusting extensions", () => {
  assert.equal(detectImageFormat(new Uint8Array([0x89, ...bytes("PNG"), 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(detectImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe1])), "jpeg");
  assert.equal(detectImageFormat(bytes("RIFF1234WEBP")), "webp");
  assert.equal(detectImageFormat(bytes("GIF89a")), "gif");
  assert.equal(detectImageFormat(bytes("BM")), "bmp");
  assert.equal(detectImageFormat(new Uint8Array([0x49, 0x49, 0x2a, 0x00])), "tiff");
});

test("converter distinguishes HEIC and AVIF ISO base media brands", () => {
  assert.equal(detectImageFormat(bytes("0000ftypheic0000mif1")), "heic");
  assert.equal(detectImageFormat(bytes("0000ftypavif0000mif1")), "avif");
});

test("converter creates stable output names and quality settings", () => {
  assert.equal(convertedName("IMG_0123.HEIC", "jpeg"), "IMG_0123.jpg");
  assert.equal(convertedName("art.final.png", "webp", "-2"), "art.final-2.webp");
  assert.equal(outputQuality("png", "high"), undefined);
  assert.equal(outputQuality("jpeg", "high"), 0.94);
  assert.equal(outputQuality("webp", "compact"), 0.68);
  assert.equal(formatLabel("heic"), "HEIC / HEIF");
  assert.equal(requiresSoftwareDecoder("tiff"), true);
});

test("converting to the same format is flagged as a re-encode", async () => {
  assert.equal(sameFormatNotice(["png", "heic", "webp"], "jpeg"), null);
  assert.equal(sameFormatNotice([], "jpeg"), null);
  assert.deepEqual(sameFormatNotice(["jpeg", "png", "jpeg"], "jpeg"), { count: 2, lossless: false });
  assert.deepEqual(sameFormatNotice(["webp"], "webp"), { count: 1, lossless: false });
  assert.deepEqual(sameFormatNotice(["png", "jpeg"], "png"), { count: 1, lossless: true });

  const { default: text } = await import("../assets/js/i18n/image-converter.js");
  assert.match(text.ja.sameFormat.lossy("JPEG", 2), /JPEGの画像が2枚.*再圧縮/);
  assert.match(text.ja.sameFormat.lossless("PNG", 1), /書き出し直し/);
  assert.equal(text.ja.sameFormat.link, "画像圧縮");
  assert.match(text.en.sameFormat.lossy("JPEG", 1), /1 of your images is already JPEG.*re-compresses it/);
  assert.match(text.en.sameFormat.lossy("JPEG", 3), /3 of your images are already JPEG.*re-compresses them/);
});
