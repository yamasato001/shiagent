import { createZip } from "./png-core.js";
import { parsePromptList } from "./line-art-core.js";

const lang = document.documentElement.dataset.pageLang || "ja";
const ja = lang === "ja";
const copy = ja ? {
  supported: "WebGPUを利用できます", unsupported: "このブラウザではWebGPUを利用できません", fp16: "FP16対応", noFp16: "FP16非対応",
  installed: "モデルを取得済み", notInstalled: "モデルはまだ取得されていません", download: "モデルを取得", downloading: "モデル取得中",
  initializing: "モデルをGPUへ読み込んでいます", ready: "生成準備完了", empty: "1行以上のプロンプトを入力してください", generating: "生成中",
  complete: "生成が完了しました", cancelled: "生成を中止しました", error: "処理中にエラーが発生しました", confirmDelete: "端末に保存したAIモデルを削除しますか？",
  retryHint: "再試行できます。解消しない場合は下の詳細を確認してください。",
  queued: "待機中", accept: "採用", accepted: "採用済み", regenerate: "再生成", remove: "削除", save: "PNG保存", downloadAccepted: "採用画像をZIP保存",
  modelProgress: (index, total, mb, all) => `${index}/${total} ファイル · 約 ${mb.toLocaleString()} / ${all.toLocaleString()} MB`, count: n => `${n}件のプロンプト`
} : {
  supported: "WebGPU is available", unsupported: "WebGPU is not available in this browser", fp16: "FP16 available", noFp16: "FP16 unavailable",
  installed: "Model installed", notInstalled: "Model not installed", download: "Download model", downloading: "Downloading model",
  initializing: "Loading model onto the GPU", ready: "Ready to generate", empty: "Enter at least one prompt", generating: "Generating",
  complete: "Generation complete", cancelled: "Generation cancelled", error: "Something went wrong", confirmDelete: "Delete the AI model stored on this device?",
  retryHint: "You can retry. If it fails again, check the details below.",
  queued: "Queued", accept: "Accept", accepted: "Accepted", regenerate: "Regenerate", remove: "Delete", save: "Save PNG", downloadAccepted: "Download accepted as ZIP",
  modelProgress: (index, total, mb, all) => `${index}/${total} files · about ${mb.toLocaleString()} / ${all.toLocaleString()} MB`, count: n => `${n} prompt${n === 1 ? "" : "s"}`
};

const $ = selector => document.querySelector(selector);
const ui = {
  gpuStatus: $("#gpuStatus"), gpuDetail: $("#gpuDetail"), modelState: $("#modelState"), modelProgress: $("#modelProgress"), progressBar: $("#modelProgressBar"),
  downloadModel: $("#downloadModel"), deleteModel: $("#deleteModel"), prompts: $("#prompts"), promptCount: $("#promptCount"), generate: $("#generateButton"), cancel: $("#cancelGeneration"),
  style: $("#styleOptions"), strength: $("#lineStrength"), seed: $("#seed"), results: $("#generationResults"), resultsSection: $("#resultsSection"),
  resultSummary: $("#resultSummary"), downloadAccepted: $("#downloadAccepted"), toast: $("#toast")
};

let worker;
let modelInstalled = false;
let gpuReady = false;
let running = false;
let results = [];
let toastTimer;

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2800);
}

async function checkGpu() {
  if (!("gpu" in navigator)) return { supported: false, fp16: false };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return { supported: Boolean(adapter), fp16: Boolean(adapter?.features.has("shader-f16")) };
  } catch { return { supported: false, fp16: false }; }
}

function updateControls() {
  ui.generate.disabled = !gpuReady || !modelInstalled || running || !parsePromptList(ui.prompts.value).length;
  ui.downloadModel.disabled = !gpuReady || running || modelInstalled;
  ui.deleteModel.disabled = !modelInstalled || running;
  ui.prompts.disabled = running;
  ui.style.disabled = running;
  ui.cancel.hidden = !running;
  ui.generate.hidden = running;
  const promptCount = parsePromptList(ui.prompts.value).length;
  ui.promptCount.textContent = copy.count(promptCount);
}

