import { createZip, formatBytes } from "./png-core.js";
import { createRenamedFiles } from "./batch-rename-core.js";
import { replaceTray } from "./work-tray.js";

const $ = selector => document.querySelector(selector);
const elements = {
  dropZone: $("#dropZone"), fileInput: $("#fileInput"), selectButton: $("#selectButton"), addButton: $("#addButton"),
  queuePanel: $("#queuePanel"), fileCount: $("#fileCount"), fileList: $("#fileList"), removeAllButton: $("#removeAllButton"),
  prefix: $("#prefixInput"), base: $("#baseInput"), start: $("#startInput"), digits: $("#digitsInput"), suffix: $("#suffixInput"), separator: $("#separatorInput"),
  resetButton: $("#resetButton"), applyButton: $("#applyButton"), statusText: $("#statusText"), resultsPanel: $("#resultsPanel"),
  resultStatus: $("#resultStatus"), resultCount: $("#resultCount"), resultSize: $("#resultSize"), downloadButton: $("#downloadButton"),
  toSplitterButton: $("#toSplitterButton"), toSvgButton: $("#toSvgButton"), handoffNote: $("#handoffNote"), toast: $("#toast")
};
const state = { files: [], renamed: [] };
const allowed = file => /image\/(png|jpeg|svg\+xml)/.test(file.type) || /\.(png|jpe?g|svg)$/i.test(file.name);

function options() { return { prefix: elements.prefix.value, base: elements.base.value, start: elements.start.value, digits: elements.digits.value, suffix: elements.suffix.value, separator: elements.separator.value }; }
function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add("show"); setTimeout(() => elements.toast.classList.remove("show"), 2600); }
function previews() { try { return createRenamedFiles(state.files, options()); } catch { return []; } }
function resetResult() { state.renamed = []; elements.resultsPanel.hidden = true; elements.statusText.textContent = ""; }

function render() {
  elements.queuePanel.hidden = state.files.length === 0;
  elements.fileCount.textContent = `${state.files.length}件`;
  elements.fileList.replaceChildren();
  const targets = previews();
  state.files.forEach((file, index) => {
    const row = document.createElement("div"); row.className = "rename-row";
    const order = document.createElement("span"); order.className = "rename-order"; order.textContent = String(index + 1).padStart(2, "0");
    const before = document.createElement("div"); before.className = "rename-name"; before.innerHTML = `<small>変更前</small><strong></strong>`; before.querySelector("strong").textContent = file.name;
    const arrow = document.createElement("span"); arrow.className = "rename-arrow"; arrow.textContent = "→";
    const after = document.createElement("div"); after.className = "rename-name after"; after.innerHTML = `<small>変更後</small><strong></strong>`; after.querySelector("strong").textContent = targets[index]?.name || "—";
    const size = document.createElement("span"); size.className = "rename-size"; size.textContent = formatBytes(file.size);
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "icon-button"; remove.textContent = "×"; remove.setAttribute("aria-label", `${file.name}を削除`);
    remove.addEventListener("click", () => { state.files.splice(index, 1); resetResult(); render(); });
    row.append(order, before, arrow, after, size, remove); elements.fileList.append(row);
  });
}

function addFiles(fileList) {
  const incoming = [...fileList].filter(allowed);
  if (!incoming.length) return showToast("PNG、JPG、SVGを選択してください。");
  const keys = new Set(state.files.map(file => `${file.name}:${file.size}:${file.lastModified}`));
  incoming.forEach(file => { const key = `${file.name}:${file.size}:${file.lastModified}`; if (!keys.has(key)) { state.files.push(file); keys.add(key); } });
  elements.fileInput.value = ""; resetResult(); render();
}

function applyRename() {
  try {
    state.renamed = createRenamedFiles(state.files, options());
    elements.resultsPanel.hidden = false; elements.resultCount.textContent = `${state.renamed.length}件`;
    elements.resultSize.textContent = formatBytes(state.renamed.reduce((sum, file) => sum + file.size, 0));
    elements.resultStatus.textContent = `${state.renamed.length}件のファイル名を確定しました。`;
    const rasterCount = state.renamed.filter(file => /\.(png|jpe?g)$/i.test(file.name)).length;
    const pngCount = state.renamed.filter(file => /\.png$/i.test(file.name)).length;
    elements.toSplitterButton.disabled = rasterCount === 0; elements.toSvgButton.disabled = pngCount === 0;
    elements.handoffNote.textContent = `画像分割へは${rasterCount}件、PNG → SVGへは${pngCount}件を渡せます。`;
    elements.statusText.textContent = "名前を確定しました"; elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: state.renamed, source: "batch-rename-result" } }));
  } catch (error) { showToast(error.message); }
}

async function handoff(target, filter) { const files = state.renamed.filter(filter); await replaceTray(files, "batch-rename"); location.href = `${target}?tray=1`; }
function clearAll() { state.files = []; resetResult(); render(); }

elements.selectButton.addEventListener("click", event => { event.stopPropagation(); elements.fileInput.click(); });
elements.addButton.addEventListener("click", () => elements.fileInput.click()); elements.fileInput.addEventListener("change", () => addFiles(elements.fileInput.files));
elements.dropZone.addEventListener("click", () => elements.fileInput.click()); elements.dropZone.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); elements.fileInput.click(); } });
for (const type of ["dragenter", "dragover"]) elements.dropZone.addEventListener(type, event => { event.preventDefault(); elements.dropZone.classList.add("is-over"); });
for (const type of ["dragleave", "drop"]) elements.dropZone.addEventListener(type, event => { event.preventDefault(); elements.dropZone.classList.remove("is-over"); });
elements.dropZone.addEventListener("drop", event => addFiles(event.dataTransfer.files)); elements.removeAllButton.addEventListener("click", clearAll);
for (const input of [elements.prefix, elements.base, elements.start, elements.digits, elements.suffix, elements.separator]) input.addEventListener("input", () => { resetResult(); render(); });
elements.resetButton.addEventListener("click", () => { elements.prefix.value = ""; elements.base.value = "image"; elements.start.value = "1"; elements.digits.value = "2"; elements.suffix.value = ""; elements.separator.value = "_"; resetResult(); render(); });
elements.applyButton.addEventListener("click", applyRename);
elements.downloadButton.addEventListener("click", async () => { const entries = await Promise.all(state.renamed.map(async file => ({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) }))); const url = URL.createObjectURL(createZip(entries)); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "shiagent-renamed-files.zip"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
elements.toSplitterButton.addEventListener("click", () => handoff("/ja/image-splitter/", file => /\.(png|jpe?g)$/i.test(file.name)));
elements.toSvgButton.addEventListener("click", () => handoff("/ja/png-to-svg/", file => /\.png$/i.test(file.name)));

render();

