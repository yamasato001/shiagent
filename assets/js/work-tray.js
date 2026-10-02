import { applyConfiguredOutputSuffix } from "./output-name.js";
import { preferredOutputStartIn } from "./folder-download.js";

const DATABASE_NAME = "shiagent-work-tray";
const STORE_NAME = "files";
const DATABASE_VERSION = 1;
const SOURCE_HANDLE_ID = "__source-handle__";

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

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function replaceTray(files, source = "tool", options = {}) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  store.clear();
  const sourceHandle = options.sourceHandle === undefined ? preferredOutputStartIn() : options.sourceHandle;
  if (sourceHandle?.kind === "file") {
    try {
      store.put({ id: SOURCE_HANDLE_ID, metadata: true, sourceHandle, source, createdAt: Date.now() });
    } catch (error) {
      console.debug("The source folder handle could not be stored in the work tray.", error);
    }
  }
  files.forEach((file, index) => store.put({
    id: `${Date.now()}-${index}`,
    name: options.applySuffix ? applyConfiguredOutputSuffix(file.name) : file.name,
    type: file.type || file.blob?.type || "application/octet-stream",
    blob: file.blob || file,
    source,
    order: index,
    createdAt: Date.now()
  }));
  await new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error));
    transaction.addEventListener("abort", () => reject(transaction.error));
  });
  database.close();
}

export async function readTray() {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
  database.close();
  return records.filter(record => !record.metadata).sort((a, b) => a.order - b.order).map(record => new File([record.blob], record.name, {
    type: record.type,
    lastModified: record.createdAt
  }));
}

export async function readTraySourceHandle() {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const record = await requestResult(transaction.objectStore(STORE_NAME).get(SOURCE_HANDLE_ID));
  database.close();
  return record?.sourceHandle?.kind === "file" ? record.sourceHandle : null;
}

export async function clearTray() {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).clear();
  await new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error));
    transaction.addEventListener("abort", () => reject(transaction.error));
  });
  database.close();
}

