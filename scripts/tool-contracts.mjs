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
  if (mode === "split") controls.unshift(pdfSelectionControl, pdfRangeControl, { ...pdfOutputControl, value: "separate" });
  if (mode === "reorder") controls.push(control("#pdfReverse", "input", "checkbox"));
  if (mode === "images-to-pdf") controls.push(control("#pdfImageSize", "select", "select", { value: "auto", values: ["auto", "a4p", "a4l"] }));
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
