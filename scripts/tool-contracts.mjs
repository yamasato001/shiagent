export const siteOrigin = "https://shiagent.com";

export const routeOverrides = {
  "line-art-generator": { status: "pending", input: null, action: null, result: null, download: null },
  "svg-white-fill/editor": { action: "#saveNextButton", result: "#previewSvg", download: "#downloadButton" },
  "workflows/custom": { input: null, action: "#runWorkflow", result: "#workflowRun", download: null },
  "pdf/sort-by-page-number": { input: "#pdfOrderInput", action: "#pdfOrderRun", result: "#pdfOrderResults", download: "#pdfOrderDownloadAll" },
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
  if (route.startsWith("pdf/")) return ["application/pdf"];
  if (route === "batch-rename") return ["application/zip", "original media types"];
  if (route.includes("svg-white-fill") || route === "svg-cleaner" || route === "image-to-svg" || route === "workflows/line-art-to-svg") return ["image/svg+xml"];
  if (route === "favicon-generator") return ["image/png", "image/x-icon", "application/manifest+json", "application/zip"];
  if (["image-compressor", "image-converter", "image-resizer", "image-cropper", "canvas-padding", "image-joiner", "metadata-cleaner", "background-remover", "svg-to-image", "color-tool"].includes(route) || route.startsWith("workflows/")) return ["image/png", "image/jpeg", "image/webp"];
  return ["image/png"];
}

export function pdfContract(route) {
  if (!route.startsWith("pdf/") || route === "pdf/sort-by-page-number") return null;
  return {
    input: "#pdfInput",
    action: "#pdfExport",
    result: "#pdfPages",
    download: "#pdfExport",
    accept: route === "pdf/images-to-pdf" ? "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" : "application/pdf,.pdf",
  };
}
