import { formatBytes } from "./png-core.js";
import { FILL_PRESETS, WHITE_FILL_ID, closedRegionMask, countMaskRegions, excludeMaskRegions, hasWhiteFillPixels, insertWhiteFill, maskToPath, newlyClosedRegionMask, normalizeSvgRasterViewport, viewBoxOfSvg } from "./svg-white-fill-core.js";
import { cleanSvg } from "./svg-cleaner-core.js";
import { createZipBlob } from "./browser-runtime.js";
import { pick } from "./i18n.js";
import common from "./i18n/common.js";
import vectorText from "./i18n/vector-tools.js";
import { applyConfiguredOutputSuffix } from "./output-name.js";
import { rememberSourceFileHandle } from "./folder-download.js";

const shared = pick(common), copy = pick(vectorText).editor;
const lineArtWorkflow = new URLSearchParams(location.search).get("workflow") === "line-art-to-svg";
const PREVIEW_LONG_SIDE = 768;

const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), select: $("#selectButton"), status: $("#fileStatus"), previous: $("#previousButton"), clearAll: $("#clearAllButton"),
  next: $("#nextButton"), zoomOut: $("#zoomOutButton"), resetZoom: $("#resetZoomButton"),
  zoomIn: $("#zoomInButton"), preset: $("#presetInput"), undo: $("#undoButton"), clear: $("#clearEditsButton"),
  download: $("#downloadButton"), downloadAll: $("#downloadAllButton"), editedSuffix: $("#editedSuffixInput"),
  originalSize: $("#originalSize"), outputSize: $("#outputSize"), regions: $("#regionCount"),
  lines: $("#lineCount"), excludes: $("#excludeCount"), workspace: $("#editorDropZone"), canvas: $("#editorCanvas"),
  empty: $("#emptyMessage"), emptyTitle: $("#emptyMessage strong"), emptyHint: $("#emptyMessage span"), toast: $("#toast"), closeMethods: $("#closeMethodOptions"),
  closeMethodButtons: [...document.querySelectorAll("[data-close-method]")]
};
const context = elements.canvas.getContext("2d");
const state = { sessions: [], index: 0, completed: false, display: null, zoom: 1, panX: 0, panY: 0, panning: null, dragLine: null, closeMethod: "segment" };
const touchPointers = new Map();
let touchGesture = null, touchMoved = false, suppressClickUntil = 0;
const isSvg = file => file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
const current = () => state.completed ? null : state.sessions[state.index];

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(copy.displayFailed)); };
    image.src = url;
  });
}

function managedFillSvg(documentNode) {
  const managed = documentNode.querySelector(`#${WHITE_FILL_ID}`);
  if (!managed?.children.length) return null;
  const root = documentNode.documentElement.cloneNode(false);
  for (const child of documentNode.documentElement.children) {
    if (["defs", "style"].includes(child.localName)) root.append(child.cloneNode(true));
  }
  root.append(managed.cloneNode(true));
  return new XMLSerializer().serializeToString(root);
}

function rasterSvg(source, viewBox) {
  const documentNode = new DOMParser().parseFromString(source, "image/svg+xml");
  normalizeSvgRasterViewport(documentNode.documentElement, viewBox);
  return new XMLSerializer().serializeToString(documentNode.documentElement);
}

async function createSession(file, sourceHandle = null) {
  const original = await file.text();
  const parsed = new DOMParser().parseFromString(original, "image/svg+xml");
  if (parsed.querySelector("parsererror")) throw new Error(copy.parseFailed(file.name));
  const viewBox = viewBoxOfSvg(parsed.documentElement);
  const managedSvg = managedFillSvg(parsed);
  const clean = insertWhiteFill(original, "");
  const [originalImage, lineImage, managedFillImage] = await Promise.all([
    loadImage(new Blob([rasterSvg(original, viewBox)], { type: "image/svg+xml" })),
    loadImage(new Blob([rasterSvg(clean, viewBox)], { type: "image/svg+xml" })),
    managedSvg ? loadImage(new Blob([rasterSvg(managedSvg, viewBox)], { type: "image/svg+xml" })) : null
  ]);
  return {
    file, sourceHandle, original, originalImage, lineImage, managedFillImage, viewBox,
    lines: [], excludedPoints: [], pending: null, history: [], stale: true,
    revision: 0, previewPromise: null, result: null, finalResult: null, finalRevision: -1,
    maskCanvas: null, analysisCache: new Map(), autoFillClosedRegions: null
  };
}

