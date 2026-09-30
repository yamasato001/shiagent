import { CUSTOM_WORKFLOW_STORAGE_KEY } from "./custom-workflow-core.js";

export function readCustomWorkflows(storage) {
  try {
    storage ||= globalThis.localStorage;
    const value = JSON.parse(storage?.getItem(CUSTOM_WORKFLOW_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeCustomWorkflows(workflows, storage) {
  try { storage ||= globalThis.localStorage; } catch { /* handled below */ }
  if (!storage) throw new Error("Workflow storage is unavailable.");
  storage.setItem(CUSTOM_WORKFLOW_STORAGE_KEY, JSON.stringify(workflows));
}
