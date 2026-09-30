import { writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { createIco } from "../assets/js/favicon-generator-core.js";
import { crc32 } from "../assets/js/png-core.js";

const brandDirectory = new URL("../assets/brand/", import.meta.url);
const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const encoder = new TextEncoder();

function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function join(parts) {
  const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function chunk(type, data) {
  const typeBytes = encoder.encode(type);
  return join([uint32(data.length), typeBytes, data, uint32(crc32(join([typeBytes, data])))]);
}

function isMarkPixel(x, y, size) {
  const px = (x + .5) * 32 / size;
  const py = (y + .5) * 32 / size;
  return px < 16 || py >= 16 || (px >= 18 && py < 14);
}

function createFaviconPng(size) {
  const raw = new Uint8Array((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x += 1) {
      if (!isMarkPixel(x, y, size)) continue;
      const offset = row + 1 + x * 4;
      raw[offset] = raw[offset + 1] = raw[offset + 2] = 17;
      raw[offset + 3] = 255;
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, size); view.setUint32(4, size);
  header[8] = 8; header[9] = 6;
  return join([
    signature,
    chunk("IHDR", header),
    chunk("tEXt", encoder.encode("Software\0SHIAGENT")),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array())
  ]);
}

const icons = [16, 32, 48].map(size => ({ size, data: createFaviconPng(size) }));
await Promise.all(icons.map(({ size, data }) => writeFile(new URL(`favicon-${size}.png`, brandDirectory), data)));
await writeFile(new URL("favicon.ico", brandDirectory), createIco(icons));
console.log(`Generated full-bleed favicons in ${fileURLToPath(brandDirectory)}`);
