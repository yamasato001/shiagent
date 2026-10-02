import { createZipBlob } from "./browser-runtime.js";
import { applyConfiguredOutputSuffix } from "./output-name.js";
import { DRAWABLE_SELECTOR, applySvgStyle, editableElements, safePaint, sanitizeSvgDocument, serializeSvg, splitAbsoluteCompoundPath } from "./svg-style-core.js";

const ja = document.documentElement.lang === "ja";
const copy = ja ? {
  choose: "SVGを選択してください", invalid: name => `${name}をSVGとして読み込めませんでした。`,
  status: (index, total, name) => `${index} / ${total}　${name}`, selected: tag => `<${tag}> を選択中`, selectedMultiple: count => `${count}個のパーツを選択中`, colorSelected: (color, count) => `${color} の部分を${count}個選択中`,
  noSelection: "プレビュー内のパーツを選択", saved: "SVGを保存しました。", allSelected: count => `${count}個のパーツを選択しました。`,
  nothing: "編集できる図形がありません。", reset: "表示中のSVGを元に戻しました。", complete: "完了", completeHint: "「次へ」で1件目に戻ります"
} : {
  choose: "Choose SVG files", invalid: name => `${name} could not be read as SVG.`,
  status: (index, total, name) => `${index} / ${total}  ${name}`, selected: tag => `Selected <${tag}>`, selectedMultiple: count => `${count} parts selected`, colorSelected: (color, count) => `${count} ${color} parts selected`,
  noSelection: "Select a part in the preview", saved: "SVG saved.", allSelected: count => `Selected ${count} parts.`,
  nothing: "No editable shapes were found.", reset: "Restored the current SVG.", complete: "Complete", completeHint: "Select Next to return to the first SVG"
};

const $ = selector => document.querySelector(selector);
const elements = {
  input: $("#fileInput"), select: $("#selectButton"), status: $("#fileStatus"), previous: $("#previousButton"), next: $("#nextButton"), clearAll: $("#clearAllButton"),
  download: $("#downloadButton"), downloadAll: $("#downloadAllButton"), workspace: $("#editorDropZone"), canvas: $(".style-editor-canvas-wrap"), stage: $("#svgStage"), selectionBox: $("#selectionBox"), empty: $("#emptyMessage"),
  selected: $("#selectedElement"), fill: $("#fillColor"), fillNone: $("#fillNone"), stroke: $("#strokeColor"), strokeNone: $("#strokeNone"),
  objectSelectMode: $("#objectSelectMode"), colorSelectMode: $("#colorSelectMode"), selectBlack: $("#selectBlackButton"), selectWhite: $("#selectWhiteButton"),
  matchedColorControl: $("#matchedColorControl"), matchedColor: $("#matchedColor"), styleFields: $("#styleFields"),
  strokeWidth: $("#strokeWidth"), strokeWidthNumber: $("#strokeWidthNumber"), opacity: $("#elementOpacity"), opacityOutput: $("#opacityOutput"),
  applyAll: $("#applyAllButton"), undo: $("#undoButton"), redo: $("#redoButton"), reset: $("#resetButton"),
  zoomOut: $("#zoomOutButton"), zoomReset: $("#resetZoomButton"), zoomIn: $("#zoomInButton"),
  originalSize: $("#originalSize"), outputSize: $("#outputSize"), elementCount: $("#elementCount"), changedCount: $("#changedCount"), toast: $("#toast"),
  emptyTitle: $("#emptyMessage strong"), emptyHint: $("#emptyMessage span")
};

const state = {
  sessions: [], index: 0, completed: false, root: null, originalViewport: null, selected: new Set(), colorChannels: new Map(), sampledColor: null, selectionMode: "object",
  zoom: 1, baseZoom: 1, panX: 0, panY: 0, basePanX: 0, basePanY: 0, drag: null, suppressClick: false
};
const current = () => state.completed ? null : state.sessions[state.index];
const isSvg = file => file?.type === "image/svg+xml" || /\.svg$/i.test(file?.name || "");

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function parseSvg(source) {
  const documentNode = sanitizeSvgDocument(new DOMParser().parseFromString(source, "image/svg+xml"));
  return documentNode.documentElement;
}

function outputName(session) {
  return applyConfiguredOutputSuffix(session.file.name.replace(/\.svg$/i, "") + ".svg");
}