function resetViewport() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  elements.resetZoom.textContent = "100%";
}

async function addFiles(fileEntries) {
  const entries = [...fileEntries].map(entry => entry?.file ? entry : { file: entry, sourceHandle: null }).filter(entry => isSvg(entry.file));
  if (!entries.length) return showToast(shared.selectSvg);
  try {
    state.sessions = [];
    for (const entry of entries) state.sessions.push(await createSession(entry.file, entry.sourceHandle));
    state.index = 0;
    state.completed = false;
    resetViewport();
    elements.input.value = "";
    render();
    for (const session of state.sessions) await requestPreview(session);
    render();
  } catch (error) {
    console.error(error);
    showToast(error.message);
  }
}

async function selectFiles() {
  if (typeof window.showOpenFilePicker !== "function") return elements.input.click();
  try {
    const handles = await window.showOpenFilePicker({
      id: "shiagent-svg-inputs",
      multiple: true,
      types: [{ description: "SVG", accept: { "image/svg+xml": [".svg"] } }]
    });
    rememberSourceFileHandle(handles[0]);
    const entries = await Promise.all(handles.map(async sourceHandle => ({ file: await sourceHandle.getFile(), sourceHandle })));
    await addFiles(entries);
  } catch (error) {
    if (error?.name !== "AbortError") { console.error(error); showToast(error.message); }
  }
}

function mode() {
  return document.querySelector('input[name="editMode"]:checked')?.value || "close";
}

function closeMethod() {
  return state.closeMethod;
}

function sameCanvasPoint(first, second) {
  if (!first || !second || !state.display) return false;
  const ratio = window.devicePixelRatio || 1;
  return Math.hypot((first[0] - second[0]) * state.display.width, (first[1] - second[1]) * state.display.height) <= 12 * ratio;
}

function updateStats() {
  const session = current();
  elements.originalSize.textContent = session ? formatBytes(session.file.size) : "—";
  elements.outputSize.textContent = session?.stale ? copy.updating : session?.result ? formatBytes(session.result.blob.size) : "—";
  elements.regions.textContent = session?.result ? copy.regions(session.result.regions, session.stale) : session ? copy.detecting : "—";
  elements.lines.textContent = copy.lines(session?.lines.length || 0);
  elements.excludes.textContent = copy.excludes(session?.excludedPoints.length || 0);
  elements.download.disabled = !session?.result || session.stale;
  elements.downloadAll.disabled = !state.sessions.length || state.sessions.some(item => !item.result || item.stale);
  elements.clearAll.disabled = !state.sessions.length;
}

function render() {
  const session = current();
  elements.empty.hidden = !!session;
  elements.emptyTitle.textContent = state.completed ? copy.complete : copy.choose;
  elements.emptyHint.textContent = state.completed ? copy.completeHint : "";
  elements.status.textContent = state.completed ? copy.complete : session ? copy.status(state.index + 1, state.sessions.length, session.file.name, session.stale) : copy.choose;
  elements.previous.disabled = !state.sessions.length || (!state.completed && state.index === 0);
  elements.next.disabled = !state.sessions.length;
  updateStats();
  draw();
}

function resizeCanvas() {
  const rect = elements.canvas.parentElement.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (elements.canvas.width !== width || elements.canvas.height !== height) {
    elements.canvas.width = width;
    elements.canvas.height = height;
    elements.canvas.style.width = `${rect.width}px`;
    elements.canvas.style.height = `${rect.height}px`;
  }
  return { width, height, ratio };
}

function drawChecker(x, y, width, height, size) {
  context.fillStyle = "#eee";
  context.fillRect(x, y, width, height);
  context.fillStyle = "#d5d5d5";
  for (let row = 0; row * size < height; row += 1) for (let column = 0; column * size < width; column += 1) {
    if ((row + column) % 2) context.fillRect(x + column * size, y + row * size, Math.min(size, width - column * size), Math.min(size, height - row * size));
  }
}

