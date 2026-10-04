import { analyzePixels, detectRasterFormat, edgeSimilarity, formatBytes, jpegQuality, outputName, perceptualSimilarity, pngOptimizationLevel, recommendedPngQualityProfile, savedPercent, usesColorGuard } from "./png-core.js";
import { createZipBlob, decodeBrowserImage, encodeBrowserCanvas } from "./browser-runtime.js";
import "./queue-drop.js";

const lang = document.documentElement.dataset.pageLang || "ja";
const locale = lang === "ja" ? "ja-JP" : "en-US";
const MAX_PALETTE_PIXELS = 2_000_000;
const copy = lang === "ja" ? {
  files: n => `${n} ファイル`,
  ready: "Ready",
  processing: "処理中…",
  done: "完了",
  kept: "元画像が最小",
  failed: "処理できませんでした",
  unsupported: "PNG、JPEG、WebPファイルだけを追加できます",
  duplicate: "同じファイルはすでに追加されています",
  empty: "PNG、JPEG、WebPファイルを追加してください",
  completed: (done, total) => `${done} / ${total} ファイル完了`,
  saved: rate => `${rate.toFixed(1)}% 削減`,
  larger: rate => `${Math.abs(rate).toFixed(1)}% 増加`,
  downloading: "ZIPを作成しています…",
  downloaded: "ダウンロードを開始しました",
  cancelled: "処理を中止しました",
  start: "圧縮を開始",
  retry: "やり直す",
  before: "圧縮前",
  after: "圧縮後",
  comparisonTabs: "比較する画像",
  badges: {
    unchanged: "画素変更なし", lossless: "ロスレス", lines: "細線保護", alpha: "透明度維持",
    transparency: "透明度対応", palette256: "最大256色", palette64: "最大64色",
    bounded: "省メモリ処理", original: "元画像を採用", jpeg: "JPEG再圧縮", webp: "WebP再圧縮", colorKept: "色を保つためロスレス", colorPalette: "色を保てる色数に調整", paletteN: n => `最大${n}色`
  },
  download: "保存",
  remove: "削除"
} : {
  files: n => `${n} file${n === 1 ? "" : "s"}`,
  ready: "Ready",
  processing: "Processing…",
  done: "Complete",
  kept: "Original was smaller",
  failed: "Could not process",
  unsupported: "Only PNG, JPEG or WebP files can be added",
  duplicate: "That file is already in the list",
  empty: "Add at least one PNG, JPEG or WebP file",
  completed: (done, total) => `${done} of ${total} files complete`,
  saved: rate => `${rate.toFixed(1)}% smaller`,
  larger: rate => `${Math.abs(rate).toFixed(1)}% larger`,
  downloading: "Creating ZIP…",
  downloaded: "Download started",
  cancelled: "Compression cancelled",
  start: "Start compression",
  retry: "Try again",
  before: "Before",
  after: "After",
  comparisonTabs: "Images to compare",
  badges: {
    unchanged: "Pixels unchanged", lossless: "Lossless", lines: "Fine lines protected", alpha: "Alpha preserved",
    transparency: "Transparency supported", palette256: "Up to 256 colors", palette64: "Up to 64 colors",
    bounded: "Memory-safe path", original: "Original retained", jpeg: "JPEG recompressed", webp: "WebP recompressed", colorKept: "Lossless to keep colors", colorPalette: "Color-safe palette", paletteN: n => `Up to ${n} colors`
  },
  download: "Download",
  remove: "Remove"
};

const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), drop: $("#dropZone"), select: $("#selectButton"), add: $("#addButton"),
  clear: $("#clearButton"), removeAll: $("#removeAllButton"), queue: $("#queuePanel"), list: $("#fileList"),
  count: $("#fileCount"), compress: $("#compressButton"), cancel: $("#cancelButton"),
  results: $("#resultsPanel"), resultStatus: $("#resultStatus"), before: $("#beforeTotal"), after: $("#afterTotal"),
  saved: $("#savedTotal"), savedRate: $("#savedRate"), downloadAll: $("#downloadAllButton"), toast: $("#toast"),
  modeGrid: $("#modeGrid"), modeInputs: [...document.querySelectorAll('input[name="mode"]')], effort: $("#effort"), comparisonTabs: $("#comparisonTabs"),
  comparisonView: $("#comparisonView"), comparisonFileName: $("#comparisonFileName")
};