function outputFile(session) {
  const source = session.history[session.historyIndex];
  return { name: outputName(session), blob: new Blob([source], { type: "image/svg+xml" }) };
}

function publishResults() {
  if (!state.sessions.length) return;
  document.dispatchEvent(new CustomEvent("shiagent:outputs", {
    detail: { files: state.sessions.map(outputFile), source: "svg-style-editor" }
  }));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function currentSource() {
  if (!state.root) return "";
  const clone = state.root.cloneNode(true);
  for (const [name, value] of Object.entries(state.originalViewport || {})) {
    if (value === null) clone.removeAttribute(name);
    else clone.setAttribute(name, value);
  }
  return serializeSvg(clone);
}

function updateStats() {
  const session = current();
  const source = session ? session.history[session.historyIndex] : "";
  elements.originalSize.textContent = session ? formatBytes(session.file.size) : "—";
  elements.outputSize.textContent = source ? formatBytes(new Blob([source]).size) : "—";
  elements.elementCount.textContent = state.root ? String(editableElements(state.root).length) : "—";
  elements.changedCount.textContent = session ? String(session.historyIndex) : "0";
  elements.undo.disabled = !session || session.historyIndex === 0;
  elements.redo.disabled = !session || session.historyIndex >= session.history.length - 1;
  elements.reset.disabled = !session || session.historyIndex === 0;
  elements.download.disabled = !session;
  elements.downloadAll.disabled = !state.sessions.length;
  elements.clearAll.disabled = !state.sessions.length;
  elements.previous.disabled = !state.sessions.length || (!state.completed && state.index === 0);
  elements.next.disabled = !state.sessions.length;
  elements.applyAll.disabled = !session;
}

function setControlsDisabled(disabled) {
  for (const element of [elements.fill, elements.fillNone, elements.stroke, elements.strokeNone, elements.strokeWidth, elements.strokeWidthNumber, elements.opacity]) element.disabled = disabled;
}

function rgbToHex(value, fallback) {
  const match = String(value || "").match(/rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i);
  if (!match) return safePaint(value, fallback);
  return `#${match.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, "0")).join("")}`;
}

function updateSelectionControls() {
  const targets = [...state.selected];
  const target = targets[0];
  elements.styleFields.hidden = state.selectionMode === "color";
  elements.matchedColorControl.hidden = state.selectionMode !== "color" || !state.sampledColor || !target;
  if (!target) {
    elements.selected.textContent = copy.noSelection;
    setControlsDisabled(true);
    return;
  }
  if (state.selectionMode === "color" && state.sampledColor) {
    elements.selected.textContent = copy.colorSelected(state.sampledColor, targets.length);
    elements.matchedColor.value = state.sampledColor;
    setControlsDisabled(true);
    return;
  }
  const highlighted = target.hasAttribute("data-shiagent-selected");
  if (highlighted) target.removeAttribute("data-shiagent-selected");
  const computed = getComputedStyle(target);
  const computedValues = { fill: computed.fill, stroke: computed.stroke, strokeWidth: computed.strokeWidth, opacity: computed.opacity };
  if (highlighted) target.setAttribute("data-shiagent-selected", "");
  const fill = target.style.fill || target.getAttribute("fill") || computedValues.fill;
  const stroke = target.style.stroke || target.getAttribute("stroke") || computedValues.stroke;
  const width = Number.parseFloat(target.style.strokeWidth || target.getAttribute("stroke-width") || computedValues.strokeWidth) || 0;
  const opacity = Number.parseFloat(target.style.opacity || target.getAttribute("opacity") || computedValues.opacity);
  elements.selected.textContent = targets.length === 1 ? copy.selected(target.localName) : copy.selectedMultiple(targets.length);
  elements.fillNone.checked = fill === "none";
  elements.fill.value = rgbToHex(fill, "#000000");
  elements.strokeNone.checked = stroke === "none";
  elements.stroke.value = rgbToHex(stroke, "#000000");
  elements.strokeWidth.value = String(Math.min(20, width));
  elements.strokeWidthNumber.value = String(width);
  elements.opacity.value = String(Number.isFinite(opacity) ? opacity : 1);
  elements.opacityOutput.value = `${Math.round((Number.isFinite(opacity) ? opacity : 1) * 100)}%`;
  setControlsDisabled(false);
}

function replaceSelection(targets, additive = false, channelMap = null) {
  if (!additive) {
    state.root?.querySelectorAll("[data-shiagent-selected]").forEach(element => element.removeAttribute("data-shiagent-selected"));
    state.selected.clear();
    state.colorChannels.clear();
  }
  for (const target of targets) {
    if (!target || !state.root?.contains(target)) continue;
    target.setAttribute("data-shiagent-selected", "");
    state.selected.add(target);
    if (channelMap?.has(target)) state.colorChannels.set(target, channelMap.get(target));
  }
  updateSelectionControls();
}

function selectElement(target, additive = false) {
  if (!additive) {
    replaceSelection(target ? [target] : []);
    return;
  }
  if (target) {
    if (state.selected.has(target)) {
      target.removeAttribute("data-shiagent-selected");
      state.selected.delete(target);
    } else {
      target.setAttribute("data-shiagent-selected", "");
      state.selected.add(target);
    }
  }
  updateSelectionControls();
}

function selectAll() {
  const targets = state.root ? editableElements(state.root) : [];
  if (!targets.length) return showToast(copy.nothing);
  setSelectionMode("object");
  replaceSelection(targets);
  showToast(copy.allSelected(targets.length));
}

function setSelectionMode(mode) {
  state.selectionMode = mode === "color" ? "color" : "object";
  state.sampledColor = null;
  replaceSelection([]);
  elements.stage.dataset.selectionMode = state.selectionMode;
  elements.objectSelectMode.setAttribute("aria-pressed", String(state.selectionMode === "object"));
  elements.colorSelectMode.setAttribute("aria-pressed", String(state.selectionMode === "color"));
  elements.objectSelectMode.classList.toggle("is-active", state.selectionMode === "object");
  elements.colorSelectMode.classList.toggle("is-active", state.selectionMode === "color");
  updateSelectionControls();
}

function normalizedPaint(value) {
  const paint = String(value || "").trim();
  if (!paint || paint === "none" || paint === "transparent" || /rgba\([^)]*,\s*0(?:\.0+)?\s*\)/i.test(paint)) return null;
  return rgbToHex(paint, null);
}

