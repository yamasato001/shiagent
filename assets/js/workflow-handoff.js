import { clearTray, readTray, replaceTray } from "./work-tray.js";
import "./queue-drop.js";
import { localPath, pick } from "./i18n.js";
import common from "./i18n/common.js";
import { chooseOutputDirectory, supportsFolderDownload, writeFilesToDirectory } from "./folder-download.js";

const copy = pick(common).tray;
if (!document.querySelector('link[data-work-tray-styles]')) {
  const styles = document.createElement("link");
  styles.rel = "stylesheet";
  styles.href = "/assets/css/work-tray.css";
  styles.dataset.workTrayStyles = "";
  document.head.append(styles);
}
const tools = [
  { name: copy.tools.compressor, path: localPath("/image-compressor/"), accepts: file => isPng(file) || isJpeg(file) || isWebp(file) },
  { name: copy.tools.converter, path: localPath("/image-converter/"), accepts: file => isRaster(file) },
  { name: copy.tools.resizer, path: localPath("/image-resizer/"), accepts: file => isRaster(file) },
  { name: copy.tools.cropper, path: localPath("/image-cropper/"), accepts: file => isRaster(file) },
  { name: copy.tools.padding, path: localPath("/canvas-padding/"), accepts: file => isRaster(file) },
  { name: copy.tools.joiner, path: localPath("/image-joiner/"), accepts: file => isRaster(file) },
  { name: copy.tools.metadata, path: localPath("/metadata-cleaner/"), accepts: file => isPng(file) || isJpeg(file) || isWebp(file) },
  { name: copy.tools.vectorizer, path: localPath("/image-to-svg/"), accepts: file => isPng(file) || isJpeg(file) || isWebp(file) },
  { name: copy.tools.rasterizer, path: localPath("/svg-to-image/"), accepts: file => isSvg(file) },
  { name: copy.tools.color, path: localPath("/color-tool/"), accepts: file => isPng(file) || isJpeg(file) || isWebp(file) || isSvg(file) },
  { name: copy.tools.favicon, path: localPath("/favicon-generator/"), accepts: file => isPng(file) || isJpeg(file) || isWebp(file) || isSvg(file) },
  { name: copy.tools.favicon, path: localPath("/favicon-generator/"), accepts: file => isPng(file) || isJpeg(file) || isWebp(file) || isSvg(file) },
  { name: copy.tools.splitter, path: localPath("/image-splitter/"), accepts: file => isPng(file) || isJpeg(file) },
  { name: copy.tools.background, path: localPath("/background-remover/"), accepts: file => isRaster(file) },
  { name: copy.tools.fillEditor, path: localPath("/svg-white-fill/editor/"), accepts: file => isSvg(file) },
  { name: copy.tools.whiteFill, path: localPath("/svg-white-fill/"), accepts: file => isSvg(file) },
  { name: copy.tools.cleaner, path: localPath("/svg-cleaner/"), accepts: file => isSvg(file) },
  { name: copy.tools.rename, path: localPath("/batch-rename/"), accepts: () => true }
];
const currentTool = tools.find(tool => location.pathname.startsWith(tool.path));
let trayFiles = [];
let outputFingerprint = "";
let scanTimer;
let scanning = false;
let latestOutputs = [];

function isPng(file) { return file.type === "image/png" || /\.png$/i.test(file.name); }
function isJpeg(file) { return file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name); }
function isWebp(file) { return file.type === "image/webp" || /\.webp$/i.test(file.name); }
function isSvg(file) { return file.type === "image/svg+xml" || /\.svg$/i.test(file.name); }
function isRaster(file) { return isPng(file) || isJpeg(file) || isWebp(file) || /image\/(?:heic|heif|avif|gif|bmp|tiff)/i.test(file.type) || /\.(?:heic|heif|avif|gif|bmp|tiff?)$/i.test(file.name); }
function supported(file) { return isRaster(file) || isSvg(file); }

