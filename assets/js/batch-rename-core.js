import { pick } from "./i18n.js";
import renameText from "./i18n/batch-rename.js";

export function splitFileName(fileName) {
  const index = fileName.lastIndexOf(".");
  if (index <= 0) return { stem: fileName, extension: "" };
  return { stem: fileName.slice(0, index), extension: fileName.slice(index) };
}

export function sanitizeStem(value) {
  return String(value || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
}

export function createRenamedFiles(files, options = {}) {
  const base = sanitizeStem(options.base || "file") || "file";
  const prefix = sanitizeStem(options.prefix || "");
  const suffix = sanitizeStem(options.suffix || "");
  const separator = options.separator === "-" ? "-" : options.separator === "none" ? "" : "_";
  const start = Math.max(0, Math.trunc(Number(options.start) || 1));
  const digits = Math.max(1, Math.min(6, Math.trunc(Number(options.digits) || 2)));
  const names = new Set();
  return files.map((file, index) => {
    const { extension } = splitFileName(file.name);
    const parts = [prefix, base, String(start + index).padStart(digits, "0"), suffix].filter(Boolean);
    const name = `${parts.join(separator)}${extension}`;
    if (names.has(name.toLowerCase())) throw new Error(pick(renameText).duplicate(name));
    names.add(name.toLowerCase());
    return new File([file], name, { type: file.type, lastModified: file.lastModified });
  });
}
