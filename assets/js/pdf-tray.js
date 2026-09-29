const DATABASE_NAME = "shiagent-pdf-tray";
const STORE_NAME = "pdf-files";
const DATABASE_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error));
    transaction.addEventListener("abort", () => reject(transaction.error));
  });
}

export async function replacePdfTray(files) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  store.clear();
  files.filter(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name)).forEach((file, index) => store.put({
    id: `${Date.now()}-${index}`,
    name: file.name,
    type: "application/pdf",
    blob: file,
    order: index,
    createdAt: Date.now()
  }));
  await transactionDone(transaction);
  database.close();
  window.dispatchEvent(new CustomEvent("shiagent:pdf-tray-changed"));
}

export async function readPdfTray() {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const request = transaction.objectStore(STORE_NAME).getAll();
  const records = await new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
  database.close();
  return records.sort((a, b) => a.order - b.order).map(record => new File([record.blob], record.name, { type: record.type, lastModified: record.createdAt }));
}

export async function clearPdfTray() {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).clear();
  await transactionDone(transaction);
  database.close();
  window.dispatchEvent(new CustomEvent("shiagent:pdf-tray-changed"));
}

export function mountPdfTray(root, options = {}) {
  if (!root) return;
  const ja = options.lang === "ja";
  root.className = "pdf-tray";
  root.innerHTML = `<section class="pdf-tray-panel" hidden><header><div><small>PDF WORK TRAY</small><strong>${ja ? "PDF作業トレイ" : "PDF work tray"}</strong></div><div><button class="pdf-tray-clear" type="button">${ja ? "クリア" : "Clear"}</button><button class="pdf-tray-close" type="button" aria-label="${ja ? "閉じる" : "Close"}">×</button></div></header><div class="pdf-tray-files"></div><a class="pdf-tray-open" href="${ja ? "/ja" : ""}/pdf/merge/">${ja ? "PDFワークスペースを開く" : "Open PDF workspace"} →</a><small class="pdf-tray-note">${ja ? "画像の作業トレイとは別に、このブラウザ内へPDFを保持します。" : "PDFs are kept separately from the image work tray in this browser."}</small></section><button class="pdf-tray-toggle" type="button"><span><small>PDF WORKSPACE</small><strong>${ja ? "PDF作業トレイ" : "PDF tray"}</strong></span><b>0</b></button>`;
  const panel = root.querySelector(".pdf-tray-panel");
  const toggle = root.querySelector(".pdf-tray-toggle");
  const files = root.querySelector(".pdf-tray-files");
  const count = toggle.querySelector("b");
  async function render() {
    try {
      const items = await readPdfTray();
      count.textContent = String(items.length);
      files.innerHTML = items.length ? items.map(file => `<span title="${file.name.replace(/"/g, "&quot;")}">${file.name}</span>`).join("") : `<em>${ja ? "PDFはまだありません" : "No PDFs yet"}</em>`;
      root.querySelector(".pdf-tray-clear").disabled = !items.length;
    } catch {
      files.innerHTML = `<em>${ja ? "トレイを読み込めませんでした" : "Could not read the tray"}</em>`;
    }
  }
  const close = () => { panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); };
  toggle.addEventListener("click", event => { event.stopPropagation(); panel.hidden = !panel.hidden; toggle.setAttribute("aria-expanded", String(!panel.hidden)); });
  root.querySelector(".pdf-tray-close").addEventListener("click", close);
  root.querySelector(".pdf-tray-clear").addEventListener("click", async () => { await clearPdfTray(); await render(); });
  document.addEventListener("click", event => { if (!panel.hidden && !root.contains(event.target)) close(); });
  window.addEventListener("shiagent:pdf-tray-changed", render);
  render();
}

