import { chooseOutputDirectory, clearPreferredOutputStartIn, installSourceFileTracking, preferredOutputStartIn, supportsFolderDownload, writeFilesToDirectory } from "./folder-download.js";
import { applyConfiguredOutputSuffix } from "./output-name.js";
import { chooseDriveFolder, driveConfigured, preloadDrive, uploadFilesToDrive } from "./google-drive.js";

const BATCH_FILES = Symbol.for("shiagent.outputFiles");
const objectUrls = new Map();
let installed = false;
let direct = false;
let directory = null;
// Drive folder chosen for the next batch of outputs (undefined = not saving to Drive).
let driveFolder;
let control = null;
let latestFiles = [];

const ja = () => document.documentElement.lang === "ja";

function revealControl() {
  if (!control) return;
  if (!control.classList.contains("editor-direct-save")) {
    const suffix = document.querySelector(".download-row [data-output-name-control]");
    const row = suffix?.closest(".download-row") || document.querySelector(".download-row");
    if (row) {
      if (suffix) {
        if (control.parentElement !== row || control.nextElementSibling !== suffix) row.insertBefore(control, suffix);
      } else {
        const note = row.querySelector(":scope > p");
        if (control.parentElement !== row || control.nextElementSibling !== note) row.insertBefore(control, note);
      }
      control.classList.add("is-download-row-control");
    } else {
      const download = document.querySelector("#downloadAllButton, #downloadButton, #pdfExport, #pdfOrderDownloadAll");
      if (suffix) {
        if (control.nextElementSibling !== suffix) suffix.parentElement.insertBefore(control, suffix);
      } else if (download && control.previousElementSibling !== download) download.insertAdjacentElement("afterend", control);
    }
  }
  control.hidden = false;
}

function updateControl(message = "") {
  if (!control) return;
  const button = control.querySelector("#outputFolderButton");
  const status = control.querySelector("small");
  button.disabled = !supportsFolderDownload(window);
  status.textContent = message || (supportsFolderDownload(window)
    ? ""
    : (ja() ? "Chrome／Edgeで利用できます" : "Available in Chrome / Edge"));
}

export function directSaveEnabled() { return direct && Boolean(directory); }

export async function selectDirectOutputDirectory() {
  if (!supportsFolderDownload(window)) return null;
  try {
    const selected = await chooseOutputDirectory(window, preferredOutputStartIn() || "downloads");
    directory = selected;
    direct = true;
    clearPreferredOutputStartIn();
    return selected;
  } catch (error) {
    if (error?.name !== "AbortError") console.error(error);
    direct = false;
    updateControl();
    return null;
  }
}

async function saveDirect(files) {
  if (!directory || !files.length) return;
  updateControl(ja() ? `保存中… 0/${files.length}` : `Saving… 0/${files.length}`);
  try {
    const count = await writeFilesToDirectory(directory, files, (done, total) => {
      updateControl(ja() ? `保存中… ${done}/${total}` : `Saving… ${done}/${total}`);
    });
    updateControl(ja() ? `${count}件を保存しました` : `Saved ${count} file${count === 1 ? "" : "s"}`);
  } catch (error) {
    console.error(error);
    updateControl(ja() ? "直接保存に失敗しました" : "Direct save failed");
  }
}

function outputItems(files) {
  return [...(files || [])].map(file => ({ name: file?.name, blob: file?.blob || file })).filter(file => file.name && file.blob);
}

async function saveToDrive(files) {
  const folder = driveFolder;
  driveFolder = undefined;
  if (!files.length) return;
  updateControl(ja() ? `Google Driveへ保存中… 0/${files.length}` : `Saving to Google Drive… 0/${files.length}`);
  try {
    const count = await uploadFilesToDrive(folder, files, (done, total) => {
      updateControl(ja() ? `Google Driveへ保存中… ${done}/${total}` : `Saving to Google Drive… ${done}/${total}`);
    });
    updateControl(ja() ? `${count}件をGoogle Driveに保存しました` : `Saved ${count} file${count === 1 ? "" : "s"} to Google Drive`);
  } catch (error) {
    console.error(error);
    updateControl(ja() ? "Google Driveに保存できませんでした" : "Could not save to Google Drive");
  }
}

// Without collected outputs, the tool's own "download all" runs and its
// download is captured by patchDownloads() instead of reaching the browser.
function requestOutputs(cancel) {
  const download = document.querySelector("#downloadAllButton, #downloadButton, #pdfExport, #pdfOrderDownloadAll");
  if (!download || download.disabled) {
    cancel();
    updateControl(ja() ? "保存できる結果がありません" : "No results are ready to save");
    return;
  }
  download.click();
}