function createDock() {
  const dock = document.createElement("aside");
  dock.className = "work-tray";
  dock.id = "workTray";
  dock.innerHTML = `
    <button class="work-tray-toggle" type="button" aria-expanded="false" aria-controls="workTrayPanel">
      <span><small>WORK TRAY</small><strong>${copy.title}</strong></span><b id="workTrayCount">0</b>
    </button>
    <div class="work-tray-panel" id="workTrayPanel" hidden>
      <div class="work-tray-heading"><div class="work-tray-heading-copy"><small>${copy.current}</small><strong id="workTraySummary">${copy.empty}</strong></div><div class="work-tray-heading-actions"><button class="work-tray-clear" type="button" id="workTrayClear">${copy.clear}</button><button class="work-tray-close" type="button" id="workTrayClose" aria-label="${copy.close}">×</button></div></div>
      <div class="work-tray-files" id="workTrayFiles" data-empty-label="${copy.emptyHint}"></div>
      <p>${copy.next}</p>
      <div class="work-tray-tools" id="workTrayTools"></div>
      <small class="work-tray-note">${copy.note}</small>
    </div>`;
  document.body.append(dock);
  const toggle = dock.querySelector(".work-tray-toggle");
  const panel = dock.querySelector(".work-tray-panel");
  const setOpen = open => { panel.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); };
  toggle.addEventListener("click", () => setOpen(panel.hidden));
  dock.querySelector("#workTrayClose").addEventListener("click", () => setOpen(false));
  document.addEventListener("pointerdown", event => {
    if (!panel.hidden && !dock.contains(event.target)) setOpen(false);
  });
  dock.querySelector("#workTrayClear").addEventListener("click", async () => {
    const clearButton = dock.querySelector("#workTrayClear");
    clearButton.disabled = true;

    try {
      const visibleResults = await collectVisibleResults();
      outputFingerprint = visibleResults.map((file) => `${file.name}:${file.size}:${file.type}`).join("|");
      await clearTray();
      trayFiles = [];
      renderDock();
    } catch (error) {
      console.error(copy.clearFailed, error);
      await refreshTray();
    }
  });
  return dock;
}

const dock = createDock();

function renderDock() {
  dock.querySelector("#workTrayCount").textContent = String(trayFiles.length);
  dock.querySelector("#workTraySummary").textContent = trayFiles.length ? copy.holding(trayFiles.length) : copy.empty;
  dock.querySelector("#workTrayClear").disabled = trayFiles.length === 0;
  const fileList = dock.querySelector("#workTrayFiles");
  fileList.replaceChildren();
  trayFiles.slice(0, 4).forEach(file => {
    const item = document.createElement("span");
    item.textContent = file.name;
    item.title = file.name;
    fileList.append(item);
  });
  if (trayFiles.length > 4) {
    const more = document.createElement("span");
    more.textContent = copy.more(trayFiles.length - 4);
    fileList.append(more);
  }
  const toolList = dock.querySelector("#workTrayTools");
  toolList.replaceChildren();
  tools.forEach(tool => {
    const count = trayFiles.filter(tool.accepts).length;
    const link = document.createElement("a");
    link.href = count ? `${tool.path}?tray=1` : tool.path;
    link.className = count ? "" : "is-disabled";
    if (tool === currentTool) link.classList.add("is-current");
    link.setAttribute("aria-disabled", String(!count));
    link.innerHTML = `<span>${tool.name}</span><small>${tool === currentTool ? copy.here : count ? copy.count(count) : copy.none}</small>`;
    if (!count) link.addEventListener("click", event => event.preventDefault());
    toolList.append(link);
  });
}

async function refreshTray() {
  trayFiles = await readTray();
  renderDock();
}

async function storeFiles(files, source) {
  const accepted = [...files].filter(supported);
  if (!accepted.length) return;
  await replaceTray(accepted, source);
  trayFiles = accepted;
  renderDock();
}