function elementPaint(target, channel) {
  const computed = getComputedStyle(target);
  return normalizedPaint(target.style[channel] || target.getAttribute(channel)) || normalizedPaint(computed[channel]);
}

function selectColor(color) {
  const normalized = normalizedPaint(color);
  if (!normalized || !state.root) return;
  if (state.selectionMode !== "color") setSelectionMode("color");
  const channelMap = new Map();
  for (const target of editableElements(state.root)) {
    const channels = new Set();
    if (elementPaint(target, "fill") === normalized) channels.add("fill");
    if (elementPaint(target, "stroke") === normalized) channels.add("stroke");
    if (channels.size) channelMap.set(target, channels);
  }
  state.sampledColor = normalized;
  replaceSelection([...channelMap.keys()], false, channelMap);
}

function fitRootToContent(root) {
  state.originalViewport = {
    viewBox: root.hasAttribute("viewBox") ? root.getAttribute("viewBox") : null,
    preserveAspectRatio: root.hasAttribute("preserveAspectRatio") ? root.getAttribute("preserveAspectRatio") : null
  };
  try {
    const bounds = root.getBBox();
    if (!(bounds.width > 0) || !(bounds.height > 0)) return;
    const padding = Math.max(bounds.width, bounds.height) * .04;
    root.setAttribute("viewBox", `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`);
    root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  } catch (error) {
    console.warn("Could not fit SVG content bounds.", error);
  }
}

function containsBox(outer, inner) {
  const epsilon = Math.max(1e-6, Math.max(outer.width, outer.height) * 1e-7);
  const larger = outer.width * outer.height > inner.width * inner.height + epsilon;
  return larger && inner.x >= outer.x - epsilon && inner.y >= outer.y - epsilon
    && inner.x + inner.width <= outer.x + outer.width + epsilon
    && inner.y + inner.height <= outer.y + outer.height + epsilon;
}

