import test from "node:test";
import assert from "node:assert/strict";
import { cleanImageMetadata, cleanedName } from "../assets/js/image-metadata-core.js";

const segment = (marker, payload) => Uint8Array.from([0xff, marker, 0, payload.length + 2, ...payload]);

test("removes JPEG EXIF, IPTC and comments without touching scan data", () => {
  const exif = segment(0xe1, [...Buffer.from("Exif\0\0"), 1, 2]);
  const iptc = segment(0xed, [3, 4]);
  const comment = segment(0xfe, [5]);
  const scan = Uint8Array.from([0xff, 0xda, 0, 2, 9, 8, 7, 0xff, 0xd9]);
  const input = Uint8Array.from([0xff, 0xd8, ...exif, ...iptc, ...comment, ...scan]);
  const result = cleanImageMetadata(input, "jpeg");
  assert.deepEqual(result.removed, ["EXIF / GPS", "IPTC", "Comment"]);
  assert.deepEqual([...result.bytes], [0xff, 0xd8, ...scan]);
});

test("removes PNG metadata chunks", () => {
  const signature = Uint8Array.from([137,80,78,71,13,10,26,10]);
  const chunk = (type, data=[]) => Uint8Array.from([0,0,0,data.length,...Buffer.from(type),...data,0,0,0,0]);
  const input = Uint8Array.from([...signature,...chunk("tEXt",[1]),...chunk("IDAT",[2]),...chunk("IEND")]);
  const result = cleanImageMetadata(input,"png");
  assert.deepEqual(result.removed,["Text"]);
  assert.equal(Buffer.from(result.bytes).includes(Buffer.from("tEXt")),false);
});

test("adds a clean suffix without changing the extension", () => {
  assert.equal(cleanedName("photo.JPG"), "photo-clean.JPG");
});

test("removes WebP EXIF and XMP chunks and updates RIFF size", () => {
  const chunk = (type, data = []) => Uint8Array.from([...Buffer.from(type), data.length, 0, 0, 0, ...data, ...(data.length & 1 ? [0] : [])]);
  const body = Uint8Array.from([...chunk("VP8X", [0x0c]), ...chunk("EXIF", [1]), ...chunk("XMP ", [2]), ...chunk("VP8 ", [3])]);
  const input = Uint8Array.from([...Buffer.from("RIFF"), body.length + 4, 0, 0, 0, ...Buffer.from("WEBP"), ...body]);
  const result = cleanImageMetadata(input, "webp");
  assert.deepEqual(result.removed, ["EXIF / GPS", "XMP"]);
  assert.equal(Buffer.from(result.bytes).includes(Buffer.from("EXIF")), false);
  assert.equal(result.bytes[20] & 0x0c, 0);
  assert.equal(result.bytes.length - 8, result.bytes[4]);
});
