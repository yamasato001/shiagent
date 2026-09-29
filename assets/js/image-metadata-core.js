const ascii = (bytes, start, length) => String.fromCharCode(...bytes.subarray(start, start + length));
const u32be = (bytes, offset) => (bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
const u32le = (bytes, offset) => (bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16 | bytes[offset + 3] << 24) >>> 0;
const concat = chunks => {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
};

function cleanJpeg(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Invalid JPEG");
  const chunks = [bytes.subarray(0, 2)];
  const removed = [];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) { chunks.push(bytes.subarray(offset)); break; }
    const start = offset;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) { chunks.push(bytes.subarray(start, offset)); break; }
    if (marker === 0xda) { chunks.push(bytes.subarray(start)); break; }
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) { chunks.push(bytes.subarray(start, offset)); continue; }
    if (offset + 2 > bytes.length) throw new Error("Invalid JPEG segment");
    const length = bytes[offset] << 8 | bytes[offset + 1];
    const end = offset + length;
    if (length < 2 || end > bytes.length) throw new Error("Invalid JPEG segment");
    const payload = offset + 2;
    const prefix = ascii(bytes, payload, Math.min(32, end - payload));
    let label = null;
    if (marker === 0xe1 && prefix.startsWith("Exif\0\0")) label = "EXIF / GPS";
    else if (marker === 0xe1) label = "XMP / APP1";
    else if (marker === 0xed) label = "IPTC";
    else if (marker === 0xfe) label = "Comment";
    if (label) removed.push(label); else chunks.push(bytes.subarray(start, end));
    offset = end;
  }
  return { bytes: concat(chunks), removed };
}

function cleanPng(bytes) {
  if (ascii(bytes, 1, 3) !== "PNG") throw new Error("Invalid PNG");
  const chunks = [bytes.subarray(0, 8)];
  const removed = [];
  const labels = { eXIf: "EXIF / GPS", tEXt: "Text", zTXt: "Compressed text", iTXt: "XMP / text", tIME: "Modified time" };
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = u32be(bytes, offset), type = ascii(bytes, offset + 4, 4), end = offset + 12 + length;
    if (end > bytes.length) throw new Error("Invalid PNG chunk");
    if (labels[type]) removed.push(labels[type]); else chunks.push(bytes.subarray(offset, end));
    offset = end;
    if (type === "IEND") break;
  }
  return { bytes: concat(chunks), removed };
}

function cleanWebp(bytes) {
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") throw new Error("Invalid WebP");
  const chunks = [];
  const removed = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4), length = u32le(bytes, offset + 4), end = offset + 8 + length + (length & 1);
    if (end > bytes.length) throw new Error("Invalid WebP chunk");
    if (type === "EXIF" || type === "XMP ") removed.push(type === "EXIF" ? "EXIF / GPS" : "XMP");
    else {
      const chunk = bytes.slice(offset, end);
      if (type === "VP8X" && length > 0) chunk[8] &= ~0x0c;
      chunks.push(chunk);
    }
    offset = end;
  }
  const body = concat(chunks), output = new Uint8Array(12 + body.length);
  output.set(bytes.subarray(0, 12)); output.set(body, 12);
  const size = output.length - 8;
  output[4] = size & 255; output[5] = size >>> 8 & 255; output[6] = size >>> 16 & 255; output[7] = size >>> 24 & 255;
  return { bytes: output, removed };
}

export function cleanImageMetadata(input, format) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (format === "jpeg") return cleanJpeg(bytes);
  if (format === "png") return cleanPng(bytes);
  if (format === "webp") return cleanWebp(bytes);
  throw new Error(`Unsupported metadata format: ${format}`);
}

export function cleanedName(name) {
  const match = /^(.*?)(\.[^.]*)?$/.exec(name);
  return `${match[1] || "image"}-clean${match[2] || ""}`;
}