function splitCompoundPaths(root) {
  for (const path of [...root.querySelectorAll("path")]) {
    if (path.closest("defs,clipPath,mask,marker,pattern,symbol") || path.id) continue;
    const fragments = splitAbsoluteCompoundPath(path.getAttribute("d"));
    if (fragments.length < 2) continue;
    const probes = fragments.map((fragment, index) => {
      const probe = path.cloneNode(false);
      probe.removeAttribute("id");
      probe.setAttribute("d", fragment);
      probe.setAttribute("data-shiagent-probe", "");
      path.parentNode.insertBefore(probe, path);
      let box = null;
      try { box = probe.getBBox(); } catch {}
      return { index, fragment, probe, box };
    });
    probes.forEach(({ probe }) => probe.remove());
    if (probes.some(({ box }) => !box || !(box.width > 0 || box.height > 0))) continue;
    for (const item of probes) {
      item.parent = probes
        .filter(candidate => candidate !== item && containsBox(candidate.box, item.box))
        .sort((first, second) => first.box.width * first.box.height - second.box.width * second.box.height)[0] || null;
    }
    const rootOf = item => {
      let cursor = item;
      while (cursor.parent) cursor = cursor.parent;
      return cursor;
    };
    const roots = probes.filter(item => !item.parent);
    if (roots.length < 2) continue;
    for (const objectRoot of roots) {
      const clone = path.cloneNode(false);
      clone.removeAttribute("id");
      clone.setAttribute("d", probes.filter(item => rootOf(item) === objectRoot).map(item => item.fragment).join(" "));
      path.parentNode.insertBefore(clone, path);
    }
    path.remove();
  }
}

function installRoot(source) {
  const root = parseSvg(source);
  elements.stage.replaceChildren(root);
  state.root = root;
  splitCompoundPaths(root);
  fitRootToContent(root);
  state.selected = new Set();
  elements.empty.hidden = true;
  selectElement(null);
  updateStats();
}

function renderSession() {
  const session = current();
  if (state.completed) {
    state.root = null;
    elements.stage.replaceChildren();
    elements.empty.hidden = false;
    elements.emptyTitle.textContent = copy.complete;
    elements.emptyHint.textContent = copy.completeHint;
    elements.status.textContent = copy.complete;
    selectElement(null);
    updateStats();
    return;
  }
  if (!session) {
    state.root = null;
    elements.stage.replaceChildren();
    elements.empty.hidden = false;
    elements.emptyTitle.textContent = copy.choose;
    elements.emptyHint.textContent = "";
    elements.status.textContent = copy.choose;
    selectElement(null);
    updateStats();
    return;
  }
  elements.status.textContent = copy.status(state.index + 1, state.sessions.length, session.file.name);
  elements.emptyTitle.textContent = copy.choose;
  elements.emptyHint.textContent = "";
  installRoot(session.history[session.historyIndex]);
  scheduleFitView();
}

async function createSession(file) {
  const source = await file.text();
  const sanitized = serializeSvg(parseSvg(source));
  return { file, original: sanitized, history: [sanitized], historyIndex: 0 };
}

async function addFiles(fileList) {
  const files = [...fileList].filter(isSvg);
  if (!files.length) return showToast(copy.choose);
  const sessions = [];
  for (const file of files) {
    try { sessions.push(await createSession(file)); }
    catch (error) { console.error(error); showToast(copy.invalid(file.name)); }
  }
  if (!sessions.length) return;
  state.sessions = sessions;
  state.index = 0;
  state.completed = false;
  elements.input.value = "";
  renderSession();
  publishResults();
}

function clearAll() {
  state.sessions = [];
  state.index = 0;
  state.completed = false;
  state.root = null;
  state.originalViewport = null;
  state.selected.clear();
  state.colorChannels.clear();
  elements.input.value = "";
  renderSession();
}

function styleFromControls() {
  return {
    fill: elements.fill.value, fillNone: elements.fillNone.checked,
    stroke: elements.stroke.value, strokeNone: elements.strokeNone.checked,
    strokeWidth: elements.strokeWidthNumber.value, opacity: elements.opacity.value
  };
}

function recordHistory(message = "") {
  const session = current();
  if (!session || !state.root) return;
  const source = currentSource();
  session.history.splice(session.historyIndex + 1);
  session.history.push(source);
  session.historyIndex += 1;
  updateStats();
  publishResults();
  if (message) showToast(message);
}

function commit(targets, message = "") {
  if (!targets.length) return;
  applySvgStyle(targets, styleFromControls());
  recordHistory(message);
}

function applySelected() {
  commit([...state.selected]);
}

function previewSelected() {
  if (!state.selected.size) return;
  applySvgStyle(state.selected, styleFromControls());
  const source = currentSource();
  elements.outputSize.textContent = source ? formatBytes(new Blob([source]).size) : "—";
}