async function saveAllDirectly() {
  if (!await selectDirectOutputDirectory()) return;
  if (latestFiles.length) {
    const files = latestFiles;
    direct = false;
    await saveDirect(files);
    return;
  }
  requestOutputs(() => { direct = false; });
}

async function saveAllToDrive() {
  let folder;
  try {
    folder = await chooseDriveFolder({ title: ja() ? "保存先のフォルダ" : "Save to folder" });
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      updateControl(ja() ? "Google Driveに接続できませんでした" : "Could not connect to Google Drive");
    }
    return;
  }
  if (!folder) return;
  driveFolder = folder;
  if (latestFiles.length) {
    await saveToDrive(latestFiles);
    return;
  }
  requestOutputs(() => { driveFolder = undefined; });
}

function filesForDownload(anchor, blob) {
  const batch = blob?.[BATCH_FILES];
  if (Array.isArray(batch) && batch.length) return batch.map(item => ({ name: item.name, blob: item.blob }));
  if (!blob || !anchor.download) return [];
  return [{ name: applyConfiguredOutputSuffix(anchor.download), blob }];
}

function patchObjectUrls() {
  if (URL.__shiagentOutputSave) return;
  const create = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  Object.defineProperty(URL, "__shiagentOutputSave", { value: true });
  URL.createObjectURL = object => {
    const url = create(object);
    if (object instanceof Blob) objectUrls.set(url, object);
    return url;
  };
  URL.revokeObjectURL = url => { objectUrls.delete(String(url)); return revoke(url); };
}

function patchDownloads() {
  const prototype = globalThis.HTMLAnchorElement?.prototype;
  if (!prototype || prototype.__shiagentDirectSave) return;
  const click = prototype.click;
  Object.defineProperty(prototype, "__shiagentDirectSave", { value: true });
  prototype.click = function patchedDirectSaveClick() {
    const blob = objectUrls.get(this.href);
    const files = filesForDownload(this, blob);
    if (driveFolder !== undefined && files.length) {
      void saveToDrive(files);
      return;
    }
    if (directSaveEnabled() && files.length) {
      direct = false;
      void saveDirect(files);
      return;
    }
    return click.call(this);
  };
}

function mountControl() {
  if (document.querySelector("[data-output-save-control]")) return true;
  const suffix = document.querySelector(".editor-save-option, .output-suffix-setting");
  const target = suffix || document.querySelector(".settings-panel, .pdf-workspace, .pdf-order-workspace, .compressor-card, .workflow-card, .custom-builder-card");
  if (!target) return false;
  control = document.createElement("div");
  control.className = suffix?.classList.contains("editor-save-option") ? "editor-direct-save" : "output-save-setting";
  control.dataset.outputSaveControl = "";
  control.hidden = true;
  const supported = supportsFolderDownload(window);
  const drive = driveConfigured() ? `<button class="button button-light" id="outputDriveButton" type="button">${ja() ? "Google Driveに保存" : "Save to Google Drive"}</button>` : "";
  control.innerHTML = `<button class="button button-light" id="outputFolderButton" type="button" ${supported ? "" : "disabled"}>${ja() ? "フォルダにすべて直接保存" : "Save all directly to folder"}</button>${drive}<small></small>`;
  if (suffix) suffix.insertAdjacentElement("afterend", control);
  else target.append(control);
  document.querySelectorAll(".folder-download-button, #pdfFolderExport, #pdfOrderFolder").forEach(button => button.remove());
  control.querySelector("#outputFolderButton").addEventListener("click", saveAllDirectly);
  const driveButton = control.querySelector("#outputDriveButton");
  if (driveButton) {
    const preload = () => { preloadDrive().catch(() => {}); };
    driveButton.addEventListener("pointerenter", preload, { once: true });
    driveButton.addEventListener("focus", preload, { once: true });
    driveButton.addEventListener("click", saveAllToDrive);
  }
  updateControl();
  return true;
}

export function installOutputSaving() {
  if (installed) return;
  installed = true;
  installSourceFileTracking(window, document);
  patchObjectUrls();
  patchDownloads();
  for (const type of ["shiagent:outputs", "shiagent:output-options-ready"]) {
    document.addEventListener(type, revealControl);
  }
  document.addEventListener("shiagent:outputs", event => { latestFiles = outputItems(event.detail?.files); });
  const mount = () => {
    if (mountControl()) return;
    const observer = new MutationObserver(() => { if (mountControl()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
}

