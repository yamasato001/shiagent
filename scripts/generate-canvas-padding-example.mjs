import { deflateSync, inflateSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import { relativePaddingPlacement } from "../assets/js/canvas-padding-core.js";

const sourcePath = new URL("../test/fixtures/sample.png", import.meta.url);
const beforePath = new URL("../assets/examples/canvas-padding-before.png", import.meta.url);
const afterPath = new URL("../assets/examples/canvas-padding-after.png", import.meta.url);

const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  Buffer.from(data).copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])), 8 + data.length);
  return output;
}

function paeth(a, b, c) {
  const prediction = a + b - c;
  const pa = Math.abs(prediction - a);
  const pb = Math.abs(prediction - b);
  const pc = Math.abs(prediction - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodeRgbaPng(buffer) {
  if (!buffer.subarray(0, 8).equals(Buffer.from(signature))) throw new Error("Invalid PNG signature");
  let offset = 8;
  let width;
  let height;
  const compressed = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error("Expected a non-interlaced 8-bit RGBA PNG");
    } else if (type === "IDAT") compressed.push(data);
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(compressed));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[sourceOffset++];
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[sourceOffset++];
      const left = x >= 4 ? pixels[rowOffset + x - 4] : 0;
      const up = y ? pixels[rowOffset - stride + x] : 0;
      const upperLeft = y && x >= 4 ? pixels[rowOffset - stride + x - 4] : 0;
      const reconstructed = filter === 0 ? value
        : filter === 1 ? value + left
        : filter === 2 ? value + up
        : filter === 3 ? value + Math.floor((left + up) / 2)
        : filter === 4 ? value + paeth(left, up, upperLeft)
        : Number.NaN;
      if (!Number.isFinite(reconstructed)) throw new Error(`Unsupported PNG filter: ${filter}`);
      pixels[rowOffset + x] = reconstructed & 0xff;
    }
  }
  return { width, height, pixels };
}

function encodeRgbaPng(width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const target = y * (stride + 1);
    raw[target] = 0;
    pixels.copy(raw, target + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from(signature),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const source = await readFile(sourcePath);
const decoded = decodeRgbaPng(source);
const placement = relativePaddingPlacement(decoded.width, decoded.height, { padding: 10, unit: "percent" });
const padded = Buffer.alloc(placement.canvasWidth * placement.canvasHeight * 4);

for (let y = 0; y < decoded.height; y += 1) {
  const sourceStart = y * decoded.width * 4;
  const targetStart = ((y + placement.y) * placement.canvasWidth + placement.x) * 4;
  decoded.pixels.copy(padded, targetStart, sourceStart, sourceStart + decoded.width * 4);
}

await writeFile(beforePath, source);
await writeFile(afterPath, encodeRgbaPng(placement.canvasWidth, placement.canvasHeight, padded));

console.log(JSON.stringify({
  input: { width: decoded.width, height: decoded.height },
  settings: { padding: 10, unit: "percent", background: "transparent" },
  output: { width: placement.canvasWidth, height: placement.canvasHeight },
}, null, 2));