function previewSelectedPaintColor() {
  if (!state.colorChannels.size) return;
  const color = safePaint(elements.matchedColor.value, "#000000");
  for (const [target, channels] of state.colorChannels) {
    for (const channel of channels) {
      target.setAttribute(channel, color);
      target.style[channel] = color;
    }
  }
  const source = currentSource();
  elements.outputSize.textContent = source ? formatBytes(new Blob([source]).size) : "—";
}

function commitSelectedPaintColor() {
  if (!state.colorChannels.size) return;
  previewSelectedPaintColor();
  state.sampledColor = elements.matchedColor.value;
  elements.selected.textContent = copy.colorSelected(state.sampledColor, state.selected.size);
  recordHistory();
}

function moveHistory(delta) {
  const session = current();
  if (!session) return;
  const next = session.historyIndex + delta;
  if (next < 0 || next >= session.history.length) return;
  session.historyIndex = next;
  renderSession();
  publishResults();
}

function resetCurrent() {
  const session = current();
  if (!session || session.historyIndex === 0) return;
  session.history.splice(session.historyIndex + 1);
  session.history.push(session.original);
  session.historyIndex += 1;
  renderSession();
  publishResults();
  showToast(copy.reset);
}

function browserDownload({ name, blob }) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadCurrent() {
  const session = current();
  if (!session) return;
  browserDownload(outputFile(session));
  showToast(copy.saved);
}

async function downloadAll() {
  if (!state.sessions.length) return;
  if (state.sessions.length === 1) return downloadCurrent();
  const files = state.sessions.map(outputFile);
  const entries = await Promise.all(files.map(async file => ({ name: file.name, data: new Uint8Array(await file.blob.arrayBuffer()) })));
  browserDownload({ name: "shiagent-svg-styled.zip", blob: createZipBlob(entries, undefined, { applySuffix: false }) });
}