function ensureWorker() {
  if (!worker) {
    worker = new Worker("/assets/dist/line-art-worker.js", { type: "module" });
    worker.addEventListener("message", handleWorkerMessage);
    worker.addEventListener("error", event => {
      running = false;
      const detail = event.message || "Worker crashed";
      console.error("Line-art worker error", event);
      setModelState(copy.error, "error");
      ui.modelProgress.textContent = detail;
      toast(`${copy.error}: ${detail}`);
      updateControls();
    });
  }
  return worker;
}

function setModelState(text, state = "") {
  ui.modelState.textContent = text;
  ui.modelState.dataset.state = state;
}

function handleWorkerMessage(event) {
  const message = event.data;
  if (message.type === "model-status" || message.type === "model-installed") {
    modelInstalled = message.installed;
    setModelState(modelInstalled ? copy.installed : copy.notInstalled, modelInstalled ? "ok" : "");
    ui.deleteModel.hidden = !modelInstalled;
    ui.downloadModel.textContent = modelInstalled ? copy.installed : copy.download;
    ui.progressBar.style.width = modelInstalled ? "100%" : "0%";
    ui.modelProgress.textContent = modelInstalled ? `2.58 GB · Cache Storage` : "2.58 GB · SD-Turbo ONNX";
    updateControls();
  }
  if (message.type === "model-progress") {
    if (message.phase === "initialize") {
      setModelState(copy.initializing);
      ui.modelProgress.textContent = `${message.index}/${message.total}`;
      ui.progressBar.style.width = `${(message.index / message.total) * 100}%`;
    } else {
      setModelState(copy.downloading);
      ui.modelProgress.textContent = copy.modelProgress(message.index, message.total, message.completedMB, message.totalSizeMB);
      ui.progressBar.style.width = `${(message.completedMB / message.totalSizeMB) * 100}%`;
    }
  }
  if (message.type === "model-ready") { setModelState(copy.ready, "ok"); }
  if (message.type === "generation-progress") {
    const item = results.find(result => result.id === message.id);
    if (item) item.status = "generating";
    renderResults();
  }
  if (message.type === "generation-result") {
    const item = results.find(result => result.id === message.id);
    if (item) {
      if (item.url) URL.revokeObjectURL(item.url);
      item.blob = message.blob;
      item.url = URL.createObjectURL(message.blob);
      item.seed = message.seed;
      item.status = "done";
    }
    renderResults();
  }
  if (message.type === "generation-error") {
    const item = results.find(result => result.id === message.id);
    if (item) { item.status = "error"; item.error = message.message; }
    renderResults();
  }
  if (message.type === "generation-complete") {
    running = false;
    toast(message.cancelled ? copy.cancelled : copy.complete);
    updateControls();
    renderResults();
  }
  if (message.type === "worker-error") {
    running = false;
    setModelState(copy.error, "error");
    ui.modelProgress.textContent = `${message.message} — ${copy.retryHint}`;
    ui.progressBar.style.width = "0%";
    console.error("Line-art worker operation failed", message);
    toast(`${copy.error}: ${message.message}`);
    updateControls();
  }
}

function resultCard(item, index) {
  const image = item.url ? `<img src="${item.url}" alt="${escapeHtml(item.prompt)}">` : `<div class="result-placeholder"><span class="spinner"></span><small>${item.status === "error" ? escapeHtml(item.error || copy.error) : item.status === "generating" ? copy.generating : copy.queued}</small></div>`;
  return `<article class="generation-card" data-id="${item.id}">
    <div class="generation-image">${image}<span class="result-index">${String(index + 1).padStart(2, "0")}</span></div>
    <div class="generation-meta"><p>${escapeHtml(item.prompt)}</p><small>Seed ${item.seed}</small></div>
    ${item.status === "done" ? `<div class="review-actions"><button type="button" data-action="accept" class="${item.accepted ? "is-accepted" : ""}">${item.accepted ? copy.accepted : copy.accept}</button><button type="button" data-action="regenerate">${copy.regenerate}</button><button type="button" data-action="save">${copy.save}</button><button type="button" data-action="delete">${copy.remove}</button></div>` : ""}
  </article>`;
}

