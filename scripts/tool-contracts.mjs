export const siteOrigin = "https://shiagent.com";

const control = (selector, element, type, details = {}) => ({ selector, element, type, ...details });
const pdfNameControl = control("#pdfName", "input", "text", { value: "shiagent" });
const pdfSelectionControl = control("#pdfSelection", "select", "select", { value: "all", values: ["all", "selected", "odd", "even", "range"] });
const pdfRangeControl = control("#pdfRange", "input", "text");
const pdfOutputControl = control("#pdfOutput", "select", "select", { value: "combined", values: ["combined", "separate"] });

export const routeOverrides = {
  "line-art-generator": { status: "pending", input: null, action: null, result: null, download: null },
  "svg-white-fill/editor": { action: "#nextButton", result: "#editorCanvas", download: "#downloadButton", statusSelector: "#fileStatus" },
  "svg-style-editor": { action: "#applyAllButton", result: "#svgStage", download: "#downloadButton", statusSelector: "#fileStatus", outputs: ["image/svg+xml"] },
  "workflows/custom": { input: null, action: "#runWorkflow", result: "#workflowSteps", download: null, statusSelector: "#builderStatus", outputs: ["varies by selected workflow"] },
  "workflows/pdf-finisher": { input: "#pdfInput", action: "#pdfExport", result: "#pdfPages", download: "#pdfExport", statusSelector: "#pdfStatus", controls: [control("#pdfCropPadding", "input", "number", { value: "3" }), control("#pdfNumberStart", "input", "number", { value: "1" }), control("#pdfNumberStyle", "select", "select", { value: "total", values: ["number", "page", "total"] }), control("#pdfPosition", "select", "select", { value: "bottom-center" }), control("#pdfRenameBase", "input", "text", { value: "document" }), control("#pdfRenameStart", "input", "number", { value: "1" }), control("#pdfRenameDigits", "select", "select", { value: "3", values: ["2", "3", "4"] })], accept: "application/pdf,.pdf", outputs: ["application/pdf", "application/zip"] },
  "workflows/scan-pdf-optimizer": { input: "#scanPdfInput", action: "#scanPdfRun", result: "#scanPdfResults", download: "#scanPdfDownloadAll", statusSelector: "#scanPdfStatus", controls: [control("#scanPdfLanguage", "select", "select", { value: "jpn+eng", values: ["jpn+eng", "jpn", "eng"] }), control("#scanPdfQuality", "select", "select", { value: "150", values: ["150", "200"] }), control("#scanPdfPadding", "input", "number", { value: "3" }), control("#scanPdfBase", "input", "text", { value: "scan" }), control("#scanPdfStart", "input", "number", { value: "1" }), control("#scanPdfDigits", "select", "select", { value: "3", values: ["2", "3", "4"] })], accept: "application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp", outputs: ["application/pdf", "application/zip"] },
  "pdf/compare": { input: "#pdfCompareA", action: "#pdfCompareRun", result: "#pdfComparePages", download: "#pdfCompareDownload", statusSelector: "#pdfCompareStatus", controls: [control("#pdfCompareB", "input", "file", { accept: "application/pdf,.pdf" }), control("#pdfCompareThreshold", "select", "select", { value: "18", values: ["8", "18", "32"] }), control("#pdfCompareDpi", "select", "select", { value: "144", values: ["96", "144", "192"] })], accept: "application/pdf,.pdf", outputs: ["image/png", "application/zip"] },
  "pdf/ocr": { input: "#pdfOcrInput", action: "#pdfOcrRun", result: "#pdfOcrResult", download: "#pdfOcrDownload", statusSelector: "#pdfOcrStatus", controls: [control("#pdfOcrLanguage", "select", "select", { value: "jpn+eng", values: ["jpn+eng", "jpn", "eng"] }), control("#pdfOcrDpi", "select", "select", { value: "200", values: ["150", "200", "300"] }), control("#pdfOcrPageMode", "select", "select", { value: "all", values: ["all", "range"] }), control("#pdfOcrRange", "input", "text", { value: "" })], accept: "application/pdf,.pdf", outputs: ["application/pdf"] },
  "pdf/compress": { input: "#pdfCompressorInput", action: "#pdfCompressorRun", result: "#pdfCompressorResult", download: "#pdfCompressorDownload", statusSelector: "#pdfCompressorStatus", controls: [control("input[name=pdfCompressionLevel]", "input", "radio", { value: "recommended", values: ["quality", "recommended", "maximum"] })], accept: "application/pdf,.pdf", outputs: ["application/pdf"] },
  "pdf/sort-by-page-number": { input: "#pdfOrderInput", action: "#pdfOrderRun", result: "#pdfOrderResults", download: "#pdfOrderDownloadAll", statusSelector: "#pdfOrderStatus", controls: [control("input[data-page-number]", "input", "number", { min: "0", step: "1", repeated: true })], outputs: ["application/pdf", "application/zip"] },
  "color-tool": { outputs: ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/zip"] },
  "svg-to-image": { outputs: ["image/png", "image/webp", "application/zip"] },
};

export const excludedRoutes = new Set(["", "pdf"]);

export const primaryActionIds = [
  "compressButton", "convertButton", "resizeButton", "cropButton", "paddingButton",
  "joinButton", "cleanButton", "rasterizeButton", "processButton", "generateButton",
  "splitButton", "applyButton", "runButton",
];

export function inferCategory(route) {
  if (route.startsWith("pdf/")) return "pdf";
  if (route.startsWith("workflows/")) return "workflow";
  if (route.includes("svg") || route === "image-to-svg") return "vector";
  if (route === "batch-rename") return "batch";
  if (route === "line-art-generator") return "ai";
  return "image";
}

export function inferOutput(route) {
  if (route === "pdf/split") return ["application/pdf", "application/zip"];
  if (route === "pdf/pdf-to-images") return ["image/png", "image/jpeg", "image/webp", "application/zip"];
  if (route.startsWith("pdf/")) return ["application/pdf"];
  if (route === "batch-rename") return ["application/zip", "original media types"];
  if (route === "svg-white-fill/editor" || route === "svg-style-editor") return ["image/svg+xml"];
  if (route.includes("svg-white-fill") || route === "svg-cleaner" || route === "image-to-svg" || route === "workflows/line-art-to-svg") return ["image/svg+xml", "application/zip"];
  if (route === "favicon-generator") return ["image/png", "image/x-icon", "application/manifest+json", "application/zip"];
  if (route === "image-splitter") return ["image/png", "application/zip"];
  if (route === "image-joiner") return ["image/png", "image/jpeg", "image/webp"];
  if (["image-compressor", "image-converter", "image-resizer", "image-cropper", "canvas-padding", "metadata-cleaner", "background-remover", "svg-to-image", "color-tool"].includes(route) || route.startsWith("workflows/")) return ["image/png", "image/jpeg", "image/webp", "application/zip"];
  return ["image/png"];
}

export function pdfContract(route) {
  if (!route.startsWith("pdf/") || route === "pdf/sort-by-page-number") return null;
  const mode = route.slice("pdf/".length);
  const controls = [pdfNameControl];
  if (mode === "merge") controls.push(control("#pdfMergeMethod", "select", "select", { value: "sequential", values: ["sequential", "interleave"] }));
  if (mode === "split") controls.unshift(pdfSelectionControl, pdfRangeControl, { ...pdfOutputControl, value: "separate" });
  if (mode === "reorder") controls.push(control("#pdfReverse", "input", "checkbox"));
  if (mode === "images-to-pdf") controls.push(control("#pdfImageSize", "select", "select", { value: "auto", values: ["auto", "a4p", "a4l"] }));
  if (mode === "pdf-to-images") controls.push(
    pdfSelectionControl, pdfRangeControl,
    control("#pdfImageFormat", "select", "select", { value: "webp", values: ["png", "jpeg", "webp"] }),
    control("#pdfImageDpi", "select", "select", { value: "150", values: ["96", "150", "300"] }),
    control("#pdfImageQuality", "select", "select", { value: "0.9", values: ["0.8", "0.9", "0.95"] })
  );
  if (mode === "page-numbers") controls.push(pdfSelectionControl, pdfRangeControl, control("#pdfNumberStart", "input", "number", { value: "1", min: "0" }), control("#pdfNumberStyle", "select", "select", { value: "number", values: ["number", "page", "total"] }), control("#pdfPosition", "select", "select", { value: "bottom-center" }));
  if (mode === "watermark") controls.push(pdfSelectionControl, pdfRangeControl, control("#pdfWatermarkText", "input", "text", { value: "CONFIDENTIAL" }), control("#pdfOpacity", "input", "number", { value: "0.18" }), control("#pdfWatermarkRotation", "input", "number", { value: "-35" }));
  if (mode === "crop") controls.push(pdfSelectionControl, pdfRangeControl, control("#pdfCropMode", "select", "select", { value: "auto", values: ["auto", "manual"] }), control("#pdfCropPadding", "input", "number", { value: "3" }));
  if (mode === "n-up") controls.push(pdfSelectionControl, pdfRangeControl, control("#pdfNUpLayout", "select", "select", { value: "4", values: ["2", "4", "6"] }), control("#pdfNUpPaper", "select", "select", { value: "a4l", values: ["a4p", "a4l"] }), control("#pdfNUpMargin", "input", "number", { value: "8" }), control("#pdfNUpGap", "input", "number", { value: "4" }), control("#pdfNUpBorder", "input", "checkbox"));
  if (mode === "form-fill") controls.push(control("[data-pdf-form-field]", "input", "varies", { repeated: true }), control("#pdfFormFlatten", "input", "checkbox"));
  if (mode === "signature") controls.push(pdfSelectionControl, pdfRangeControl, control("#pdfSignatureText", "input", "text"), control("#pdfSignatureImage", "input", "file"), control("#pdfPosition", "select", "select", { value: "bottom-right" }), control("#pdfSignatureSize", "input", "number", { value: "24" }), control("#pdfMargin", "input", "number", { value: "12" }));
  if (mode === "rotate") controls.push(control("#pdfAutoOrient", "button", "button", { action: "click" }));
  return {
    input: "#pdfInput",
    action: "#pdfExport",
    result: "#pdfPages",
    download: "#pdfExport",
    status: "#pdfStatus",
    controls,
    accept: route === "pdf/images-to-pdf" ? "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" : "application/pdf,.pdf",
  };
}
