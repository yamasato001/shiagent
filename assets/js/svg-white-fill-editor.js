import { formatBytes } from "./png-core.js";
import { FILL_PRESETS, closedRegionMask, countMaskRegions, insertWhiteFill, maskToPath, viewBoxOfSvg } from "./svg-white-fill-core.js";
import { cleanSvg } from "./svg-cleaner-core.js";
import { pick } from "./i18n.js";
import common from "./i18n/common.js";
import vectorText from "./i18n/vector-tools.js";

const shared = pick(common), copy = pick(vectorText).editor;
const lineArtWorkflow = new URLSearchParams(location.search).get("workflow") === "line-art-to-svg";

const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), select: $("#selectButton"), status: $("#fileStatus"), previous: $("#previousButton"),
  skip: $("#skipButton"), saveNext: $("#saveNextButton"), zoomOut: $("#zoomOutButton"), resetZoom: $("#resetZoomButton"),
  zoomIn: $("#zoomInButton"), preset: $("#presetInput"), undo: $("#undoButton"), clear: $("#clearEditsButton"),
  download: $("#downloadButton"), originalSize: $("#originalSize"), outputSize: $("#outputSize"), regions: $("#regionCount"),
  lines: $("#lineCount"), excludes: $("#excludeCount"), workspace: $("#editorDropZone"), canvas: $("#editorCanvas"),
  empty: $("#emptyMessage"), toast: $("#toast")
};
const context = elements.canvas.getContext("2d");
const state = { sessions: [], index: 0, display: null, zoom: 1, panX: 0, panY: 0, panning: null };
const isSvg = file => file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
const current = () => state.sessions[state.index];

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

async function createSession(file) {
  const original = await file.text();
  const parsed = new DOMParser().parseFromString(original, "image/svg+xml");
  if (parsed.querySelector("parsererror")) throw new Error(copy.parseFailed(file.name));
  const clean = insertWhiteFill(original, "");
  const [originalImage, lineImage] = await Promise.all([loadImage(file), loadImage(new Blob([clean], { type: "image/svg+xml" }))]);
  return {
    file, original, originalImage, lineImage, viewBox: viewBoxOfSvg(parsed.documentElement),
    lines: [], excludedPoints: [], pending: null, history: [], stale: true,
    revision: 0, previewPromise: null, result: null, maskCanvas: null
  };
}

function resetViewport() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  elements.resetZoom.textContent = "100%";
}

async function addFiles(fileList) {
  const files = [...fileList].filter(isSvg);
  if (!files.length) return showToast(shared.selectSvg);
  try {
    state.sessions = [];
    for (const file of files) state.sessions.push(await createSession(file));
    state.index = 0;
    resetViewport();
    elements.input.value = "";
    render();
    for (const session of state.sessions) await requestPreview(session);
  } catch (error) {
    console.error(error);
    showToast(error.message);
  }
}

function mode() {
  return document.querySelector('input[name="editMode"]:checked')?.value || "close";
}

function updateStats() {
  const session = current();
  elements.originalSize.textContent = session ? formatBytes(session.file.size) : "—";
  elements.outputSize.textContent = session?.stale ? copy.updating : session?.result ? formatBytes(session.result.blob.size) : "—";
  elements.regions.textContent = session?.result ? copy.regions(session.result.regions, session.stale) : session ? copy.detecting : "—";
  elements.lines.textContent = copy.lines(session?.lines.length || 0);
  elements.excludes.textContent = copy.excludes(session?.excludedPoints.length || 0);
  elements.download.disabled = !session?.result || session.stale;
}

function render() {
  const session = current();
  elements.empty.hidden = !!session;
  elements.status.textContent = session ? copy.status(state.index + 1, state.sessions.length, session.file.name, session.stale) : copy.choose;
  elements.previous.disabled = !session || state.index === 0;
  elements.skip.disabled = !session || state.index >= state.sessions.length - 1;
  elements.saveNext.disabled = !session;
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
      files: state.sessions.filter(session => session.result && !session.stale).map(session => ({ name: session.result.name, blob: session.result.blob })),
      source: "svg-white-fill-editor"
    }
  }));
}

