export const PDF_MODES = Object.freeze([
  "merge", "split", "reorder", "interleave", "rotate", "delete-pages", "images-to-pdf",
  "pdf-to-images", "page-numbers", "watermark", "crop",
  "metadata-cleaner", "n-up", "form-fill", "signature", "pdf-finisher"
]);

export const PDF_MODE_FEATURES = Object.freeze({
  merge: Object.freeze({ selection: false, output: false, reverse: false, autoOrient: false, draggable: true, selectable: false, actions: [] }),
  split: Object.freeze({ selection: true, output: true, reverse: false, autoOrient: false, draggable: false, selectable: true, actions: [] }),
  reorder: Object.freeze({ selection: false, output: false, reverse: true, autoOrient: false, draggable: true, selectable: false, actions: [] }),
  interleave: Object.freeze({ selection: false, output: false, reverse: false, autoOrient: false, draggable: false, selectable: false, actions: [] }),
  rotate: Object.freeze({ selection: false, output: false, reverse: false, autoOrient: true, draggable: false, selectable: false, actions: ["left", "right"] }),
  "delete-pages": Object.freeze({ selection: false, output: false, reverse: false, autoOrient: false, draggable: false, selectable: false, actions: ["remove"] }),
  "images-to-pdf": Object.freeze({ selection: false, output: false, reverse: false, autoOrient: false, draggable: true, selectable: false, actions: ["remove"] }),
  "pdf-to-images": Object.freeze({ selection: true, output: false, reverse: false, autoOrient: false, draggable: false, selectable: true, actions: [], imageOutput: true }),
  "page-numbers": Object.freeze({ selection: true, output: false, reverse: false, autoOrient: false, draggable: false, selectable: true, actions: [], preserveAll: true }),
  watermark: Object.freeze({ selection: true, output: false, reverse: false, autoOrient: false, draggable: false, selectable: true, actions: [], preserveAll: true }),
  crop: Object.freeze({ selection: true, output: false, reverse: false, autoOrient: false, draggable: false, selectable: true, actions: [], preserveAll: true }),
  "metadata-cleaner": Object.freeze({ selection: false, output: false, reverse: false, autoOrient: false, draggable: false, selectable: false, actions: [] }),
  "n-up": Object.freeze({ selection: true, output: false, reverse: false, autoOrient: false, draggable: true, selectable: true, actions: [], nUpOutput: true }),
  "form-fill": Object.freeze({ selection: false, output: false, reverse: false, autoOrient: false, draggable: false, selectable: false, actions: [], formOutput: true }),
  signature: Object.freeze({ selection: true, output: false, reverse: false, autoOrient: false, draggable: false, selectable: true, actions: [], preserveAll: true }),
  "pdf-finisher": Object.freeze({ selection: false, output: false, reverse: false, autoOrient: false, draggable: false, selectable: false, actions: [], finishWorkflow: true })
});

export function nUpGrid(layout = "2") {
  if (String(layout) === "4") return { columns: 2, rows: 2, count: 4 };
  if (String(layout) === "6") return { columns: 2, rows: 3, count: 6 };
  return { columns: 1, rows: 2, count: 2 };
}

export function fitInsideBox(sourceWidth, sourceHeight, boxWidth, boxHeight) {
  const scale = Math.min(boxWidth / Math.max(1, sourceWidth), boxHeight / Math.max(1, sourceHeight));
  const width = sourceWidth * scale, height = sourceHeight * scale;
  return { width, height, x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, scale };
}

export function pageNumberLabel(index, total, style = "number", start = 1) {
  const value = Number(start) + Number(index);
  if (style === "page") return `Page ${value}`;
  if (style === "total") return `${value} / ${Number(start) + Number(total) - 1}`;
  return String(value);
}

export function positionInBox(width, height, itemWidth, itemHeight, position = "bottom-center", margin = 24) {
  const horizontal = position.endsWith("left") ? margin : position.endsWith("right") ? width - itemWidth - margin : (width - itemWidth) / 2;
  const vertical = position.startsWith("top") ? height - itemHeight - margin : position.startsWith("bottom") ? margin : (height - itemHeight) / 2;
  return { x: horizontal, y: vertical };
}