let entries = [];
let running = false;
let cancelRequested = false;
let comparisonEntryId = null;
let toastTimer;
let optimizerWorker;
let optimizerRequestId = 0;
const optimizerRequests = new Map();

function ensureOptimizerWorker() {
  if (!optimizerWorker) {
    optimizerWorker = new Worker("/assets/dist/png-optimizer-worker.js", { type: "module" });
    optimizerWorker.addEventListener("message", event => {
      const request = optimizerRequests.get(event.data.id);
      if (!request) return;
      optimizerRequests.delete(event.data.id);
      if (event.data.error) request.reject(new Error(event.data.error));
      else request.resolve(event.data);
    });
    optimizerWorker.addEventListener("error", event => {
      const error = new Error(event.message || "PNG optimizer worker failed");
      stopOptimizerWorker(error);
    });
  }
  return optimizerWorker;
}

function stopOptimizerWorker(error = Object.assign(new Error("Compression cancelled"), { name: "AbortError" })) {
  for (const request of optimizerRequests.values()) request.reject(error);
  optimizerRequests.clear();
  optimizerWorker?.terminate();
  optimizerWorker = null;
}

function optimisePng(blob, level) {
  return blob.arrayBuffer().then(buffer => new Promise((resolve, reject) => {
    const id = ++optimizerRequestId;
    optimizerRequests.set(id, { resolve, reject });
    ensureOptimizerWorker().postMessage({ id, buffer, level, optimiseAlpha: false }, [buffer]);
  })).then(({ result }) => new Blob([result], { type: "image/png" }));
}

function quantizePng(imageData, width, height, mode, level, colorGuard = false, requestedColors = null) {
  // Recommended evaluates more than one palette, so never detach the decoded
  // source buffer when handing pixels to the worker.
  const buffer = new Uint8ClampedArray(imageData.data).buffer;
  return new Promise((resolve, reject) => {
    const id = ++optimizerRequestId;
    optimizerRequests.set(id, { resolve, reject });
    ensureOptimizerWorker().postMessage({
      id,
      type: "quantize",
      buffer,
      width,
      height,
      mode,
      level,
      optimiseAlpha: false,
      colorGuard,
      requestedColors
    }, [buffer]);
  }).then(({ result, colorGuarded, paletteColors }) => ({ blob: new Blob([result], { type: "image/png" }), colorGuarded, paletteColors }));
}

function processLineArtPng(imageData, width, height, level, compact = false, colorGuard = false) {
  const buffer = imageData.data.buffer;
  return new Promise((resolve, reject) => {
    const id = ++optimizerRequestId;
    optimizerRequests.set(id, { resolve, reject });
    ensureOptimizerWorker().postMessage({
      id,
      type: compact ? "lineart-compact" : "lineart",
      buffer,
      width,
      height,
      level,
      optimiseAlpha: false,
      colorGuard
    }, [buffer]);
  }).then(({ result, colorGuarded, paletteColors }) => ({ blob: new Blob([result], { type: "image/png" }), colorGuarded, paletteColors }));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function selectedMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || "recommended";
}

function modeLabel(mode) {
  if (mode === "recommended") return lang === "ja" ? "おすすめ" : "Recommended";
  if (mode === "smallest") return "Smallest";
  if (mode === "lineart") return "Line Art";
  return mode[0].toUpperCase() + mode.slice(1);
}

function makeOutputName(entry, suffix = "") { return outputName(entry.file.name, entry.format, suffix); }

function disposeEntry(entry) {
  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
  if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
}

function resetResults() {
  elements.results.hidden = true;
  comparisonEntryId = null;
  for (const entry of entries) {
    if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
    entry.resultUrl = null;
    entry.resultBlob = null;
    entry.after = null;
    entry.status = "ready";
    entry.error = null;
    entry.kind = null;
    entry.usedMode = null;
    entry.processingMode = null;
    entry.processingStrategy = null;
    entry.keptOriginal = false;
    entry.colorGuarded = false;
    entry.paletteColors = null;
  }
}

