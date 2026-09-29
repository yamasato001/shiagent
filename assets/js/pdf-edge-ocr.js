import { edgeLocation, parsePageNumberText } from "./pdf-page-number-core.js";

const NORMAL_WIDTH = 18;
const NORMAL_HEIGHT = 28;
let digitTemplates = null;

function binaryBounds(data, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (!data[y * width + x]) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return right >= left ? { left, top, right, bottom } : null;
}

function normalizeBinary(data, width, height, bounds) {
  const output = new Uint8Array(NORMAL_WIDTH * NORMAL_HEIGHT);
  const sourceWidth = bounds.right - bounds.left + 1;
  const sourceHeight = bounds.bottom - bounds.top + 1;
  const scale = Math.min((NORMAL_WIDTH - 2) / sourceWidth, (NORMAL_HEIGHT - 2) / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (NORMAL_WIDTH - drawWidth) / 2;
  const offsetY = (NORMAL_HEIGHT - drawHeight) / 2;
  for (let y = 0; y < NORMAL_HEIGHT; y += 1) for (let x = 0; x < NORMAL_WIDTH; x += 1) {
    const sx = Math.floor((x - offsetX) / scale) + bounds.left;
    const sy = Math.floor((y - offsetY) / scale) + bounds.top;
    if (sx >= bounds.left && sx <= bounds.right && sy >= bounds.top && sy <= bounds.bottom && data[sy * width + sx]) output[y * NORMAL_WIDTH + x] = 1;
  }
  return output;
}

function maskFromCanvas(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const samples = [];
  const step = Math.max(1, Math.floor((canvas.width + canvas.height) / 180));
  for (let x = 0; x < canvas.width; x += step) {
    let offset = x * 4;
    samples.push(image.data[offset] * .2126 + image.data[offset + 1] * .7152 + image.data[offset + 2] * .0722);
    offset = ((canvas.height - 1) * canvas.width + x) * 4;
    samples.push(image.data[offset] * .2126 + image.data[offset + 1] * .7152 + image.data[offset + 2] * .0722);
  }
  samples.sort((a, b) => a - b);
  const background = samples[Math.floor(samples.length / 2)] ?? 255;
  const threshold = Math.max(24, Math.min(72, background * .2));
  const mask = new Uint8Array(canvas.width * canvas.height);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const luminance = image.data[offset] * .2126 + image.data[offset + 1] * .7152 + image.data[offset + 2] * .0722;
    if (image.data[offset + 3] > 32 && background - luminance > threshold) mask[index] = 1;
  }
  return mask;
}

function templates(ownerDocument) {
  if (digitTemplates) return digitTemplates;
  digitTemplates = [];
  for (const family of ["Arial", "Georgia", "Times New Roman", "Courier New", "sans-serif", "serif"]) {
    for (const weight of ["400", "700"]) {
      for (let digit = 0; digit <= 9; digit += 1) {
        const canvas = ownerDocument.createElement("canvas");
        canvas.width = 72; canvas.height = 88;
        const context = canvas.getContext("2d");
        context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#000"; context.font = `${weight} 62px ${family}`; context.textAlign = "center"; context.textBaseline = "middle";
        context.fillText(String(digit), canvas.width / 2, canvas.height / 2 + 2);
        const raw = maskFromCanvas(canvas);
        const bounds = binaryBounds(raw, canvas.width, canvas.height);
        if (bounds) digitTemplates.push({ digit, data: normalizeBinary(raw, canvas.width, canvas.height, bounds) });
      }
    }
  }
  return digitTemplates;
}

function similarity(left, right) {
  let intersection = 0, leftInk = 0, rightInk = 0;
  for (let index = 0; index < left.length; index += 1) {
    leftInk += left[index]; rightInk += right[index];
    if (left[index] && right[index]) intersection += 1;
  }
  return (2 * intersection) / Math.max(1, leftInk + rightInk);
}

function recognizeComponent(component, mask, width, height, ownerDocument) {
  const normalized = normalizeBinary(mask, width, height, component);
  let best = { digit: null, score: 0 };
  for (const template of templates(ownerDocument)) {
    const score = similarity(normalized, template.data);
    if (score > best.score) best = { digit: template.digit, score };
  }
  return best;
}

