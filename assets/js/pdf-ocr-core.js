import { parsePageRange } from "./pdf-core.js";

export function pdfOcrOutputName(name = "input.pdf") {
  const base = String(name).replace(/\.pdf$/i, "").trim() || "input";
  return `${base}-searchable.pdf`;
}

export function pdfOcrPageIndexes(mode, range, pageCount) {
  if (mode === "range") return parsePageRange(range, pageCount);
  return Array.from({ length: Math.max(0, Number(pageCount) || 0) }, (_, index) => index);
}

export function hasUsefulPdfText(items, minimumCharacters = 12) {
  const count = (items || []).reduce((sum, item) => sum + String(item?.str || "").replace(/\s/g, "").length, 0);
  return { useful: count >= minimumCharacters, characters: count };
}

export function summarizePdfOcr(results = []) {
  const recognized = results.filter(result => result.type === "ocr");
  const preserved = results.length - recognized.length;
  const characters = recognized.reduce((sum, result) => sum + (Number(result.characters) || 0), 0);
  const confidence = recognized.length
    ? recognized.reduce((sum, result) => sum + (Number(result.confidence) || 0), 0) / recognized.length
    : 0;
  return { pages: results.length, recognized: recognized.length, preserved, characters, confidence };
}