function draw() {
  const session = current();
  const { width: canvasWidth, height: canvasHeight, ratio } = resizeCanvas();
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = "#c8c8c8";
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  if (!session) { state.display = null; return; }
  const padding = 28 * ratio;
  const availableWidth = canvasWidth - padding * 2;
  const availableHeight = canvasHeight - padding * 2;
  const aspect = session.viewBox[2] / session.viewBox[3];
  let width = availableWidth;
  let height = width / aspect;
  if (height > availableHeight) { height = availableHeight; width = height * aspect; }
  width *= state.zoom;
  height *= state.zoom;
  const x = (canvasWidth - width) / 2 + state.panX * ratio;
  const y = (canvasHeight - height) / 2 + state.panY * ratio;
  state.display = { x, y, width, height };
  drawChecker(x, y, width, height, Math.max(12, Math.round(Math.max(width, height) / 60)));
  if (session.maskCanvas) {
    context.drawImage(session.maskCanvas, x, y, width, height);
    context.drawImage(session.lineImage, x, y, width, height);
  } else context.drawImage(session.originalImage, x, y, width, height);
  context.lineWidth = 3 * ratio;
  context.strokeStyle = "#f02020";
  for (const [a, b] of session.lines) {
    context.beginPath();
    context.moveTo(x + a[0] * width, y + a[1] * height);
    context.lineTo(x + b[0] * width, y + b[1] * height);
    context.stroke();
  }
  if (state.dragLine?.session === session) {
    const { start, end } = state.dragLine;
    context.beginPath();
    context.moveTo(x + start[0] * width, y + start[1] * height);
    context.lineTo(x + end[0] * width, y + end[1] * height);
    context.stroke();
  }
  context.strokeStyle = "#2070ff";
  for (const point of session.excludedPoints) {
    const px = x + point[0] * width;
    const py = y + point[1] * height;
    const size = 8 * ratio;
    context.beginPath();
    context.moveTo(px - size, py - size);
    context.lineTo(px + size, py + size);
    context.moveTo(px - size, py + size);
    context.lineTo(px + size, py - size);
    context.stroke();
  }
  if (session.pending) {
    const px = x + session.pending[0] * width;
    const py = y + session.pending[1] * height;
    context.strokeStyle = "#f02020";
    context.beginPath();
    context.arc(px, py, 6 * ratio, 0, Math.PI * 2);
    context.stroke();
  }
}

function canvasPoint(event) {
  if (!state.display) return null;
  const rect = elements.canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * elements.canvas.width / rect.width;
  const y = (event.clientY - rect.top) * elements.canvas.height / rect.height;
  const display = state.display;
  if (x < display.x || y < display.y || x > display.x + display.width || y > display.y + display.height) return null;
  return [(x - display.x) / display.width, (y - display.y) / display.height];
}

function eraseNearest(session, point) {
  const candidates = [];
  session.excludedPoints.forEach((candidate, index) => candidates.push([(candidate[0] - point[0]) ** 2 + (candidate[1] - point[1]) ** 2, "exclude", index]));
  session.lines.forEach(([a, b], index) => {
    const x = (a[0] + b[0]) / 2;
    const y = (a[1] + b[1]) / 2;
    candidates.push([(x - point[0]) ** 2 + (y - point[1]) ** 2, "line", index]);
  });
  if (!candidates.length) return false;
  const [, kind, index] = candidates.sort((a, b) => a[0] - b[0])[0];
  const value = kind === "exclude" ? session.excludedPoints.splice(index, 1)[0] : session.lines.splice(index, 1)[0];
  session.history.push({ type: "erase", kind, index, value });
  return true;
}

function publishResults() {
  document.dispatchEvent(new CustomEvent("shiagent:outputs", {
    detail: {
      files: state.sessions.filter(session => session.result && !session.stale).map(session => exportResult(session)),
      source: "svg-white-fill-editor"
    }
  }));
}

