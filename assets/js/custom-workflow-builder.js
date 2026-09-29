import { TOOL_CATALOG, applyTool, canAppend, moveStep, readCustomWorkflows, toolById, validateWorkflow, writeCustomWorkflows } from "./custom-workflow-core.js";

const root = document.querySelector("#customWorkflowBuilder");
const ja = document.documentElement.lang === "ja";
const labels = ja ? {
  tools: {
    "image-cropper": "画像トリミング", "canvas-padding": "余白追加", "image-resizer": "画像リサイズ", "background-remover": "背景削除・変更", "image-converter": "画像形式変換", "image-compressor": "画像圧縮", "metadata-cleaner": "メタデータ削除", "image-joiner": "画像結合", "image-splitter": "画像分割", "color-tool": "色置換", "favicon-generator": "Favicon生成", "image-to-svg": "画像 → SVG", "svg-white-fill": "SVG自動白塗り", "svg-white-fill-editor": "SVG手動白塗り", "svg-cleaner": "SVGクリーナー", "svg-to-image": "SVG → 画像", "pdf-merge": "PDF結合", "pdf-split": "PDF分割", "pdf-reorder": "PDF並べ替え", "pdf-interleave": "PDF交互結合", "pdf-rotate": "PDF回転", "pdf-delete-pages": "PDFページ削除", "images-to-pdf": "画像 → PDF", "batch-rename": "一括リネーム"
  },
  categories: { image: "IMAGE", vector: "VECTOR", pdf: "PDF", file: "FILE" }, empty: "左のツールを追加すると、ここに工程が並びます。", chooseInput: "最初に入れるファイルを選択すると、追加できるツールが表示されます。", add: "追加", unavailable: "前の工程の出力形式には対応していません", remove: "削除", up: "上へ", down: "下へ", saved: "ブラウザに保存しました。", completed: "ワークフローが完了しました。", cleared: "編集中の工程をすべてクリアしました。", clear: "すべてクリア", confirmClear: "編集中の工程をすべてクリアしますか？", needSteps: "ツールを1つ以上追加してください。", invalid: "この位置では前後の形式がつながりません。", storageError: "ブラウザに保存できませんでした。", noSaved: "保存したワークフローはまだありません。", edit: "編集", start: "開始", delete: "削除", defaultName: "名称未設定のワークフロー", output: "出力", confirmDelete: "このワークフローを削除しますか？"
} : {
  tools: {
    "image-cropper": "Image Cropper", "canvas-padding": "Canvas Padding", "image-resizer": "Image Resizer", "background-remover": "Background Remover", "image-converter": "Image Converter", "image-compressor": "Image Compressor", "metadata-cleaner": "EXIF Cleaner", "image-joiner": "Image Joiner", "image-splitter": "Image Splitter", "color-tool": "Replace Color", "favicon-generator": "Favicon Generator", "image-to-svg": "Image to SVG", "svg-white-fill": "Automatic SVG White Fill", "svg-white-fill-editor": "Manual SVG White Fill", "svg-cleaner": "SVG Cleaner", "svg-to-image": "SVG to Image", "pdf-merge": "Merge PDF", "pdf-split": "Split PDF", "pdf-reorder": "Reorder PDF", "pdf-interleave": "Interleave PDFs", "pdf-rotate": "Rotate PDF", "pdf-delete-pages": "Delete PDF Pages", "images-to-pdf": "Images to PDF", "batch-rename": "Batch Rename"
  },
  categories: { image: "IMAGE", vector: "VECTOR", pdf: "PDF", file: "FILE" }, empty: "Add a tool from the left to build your workflow.", chooseInput: "Choose a starting file type to see the tools you can add.", add: "Add", unavailable: "This tool cannot accept the previous step's output", remove: "Remove", up: "Move up", down: "Move down", saved: "Saved in this browser.", completed: "Workflow complete.", cleared: "All current steps were cleared.", clear: "Clear all", confirmClear: "Clear all current steps?", needSteps: "Add at least one tool.", invalid: "The file formats do not connect in that order.", storageError: "Could not save in this browser.", noSaved: "No saved workflows yet.", edit: "Edit", start: "Start", delete: "Delete", defaultName: "Untitled workflow", output: "Output", confirmDelete: "Delete this workflow?"
};

