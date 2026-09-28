export const QUALITY_PRESETS = Object.freeze({
  standard: Object.freeze({ name: "標準", upscale: 2, blurKernel: 3, threshold: 238, closeIterations: 0, openIterations: 0, minComponentArea: 0, turdsize: 3, alphamax: 1, opttolerance: 0.25 }),
  smooth: Object.freeze({ name: "なめらか", upscale: 2, blurKernel: 5, threshold: 235, closeIterations: 1, openIterations: 0, minComponentArea: 0, turdsize: 5, alphamax: 1.1, opttolerance: 0.35 }),
  strong: Object.freeze({ name: "強め", upscale: 3, blurKernel: 5, threshold: 228, closeIterations: 1, openIterations: 1, minComponentArea: 18, turdsize: 8, alphamax: 1.2, opttolerance: 0.5 })
});

export const SPLIT_PRESETS = Object.freeze({
  fine: Object.freeze({ name: "細かく", minGap: 6, minForeground: 60 }),
  standard: Object.freeze({ name: "標準", minGap: 10, minForeground: 80 }),
  grouped: Object.freeze({ name: "まとめ気味", minGap: 20, minForeground: 100 })
});

const clampIndex = (value, size) => {
  if (size <= 1) return 0;
  while (value < 0 || value >= size) {
    if (value < 0) value = -value;
    if (value >= size) value = size * 2 - value - 2;
  }
  return value;
};

export function compositeOnWhite(rgba) {
  const rgb = new Uint8ClampedArray((rgba.length / 4) * 3);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 3) {
    const alpha = rgba[source + 3] / 255;
    rgb[target] = Math.trunc(rgba[source] * alpha + 255 * (1 - alpha));
    rgb[target + 1] = Math.trunc(rgba[source + 1] * alpha + 255 * (1 - alpha));
    rgb[target + 2] = Math.trunc(rgba[source + 2] * alpha + 255 * (1 - alpha));
  }
  return rgb;
}

export function rgbToGray(rgb) {
  const gray = new Uint8ClampedArray(rgb.length / 3);
  for (let source = 0, target = 0; source < rgb.length; source += 3, target += 1) {
    gray[target] = Math.round(rgb[source] * 0.299 + rgb[source + 1] * 0.587 + rgb[source + 2] * 0.114);
  }
  return gray;
}

function cubicWeight(value) {
  const x = Math.abs(value);
  const a = -0.75;
  if (x <= 1) return (a + 2) * x ** 3 - (a + 3) * x ** 2 + 1;
  if (x < 2) return a * x ** 3 - 5 * a * x ** 2 + 8 * a * x - 4 * a;
  return 0;
}

export function resizeCubic(source, width, height, factor) {
  if (factor === 1) return { data: new Uint8ClampedArray(source), width, height };
  const targetWidth = Math.max(1, Math.round(width * factor));
  const targetHeight = Math.max(1, Math.round(height * factor));
  const output = new Uint8ClampedArray(targetWidth * targetHeight);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = (y + 0.5) / factor - 0.5;
    const yBase = Math.floor(sourceY);
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = (x + 0.5) / factor - 0.5;
      const xBase = Math.floor(sourceX);
      let sum = 0;
      let weightSum = 0;
      for (let ky = -1; ky <= 2; ky += 1) {
        const sy = Math.max(0, Math.min(height - 1, yBase + ky));
        const wy = cubicWeight(sourceY - (yBase + ky));
        for (let kx = -1; kx <= 2; kx += 1) {
          const sx = Math.max(0, Math.min(width - 1, xBase + kx));
          const weight = wy * cubicWeight(sourceX - (xBase + kx));
          sum += source[sy * width + sx] * weight;
          weightSum += weight;
        }
      }
      output[y * targetWidth + x] = Math.max(0, Math.min(255, Math.round(sum / weightSum)));
    }
  }
  return { data: output, width: targetWidth, height: targetHeight };
}

function gaussianKernel(size) {
  const sigma = 0.3 * ((size - 1) * 0.5 - 1) + 0.8;
  const radius = Math.floor(size / 2);
  const kernel = [];
  let sum = 0;
  for (let index = -radius; index <= radius; index += 1) {
    const value = Math.exp(-(index ** 2) / (2 * sigma ** 2));
    kernel.push(value);
    sum += value;
  }
  return kernel.map(value => value / sum);
}

export function gaussianBlur(source, width, height, size) {
  if (size < 3) return new Uint8ClampedArray(source);
  const kernel = gaussianKernel(size);
  const radius = Math.floor(size / 2);
  const horizontal = new Float32Array(source.length);
  const output = new Uint8ClampedArray(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        value += source[y * width + clampIndex(x + offset, width)] * kernel[offset + radius];
      }
      horizontal[y * width + x] = value;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        value += horizontal[clampIndex(y + offset, height) * width + x] * kernel[offset + radius];
      }
      output[y * width + x] = Math.round(value);
    }
  }
  return output;
}