export function cropBoxFromMargins(box, margins = {}) {
  const left = Math.max(0, Number(margins.left) || 0);
  const right = Math.max(0, Number(margins.right) || 0);
  const top = Math.max(0, Number(margins.top) || 0);
  const bottom = Math.max(0, Number(margins.bottom) || 0);
  return {
    x: box.x + Math.min(left, box.width - 1),
    y: box.y + Math.min(bottom, box.height - 1),
    width: Math.max(1, box.width - left - right),
    height: Math.max(1, box.height - top - bottom)
  };
}

export function detectWhiteContentBounds(imageData, threshold = 245) {
  const { data, width, height } = imageData || {};
  if (!data || !width || !height) return null;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] > 16 && (data[offset] < threshold || data[offset + 1] < threshold || data[offset + 2] < threshold)) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return {
    left: minX / width,
    top: minY / height,
    right: (width - 1 - maxX) / width,
    bottom: (height - 1 - maxY) / height
  };
}

export function interleaveGroups(groups) {
  const result = [];
  const length = Math.max(0, ...groups.map(group => group.length));
  for (let index = 0; index < length; index += 1) {
    for (const group of groups) if (group[index]) result.push(group[index]);
  }
  return result;
}

export function parsePageRange(value, pageCount) {
  const selected = new Set();
  for (const token of String(value || "").split(",").map(part => part.trim()).filter(Boolean)) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (range) {
      const from = Math.min(Number(range[1]), Number(range[2]));
      const to = Math.max(Number(range[1]), Number(range[2]));
      for (let page = from; page <= to; page += 1) if (page >= 1 && page <= pageCount) selected.add(page - 1);
      continue;
    }
    const page = Number(token);
    if (Number.isInteger(page) && page >= 1 && page <= pageCount) selected.add(page - 1);
  }
  return [...selected].sort((a, b) => a - b);
}

export function selectPageIndexes(pageCount, mode, range = "", selected = []) {
  const all = Array.from({ length: pageCount }, (_, index) => index);
  if (mode === "odd") return all.filter(index => index % 2 === 0);
  if (mode === "even") return all.filter(index => index % 2 === 1);
  if (mode === "range") return parsePageRange(range, pageCount);
  if (mode === "selected") return [...new Set(selected)].filter(index => index >= 0 && index < pageCount).sort((a, b) => a - b);
  return all;
}

export function rotateAngle(angle, delta) {
  return ((Number(angle) + Number(delta)) % 360 + 360) % 360;
}

export function multiplyPdfTransform(left, right) {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5]
  ];
}

export function nearestQuarterTurn(angle) {
  return rotateAngle(Math.round(Number(angle) / 90) * 90, 0);
}

export function detectTextOrientation(items, viewportTransform) {
  const votes = [0, 0, 0, 0];
  let characters = 0;
  for (const item of items || []) {
    const value = String(item?.str || "").replace(/\s/g, "");
    if (!value || !Array.isArray(item.transform) || item.transform.length < 6) continue;
    const transform = multiplyPdfTransform(viewportTransform, item.transform);
    const angle = nearestQuarterTurn(Math.atan2(transform[1], transform[0]) * 180 / Math.PI);
    const fontSize = Math.max(6, Math.min(36, Math.hypot(transform[0], transform[1])));
    const weight = value.length * fontSize;
    votes[angle / 90] += weight;
    characters += value.length;
  }
  const total = votes.reduce((sum, value) => sum + value, 0);
  const dominant = Math.max(...votes);
  const direction = votes.indexOf(dominant) * 90;
  const confidence = total ? dominant / total : 0;
  return {
    usable: characters >= 6 && confidence >= 0.6,
    correction: rotateAngle(0, -direction),
    confidence,
    characters,
    method: "text"
  };
}

function rotatedPoint(x, y, width, height, rotation) {
  if (rotation === 90) return [height - 1 - y, x, height, width];
  if (rotation === 180) return [width - 1 - x, height - 1 - y, width, height];
  if (rotation === 270) return [y, width - 1 - x, height, width];
  return [x, y, width, height];
}