function renderView() {
  elements.stage.style.transform = `translate(-50%, -50%) translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  elements.zoomReset.textContent = `${Math.round((state.zoom / state.baseZoom) * 100)}%`;
}

function setZoom(value, anchor = null) {
  const previous = state.zoom;
  const next = Math.min(8, Math.max(.02, value));
  if (anchor && next !== previous) {
    const rect = elements.canvas.getBoundingClientRect();
    const offsetX = anchor.clientX - (rect.left + rect.width / 2);
    const offsetY = anchor.clientY - (rect.top + rect.height / 2);
    const ratio = next / previous;
    state.panX = offsetX - (offsetX - state.panX) * ratio;
    state.panY = offsetY - (offsetY - state.panY) * ratio;
  }
  state.zoom = next;
  renderView();
}

function resetView() {
  state.panX = state.basePanX;
  state.panY = state.basePanY;
  state.zoom = state.baseZoom;
  renderView();
}

function fitViewToContent(expectedRoot) {
  if (!state.root || state.root !== expectedRoot) {
    elements.canvas.classList.remove("is-fitting");
    return;
  }
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  renderView();
  const boxes = editableElements(state.root)
    .map(target => target.getBoundingClientRect())
    .filter(box => Number.isFinite(box.left) && Number.isFinite(box.top) && (box.width > 0 || box.height > 0));
  if (!boxes.length) {
    state.baseZoom = 1;
    state.basePanX = 0;
    state.basePanY = 0;
    resetView();
    elements.canvas.classList.remove("is-fitting");
    return;
  }
  const content = {
    left: Math.min(...boxes.map(box => box.left)), right: Math.max(...boxes.map(box => box.right)),
    top: Math.min(...boxes.map(box => box.top)), bottom: Math.max(...boxes.map(box => box.bottom))
  };
  const canvas = elements.canvas.getBoundingClientRect();
  const contentWidth = Math.max(1, content.right - content.left);
  const contentHeight = Math.max(1, content.bottom - content.top);
  const availableWidth = Math.max(1, canvas.width - 96);
  const availableHeight = Math.max(1, canvas.height - 96);
  const fittedZoom = Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight);
  const canvasCenterX = canvas.left + canvas.width / 2;
  const canvasCenterY = canvas.top + canvas.height / 2;
  const contentCenterX = (content.left + content.right) / 2;
  const contentCenterY = (content.top + content.bottom) / 2;
  state.baseZoom = Math.max(.02, fittedZoom);
  state.basePanX = -(contentCenterX - canvasCenterX) * state.baseZoom;
  state.basePanY = -(contentCenterY - canvasCenterY) * state.baseZoom;
  resetView();
  requestAnimationFrame(() => elements.canvas.classList.remove("is-fitting"));
}

function scheduleFitView() {
  const expectedRoot = state.root;
  elements.canvas.classList.add("is-fitting");
  state.baseZoom = 1;
  state.basePanX = 0;
  state.basePanY = 0;
  resetView();
  requestAnimationFrame(() => requestAnimationFrame(() => fitViewToContent(expectedRoot)));
}

function drawableTarget(event) {
  const target = event.target.closest?.(DRAWABLE_SELECTOR);
  return target && state.root?.contains(target) && !target.closest("defs,clipPath,mask,marker,pattern,symbol") ? target : null;
}

function sampledPaintAtPoint(target, event) {
  const fill = elementPaint(target, "fill");
  const stroke = elementPaint(target, "stroke");
  try {
    const matrix = target.getScreenCTM?.();
    if (matrix && typeof DOMPoint !== "undefined") {
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      if (stroke && target.isPointInStroke?.(point)) return stroke;
      if (fill && target.isPointInFill?.(point)) return fill;
    }
  } catch (error) {
    console.debug("Paint hit testing fell back to computed color.", error);
  }
  return fill || stroke;
}

elements.select.addEventListener("click", () => elements.input.click());
elements.input.addEventListener("change", () => addFiles(elements.input.files));
elements.stage.addEventListener("click", event => {
  if (state.suppressClick) return;
  const target = drawableTarget(event);
  if (target && state.selectionMode === "color") selectColor(sampledPaintAtPoint(target, event));
  else if (target) selectElement(target, event.ctrlKey || event.metaKey || event.shiftKey);
  else selectElement(null);
});
elements.objectSelectMode.addEventListener("click", () => setSelectionMode("object"));
elements.colorSelectMode.addEventListener("click", () => setSelectionMode("color"));
elements.selectBlack.addEventListener("click", () => selectColor("#000000"));
elements.selectWhite.addEventListener("click", () => selectColor("#ffffff"));
elements.matchedColor.addEventListener("input", previewSelectedPaintColor);
elements.matchedColor.addEventListener("change", commitSelectedPaintColor);
elements.fill.addEventListener("input", () => { elements.fillNone.checked = false; previewSelected(); });
elements.stroke.addEventListener("input", () => { elements.strokeNone.checked = false; previewSelected(); });
for (const control of [elements.fill, elements.fillNone, elements.stroke, elements.strokeNone, elements.strokeWidthNumber, elements.opacity]) control.addEventListener("change", applySelected);
elements.strokeWidth.addEventListener("input", () => { elements.strokeWidthNumber.value = elements.strokeWidth.value; previewSelected(); });
elements.strokeWidth.addEventListener("change", applySelected);
elements.strokeWidthNumber.addEventListener("input", () => { elements.strokeWidth.value = String(Math.min(20, Number(elements.strokeWidthNumber.value) || 0)); previewSelected(); });
elements.opacity.addEventListener("input", () => { elements.opacityOutput.value = `${Math.round(Number(elements.opacity.value) * 100)}%`; previewSelected(); });
elements.applyAll.addEventListener("click", selectAll);
elements.undo.addEventListener("click", () => moveHistory(-1));
elements.redo.addEventListener("click", () => moveHistory(1));
elements.reset.addEventListener("click", resetCurrent);
elements.previous.addEventListener("click", () => {
  if (state.completed && state.sessions.length) { state.completed = false; state.index = state.sessions.length - 1; renderSession(); }
  else if (state.index > 0) { state.index -= 1; renderSession(); }
});
elements.next.addEventListener("click", () => {
  if (!state.sessions.length) return;
  if (state.completed) { state.completed = false; state.index = 0; renderSession(); }
  else if (state.index < state.sessions.length - 1) { state.index += 1; renderSession(); }
  else { state.completed = true; renderSession(); }
});
elements.clearAll.addEventListener("click", clearAll);
elements.download.addEventListener("click", downloadCurrent);
elements.downloadAll.addEventListener("click", downloadAll);
elements.zoomOut.addEventListener("click", () => setZoom(state.zoom / 1.25));
elements.zoomReset.addEventListener("click", resetView);
elements.zoomIn.addEventListener("click", () => setZoom(state.zoom * 1.25));
elements.canvas.addEventListener("wheel", event => {
  if (!event.ctrlKey || !state.root) return;
  event.preventDefault();
  setZoom(state.zoom * Math.exp(-event.deltaY * .002), event);
}, { passive: false });
elements.canvas.addEventListener("pointerdown", event => {
  if (!state.root) return;
  const pan = event.button === 1;
  const marquee = event.button === 0 && state.selectionMode === "object" && !drawableTarget(event);
  if (!pan && !marquee) return;
  event.preventDefault();
  state.drag = {
    mode: pan ? "pan" : "select", id: event.pointerId, x: event.clientX, y: event.clientY,
    panX: state.panX, panY: state.panY, moved: false,
    additive: event.ctrlKey || event.metaKey || event.shiftKey
  };
  elements.canvas.setPointerCapture(event.pointerId);
  if (pan) elements.canvas.classList.add("is-panning");
  else {
    const canvasRect = elements.canvas.getBoundingClientRect();
    elements.selectionBox.hidden = false;
    elements.selectionBox.style.cssText = `left:${event.clientX - canvasRect.left}px;top:${event.clientY - canvasRect.top}px;width:0;height:0`;
  }
});
elements.canvas.addEventListener("pointermove", event => {
  if (!state.drag || state.drag.id !== event.pointerId) return;
  const dx = event.clientX - state.drag.x;
  const dy = event.clientY - state.drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) state.drag.moved = true;
  if (state.drag.mode === "pan") {
    state.panX = state.drag.panX + dx;
    state.panY = state.drag.panY + dy;
    renderView();
  } else {
    const canvasRect = elements.canvas.getBoundingClientRect();
    elements.selectionBox.style.left = `${Math.min(state.drag.x, event.clientX) - canvasRect.left}px`;
    elements.selectionBox.style.top = `${Math.min(state.drag.y, event.clientY) - canvasRect.top}px`;
    elements.selectionBox.style.width = `${Math.abs(dx)}px`;
    elements.selectionBox.style.height = `${Math.abs(dy)}px`;
  }
});
function finishPointer(event) {
  if (!state.drag || state.drag.id !== event.pointerId) return;
  if (state.drag.mode === "select" && event.type !== "pointercancel") {
    if (state.drag.moved) {
      const area = {
        left: Math.min(state.drag.x, event.clientX), right: Math.max(state.drag.x, event.clientX),
        top: Math.min(state.drag.y, event.clientY), bottom: Math.max(state.drag.y, event.clientY)
      };
      const targets = editableElements(state.root).filter(target => {
        const box = target.getBoundingClientRect();
        return box.right >= area.left && box.left <= area.right && box.bottom >= area.top && box.top <= area.bottom;
      });
      replaceSelection(targets, state.drag.additive);
    } else if (!state.drag.additive) replaceSelection([]);
    elements.selectionBox.hidden = true;
    state.suppressClick = true;
    window.setTimeout(() => { state.suppressClick = false; }, 0);
  }
  elements.selectionBox.hidden = true;
  state.drag = null;
  elements.canvas.classList.remove("is-panning");
  if (elements.canvas.hasPointerCapture(event.pointerId)) elements.canvas.releasePointerCapture(event.pointerId);
}
elements.canvas.addEventListener("pointerup", finishPointer);
elements.canvas.addEventListener("pointercancel", finishPointer);
elements.canvas.addEventListener("auxclick", event => { if (event.button === 1) event.preventDefault(); });
elements.workspace.addEventListener("dragover", event => { event.preventDefault(); elements.workspace.classList.add("is-over"); });
elements.workspace.addEventListener("dragleave", () => elements.workspace.classList.remove("is-over"));
elements.workspace.addEventListener("drop", event => { event.preventDefault(); elements.workspace.classList.remove("is-over"); addFiles(event.dataTransfer.files); });
document.addEventListener("keydown", event => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === "a" && state.root && !event.target.closest?.("input,textarea,select,[contenteditable]")) { event.preventDefault(); selectAll(); }
  if (event.key.toLowerCase() === "z") { event.preventDefault(); moveHistory(event.shiftKey ? 1 : -1); }
  if (event.key.toLowerCase() === "y") { event.preventDefault(); moveHistory(1); }
});

setControlsDisabled(true);
elements.stage.setAttribute("role", "img");
elements.stage.setAttribute("aria-label", ja ? "編集中のSVGプレビュー" : "Editable SVG preview");
setSelectionMode("object");
renderSession();