async function calculatePreview(session, revision) {
  const selected = FILL_PRESETS[elements.preset.value];
  const width = session.viewBox[2] >= session.viewBox[3] ? selected.longSide : Math.max(1, Math.round(selected.longSide * session.viewBox[2] / session.viewBox[3]));
  const height = session.viewBox[3] >= session.viewBox[2] ? selected.longSide : Math.max(1, Math.round(selected.longSide * session.viewBox[3] / session.viewBox[2]));
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = width;
  renderCanvas.height = height;
  const renderContext = renderCanvas.getContext("2d", { willReadFrequently: true });
  renderContext.drawImage(session.lineImage, 0, 0, width, height);
  const rgba = renderContext.getImageData(0, 0, width, height).data;
  const alpha = new Uint8ClampedArray(width * height);
  for (let index = 0; index < alpha.length; index += 1) alpha[index] = rgba[index * 4 + 3];
  const lines = session.lines.map(([a, b]) => [[...a], [...b]]);
  const excludedPoints = session.excludedPoints.map(point => [...point]);
  const mask = closedRegionMask(alpha, width, height, selected, { lines, excludedPoints });
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
  if (revision !== session.revision) return false;
  session.maskCanvas = maskCanvas;
  session.result = { name: lineArtWorkflow ? session.file.name : session.file.name.replace(/\.svg$/i, "-edited.svg"), svg, blob, regions: countMaskRegions(mask, width, height) };
  session.stale = false;
  publishResults();
  return true;
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
  updateStats();
  draw();
  requestPreview(session);
}

function canvasClick(event) {
  const session = current();
  const point = canvasPoint(event);
  if (!session || !point) return;
  if (mode() === "close") {
    if (!session.pending) { session.pending = point; draw(); return; }
    session.lines.push([session.pending, point]);
    session.history.push({ type: "line" });
    session.pending = null;
  } else if (mode() === "exclude") {
    session.excludedPoints.push(point);
    session.history.push({ type: "exclude" });
  } else if (!eraseNearest(session, point)) return;
  markStale(session);
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

function download() {
  const session = current();
  if (!session?.result || session.stale) return;
  const url = URL.createObjectURL(session.result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = session.result.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function saveNext() {
  const session = current();
  if (!session || !await requestPreview(session)) return;
  if (state.index < state.sessions.length - 1) {
    state.index += 1;
    resetViewport();
    render();
    requestPreview(current());
  } else showToast(copy.allDone);
}

function move(offset) {
  const next = state.index + offset;
  if (next < 0 || next >= state.sessions.length) return;
  state.index = next;
  resetViewport();
  render();
  requestPreview(current());
}

function changeZoom(multiplier) {
  state.zoom = Math.max(.25, Math.min(8, state.zoom * multiplier));
  elements.resetZoom.textContent = `${Math.round(state.zoom * 100)}%`;
  draw();
}

elements.select.addEventListener("click", () => elements.input.click());
elements.input.addEventListener("change", () => addFiles(elements.input.files));
elements.canvas.addEventListener("click", canvasClick);
elements.zoomOut.addEventListener("click", () => changeZoom(1 / 1.25));
elements.zoomIn.addEventListener("click", () => changeZoom(1.25));
elements.resetZoom.addEventListener("click", () => { resetViewport(); draw(); });
elements.canvas.addEventListener("wheel", event => {
  if (!event.ctrlKey) return;
  event.preventDefault();
  changeZoom(event.deltaY < 0 ? 1.15 : 1 / 1.15);
}, { passive: false });
elements.canvas.addEventListener("mousedown", event => {
  if (event.button !== 1) return;
  event.preventDefault();
  state.panning = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
});
window.addEventListener("mousemove", event => {
  if (!state.panning) return;
  state.panX = state.panning.panX + event.clientX - state.panning.x;
  state.panY = state.panning.panY + event.clientY - state.panning.y;
  draw();
});
window.addEventListener("mouseup", () => { state.panning = null; });
elements.canvas.addEventListener("auxclick", event => event.preventDefault());
elements.undo.addEventListener("click", undo);
elements.clear.addEventListener("click", clearEdits);
elements.download.addEventListener("click", download);
elements.saveNext.addEventListener("click", saveNext);
elements.previous.addEventListener("click", () => move(-1));
elements.skip.addEventListener("click", () => move(1));
elements.preset.addEventListener("change", () => { if (current()) markStale(current()); });
for (const type of ["dragenter", "dragover"]) elements.workspace.addEventListener(type, event => event.preventDefault());
elements.workspace.addEventListener("drop", event => { event.preventDefault(); addFiles(event.dataTransfer.files); });
window.addEventListener("resize", draw);
window.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
  else if ((event.ctrlKey || event.metaKey) && event.key === "0") { event.preventDefault(); resetViewport(); draw(); }
  else if (event.key === "Delete") undo();
});

render();