function analysisFor(session, longSide) {
  if (session.analysisCache.has(longSide)) return session.analysisCache.get(longSide);
  const width = session.viewBox[2] >= session.viewBox[3] ? longSide : Math.max(1, Math.round(longSide * session.viewBox[2] / session.viewBox[3]));
  const height = session.viewBox[3] >= session.viewBox[2] ? longSide : Math.max(1, Math.round(longSide * session.viewBox[3] / session.viewBox[2]));
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = width;
  renderCanvas.height = height;
  const renderContext = renderCanvas.getContext("2d", { willReadFrequently: true });
  renderContext.drawImage(session.lineImage, 0, 0, width, height);
  const rgba = renderContext.getImageData(0, 0, width, height).data;
  const alpha = new Uint8ClampedArray(width * height);
  for (let index = 0; index < alpha.length; index += 1) alpha[index] = rgba[index * 4 + 3];
  let managedFillMask = null;
  if (session.managedFillImage) {
    renderContext.clearRect(0, 0, width, height);
    renderContext.drawImage(session.managedFillImage, 0, 0, width, height);
    const managedRgba = renderContext.getImageData(0, 0, width, height).data;
    managedFillMask = Uint8Array.from({ length: width * height }, (_, index) => managedRgba[index * 4 + 3] > 20 ? 1 : 0);
  }
  const analysis = { width, height, alpha, managedFillMask, hasWhiteFill: hasWhiteFillPixels(rgba, width, height) };
  session.analysisCache.set(longSide, analysis);
  return analysis;
}

function scaledPreset(selected, longSide) {
  const scale = longSide / selected.longSide;
  return {
    ...selected,
    longSide,
    closeRadius: selected.closeRadius ? Math.max(1, Math.round(selected.closeRadius * scale)) : 0,
    inset: selected.inset ? Math.max(1, Math.round(selected.inset * scale)) : 0,
    minArea: Math.max(1, Math.round(selected.minArea * scale * scale))
  };
}

function calculateAtResolution(session, selected, longSide) {
  const { width, height, alpha, managedFillMask, hasWhiteFill } = analysisFor(session, longSide);
  const effectivePreset = longSide === selected.longSide ? selected : scaledPreset(selected, longSide);
  const lines = session.lines.map(([a, b]) => [[...a], [...b]]);
  const excludedPoints = session.excludedPoints.map(point => [...point]);
  if (session.autoFillClosedRegions === null) session.autoFillClosedRegions = !managedFillMask && !hasWhiteFill;
  let mask = closedRegionMask(alpha, width, height, effectivePreset, { lines });
  if (!session.autoFillClosedRegions) {
    const originalMask = closedRegionMask(alpha, width, height, effectivePreset);
    mask = newlyClosedRegionMask(mask, originalMask);
    if (managedFillMask) mask = Uint8Array.from(mask, (value, index) => value || managedFillMask[index] ? 1 : 0);
  }
  mask = excludeMaskRegions(mask, width, height, excludedPoints);
  const path = maskToPath(mask, width, height, session.viewBox);
  const filledSvg = insertWhiteFill(session.original, path);
  const svg = lineArtWorkflow ? cleanSvg(filledSvg).svg : filledSvg;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskContext = maskCanvas.getContext("2d");
  const maskData = maskContext.createImageData(width, height);
  for (let index = 0; index < mask.length; index += 1) if (mask[index]) {
    const target = index * 4;
    maskData.data[target] = maskData.data[target + 1] = maskData.data[target + 2] = maskData.data[target + 3] = 255;
  }
  maskContext.putImageData(maskData, 0, 0);
  return {
    maskCanvas,
    result: { name: session.file.name, svg, blob, regions: countMaskRegions(mask, width, height) }
  };
}

async function calculatePreview(session, revision) {
  const selected = FILL_PRESETS[elements.preset.value];
  const generated = calculateAtResolution(session, selected, Math.min(PREVIEW_LONG_SIDE, selected.longSide));
  if (revision !== session.revision) return false;
  session.maskCanvas = generated.maskCanvas;
  session.result = generated.result;
  session.stale = false;
  publishResults();
  return true;
}

async function ensureFinalResult(session) {
  if (!session) return null;
  if (session.stale && !await requestPreview(session)) return null;
  if (session.finalResult && session.finalRevision === session.revision) return session.finalResult;
  const revision = session.revision;
  await new Promise(resolve => requestAnimationFrame(resolve));
  const selected = FILL_PRESETS[elements.preset.value];
  const generated = calculateAtResolution(session, selected, selected.longSide);
  if (revision !== session.revision) return ensureFinalResult(session);
  session.maskCanvas = generated.maskCanvas;
  session.result = session.finalResult = generated.result;
  session.finalRevision = revision;
  publishResults();
  if (current() === session) render();
  return session.finalResult;
}