function renderResults() {
  ui.resultsSection.hidden = results.length === 0;
  ui.results.innerHTML = results.map(resultCard).join("");
  const done = results.filter(item => item.status === "done").length;
  const accepted = results.filter(item => item.accepted && item.blob).length;
  ui.resultSummary.textContent = `${done} / ${results.length} · ${copy.accepted} ${accepted}`;
  ui.downloadAccepted.disabled = accepted === 0 || running;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

function selectedStyle() { return document.querySelector('input[name="style"]:checked')?.value || "worksheet"; }

function startGeneration(items = null) {
  if (running) return;
  const prompts = items ? null : parsePromptList(ui.prompts.value);
  if (!items && !prompts.length) { toast(copy.empty); return; }
  if (!modelInstalled) { toast(copy.notInstalled); return; }
  if (!items) {
    results.forEach(item => item.url && URL.revokeObjectURL(item.url));
    const baseSeed = Number(ui.seed.value) || Math.floor(Math.random() * 2147483647);
    results = prompts.map((prompt, index) => ({ id: crypto.randomUUID(), prompt, seed: (baseSeed + index * 9973) >>> 0, status: "queued", blob: null, url: null, accepted: false }));
  }
  running = true;
  ui.resultsSection.hidden = false;
  renderResults();
  updateControls();
  ensureWorker().postMessage({ action: "generate", items: items || results.map(({ id, prompt, seed }) => ({ id, prompt, seed })), style: selectedStyle(), strength: Number(ui.strength.value) });
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function saveAccepted() {
  const accepted = results.filter(item => item.accepted && item.blob);
  const zipEntries = [];
  for (let index = 0; index < accepted.length; index += 1) zipEntries.push({ name: `shiagent-line-art-${String(index + 1).padStart(2, "0")}.png`, data: new Uint8Array(await accepted[index].blob.arrayBuffer()) });
  saveBlob(createZip(zipEntries), "shiagent-line-art-accepted.zip");
}

ui.prompts.addEventListener("input", updateControls);
ui.prompts.addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); startGeneration(); } });
ui.downloadModel.addEventListener("click", () => { ensureWorker().postMessage({ action: "download" }); ui.downloadModel.disabled = true; });
ui.deleteModel.addEventListener("click", () => { if (window.confirm(copy.confirmDelete)) ensureWorker().postMessage({ action: "delete-model" }); });
ui.generate.addEventListener("click", () => startGeneration());
ui.cancel.addEventListener("click", () => { ensureWorker().postMessage({ action: "cancel" }); ui.cancel.disabled = true; });
ui.downloadAccepted.addEventListener("click", saveAccepted);
ui.results.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  const card = event.target.closest("[data-id]");
  if (!button || !card) return;
  const item = results.find(result => result.id === card.dataset.id);
  if (!item) return;
  if (button.dataset.action === "accept") item.accepted = !item.accepted;
  if (button.dataset.action === "delete") { if (item.url) URL.revokeObjectURL(item.url); results = results.filter(result => result.id !== item.id); }
  if (button.dataset.action === "save" && item.blob) saveBlob(item.blob, `shiagent-line-art-${item.seed}.png`);
  if (button.dataset.action === "regenerate") { item.status = "queued"; item.accepted = false; item.seed = (item.seed + 1) >>> 0; startGeneration([{ id: item.id, prompt: item.prompt, seed: item.seed }]); }
  renderResults();
});

checkGpu().then(status => {
  gpuReady = status.supported && status.fp16;
  ui.gpuStatus.textContent = status.supported ? copy.supported : copy.unsupported;
  ui.gpuStatus.dataset.state = status.supported ? "ok" : "error";
  ui.gpuDetail.textContent = status.supported ? (status.fp16 ? copy.fp16 : copy.noFp16) : "Chrome / Edge + WebGPU";
  if (gpuReady) ensureWorker().postMessage({ action: "status" });
  updateControls();
});
window.addEventListener("beforeunload", () => results.forEach(item => item.url && URL.revokeObjectURL(item.url)));
updateControls();