const crossOffsets = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];

function morph(ink, width, height, type) {
  const output = new Uint8Array(ink.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = type === "dilate" ? 0 : 1;
      for (const [dx, dy] of crossOffsets) {
        const sx = x + dx;
        const sy = y + dy;
        const sample = sx < 0 || sy < 0 || sx >= width || sy >= height ? 0 : ink[sy * width + sx];
        value = type === "dilate" ? Math.max(value, sample) : Math.min(value, sample);
      }
      output[y * width + x] = value;
    }
  }
  return output;
}

function applyMorphology(binary, width, height, closeIterations, openIterations) {
  let ink = Uint8Array.from(binary, value => value === 0 ? 1 : 0);
  for (let index = 0; index < closeIterations; index += 1) ink = morph(morph(ink, width, height, "dilate"), width, height, "erode");
  for (let index = 0; index < openIterations; index += 1) ink = morph(morph(ink, width, height, "erode"), width, height, "dilate");
  return Uint8ClampedArray.from(ink, value => value ? 0 : 255);
}

export function removeSmallComponents(binary, width, height, minimumArea) {
  if (minimumArea <= 0) return binary;
  const visited = new Uint8Array(binary.length);
  const queue = new Int32Array(binary.length);
  const component = [];
  for (let start = 0; start < binary.length; start += 1) {
    if (visited[start] || binary[start] !== 0) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    component.length = 0;
    while (head < tail) {
      const current = queue[head++];
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (!visited[next] && binary[next] === 0) {
            visited[next] = 1;
            queue[tail++] = next;
          }
        }
      }
    }
    if (component.length < minimumArea) for (const index of component) binary[index] = 255;
  }
  return binary;
}

export function preprocessRgba(rgba, width, height, preset) {
  const rgb = compositeOnWhite(rgba);
  const gray = rgbToGray(rgb);
  const resized = resizeCubic(gray, width, height, preset.upscale);
  const blurred = gaussianBlur(resized.data, resized.width, resized.height, preset.blurKernel);
  let binary = Uint8ClampedArray.from(blurred, value => value > preset.threshold ? 255 : 0);
  binary = applyMorphology(binary, resized.width, resized.height, preset.closeIterations, preset.openIterations);
  binary = removeSmallComponents(binary, resized.width, resized.height, preset.minComponentArea);
  return { data: binary, width: resized.width, height: resized.height };
}

function trimBox(mask, width, height, [x1, y1, x2, y2]) {
  let minX = x2;
  let minY = y2;
  let maxX = x1 - 1;
  let maxY = y1 - 1;
  for (let y = y1; y < y2; y += 1) {
    for (let x = x1; x < x2; x += 1) {
      if (!mask[y * width + x]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < minX ? null : [minX, minY, maxX + 1, maxY + 1];
}

function longestGap(flags, minimum) {
  let best = null;
  let start = -1;
  for (let index = 0; index <= flags.length; index += 1) {
    if (index < flags.length && !flags[index]) {
      if (start < 0) start = index;
    } else if (start >= 0) {
      if (index - start >= minimum && (!best || index - start > best[1] - best[0])) best = [start, index];
      start = -1;
    }
  }
  return best;
}

export function projectionSplit(mask, width, height, preset) {
  const initial = trimBox(mask, width, height, [0, 0, width, height]);
  if (!initial) return [];
  const results = [];
  const recurse = box => {
    const trimmed = trimBox(mask, width, height, box);
    if (!trimmed) return;
    const [x1, y1, x2, y2] = trimmed;
    let foreground = 0;
    const columns = new Uint8Array(x2 - x1);
    const rows = new Uint8Array(y2 - y1);
    for (let y = y1; y < y2; y += 1) {
      for (let x = x1; x < x2; x += 1) {
        if (!mask[y * width + x]) continue;
        foreground += 1;
        columns[x - x1] = 1;
        rows[y - y1] = 1;
      }
    }
    if (foreground < preset.minForeground) return;
    const columnGap = longestGap(columns, preset.minGap);
    const rowGap = longestGap(rows, preset.minGap);
    const columnSize = columnGap ? columnGap[1] - columnGap[0] : 0;
    const rowSize = rowGap ? rowGap[1] - rowGap[0] : 0;
    if (!columnSize && !rowSize) {
      results.push(trimmed);
    } else if (columnSize >= rowSize) {
      recurse([x1, y1, x1 + columnGap[0], y2]);
      recurse([x1 + columnGap[1], y1, x2, y2]);
    } else {
      recurse([x1, y1, x2, y1 + rowGap[0]]);
      recurse([x1, y1 + rowGap[1], x2, y2]);
    }
  };
  recurse(initial);
  if (!results.length) return [];
  const heights = results.map(box => box[3] - box[1]).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)];
  const tolerance = Math.max(12, Math.trunc(median * 0.45));
  const rowGroups = [];
  for (const box of results.sort((a, b) => a[1] - b[1] || a[0] - b[0])) {
    const centerY = Math.trunc((box[1] + box[3]) / 2);
    let row = rowGroups.find(group => Math.abs(centerY - Math.trunc(group.reduce((sum, item) => sum + (item[1] + item[3]) / 2, 0) / group.length)) <= tolerance);
    if (!row) {
      row = [];
      rowGroups.push(row);
    }
    row.push(box);
  }
  rowGroups.sort((a, b) => Math.min(...a.map(box => box[1])) - Math.min(...b.map(box => box[1])));
  return rowGroups.flatMap(row => row.sort((a, b) => a[0] - b[0]));
}

export function foregroundMask(rgb, threshold = 245) {
  const gray = rgbToGray(rgb);
  return Uint8Array.from(gray, value => value < threshold ? 1 : 0);
}

export function cropRgba(rgba, width, height, box, padding = 16) {
  const x1 = Math.max(0, box[0] - padding);
  const y1 = Math.max(0, box[1] - padding);
  const x2 = Math.min(width, box[2] + padding);
  const y2 = Math.min(height, box[3] + padding);
  const cropWidth = x2 - x1;
  const cropHeight = y2 - y1;
  const output = new Uint8ClampedArray(cropWidth * cropHeight * 4);
  for (let y = 0; y < cropHeight; y += 1) {
    const sourceStart = ((y1 + y) * width + x1) * 4;
    output.set(rgba.subarray(sourceStart, sourceStart + cropWidth * 4), y * cropWidth * 4);
  }
  return { data: output, width: cropWidth, height: cropHeight };
}

export function binaryToImageData(binary, width, height) {
  const rgba = new Uint8ClampedArray(binary.length * 4);
  for (let index = 0; index < binary.length; index += 1) {
    const value = binary[index];
    const target = index * 4;
    rgba[target] = rgba[target + 1] = rgba[target + 2] = value;
    rgba[target + 3] = 255;
  }
  return new ImageData(rgba, width, height);
}

const parseNumber = value => {
  const match = String(value || "").match(/^\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+))/);
  return match ? Number(match[1]) : 0;
};