async function addFiles(fileList) {
  if (running) return;
  let rejected = false;
  let duplicate = false;
  let added = false;
  for (const file of fileList) {
    const format = detectRasterFormat(await file.slice(0, 12).arrayBuffer());
    if (!format) { rejected = true; continue; }
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (entries.some(entry => entry.key === key)) { duplicate = true; continue; }
    entries.push({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      key, file, format, previewUrl: URL.createObjectURL(file), resultUrl: null, resultBlob: null,
      status: "ready", after: null, error: null, kind: null, usedMode: null, processingMode: null,
      processingStrategy: null, keptOriginal: false, colorGuarded: false, paletteColors: null
    });
    added = true;
  }
  if (rejected) showToast(copy.unsupported);
  else if (duplicate) showToast(copy.duplicate);
  elements.input.value = "";
  if (added) resetResults();
  render();
}

function removeEntry(id) {
  if (running) return;
  const index = entries.findIndex(entry => entry.id === id);
  if (index < 0) return;
  disposeEntry(entries[index]);
  entries.splice(index, 1);
  render();
}

function clearEntries() {
  if (running) return;
  entries.forEach(disposeEntry);
  entries = [];
  comparisonEntryId = null;
  elements.results.hidden = true;
  render();
}

function resultMarkup(entry) {
  if (entry.status !== "done") return "";
  const rate = savedPercent(entry.file.size, entry.after);
  return `<div class="file-result"><span>${formatBytes(entry.file.size, locale)} → ${formatBytes(entry.after, locale)}</span><strong>${rate >= 0 ? `−${rate.toFixed(1)}%` : `+${Math.abs(rate).toFixed(1)}%`}</strong><button class="button button-light file-download" type="button" data-download="${entry.id}">${copy.download}</button></div>`;
}

function resultBadges(entry) {
  if (entry.status !== "done") return "";
  const badges = [];
  const processingMode = entry.processingMode || entry.usedMode;
  if (entry.keptOriginal) {
    badges.push(copy.badges.original, copy.badges.unchanged);
    if (entry.format === "png" || entry.format === "webp") badges.push(copy.badges.alpha);
  } else if (entry.format === "jpeg" || entry.format === "webp") {
    badges.push(copy.badges[entry.format]);
  } else if (processingMode === "exact") {
    badges.push(copy.badges.unchanged, copy.badges.lossless, copy.badges.alpha);
  } else if (entry.colorGuarded === "lossless") {
    // Too many colors for a palette (photo, gradient): kept losslessly.
    badges.push(copy.badges.colorKept, copy.badges.unchanged, copy.badges.lossless, copy.badges.alpha);
  } else if (entry.colorGuarded === "palette") {
    // The preset palette shifted colors; a color-safe palette kept them.
    badges.push(copy.badges.colorPalette, copy.badges.paletteN(entry.paletteColors || 256), copy.badges.transparency);
  } else if (processingMode === "lineart") {
    badges.push(copy.badges.lines, copy.badges.alpha);
  } else {
    if (entry.processingStrategy === "bounded") badges.push(copy.badges.bounded);
    else if (entry.paletteColors) badges.push(copy.badges.paletteN(entry.paletteColors));
    else badges.push(processingMode === "smallest" ? copy.badges.palette64 : copy.badges.palette256);
    badges.push(copy.badges.transparency);
  }
  return `<div class="result-badges">${[...new Set(badges)].map(badge => `<span>${escapeHtml(badge)}</span>`).join("")}</div>`;
}

function comparisonMarkup(entry) {
  const after = entry.status === "done" && entry.resultUrl
    ? `<figure><figcaption>${copy.after}</figcaption><img class="file-thumb" src="${entry.resultUrl}" alt=""></figure>`
    : "";
  return `<div class="file-compare"><figure><figcaption>${copy.before}</figcaption><img class="file-thumb" src="${entry.previewUrl}" alt=""></figure>${after}</div>`;
}

