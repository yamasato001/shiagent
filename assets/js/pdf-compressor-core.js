export const PDF_COMPRESSION_PRESETS = Object.freeze({
  quality: Object.freeze({ strategy: "images", dpi: 200, quality: 82, textPreserved: true }),
  recommended: Object.freeze({ strategy: "images", dpi: 150, quality: 72, textPreserved: true }),
  maximum: Object.freeze({ strategy: "raster", dpi: 120, quality: 60, textPreserved: false })
});

export function pdfCompressionPreset(value = "recommended") {
  return PDF_COMPRESSION_PRESETS[value] || PDF_COMPRESSION_PRESETS.recommended;
}

export function pdfCompressedName(name = "input.pdf") {
  const base = String(name).replace(/\.pdf$/i, "").trim() || "input";
  return `${base}-compressed.pdf`;
}

export function pdfSavingsPercent(originalSize, outputSize) {
  if (!(originalSize > 0)) return 0;
  return Math.max(0, (1 - outputSize / originalSize) * 100);
}

export function formatPdfBytes(bytes, locale = "ja-JP") {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 ** 2).toLocaleString(locale, { maximumFractionDigits: 2 })} MB`;
}