function projectionScore(mask, width, height, rotation) {
  const [, , rotatedWidth, rotatedHeight] = rotatedPoint(0, 0, width, height, rotation);
  const rows = new Float64Array(rotatedHeight);
  const columns = new Float64Array(rotatedWidth);
  let ink = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      const [rx, ry] = rotatedPoint(x, y, width, height, rotation);
      rows[ry] += 1;
      columns[rx] += 1;
      ink += 1;
    }
  }
  if (!ink) return { score: 0, directionBias: 0 };
  const variance = (values, scale) => {
    const mean = ink / values.length / scale;
    let sum = 0;
    for (const value of values) sum += ((value / scale) - mean) ** 2;
    return Math.sqrt(sum / values.length);
  };
  const rowVariation = variance(rows, rotatedWidth);
  const columnVariation = variance(columns, rotatedHeight);
  const threshold = Math.max(1, rotatedWidth * 0.0025);
  const bands = [];
  let start = -1;
  let last = -1;
  for (let y = 0; y < rows.length; y += 1) {
    if (rows[y] >= threshold) {
      if (start < 0) start = y;
      last = y;
    } else if (start >= 0 && y - last > 2) {
      bands.push([start, last]);
      start = -1;
    }
  }
  if (start >= 0) bands.push([start, last]);
  let biasTotal = 0;
  let biasWeight = 0;
  for (const [from, to] of bands) {
    if (to - from < 3) continue;
    const middle = (from + to) / 2;
    let top = 0;
    let bottom = 0;
    for (let y = from; y <= to; y += 1) {
      if (y <= middle) top += rows[y];
      else bottom += rows[y];
    }
    const weight = top + bottom;
    biasTotal += (top - bottom) * weight;
    biasWeight += weight * weight;
  }
  const directionBias = biasWeight ? biasTotal / biasWeight : 0;
  return {
    score: rowVariation / Math.max(0.000001, rowVariation + columnVariation),
    directionBias
  };
}

export function detectRasterOrientation(imageData) {
  const { data, width, height } = imageData || {};
  if (!data || !width || !height) return { usable: false, correction: 0, confidence: 0, method: "pixels" };
  const samples = [];
  const step = Math.max(1, Math.floor((width + height) / 160));
  for (let x = 0; x < width; x += step) {
    samples.push((data[x * 4] + data[x * 4 + 1] + data[x * 4 + 2]) / 3);
    const bottom = ((height - 1) * width + x) * 4;
    samples.push((data[bottom] + data[bottom + 1] + data[bottom + 2]) / 3);
  }
  for (let y = 0; y < height; y += step) {
    const left = y * width * 4;
    const right = (y * width + width - 1) * 4;
    samples.push((data[left] + data[left + 1] + data[left + 2]) / 3);
    samples.push((data[right] + data[right + 1] + data[right + 2]) / 3);
  }
  samples.sort((a, b) => a - b);
  const background = samples[Math.floor(samples.length / 2)] ?? 255;
  const threshold = Math.max(18, Math.min(54, background * 0.13));
  const mask = new Uint8Array(width * height);
  let ink = 0;
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
    if (data[offset + 3] > 32 && background - luminance > threshold) {
      mask[index] = 1;
      ink += 1;
    }
  }
  const occupancy = ink / (width * height);
  if (occupancy < 0.001 || occupancy > 0.72) return { usable: false, correction: 0, confidence: 0, method: "pixels" };
  const candidates = [0, 90, 180, 270].map(correction => {
    const stats = projectionScore(mask, width, height, correction);
    return { correction, ...stats, combined: stats.score + stats.directionBias * 0.12 };
  }).sort((a, b) => b.combined - a.combined);
  const best = candidates[0];
  const oppositeAxis = candidates.find(item => item.correction % 180 !== best.correction % 180);
  const axisCertainty = Math.max(0, best.score - (oppositeAxis?.score || 0));
  const directionCertainty = Math.min(1, Math.abs(best.directionBias) * 5);
  const confidence = Math.min(0.78, 0.38 + axisCertainty * 0.45 + directionCertainty * 0.18);
  return { usable: true, correction: best.correction, confidence, method: "pixels" };
}

export function safePdfName(value, fallback = "shiagent") {
  const cleaned = String(value || "").replace(/[\\/:*?"<>|]/g, "").replace(/\.pdf$/i, "").trim().replace(/[. ]+$/, "");
  return `${cleaned || fallback}.pdf`;
}