function componentsAtEdges(mask, width, height, edgeRatio) {
  const visited = new Uint8Array(mask.length);
  const output = [];
  const inEdge = (x, y) => x <= width * edgeRatio || x >= width * (1 - edgeRatio) || y <= height * edgeRatio || y >= height * (1 - edgeRatio);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const start = y * width + x;
    if (!mask[start] || visited[start] || !inEdge(x, y)) continue;
    const stack = [start];
    visited[start] = 1;
    let left = x, right = x, top = y, bottom = y, area = 0;
    while (stack.length) {
      const index = stack.pop();
      const px = index % width, py = Math.floor(index / width);
      area += 1; left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || !inEdge(nx, ny)) continue;
        const next = ny * width + nx;
        if (mask[next] && !visited[next]) { visited[next] = 1; stack.push(next); }
      }
    }
    const componentWidth = right - left + 1, componentHeight = bottom - top + 1;
    if (area >= 8 && componentWidth >= 2 && componentHeight >= 7 && componentWidth <= width * .09 && componentHeight <= height * .09) output.push({ left, right, top, bottom, area, width: componentWidth, height: componentHeight });
  }
  return output;
}

function candidatesFromComponents(components, mask, width, height, ownerDocument) {
  const glyphs = components.map(component => ({ ...component, ...recognizeComponent(component, mask, width, height, ownerDocument) }))
    .filter(component => component.score >= .47);
  const rows = [];
  for (const glyph of glyphs.sort((a, b) => a.top - b.top || a.left - b.left)) {
    const centerY = (glyph.top + glyph.bottom) / 2;
    let row = rows.find(item => Math.abs(item.centerY - centerY) <= Math.max(item.height, glyph.height) * .42);
    if (!row) { row = { centerY, height: glyph.height, glyphs: [] }; rows.push(row); }
    row.glyphs.push(glyph);
    row.centerY = row.glyphs.reduce((sum, item) => sum + (item.top + item.bottom) / 2, 0) / row.glyphs.length;
    row.height = Math.max(row.height, glyph.height);
  }
  const candidates = [];
  for (const row of rows) {
    const ordered = row.glyphs.sort((a, b) => a.left - b.left);
    let group = [];
    const flush = () => {
      if (!group.length || group.length > 5) { group = []; return; }
      const raw = group.map(item => item.digit).join("");
      const parsed = parsePageNumberText(raw);
      const left = group[0].left, right = group.at(-1).right;
      const top = Math.min(...group.map(item => item.top)), bottom = Math.max(...group.map(item => item.bottom));
      const location = edgeLocation((left + right) / 2, (top + bottom) / 2, width, height);
      if (parsed && location) candidates.push({ ...parsed, ...location, raw, x: (left + right) / 2 / width, y: (top + bottom) / 2 / height, confidence: Math.min(...group.map(item => item.score)) * location.positionScore * .82, method: "ocr" });
      group = [];
    };
    for (const glyph of ordered) {
      const previous = group.at(-1);
      if (previous && glyph.left - previous.right > Math.max(previous.width, glyph.width) * 1.7) flush();
      group.push(glyph);
    }
    flush();
  }
  return candidates;
}

async function nativeTextCandidates(canvas) {
  if (!("TextDetector" in globalThis)) return [];
  try {
    const detector = new globalThis.TextDetector();
    const results = await detector.detect(canvas);
    return results.flatMap(result => {
      const parsed = parsePageNumberText(result.rawValue);
      const box = result.boundingBox;
      const location = parsed && box ? edgeLocation(box.x + box.width / 2, box.y + box.height / 2, canvas.width, canvas.height) : null;
      return parsed && location ? [{ ...parsed, ...location, raw: result.rawValue, x: (box.x + box.width / 2) / canvas.width, y: (box.y + box.height / 2) / canvas.height, confidence: parsed.strength * location.positionScore * .9, method: "ocr" }] : [];
    });
  } catch {
    return [];
  }
}

export async function recognizeEdgePageNumbers(canvas, edgeRatio = 0.18) {
  const native = await nativeTextCandidates(canvas);
  if (native.length) return native;
  const mask = maskFromCanvas(canvas);
  const components = componentsAtEdges(mask, canvas.width, canvas.height, edgeRatio);
  return candidatesFromComponents(components, mask, canvas.width, canvas.height, canvas.ownerDocument || document);
}
