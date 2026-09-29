export function supportsFolderDownload(scope = globalThis) {
  return typeof scope?.showDirectoryPicker === "function";
}

export function safeFolderFileName(value, fallbackIndex = 0) {
  const cleaned = String(value || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().replace(/[. ]+$/, "");
  return cleaned || `file_${String(fallbackIndex + 1).padStart(2, "0")}`;
}

export async function chooseOutputDirectory(scope = globalThis) {
  if (!supportsFolderDownload(scope)) throw new Error("Folder download is not supported");
  return scope.showDirectoryPicker({ id: "shiagent-exports", mode: "readwrite", startIn: "downloads" });
}

export async function writeFilesToDirectory(directory, files, onProgress = () => {}) {
  const used = new Set();
  let written = 0;
  for (let index = 0; index < files.length; index += 1) {
    const item = files[index];
    const payload = item?.blob || item;
    if (!payload || typeof payload !== "object") continue;
    const original = safeFolderFileName(item?.name || payload.name, index);
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