function requestPreview(session) {
  if (!session) return Promise.resolve(null);
  if (session.previewPromise) return session.previewPromise;
  session.previewPromise = (async () => {
    while (session.stale) {
      const revision = session.revision;
      await new Promise(resolve => requestAnimationFrame(resolve));
      await calculatePreview(session, revision);
    }
    return session.result;
  })().catch(error => {
    console.error(error);
    session.stale = false;
    showToast(error.message);
    return null;
  }).finally(() => {
    session.previewPromise = null;
    if (current() === session) render();
    if (session.stale) requestPreview(session);
  });
  return session.previewPromise;
}

function markStale(session) {
  session.revision += 1;
  session.stale = true;
  session.finalResult = null;
  session.finalRevision = -1;
  updateStats();
  draw();
  requestPreview(session);
}

function editCanvasAt(clientX, clientY) {
  const session = current();
  const point = canvasPoint({ clientX, clientY });
  if (!session || !point) return;
  if (mode() === "close") {
    if (!session.pending) { session.pending = point; draw(); return; }
    if (closeMethod() === "polyline" && sameCanvasPoint(session.pending, point)) {
      session.pending = null;
      draw();
      return;
    }
    session.lines.push([session.pending, point]);
    session.history.push({ type: "line" });
    session.pending = closeMethod() === "polyline" ? point : null;
  } else if (mode() === "exclude") {
    session.excludedPoints.push(point);
    session.history.push({ type: "exclude" });
  } else if (!eraseNearest(session, point)) return;
  markStale(session);
}

function commitGuideLine(session, start, end) {
  if (!session || !start || !end) return;
  session.lines.push([start, end]);
  session.history.push({ type: "line" });
  session.pending = null;
  state.dragLine = null;
  markStale(session);
}

function canvasClick(event) {
  if (performance.now() < suppressClickUntil) return;
  editCanvasAt(event.clientX, event.clientY);
}

function touchCenter(points) {
  return points.reduce((center, point) => ({ x: center.x + point.x / points.length, y: center.y + point.y / points.length }), { x: 0, y: 0 });
}

function beginTouchGesture() {
  const points = [...touchPointers.values()];
  if (points.length === 1) {
    const canvasStart = canvasPoint({ clientX: points[0].x, clientY: points[0].y });
    if (mode() === "close" && closeMethod() === "segment" && !touchMoved && canvasStart) {
      touchGesture = { type: "line", point: points[0], start: canvasStart, end: canvasStart, session: current() };
      state.dragLine = { session: current(), start: canvasStart, end: canvasStart };
    } else touchGesture = { type: "pan", point: points[0], panX: state.panX, panY: state.panY };
  } else if (points.length >= 2) {
    state.dragLine = null;
    const [first, second] = points;
    touchGesture = {
      type: "pinch",
      center: touchCenter([first, second]),
      distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      zoom: state.zoom,
      panX: state.panX,
      panY: state.panY
    };
    touchMoved = true;
  }
}

function touchPointerDown(event) {
  if (event.pointerType !== "touch") return;
  event.preventDefault();
  if (!touchPointers.size) touchMoved = false;
  touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  elements.canvas.setPointerCapture?.(event.pointerId);
  beginTouchGesture();
}

function touchPointerMove(event) {
  if (event.pointerType !== "touch" || !touchPointers.has(event.pointerId)) return;
  event.preventDefault();
  touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const points = [...touchPointers.values()];
  if (points.length === 1 && touchGesture?.type === "line") {
    const dx = points[0].x - touchGesture.point.x;
    const dy = points[0].y - touchGesture.point.y;
    if (Math.hypot(dx, dy) > 6) touchMoved = true;
    const end = canvasPoint({ clientX: points[0].x, clientY: points[0].y });
    if (touchMoved && end) {
      touchGesture.end = end;
      state.dragLine.end = end;
      draw();
    }
  } else if (points.length === 1 && touchGesture?.type === "pan") {
    const dx = points[0].x - touchGesture.point.x;
    const dy = points[0].y - touchGesture.point.y;
    if (Math.hypot(dx, dy) > 6) touchMoved = true;
    if (touchMoved) {
      state.panX = touchGesture.panX + dx;
      state.panY = touchGesture.panY + dy;
      draw();
    }
  } else if (points.length >= 2 && touchGesture?.type === "pinch") {
    const [first, second] = points;
    const center = touchCenter([first, second]);
    const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
    state.zoom = Math.max(.25, Math.min(8, touchGesture.zoom * distance / touchGesture.distance));
    state.panX = touchGesture.panX + center.x - touchGesture.center.x;
    state.panY = touchGesture.panY + center.y - touchGesture.center.y;
    elements.resetZoom.textContent = `${Math.round(state.zoom * 100)}%`;
    draw();
  }
}

