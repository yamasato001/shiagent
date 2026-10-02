import { applyConfiguredOutputSuffix } from "./output-name.js";

let preferredStartIn = null;
let sourcePickerInstalled = false;

const MIME_BY_EXTENSION = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".jfif": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp", ".avif": "image/avif",
  ".heic": "image/heic", ".heif": "image/heif", ".tif": "image/tiff", ".tiff": "image/tiff",
  ".svg": "image/svg+xml", ".pdf": "application/pdf"
};

export function rememberSourceFileHandle(handle) {
  if (handle?.kind === "file") preferredStartIn = handle;
}

export function preferredOutputStartIn() {
  return preferredStartIn;
}

export function clearPreferredOutputStartIn() {
  preferredStartIn = null;
}

export function pickerTypesFromAccept(accept = "") {
  const grouped = new Map();
  for (const token of String(accept).split(",").map(value => value.trim().toLowerCase()).filter(value => value.startsWith("."))) {
    const mime = MIME_BY_EXTENSION[token] || "application/octet-stream";
    if (!grouped.has(mime)) grouped.set(mime, []);
    if (!grouped.get(mime).includes(token)) grouped.get(mime).push(token);
  }
  if (!grouped.size) return undefined;
  return [{ description: "Supported files", accept: Object.fromEntries(grouped) }];
}

export function installSourceFileTracking(scope = globalThis, documentNode = document) {
  if (sourcePickerInstalled) return;
  sourcePickerInstalled = true;
  const input = documentNode.querySelector("#fileInput[type=file]");
  if (input && typeof scope.showOpenFilePicker === "function" && typeof scope.DataTransfer === "function") {
    const nativeClick = input.click.bind(input);
    input.click = async () => {
      try {
        const options = { id: "shiagent-input-files", multiple: input.multiple };
        const types = pickerTypesFromAccept(input.accept);
        if (types) { options.types = types; options.excludeAcceptAllOption = true; }
        const handles = await scope.showOpenFilePicker(options);
        if (!handles.length) return;
        rememberSourceFileHandle(handles[0]);
        const transfer = new scope.DataTransfer();
        for (const handle of handles) transfer.items.add(await handle.getFile());
        input.files = transfer.files;
        input.dispatchEvent(new scope.Event("change", { bubbles: true }));
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.warn("File handle picker unavailable; using the browser file input.", error);
        nativeClick();
      }
    };
  }
  documentNode.addEventListener("drop", event => {
    const item = [...(event.dataTransfer?.items || [])].find(entry => entry.kind === "file" && typeof entry.getAsFileSystemHandle === "function");
    if (item) item.getAsFileSystemHandle().then(rememberSourceFileHandle).catch(() => {});
  }, true);
}

export function supportsFolderDownload(scope = globalThis) {
  return typeof scope?.showDirectoryPicker === "function";
}

export function safeFolderFileName(value, fallbackIndex = 0) {
  const cleaned = String(value || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().replace(/[. ]+$/, "");
  return cleaned || `file_${String(fallbackIndex + 1).padStart(2, "0")}`;
}

export async function chooseOutputDirectory(scope = globalThis, startIn = "downloads") {
  if (!supportsFolderDownload(scope)) throw new Error("Folder download is not supported");
  const options = { mode: "readwrite", startIn };
  if (typeof startIn === "string") options.id = "shiagent-exports";
  return scope.showDirectoryPicker(options);
}

export async function writeFilesToDirectory(directory, files, onProgress = () => {}) {
  const used = new Set();
  let written = 0;
  for (let index = 0; index < files.length; index += 1) {
    const item = files[index];
    const payload = item?.blob || item;
    if (!payload || typeof payload !== "object") continue;
    const original = safeFolderFileName(applyConfiguredOutputSuffix(item?.name || payload.name), index);
    const dot = original.lastIndexOf(".");
    const stem = dot > 0 ? original.slice(0, dot) : original;
    const extension = dot > 0 ? original.slice(dot) : "";
    let name = original;
    let suffix = 2;
    while (used.has(name.toLocaleLowerCase("en-US"))) name = `${stem}_${suffix++}${extension}`;
    used.add(name.toLocaleLowerCase("en-US"));
    const handle = await directory.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    try { await writable.write(payload); await writable.close(); }
    catch (error) { if (typeof writable.abort === "function") await writable.abort().catch(() => {}); throw error; }
    written += 1;
    onProgress(written, files.length, name);
  }
  return written;
}

