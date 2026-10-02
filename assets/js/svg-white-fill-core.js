import { pick } from "./i18n.js";
import common from "./i18n/common.js";

const messages = pick(common);
export const WHITE_FILL_ID = "matopuri-white-fill";
export const FILL_PRESETS = Object.freeze({
  strict: Object.freeze({ name: "厳密", longSide: 1024, closeRadius: 0, inset: 1, minArea: 4 }),
  standard: Object.freeze({ name: "標準", longSide: 1536, closeRadius: 1, inset: 2, minArea: 8 }),
  precise: Object.freeze({ name: "高精度", longSide: 2048, closeRadius: 2, inset: 3, minArea: 12 })
});

export function hasWhiteFillPixels(rgba, width, height) {
  if (width < 3 || height < 3 || rgba.length < width * height * 4) return false;
  const white = index => {
    const offset = index * 4;
    return rgba[offset + 3] >= 80 && rgba[offset] >= 245 && rgba[offset + 1] >= 245 && rgba[offset + 2] >= 245;
  };
  const minimumCore = Math.max(1, Math.round(width * height * .00001));
  let corePixels = 0;
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
    let solid = true;
    for (let dy = -1; dy <= 1 && solid; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (!white((y + dy) * width + x + dx)) { solid = false; break; }
    }
    if (solid && ++corePixels >= minimumCore) return true;
  }
  return false;
}

export function newlyClosedRegionMask(currentMask, originalMask) {
  return Uint8Array.from(currentMask, (value, index) => value && !originalMask[index] ? 1 : 0);
}

export function excludeMaskRegions(mask, width, height, points = []) {
  const output = Uint8Array.from(mask);
  if (!points.length) return output;
  const labels = new Int32Array(output.length);
  const queue = new Int32Array(output.length);
  let label = 0;
  for (let start = 0; start < output.length; start += 1) {
    if (!output[start] || labels[start]) continue;
    label += 1;
    let head = 0, tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width);
      for (const next of [x ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y ? index - width : -1, y + 1 < height ? index + width : -1]) {
        if (next >= 0 && output[next] && !labels[next]) { labels[next] = label; queue[tail++] = next; }
      }
    }
  }
  const excludedLabels = new Set();
  for (const point of points) {
    const x = Math.max(0, Math.min(width - 1, Math.round(point[0] * (width - 1))));
    const y = Math.max(0, Math.min(height - 1, Math.round(point[1] * (height - 1))));
    let selectedLabel = labels[y * width + x];
    if (!selectedLabel) {
      const radius = Math.max(4, Math.round(Math.min(width, height) * .012));
      let nearestDistance = Infinity;
      for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const candidate = labels[ny * width + nx];
        const distance = dx * dx + dy * dy;
        if (candidate > 0 && distance < nearestDistance) { selectedLabel = candidate; nearestDistance = distance; }
      }
    }
    if (selectedLabel > 0) excludedLabels.add(selectedLabel);
  }
  if (excludedLabels.size) for (let index = 0; index < output.length; index += 1) if (excludedLabels.has(labels[index])) output[index] = 0;
  return output;
}

export function viewBoxOfSvg(root) {
  const raw = root.getAttribute("viewBox");
  if (raw) {
    const values = raw.trim().split(/[\s,]+/).map(Number);
    if (values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) return values;
  }
  const width = parseFloat(root.getAttribute("width"));
  const height = parseFloat(root.getAttribute("height"));
  if (width > 0 && height > 0) return [0, 0, width, height];
  throw new Error(messages.svgSizeMissing);
}

export function normalizeSvgRasterViewport(root, viewBox = viewBoxOfSvg(root)) {
  root.setAttribute("width", String(viewBox[2]));
  root.setAttribute("height", String(viewBox[3]));
  return root;
}

function morph(mask, width, height, radius, mode) {
  if (!radius) return mask;
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    let value = mode === "dilate" ? 0 : 1;
    outer: for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const nx = x + dx, ny = y + dy;
      const sample = nx >= 0 && ny >= 0 && nx < width && ny < height ? mask[ny * width + nx] : 0;
      if (mode === "dilate" && sample) { value = 1; break outer; }
      if (mode === "erode" && !sample) { value = 0; break outer; }
    }
    output[y * width + x] = value;
  }
  return output;
}

function drawBarrierLine(mask, width, height, start, end) {
  const x1 = Math.round(start[0] * (width - 1)), y1 = Math.round(start[1] * (height - 1));
  const x2 = Math.round(end[0] * (width - 1)), y2 = Math.round(end[1] * (height - 1));
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  const radius = Math.max(1, Math.round(Math.max(width, height) / 1200));
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(x1 + (x2 - x1) * step / steps), y = Math.round(y1 + (y2 - y1) * step / steps);
    for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) mask[ny * width + nx] = 1;
    }
  }
}