const formatNumber = value => {
  const rounded = Math.abs(value) < 0.0001 ? 0 : Math.round(value * 1000) / 1000;
  return String(rounded).replace(/^(-?)0\./, "$1.");
};

export const OUTPUT_SIZES = Object.freeze([256, 512, 1024]);

export function contentSizeForCanvas(canvasSize) {
  if (!OUTPUT_SIZES.includes(canvasSize)) throw new Error("出力サイズが正しくありません。");
  return Math.round(canvasSize * 420 / 512);
}

export function normalizeSvgCanvas(svgText, canvasSize = 512, contentSize = contentSizeForCanvas(canvasSize)) {
  const documentNode = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = documentNode.documentElement;
  if (root.localName === "parsererror") throw new Error("SVGを解析できませんでした。");
  const viewBox = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  const [minX, minY, width, height] = viewBox.length === 4 && viewBox.every(Number.isFinite)
    ? viewBox
    : [0, 0, parseNumber(root.getAttribute("width")), parseNumber(root.getAttribute("height"))];
  if (!(width > 0 && height > 0)) throw new Error("SVGの元サイズを取得できませんでした。");
  const scale = Math.min(contentSize / width, contentSize / height);
  const offsetX = (canvasSize - width * scale) / 2 - minX * scale;
  const offsetY = (canvasSize - height * scale) / 2 - minY * scale;
  const wrapper = documentNode.createElementNS("http://www.w3.org/2000/svg", "g");
  wrapper.setAttribute("transform", `translate(${formatNumber(offsetX)} ${formatNumber(offsetY)}) scale(${formatNumber(scale)})`);
  for (const child of [...root.children]) {
    if (["metadata", "title", "desc", "defs"].includes(child.localName)) {
      if (child.localName !== "defs") child.remove();
    } else {
      wrapper.append(child);
    }
  }
  root.append(wrapper);
  for (const attribute of ["version", "baseProfile", "contentScriptType", "contentStyleType", "preserveAspectRatio"]) root.removeAttribute(attribute);
  root.setAttribute("viewBox", `0 0 ${canvasSize} ${canvasSize}`);
  root.setAttribute("width", String(canvasSize));
  root.setAttribute("height", String(canvasSize));
  for (const element of root.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (/^(d|points|transform|viewBox|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|width|height|stroke-width|stroke-dasharray|stroke-dashoffset|opacity|fill-opacity|stroke-opacity)$/.test(attribute.localName)) {
        attribute.value = attribute.value.replace(/(?<![A-Za-z_])[-+]?(?:\d+\.\d+|\d+\.|\.\d+)(?:[eE][-+]?\d+)?/g, match => formatNumber(Number(match))).replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").trim();
      }
    }
  }
  return new XMLSerializer().serializeToString(root).replace(/>\s+</g, "><").trim();
}

export function safeBaseName(fileName) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "") || "image";
}