function render() {
  elements.queue.hidden = entries.length === 0;
  elements.count.textContent = copy.files(entries.length);
  elements.compress.disabled = entries.length === 0 || running;
  elements.compress.innerHTML = `${entries.some(entry => entry.status === "done") ? copy.retry : copy.start} <span>→</span>`;
  elements.select.disabled = running;
  elements.add.disabled = running;
  elements.clear.disabled = running;
  elements.removeAll.disabled = running;
  for (const input of elements.modeInputs) input.disabled = running;
  elements.effort.disabled = running;
  elements.cancel.hidden = !running;
  elements.compress.hidden = running;

  elements.list.innerHTML = entries.map(entry => {
    const statusClass = entry.status === "done" ? "done" : entry.status === "error" ? "error" : entry.status === "processing" ? "processing" : "";
    const statusText = entry.status === "processing" ? copy.processing : entry.status === "done" ? (entry.keptOriginal ? copy.kept : copy.done) : entry.status === "error" ? copy.failed : copy.ready;
    const modeText = entry.usedMode ? ` · ${modeLabel(entry.usedMode)}` : "";
    return `<article class="file-row ${entry.status === "done" ? "has-result" : ""}" data-id="${entry.id}">
      ${comparisonMarkup(entry)}
      <div class="file-main"><span class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span><span class="file-meta">${entry.format.toUpperCase()} · ${formatBytes(entry.file.size, locale)}${modeText}</span>${resultBadges(entry)}${entry.status === "processing" ? '<div class="progress-track"><span class="progress-bar" style="width:55%"></span></div>' : ""}</div>
      <span class="file-status ${statusClass}">${statusText}</span>
      ${entry.status === "done" ? resultMarkup(entry) : `<button class="icon-button" type="button" data-remove="${entry.id}" aria-label="${copy.remove}">×</button>`}
    </article>`;
  }).join("");

  const completed = entries.filter(entry => entry.status === "done");
  if (completed.length) updateSummary(completed);
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

async function decodeFile(file) {
  const canvas = await decodeBrowserImage(file, { willReadFrequently: true });
  const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  return { canvas, imageData: context.getImageData(0, 0, canvas.width, canvas.height) };
}

async function encodeRaster(canvas, format, quality) {
  const mime = format === "webp" ? "image/webp" : "image/jpeg";
  const blob = await encodeBrowserCanvas(canvas, mime, quality);
  if (blob.type !== mime) throw new Error(`${format.toUpperCase()} encoding failed`);
  return blob;
}

async function encodeRecommendedRaster(decoded, format, kind, effort) {
  // Try genuinely compact encodes as well. They are accepted only when both
  // perceptual similarity and strong-edge preservation remain above the
  // content-aware guard, so the wider search does not automatically mean a
  // lower-quality result.
  const qualities = [0.5, 0.56, 0.62, 0.68, 0.72, 0.76, 0.8, 0.84, 0.88, 0.92, 0.95, 0.97];
  const baseThreshold = kind === "lineart" ? 0.995 : kind === "illustration" ? 0.991 : 0.985;
  const threshold = Math.min(0.997, baseThreshold + (effort === "careful" ? 0.003 : 0));
  const baseEdgeThreshold = kind === "lineart" ? 0.96 : kind === "illustration" ? 0.93 : 0.9;
  const edgeThreshold = Math.min(0.98, baseEdgeThreshold + (effort === "careful" ? 0.02 : 0));
  let low = 0, high = qualities.length - 1, best = null;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const quality = qualities[middle];
    const blob = await encodeRaster(decoded.canvas, format, quality);
    const comparisonCanvas = await decodeBrowserImage(blob, { willReadFrequently: true });
    const comparisonData = comparisonCanvas.getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, comparisonCanvas.width, comparisonCanvas.height);
    const similarity = perceptualSimilarity(
      decoded.imageData.data,
      comparisonData.data,
      decoded.canvas.width,
      decoded.canvas.height
    );
    const edges = edgeSimilarity(
      decoded.imageData.data,
      comparisonData.data,
      decoded.canvas.width,
      decoded.canvas.height
    );
    if (similarity >= threshold && edges >= edgeThreshold) {
      best = { blob, quality, similarity, edges };
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }
  if (best) return best.blob;
  return encodeRaster(decoded.canvas, format, jpegQuality("recommended", effort, kind));
}

