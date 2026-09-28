import { readTray, replaceTray } from "./work-tray.js";

const tools = [
  { name: "PNG圧縮", path: "/ja/png-compressor/", accepts: file => isPng(file) },
  { name: "PNG → SVG", path: "/ja/png-to-svg/", accepts: file => isPng(file) },
  { name: "画像分割", path: "/ja/image-splitter/", accepts: file => isPng(file) || isJpeg(file) },
  { name: "手動SVGフィル", path: "/ja/svg-white-fill/editor/", accepts: file => isSvg(file) },
  { name: "SVG白塗り", path: "/ja/svg-white-fill/", accepts: file => isSvg(file) },
  { name: "SVGクリーナー", path: "/ja/svg-cleaner/", accepts: file => isSvg(file) },
  { name: "一括リネーム", path: "/ja/batch-rename/", accepts: file => isPng(file) || isJpeg(file) || isSvg(file) }
];
const currentTool = tools.find(tool => location.pathname.includes(tool.path));
let trayFiles = [];
let outputFingerprint = "";
let scanTimer;
let scanning = false;

function isPng(file) { return file.type === "image/png" || /\.png$/i.test(file.name); }
function isJpeg(file) { return file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name); }
function isSvg(file) { return file.type === "image/svg+xml" || /\.svg$/i.test(file.name); }
function supported(file) { return isPng(file) || isJpeg(file) || isSvg(file); }

function createDock() {
  const dock = document.createElement("aside");
  dock.className = "work-tray";
  dock.id = "workTray";
  dock.innerHTML = `
    <button class="work-tray-toggle" type="button" aria-expanded="false" aria-controls="workTrayPanel">
      <span><small>WORK TRAY</small><strong>作業トレイ</strong></span><b id="workTrayCount">0</b>
    </button>
    <div class="work-tray-panel" id="workTrayPanel" hidden>
      <div class="work-tray-heading"><div><small>現在のファイル</small><strong id="workTraySummary">ファイルはありません</strong></div><button type="button" id="workTrayClose" aria-label="閉じる">×</button></div>
      <div class="work-tray-files" id="workTrayFiles"></div>
      <p>次のツールへ</p>
      <div class="work-tray-tools" id="workTrayTools"></div>
      <small class="work-tray-note">対応するファイルだけを、ブラウザ内で引き継ぎます。</small>
    </div>`;
  document.body.append(dock);
  const toggle = dock.querySelector(".work-tray-toggle");
  const panel = dock.querySelector(".work-tray-panel");
  const setOpen = open => { panel.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); };
  toggle.addEventListener("click", () => setOpen(panel.hidden));
  dock.querySelector("#workTrayClose").addEventListener("click", () => setOpen(false));
  return dock;
}

const dock = createDock();

function renderDock() {
  dock.querySelector("#workTrayCount").textContent = String(trayFiles.length);
  dock.querySelector("#workTraySummary").textContent = trayFiles.length ? `${trayFiles.length}件を保持中` : "ファイルはありません";
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
    more.textContent = `ほか${trayFiles.length - 4}件`;
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
    link.innerHTML = `<span>${tool.name}</span><small>${tool === currentTool ? "現在" : count ? `${count}件 →` : "対象なし"}</small>`;
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
  history.replaceState(null, "", location.pathname);
}

async function collectVisibleResults() {
  const results = document.querySelector("#resultsPanel");
  if (!results || results.hidden) return [];
  if (location.pathname.includes("png-compressor")) {
    return Promise.all([...document.querySelectorAll(".file-row.has-result")].map(async row => {
      const original = row.querySelector(".file-name")?.textContent?.trim() || "image.png";
      const image = row.querySelectorAll(".file-compare img")[1];
      return { name: original.replace(/\.png$/i, "-compressed.png"), blob: await (await fetch(image.src)).blob() };
    }));
  }
  const selector = location.pathname.includes("image-splitter") ? ".splitter-result-card" : location.pathname.includes("png-to-svg") ? ".vector-result-card" : null;
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
      await storeFiles(results, `${currentTool?.name || "tool"}-result`);
    }
  } finally { scanning = false; }
}

document.addEventListener("change", event => {
  if (event.target.matches("#fileInput") && event.target.files?.length) storeFiles(event.target.files, `${currentTool?.name || "tool"}-upload`).catch(console.error);
});
document.addEventListener("shiagent:outputs", event => storeFiles(event.detail.files, event.detail.source || "tool-result").catch(console.error));
new MutationObserver(() => {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => scanResults().catch(console.error), 80);
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "src"] });

refreshTray().then(importTray).catch(console.error);
renderDock();