function touchPointerEnd(event, cancelled = false) {
  if (event.pointerType !== "touch" || !touchPointers.has(event.pointerId)) return;
  event.preventDefault();
  const completedGesture = touchGesture;
  touchPointers.delete(event.pointerId);
  if (touchPointers.size) beginTouchGesture();
  else {
    if (!cancelled && completedGesture?.type === "line" && touchMoved) {
      commitGuideLine(completedGesture.session, completedGesture.start, completedGesture.end);
    } else {
      state.dragLine = null;
      if (!cancelled && !touchMoved) editCanvasAt(event.clientX, event.clientY);
      else draw();
    }
    suppressClickUntil = performance.now() + 500;
    touchGesture = null;
  }
}

function undo() {
  const session = current();
  if (!session) return;
  if (session.pending) { session.pending = null; draw(); return; }
  const action = session.history.pop();
  if (!action) return;
  if (action.type === "line") session.lines.pop();
  else if (action.type === "exclude") session.excludedPoints.pop();
  else if (action.type === "erase") (action.kind === "exclude" ? session.excludedPoints : session.lines).splice(action.index, 0, action.value);
  markStale(session);
}

function clearEdits() {
  const session = current();
  if (!session || (!session.lines.length && !session.excludedPoints.length && !session.pending)) return;
  session.lines = [];
  session.excludedPoints = [];
  session.pending = null;
  session.history = [];
  markStale(session);
}