export function closedRegionMask(alpha, width, height, preset, manual = {}) {
  let barrier = Uint8Array.from(alpha, value => value > 20 ? 1 : 0);
  for (const [start, end] of manual.lines || []) drawBarrierLine(barrier, width, height, start, end);
  if (preset.closeRadius) barrier = morph(morph(barrier, width, height, preset.closeRadius, "dilate"), width, height, preset.closeRadius, "erode");
  const outside = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const push = index => { if (!barrier[index] && !outside[index]) { outside[index] = 1; queue[tail++] = index; } };
  for (let x = 0; x < width; x += 1) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { push(y * width); push(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], x = index % width, y = Math.floor(index / width);
    if (x) push(index - 1); if (x + 1 < width) push(index + 1); if (y) push(index - width); if (y + 1 < height) push(index + width);
  }
  let closed = Uint8Array.from(barrier, (value, index) => !value && !outside[index] ? 1 : 0);
  if (preset.inset) closed = morph(closed, width, height, preset.inset, "erode");
  const labels = new Int32Array(closed.length);
  let label = 0;
  for (let start = 0; start < closed.length; start += 1) {
    if (!closed[start] || labels[start]) continue;
    label += 1; head = 0; tail = 0; queue[tail++] = start; labels[start] = label;
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width);
      for (const next of [x ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y ? index - width : -1, y + 1 < height ? index + width : -1]) if (next >= 0 && closed[next] && !labels[next]) { labels[next] = label; queue[tail++] = next; }
    }
    if (tail < preset.minArea) for (let i = 0; i < tail; i += 1) closed[queue[i]] = 0;
  }
  return excludeMaskRegions(closed, width, height, manual.excludedPoints);
}

export function countMaskRegions(mask, width, height) {
  const visited = new Uint8Array(mask.length), queue = new Int32Array(mask.length);
  let count = 0;
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    count += 1; let head = 0, tail = 0; queue[tail++] = start; visited[start] = 1;
    while (head < tail) { const index = queue[head++], x = index % width, y = Math.floor(index / width); for (const next of [x ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y ? index - width : -1, y + 1 < height ? index + width : -1]) if (next >= 0 && mask[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; } }
  }
  return count;
}

const key = (x, y) => `${x},${y}`;
export function maskToPath(mask, width, height, viewBox) {
  const edges = new Map();
  const add = (x1, y1, x2, y2) => { const start = key(x1, y1); if (!edges.has(start)) edges.set(start, []); edges.get(start).push([x2, y2]); };
  const filled = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (filled(x, y)) {
    if (!filled(x, y - 1)) add(x, y, x + 1, y);
    if (!filled(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!filled(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!filled(x - 1, y)) add(x, y + 1, x, y);
  }
  const [minX, minY, vbWidth, vbHeight] = viewBox;
  const point = ([x, y]) => [minX + x * vbWidth / width, minY + y * vbHeight / height];
  const number = value => String(Math.round(value * 1000) / 1000).replace(/^(-?)0\./, "$1.");
  const loops = [];
  while (edges.size) {
    const startKey = edges.keys().next().value;
    const [sx, sy] = startKey.split(",").map(Number);
    const points = [[sx, sy]];
    let current = startKey;
    do {
      const options = edges.get(current);
      if (!options?.length) break;
      const next = options.pop();
      if (!options.length) edges.delete(current);
      points.push(next);
      current = key(next[0], next[1]);
    } while (current !== startKey && points.length < mask.length * 4);
    if (current !== startKey || points.length < 4) continue;
    const simplified = points.filter((p, index) => {
      if (index === 0 || index === points.length - 1) return true;
      const a = points[index - 1], b = points[index + 1];
      return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
    });
    const first = point(simplified[0]);
    loops.push(`M${number(first[0])},${number(first[1])}${simplified.slice(1, -1).map(p => { const q = point(p); return `L${number(q[0])},${number(q[1])}`; }).join("")}Z`);
  }
  return loops.join("");
}

export function insertWhiteFill(svgText, pathData, { preserveExisting = false } = {}) {
  const documentNode = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) throw new Error(messages.svgParseFailed);
  const root = documentNode.documentElement;
  let group = root.querySelector(`#${WHITE_FILL_ID}`);
  if (group && !preserveExisting) { group.remove(); group = null; }
  if (!group) {
    group = documentNode.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("id", WHITE_FILL_ID); group.setAttribute("fill", "#fff"); group.setAttribute("stroke", "none"); group.setAttribute("fill-rule", "evenodd");
    const reference = [...root.children].find(child => !["defs", "metadata", "title", "desc"].includes(child.localName));
    root.insertBefore(group, reference || null);
  }
  if (pathData) { const path = documentNode.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", pathData); path.setAttribute("fill", "#fff"); path.setAttribute("stroke", "none"); path.setAttribute("fill-rule", "evenodd"); group.append(path); }
  return new XMLSerializer().serializeToString(root).replace(/>\s+</g, "><").trim();
}