function normalizeOutputs(files) {
  return [...(files || [])].map(file => file?.blob ? file : { name: file?.name, blob: file }).filter(file => file.name && file.blob);
}

function showFolderMessage(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function installFolderButtons() {
  if (!supportsFolderDownload(window)) return;
  document.querySelectorAll(".download-row").forEach(row => {
    if (!row.querySelector("#downloadAllButton") || row.querySelector(".folder-download-button")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-light folder-download-button";
    button.textContent = copy.folderSave;
    row.insertBefore(button, row.querySelector("p"));
    button.addEventListener("click", async () => {
      const original = button.textContent;
      try {
        const directory = await chooseOutputDirectory(window);
        const visible = normalizeOutputs(await collectVisibleResults());
        const files = visible.length ? visible : latestOutputs;
        if (!files.length) return;
        button.disabled = true;
        const count = await writeFilesToDirectory(directory, files, (done, total) => { button.textContent = copy.folderSaving(done, total); });
        showFolderMessage(copy.folderSaved(count));
      } catch (error) {
        if (error?.name !== "AbortError") { console.error(error); showFolderMessage(copy.folderFailed); }
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
  });
}

async function importTray() {
  if (new URLSearchParams(location.search).get("tray") !== "1") return;
  const files = (await readTray()).filter(currentTool?.accepts || supported);
  const input = document.querySelector("#fileInput");
  if (input && files.length) {
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const url = new URL(location.href);
  url.searchParams.delete("tray");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

async function collectVisibleResults() {
  const results = document.querySelector("#resultsPanel");
  if (!results || results.hidden) return [];
  if (location.pathname.includes("image-compressor")) {
    return Promise.all([...document.querySelectorAll(".file-row.has-result")].map(async row => {
      const original = row.querySelector(".file-name")?.textContent?.trim() || "image.png";
      const image = row.querySelectorAll(".file-compare img")[1];
      const blob = await (await fetch(image.src)).blob();
      const extension = blob.type === "image/jpeg" ? ".jpg" : blob.type === "image/webp" ? ".webp" : ".png";
      return { name: original.replace(/\.(?:png|jpe?g|webp)$/i, "-compressed") + extension, blob };
    }));
  }
  const selector = location.pathname.includes("image-splitter") ? ".splitter-result-card" : location.pathname.includes("image-to-svg") ? ".vector-result-card" : null;
  if (!selector) return [];
  return Promise.all([...document.querySelectorAll(selector)].map(async card => {
    const images = card.querySelectorAll("img");
    const image = location.pathname.includes("image-splitter") ? images[0] : images[images.length - 1];
    return { name: card.querySelector("strong")?.textContent?.trim(), blob: await (await fetch(image.src)).blob() };
  }));
}

async function scanResults() {
  if (scanning) return;
  scanning = true;
  try {
    const results = (await collectVisibleResults()).filter(result => result.name && result.blob);
    const fingerprint = results.map(result => `${result.name}:${result.blob.size}`).join("|");
    if (results.length && fingerprint !== outputFingerprint) {
      outputFingerprint = fingerprint;
      latestOutputs = normalizeOutputs(results);
      await storeFiles(results, `${currentTool?.name || "tool"}-result`);
    }
  } finally { scanning = false; }
}

document.addEventListener("change", event => {
  if (event.target.matches("#fileInput") && event.target.files?.length) storeFiles(event.target.files, `${currentTool?.name || "tool"}-upload`).catch(console.error);
});
document.addEventListener("shiagent:outputs", event => {
  latestOutputs = normalizeOutputs(event.detail.files);
  storeFiles(event.detail.files, event.detail.source || "tool-result").catch(console.error);
});
new MutationObserver(() => {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => scanResults().catch(console.error), 80);
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "src"] });

refreshTray().then(importTray).catch(console.error);
renderDock();
installFolderButtons();