async function encodeRecommendedPng(decoded, sourceFile, analysis, level, effort) {
  const { denseColorPng, similarityThreshold, edgeThreshold } = recommendedPngQualityProfile(analysis, effort);
  // Photos and dense illustrations start at the highest-quality palette and
  // only step down when the 80% target cannot be reached. Flat graphics keep
  // starting from the smallest viable palette because broad areas survive it.
  const paletteCandidates = denseColorPng
    ? [256, 128, 64, 32, 16, 12]
    : [12, 16, 32, 64, 128, 256];
  let safeFallback = null;
  for (const colors of paletteCandidates) {
    const candidate = await quantizePng(
      decoded.imageData,
      decoded.canvas.width,
      decoded.canvas.height,
      "balanced",
      level,
      false,
      colors
    );
    const comparisonCanvas = await decodeBrowserImage(candidate.blob, { willReadFrequently: true });
    const comparisonData = comparisonCanvas.getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, comparisonCanvas.width, comparisonCanvas.height);
    const similarity = perceptualSimilarity(
      decoded.imageData.data,
      comparisonData.data,
      decoded.canvas.width,
      decoded.canvas.height
    );
    const edges = edgeSimilarity(
      decoded.imageData.data,
      comparisonData.data,
      decoded.canvas.width,
      decoded.canvas.height
    );
    const savings = savedPercent(sourceFile.size, candidate.blob.size);
    const qualitySafe = similarity >= similarityThreshold && edges >= edgeThreshold;
    if (qualitySafe) {
      const result = { ...candidate, paletteColors: candidate.paletteColors || colors, similarity, edgeSimilarity: edges };
      if (!denseColorPng || savings >= 80) return result;
      safeFallback = result;
    }
  }

  // If 80% is not safely reachable, prefer the smallest candidate that still
  // passed the visual guards instead of discarding all useful compression.
  if (safeFallback) return safeFallback;

  return {
    blob: await optimisePng(sourceFile, level),
    colorGuarded: "lossless",
    paletteColors: null,
    similarity: 1,
    edgeSimilarity: 1
  };
}

async function compressEntry(entry, requestedMode) {
  entry.status = "processing";
  render();
  await new Promise(resolve => requestAnimationFrame(resolve));
  let mode = requestedMode;
  let blob = entry.file;
  const effortLevel = pngOptimizationLevel(elements.effort.value);

  if (entry.format === "jpeg" || entry.format === "webp") {
    if (requestedMode === "exact") {
      entry.usedMode = "exact";
      entry.keptOriginal = true;
    } else {
      const decoded = await decodeFile(entry.file);
      const analysis = analyzePixels(decoded.imageData.data, decoded.canvas.width, decoded.canvas.height);
      entry.kind = analysis.kind;
      mode = requestedMode;
      blob = requestedMode === "recommended"
        ? await encodeRecommendedRaster(decoded, entry.format, analysis.kind, elements.effort.value)
        : await encodeRaster(decoded.canvas, entry.format, jpegQuality(mode, elements.effort.value, analysis.kind));
      entry.usedMode = requestedMode;
      entry.processingMode = mode;
      entry.processingStrategy = "jpeg";
      if (blob.size >= entry.file.size) {
        blob = entry.file;
        entry.keptOriginal = true;
      }
    }
    entry.resultBlob = blob;
    entry.resultUrl = URL.createObjectURL(blob);
    entry.after = blob.size;
    entry.status = "done";
    return;
  }

  // Exact is a byte-level lossless path. Avoid decoding into a canvas so large
  // images do not consume a second full RGBA buffer and hidden RGB values under
  // transparent pixels are never touched.
  if (requestedMode !== "exact") {
    const decoded = await decodeFile(entry.file);
    const analysis = analyzePixels(decoded.imageData.data, decoded.canvas.width, decoded.canvas.height);
    entry.kind = analysis.kind;
    mode = requestedMode === "recommended" ? analysis.preset : requestedMode;
    if (requestedMode === "recommended") {
      entry.processingStrategy = "adaptive-palette";
      ({ blob, colorGuarded: entry.colorGuarded, paletteColors: entry.paletteColors } = await encodeRecommendedPng(
        decoded,
        entry.file,
        analysis,
        effortLevel,
        elements.effort.value
      ));
    } else if (elements.effort.value === "careful" && mode === "smallest") {
      mode = "balanced";
      entry.processingStrategy = decoded.canvas.width * decoded.canvas.height > MAX_PALETTE_PIXELS ? "bounded" : "palette";
      ({ blob, colorGuarded: entry.colorGuarded, paletteColors: entry.paletteColors } = await quantizePng(decoded.imageData, decoded.canvas.width, decoded.canvas.height, mode, effortLevel, usesColorGuard(requestedMode)));
    } else if (mode === "balanced" || mode === "smallest" || mode === "illustration") {
      entry.processingStrategy = decoded.canvas.width * decoded.canvas.height > MAX_PALETTE_PIXELS ? "bounded" : "palette";
      ({ blob, colorGuarded: entry.colorGuarded, paletteColors: entry.paletteColors } = await quantizePng(decoded.imageData, decoded.canvas.width, decoded.canvas.height, mode, effortLevel, usesColorGuard(requestedMode)));
    } else {
      entry.processingStrategy = "lineart";
      ({ blob, colorGuarded: entry.colorGuarded, paletteColors: entry.paletteColors } = await processLineArtPng(
        decoded.imageData,
        decoded.canvas.width,
        decoded.canvas.height,
        effortLevel,
        requestedMode === "recommended",
        usesColorGuard(requestedMode)
      ));
    }
  }
  entry.usedMode = requestedMode;
  entry.processingMode = mode;
  if (mode === "exact") blob = await optimisePng(blob, effortLevel);
  if (blob.size >= entry.file.size) {
    blob = entry.file;
    entry.keptOriginal = true;
  }
  entry.resultBlob = blob;
  entry.resultUrl = URL.createObjectURL(blob);
  entry.after = blob.size;
  entry.status = "done";
}