let state = { id: null, name: "", inputType: "", steps: [] };
let draggedIndex = -1;
let activeCategory = "image";
const els = Object.fromEntries([...root.querySelectorAll("[id]")].map(element => [element.id, element]));

function uid() { return globalThis.crypto?.randomUUID?.() || `workflow-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function formatTypes(types) { return types.map(type => type === "jpeg" ? "JPEG" : type.toUpperCase()).join(" / "); }
function status(message, error = false) { els.builderStatus.textContent = message; els.builderStatus.classList.toggle("is-error", error); }

function renderPalette() {
  if (!state.inputType) {
    els.toolPalette.innerHTML = `<p class="builder-palette-empty">${labels.chooseInput}</p>`;
    return;
  }
  const tabs = Object.keys(labels.categories).map(category => `<button type="button" role="tab" data-tool-tab="${category}" aria-selected="${category === activeCategory}" tabindex="${category === activeCategory ? 0 : -1}">${labels.categories[category]}</button>`).join("");
  const tools = TOOL_CATALOG.filter(tool => tool.category === activeCategory).map(tool => {
    const enabled = canAppend(state.inputType, state.steps, tool.id);
    return `<button type="button" data-add="${tool.id}" ${enabled ? "" : "disabled"} title="${enabled ? labels.add : labels.unavailable}"><span>${escapeHtml(labels.tools[tool.id])}</span><b>${enabled ? "+" : "—"}</b></button>`;
  }).join("");
  els.toolPalette.innerHTML = `<div class="builder-tool-tabs" role="tablist" aria-label="Tools">${tabs}</div><section class="builder-tool-group" role="tabpanel"><div>${tools}</div></section>`;
}

function outputAt(index) {
  let types = validateWorkflow(state.inputType, []).types;
  for (let i = 0; i <= index; i += 1) types = applyTool(types, state.steps[i]) || [];
  return types;
}

function renderSteps() {
  els.workflowSteps.classList.toggle("is-empty", !state.steps.length);
  els.workflowSteps.innerHTML = state.steps.length ? state.steps.map((id, index) => {
    const tool = toolById(id);
    return `<article class="builder-step" draggable="true" data-index="${index}"><span class="builder-handle" aria-hidden="true">⋮⋮</span><em>${String(index + 1).padStart(2, "0")}</em><div><strong>${escapeHtml(labels.tools[id])}</strong><small>${labels.output}: ${formatTypes(outputAt(index))}</small></div><div class="builder-step-actions"><button type="button" data-move="up" aria-label="${labels.up}" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move="down" aria-label="${labels.down}" ${index === state.steps.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-remove aria-label="${labels.remove}">×</button></div><span class="builder-kind">${labels.categories[tool.category]}</span></article>`;
  }).join("") : `<p class="builder-empty">${labels.empty}</p>`;
  els.saveWorkflowTop.disabled = !state.steps.length;
  els.saveWorkflowBottom.disabled = !state.steps.length;
  els.runWorkflow.disabled = !state.steps.length;
  els.clearWorkflow.disabled = !state.steps.length;
  renderPalette();
}

function renderSaved() {
  const workflows = readCustomWorkflows();
  els.savedWorkflows.innerHTML = workflows.length ? workflows.map(item => `<article><div><span>${item.steps.length} STEPS</span><h3>${escapeHtml(item.name || labels.defaultName)}</h3><p>${item.steps.map(id => labels.tools[id] || id).join(" → ")}</p></div><div><button type="button" data-edit="${item.id}">${labels.edit}</button><button type="button" class="button button-dark" data-start="${item.id}">${labels.start} →</button><button type="button" data-delete="${item.id}" aria-label="${labels.delete}">×</button></div></article>`).join("") : `<p class="builder-no-saved">${labels.noSaved}</p>`;
}

function reset() { state = { id: null, name: "", inputType: "", steps: [] }; els.workflowName.value = ""; els.inputType.value = ""; status(""); renderSteps(); }
function save() {
  if (!state.steps.length) return status(labels.needSteps, true);
  const now = new Date().toISOString();
  const workflows = readCustomWorkflows();
  const old = workflows.find(item => item.id === state.id);
  const item = { id: state.id || uid(), name: els.workflowName.value.trim() || labels.defaultName, inputType: state.inputType, steps: [...state.steps], version: 1, createdAt: old?.createdAt || now, updatedAt: now };
  const next = workflows.filter(entry => entry.id !== item.id); next.unshift(item);
  try { writeCustomWorkflows(next); state.id = item.id; state.name = item.name; status(labels.saved); renderSaved(); return item; }
  catch { status(labels.storageError, true); return null; }
}
function load(id) {
  const item = readCustomWorkflows().find(entry => entry.id === id); if (!item) return;
  state = { id: item.id, name: item.name, inputType: item.inputType, steps: [...item.steps] };
  els.workflowName.value = item.name; els.inputType.value = item.inputType; status(""); renderSteps(); root.scrollIntoView({ behavior: "smooth" });
}
function start(item = save()) {
  if (!item) return;
  const first = toolById(item.steps[0]);
  const prefix = ja ? "/ja" : "";
  location.href = `${prefix}${first.path}?customWorkflow=${encodeURIComponent(item.id)}&step=0`;
}

els.toolPalette.addEventListener("click", event => { const button = event.target.closest("[data-add]"); if (!button || button.disabled) return; state.steps.push(button.dataset.add); status(""); renderSteps(); });
els.toolPalette.addEventListener("click", event => { const tab = event.target.closest("[data-tool-tab]"); if (!tab) return; activeCategory = tab.dataset.toolTab; renderPalette(); });
els.toolPalette.addEventListener("keydown", event => {
  const tabs = [...els.toolPalette.querySelectorAll("[data-tool-tab]")];
  const index = tabs.indexOf(document.activeElement);
  if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const target = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  activeCategory = tabs[target].dataset.toolTab; renderPalette(); els.toolPalette.querySelector(`[data-tool-tab="${activeCategory}"]`).focus();
});
els.workflowSteps.addEventListener("click", event => {
  const card = event.target.closest("[data-index]"); if (!card) return; const index = Number(card.dataset.index);
  if (event.target.closest("[data-remove]")) { state.steps.splice(index, 1); status(""); renderSteps(); return; }
  const direction = event.target.closest("[data-move]")?.dataset.move; if (!direction) return;
  const next = moveStep(state.inputType, state.steps, index, index + (direction === "up" ? -1 : 1));
  if (!next) return status(labels.invalid, true); state.steps = next; status(""); renderSteps();
});
els.workflowSteps.addEventListener("dragstart", event => { draggedIndex = Number(event.target.closest("[data-index]")?.dataset.index); event.dataTransfer.effectAllowed = "move"; });
els.workflowSteps.addEventListener("dragover", event => { if (event.target.closest("[data-index]")) event.preventDefault(); });
els.workflowSteps.addEventListener("drop", event => { event.preventDefault(); const target = Number(event.target.closest("[data-index]")?.dataset.index); const next = moveStep(state.inputType, state.steps, draggedIndex, target); if (!next) return status(labels.invalid, true); state.steps = next; status(""); renderSteps(); });
els.inputType.addEventListener("change", () => { const previous = state.inputType; state.inputType = els.inputType.value; if (!validateWorkflow(state.inputType, state.steps).valid) { state.inputType = previous; els.inputType.value = previous; status(labels.invalid, true); } renderSteps(); });
els.newWorkflow.addEventListener("click", reset);
els.clearWorkflow.addEventListener("click", () => { if (state.steps.length && confirm(labels.confirmClear)) { state.steps = []; status(labels.cleared); renderSteps(); } });
[els.saveWorkflowTop, els.saveWorkflowBottom].forEach(button => button.addEventListener("click", save));
els.runWorkflow.addEventListener("click", () => start());
els.savedWorkflows.addEventListener("click", event => {
  const edit = event.target.closest("[data-edit]"); if (edit) return load(edit.dataset.edit);
  const run = event.target.closest("[data-start]"); if (run) return start(readCustomWorkflows().find(item => item.id === run.dataset.start));
  const remove = event.target.closest("[data-delete]"); if (!remove || !confirm(labels.confirmDelete)) return;
  writeCustomWorkflows(readCustomWorkflows().filter(item => item.id !== remove.dataset.delete)); if (state.id === remove.dataset.delete) reset(); renderSaved();
});

const pageParams = new URLSearchParams(location.search);
const editId = pageParams.get("edit");
if (editId) load(editId); else renderSteps();
renderSaved();
if (pageParams.has("completed")) status(labels.completed);