function browserDownload(result) {
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportResult(session, result = session.result) {
  const stem = session.file.name.replace(/\.svg$/i, "");
  const name = applyConfiguredOutputSuffix(`${stem}.svg`);
  return { ...result, name };
}

async function download() {
  const session = current();
  if (!session?.result || session.stale) return;
  const finalResult = await ensureFinalResult(session);
  if (!finalResult) return;
  browserDownload(exportResult(session, finalResult));
}

async function downloadAll() {
  if (!state.sessions.length) return;
  const previews = await Promise.all(state.sessions.map(requestPreview));
  if (previews.some(result => !result)) return;
  const results = [];
  for (const session of state.sessions) {
    const finalResult = await ensureFinalResult(session);
    if (!finalResult) return;
    results.push(exportResult(session, finalResult));
  }
  const entries = await Promise.all(results.map(async result => ({ name: result.name, data: new Uint8Array(await result.blob.arrayBuffer()) })));
  browserDownload({ name: "shiagent-svg-edited.zip", blob: createZipBlob(entries, undefined, { applySuffix: false }) });
}

async function moveNext() {
  if (state.completed) {
    state.completed = false;
    state.index = 0;
    resetViewport();
    render();
    requestPreview(current());
    return;
  }
  const session = current();
  if (!session || !await ensureFinalResult(session)) return;
  if (state.index < state.sessions.length - 1) {
    state.index += 1;
    resetViewport();
    render();
    requestPreview(current());
  } else {
    state.completed = true;
    resetViewport();
    render();
    showToast(copy.allDone);
  }
}

function move(offset) {
  if (state.completed && offset < 0 && state.sessions.length) {
    state.completed = false;
    state.index = state.sessions.length - 1;
    resetViewport();
    render();
    requestPreview(current());
    return;
  }
  const next = state.index + offset;
  if (next < 0 || next >= state.sessions.length) return;
  state.index = next;
  resetViewport();
  render();
  requestPreview(current());
}

function clearAll() {
  state.sessions = [];
  state.index = 0;
  state.completed = false;
  state.display = null;
  state.dragLine = null;
  state.panning = null;
  elements.input.value = "";
  resetViewport();
  render();
}

function changeZoom(multiplier) {
  state.zoom = Math.max(.25, Math.min(8, state.zoom * multiplier));
  elements.resetZoom.textContent = `${Math.round(state.zoom * 100)}%`;
  draw();
}

elements.select.addEventListener("click", selectFiles);
elements.input.addEventListener("change", () => addFiles(elements.input.files));
elements.canvas.addEventListener("click", canvasClick);
elements.canvas.addEventListener("pointerdown", touchPointerDown);
elements.canvas.addEventListener("pointermove", touchPointerMove);
elements.canvas.addEventListener("pointerup", event => touchPointerEnd(event));
elements.canvas.addEventListener("pointercancel", event => touchPointerEnd(event, true));
elements.zoomOut.addEventListener("click", () => changeZoom(1 / 1.25));
elements.zoomIn.addEventListener("click", () => changeZoom(1.25));
elements.resetZoom.addEventListener("click", () => { resetViewport(); draw(); });
elements.canvas.addEventListener("wheel", event => {
  if (!event.ctrlKey) return;
  event.preventDefault();
  changeZoom(event.deltaY < 0 ? 1.15 : 1 / 1.15);
}, { passive: false });
elements.canvas.addEventListener("mousedown", event => {
  if (event.button === 0 && mode() === "close" && closeMethod() === "segment") {
    const start = canvasPoint(event);
    const session = current();
    if (!start || !session) return;
    state.dragLine = { session, start, end: start, x: event.clientX, y: event.clientY, moved: false, pointerType: "mouse" };
    draw();
  } else if (event.button === 1) {
    event.preventDefault();
    state.panning = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
  }
});
window.addEventListener("mousemove", event => {
  if (state.dragLine?.pointerType === "mouse") {
    const end = canvasPoint(event);
    if (Math.hypot(event.clientX - state.dragLine.x, event.clientY - state.dragLine.y) > 4) state.dragLine.moved = true;
    if (end) state.dragLine.end = end;
    if (state.dragLine.moved) draw();
  } else if (state.panning) {
    state.panX = state.panning.panX + event.clientX - state.panning.x;
    state.panY = state.panning.panY + event.clientY - state.panning.y;
    draw();
  }
});
window.addEventListener("mouseup", event => {
  if (event.button === 0 && state.dragLine?.pointerType === "mouse") {
    const gesture = state.dragLine;
    state.dragLine = null;
    if (gesture.moved) {
      suppressClickUntil = performance.now() + 500;
      commitGuideLine(gesture.session, gesture.start, gesture.end);
    } else draw();
  }
  if (event.button === 1) state.panning = null;
});
elements.canvas.addEventListener("auxclick", event => event.preventDefault());
elements.undo.addEventListener("click", undo);
elements.clear.addEventListener("click", clearEdits);
elements.download.addEventListener("click", download);
elements.downloadAll.addEventListener("click", downloadAll);
elements.clearAll.addEventListener("click", clearAll);
elements.editedSuffix.addEventListener("change", publishResults);
function resetPendingLine() {
  const session = current();
  if (session) session.pending = null;
  state.dragLine = null;
  elements.closeMethods.classList.toggle("is-inactive", mode() !== "close");
  draw();
}
document.querySelectorAll('input[name="editMode"]').forEach(input => input.addEventListener("change", resetPendingLine));
elements.closeMethodButtons.forEach(button => button.addEventListener("click", () => {
  const closeMode = document.querySelector('input[name="editMode"][value="close"]');
  state.closeMethod = button.dataset.closeMethod;
  closeMode.checked = true;
  elements.closeMethodButtons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
  resetPendingLine();
}));
elements.next.addEventListener("click", moveNext);
elements.previous.addEventListener("click", () => move(-1));
elements.preset.addEventListener("change", () => { if (current()) markStale(current()); });
for (const type of ["dragenter", "dragover"]) elements.workspace.addEventListener(type, event => event.preventDefault());
elements.workspace.addEventListener("drop", async event => {
  event.preventDefault();
  const entries = await Promise.all([...event.dataTransfer.items].filter(item => item.kind === "file").map(async item => {
    const file = item.getAsFile();
    const sourceHandle = typeof item.getAsFileSystemHandle === "function" ? await item.getAsFileSystemHandle().catch(() => null) : null;
    return { file, sourceHandle: sourceHandle?.kind === "file" ? sourceHandle : null };
  }));
  addFiles(entries.length ? entries : event.dataTransfer.files);
});
window.addEventListener("resize", draw);
window.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
  else if ((event.ctrlKey || event.metaKey) && event.key === "0") { event.preventDefault(); resetViewport(); draw(); }
  else if (event.key === "Delete") undo();
});

render();