async function runCompression() {
  if (!entries.length || running) { if (!entries.length) showToast(copy.empty); return; }
  resetResults();
  running = true;
  cancelRequested = false;
  elements.cancel.disabled = false;
  render();
  const requestedMode = selectedMode();

  for (const entry of entries) {
    if (cancelRequested) break;
    try { await compressEntry(entry, requestedMode); }
    catch (error) {
      if (cancelRequested || error?.name === "AbortError") entry.status = "ready";
      else { entry.status = "error"; entry.error = error instanceof Error ? error.message : String(error); }
    }
    render();
  }

  running = false;
  const completed = entries.filter(entry => entry.status === "done");
  for (const entry of entries.filter(item => item.status === "ready" || item.status === "processing")) entry.status = "ready";
  render();
  if (cancelRequested) showToast(copy.cancelled);
  if (completed.length) {
    elements.results.hidden = false;
    updateSummary(completed);
    elements.results.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function updateSummary(completed) {
  const before = completed.reduce((sum, entry) => sum + entry.file.size, 0);
  const after = completed.reduce((sum, entry) => sum + entry.after, 0);
  const saved = before - after;
  const rate = savedPercent(before, after);
  elements.resultStatus.textContent = copy.completed(completed.length, entries.length);
  elements.before.textContent = formatBytes(before, locale);
  elements.after.textContent = formatBytes(after, locale);
  elements.saved.textContent = formatBytes(Math.max(0, saved), locale);
  elements.savedRate.textContent = rate >= 0 ? copy.saved(rate) : copy.larger(rate);
  renderLargeComparison(completed);
}

function renderLargeComparison(completed) {
  if (!completed.length) return;
  if (!completed.some(entry => entry.id === comparisonEntryId)) comparisonEntryId = completed[0].id;
  const selected = completed.find(entry => entry.id === comparisonEntryId) || completed[0];
  elements.comparisonFileName.textContent = selected.file.name;
  elements.comparisonTabs.hidden = completed.length < 2;
  elements.comparisonTabs.setAttribute("aria-label", copy.comparisonTabs);
  elements.comparisonTabs.innerHTML = completed.map((entry, index) => `<button type="button" role="tab" aria-selected="${entry.id === selected.id}" tabindex="${entry.id === selected.id ? "0" : "-1"}" data-comparison-id="${entry.id}"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(entry.file.name)}</button>`).join("");
  elements.comparisonView.innerHTML = `<div class="compression-comparison-grid" role="tabpanel"><figure><figcaption>${copy.before}<small>${formatBytes(selected.file.size, locale)}</small></figcaption><div><img src="${selected.previewUrl}" alt="${escapeHtml(selected.file.name)} ${copy.before}"></div></figure><figure><figcaption>${copy.after}<small>${formatBytes(selected.after, locale)}</small></figcaption><div><img src="${selected.resultUrl}" alt="${escapeHtml(selected.file.name)} ${copy.after}"></div></figure></div>`;
  bindComparisonScroll();
}

function bindComparisonScroll() {
  const panes = [...elements.comparisonView.querySelectorAll(".compression-comparison-grid figure > div")];
  if (panes.length !== 2) return;
  let syncing = false;
  const mirror = (source, target) => {
    if (syncing) return;
    syncing = true;
    const sourceX = Math.max(0, source.scrollWidth - source.clientWidth);
    const sourceY = Math.max(0, source.scrollHeight - source.clientHeight);
    const targetX = Math.max(0, target.scrollWidth - target.clientWidth);
    const targetY = Math.max(0, target.scrollHeight - target.clientHeight);
    target.scrollLeft = sourceX ? source.scrollLeft / sourceX * targetX : 0;
    target.scrollTop = sourceY ? source.scrollTop / sourceY * targetY : 0;
    requestAnimationFrame(() => { syncing = false; });
  };
  panes[0].addEventListener("scroll", () => mirror(panes[0], panes[1]), { passive: true });
  panes[1].addEventListener("scroll", () => mirror(panes[1], panes[0]), { passive: true });
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadAll() {
  const completed = entries.filter(entry => entry.status === "done" && entry.resultBlob);
  if (!completed.length) return;
  showToast(copy.downloading);
  const usedNames = new Map();
  const zipEntries = [];
  for (const entry of completed) {
    let name = makeOutputName(entry);
    const seen = usedNames.get(name) || 0;
    usedNames.set(name, seen + 1);
    if (seen) name = makeOutputName(entry, `-${seen + 1}`);
    zipEntries.push({ name, data: new Uint8Array(await entry.resultBlob.arrayBuffer()) });
  }
  downloadBlob(createZipBlob(zipEntries), "shiagent-images.zip");
  showToast(copy.downloaded);
}

elements.select.addEventListener("click", event => { event.stopPropagation(); elements.input.click(); });
elements.add.addEventListener("click", () => elements.input.click());
elements.input.addEventListener("change", () => addFiles(elements.input.files));
elements.drop.addEventListener("click", event => { if (!event.target.closest("button")) elements.input.click(); });
elements.drop.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.input.click(); } });
elements.drop.addEventListener("dragover", event => { event.preventDefault(); elements.drop.classList.add("is-over"); });
elements.drop.addEventListener("dragleave", () => elements.drop.classList.remove("is-over"));
elements.drop.addEventListener("drop", event => { event.preventDefault(); elements.drop.classList.remove("is-over"); addFiles(event.dataTransfer.files); });
elements.clear.addEventListener("click", clearEntries);
elements.removeAll.addEventListener("click", clearEntries);
elements.compress.addEventListener("click", runCompression);
elements.cancel.addEventListener("click", () => {
  cancelRequested = true;
  elements.cancel.disabled = true;
  stopOptimizerWorker();
});
elements.downloadAll.addEventListener("click", downloadAll);
elements.comparisonTabs.addEventListener("click", event => {
  const tab = event.target.closest("[data-comparison-id]");
  if (!tab) return;
  comparisonEntryId = tab.dataset.comparisonId;
  renderLargeComparison(entries.filter(entry => entry.status === "done"));
});
elements.comparisonTabs.addEventListener("keydown", event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...elements.comparisonTabs.querySelectorAll('[role="tab"]')];
  if (!tabs.length) return;
  const current = Math.max(0, tabs.indexOf(document.activeElement));
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[index].click();
  elements.comparisonTabs.querySelector(`[data-comparison-id="${comparisonEntryId}"]`)?.focus();
});
elements.list.addEventListener("click", event => {
  const remove = event.target.closest("[data-remove]");
  if (remove) removeEntry(remove.dataset.remove);
  const download = event.target.closest("[data-download]");
  if (download) {
    const entry = entries.find(item => item.id === download.dataset.download);
    if (entry?.resultBlob) downloadBlob(entry.resultBlob, makeOutputName(entry));
  }
});
window.addEventListener("beforeunload", () => {
  stopOptimizerWorker();
  entries.forEach(disposeEntry);
});
render();
