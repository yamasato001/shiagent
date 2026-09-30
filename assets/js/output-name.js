import { appendOutputSuffix, sanitizeOutputSuffix } from "./output-name-core.js";

const STORAGE_KEY = "shiagent-output-suffix-v1";
const DEFAULT_STATE = Object.freeze({ enabled: true, suffix: "_edited" });
let installed = false;

function readState() {
  if (typeof window === "undefined") return { enabled: false, suffix: DEFAULT_STATE.suffix };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (stored && typeof stored === "object") return { enabled: stored.enabled !== false, suffix: sanitizeOutputSuffix(stored.suffix) || DEFAULT_STATE.suffix };
  } catch { /* use defaults */ }
  return { ...DEFAULT_STATE };
}

function writeState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private browsing may deny storage */ }
  document.dispatchEvent(new CustomEvent("shiagent:output-name-change", { detail: state }));
}

export function outputSuffixState() { return readState(); }

export function applyConfiguredOutputSuffix(fileName) {
  const state = readState();
  return state.enabled ? appendOutputSuffix(fileName, state.suffix) : fileName;
}

function bindControl(root) {
  const enabled = root.querySelector("#outputSuffixEnabled, #editedSuffixInput");
  let input = root.querySelector("#outputSuffixText");
  const state = readState();
  if (enabled.id === "editedSuffixInput") {
    const caption = enabled.closest("label")?.querySelector("span");
    if (caption) caption.textContent = document.documentElement.lang === "ja" ? "末尾" : "Suffix";
  }
  enabled.checked = state.enabled;
  if (!input) {
    input = document.createElement("input");
    input.id = "outputSuffixText";
    input.className = "output-suffix-text";
    input.type = "text";
    input.maxLength = 40;
    input.spellcheck = false;
    input.setAttribute("aria-label", document.documentElement.lang === "ja" ? "ファイル名の末尾文字" : "File name suffix");
    enabled.closest("label")?.append(input);
  }
  input.value = state.suffix;
  input.disabled = !enabled.checked;
  const save = () => {
    const suffix = sanitizeOutputSuffix(input.value) || DEFAULT_STATE.suffix;
    input.value = suffix;
    input.disabled = !enabled.checked;
    writeState({ enabled: enabled.checked, suffix });
  };
  enabled.addEventListener("change", save);
  input.addEventListener("change", save);
  input.addEventListener("blur", save);
}

function mountControl() {
  const existing = document.querySelector("#editedSuffixInput");
  if (existing) return bindControl(existing.closest(".editor-save-option") || existing.parentElement);
  if (document.querySelector("#outputSuffixEnabled")) return;
  const target = document.querySelector(".settings-panel, .pdf-workspace, .compressor-card, .workflow-card");
  if (!target) return false;
  const ja = document.documentElement.lang === "ja";
  const control = document.createElement("div");
  control.className = "output-suffix-setting";
  control.innerHTML = `<label><input id="outputSuffixEnabled" type="checkbox"><span><b>${ja ? "保存名に末尾文字を付ける" : "Add a suffix to saved names"}</b><small>${ja ? "個別保存・ZIP・フォルダ保存に共通で適用" : "Used for individual, ZIP and folder saves"}</small></span><input id="outputSuffixText" class="output-suffix-text" type="text" maxlength="40" spellcheck="false" aria-label="${ja ? "ファイル名の末尾文字" : "File name suffix"}"></label>`;
  target.append(control);
  bindControl(control);
  return true;
}

function patchBrowserDownloads() {
  const prototype = globalThis.HTMLAnchorElement?.prototype;
  if (!prototype || prototype.__shiagentOutputSuffix) return;
  const click = prototype.click;
  Object.defineProperty(prototype, "__shiagentOutputSuffix", { value: true });
  prototype.click = function patchedClick() {
    if (this.download) this.download = applyConfiguredOutputSuffix(this.download);
    return click.call(this);
  };
}

export function installOutputNaming() {
  if (installed) return;
  installed = true;
  patchBrowserDownloads();
  const mount = () => {
    if (mountControl() !== false) return;
    const observer = new MutationObserver(() => { if (mountControl() !== false) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
}
