export const CUSTOM_WORKFLOW_STORAGE_KEY = "shiagent-custom-workflows-v1";

const RASTER = ["png", "jpeg", "webp", "heic", "avif", "gif", "bmp", "tiff"];
const WEB_RASTER = ["png", "jpeg", "webp"];

export const INPUT_TYPES = {
  raster: RASTER,
  webRaster: WEB_RASTER,
  svg: ["svg"],
  pdf: ["pdf"],
  files: [...RASTER, "svg", "pdf", "file"]
};

export const TOOL_CATALOG = [
  { id: "image-cropper", category: "image", path: "/image-cropper/", accepts: RASTER, output: WEB_RASTER },
  { id: "canvas-padding", category: "image", path: "/canvas-padding/", accepts: RASTER, output: WEB_RASTER },
  { id: "image-resizer", category: "image", path: "/image-resizer/", accepts: RASTER, output: WEB_RASTER },
  { id: "background-remover", category: "image", path: "/background-remover/", accepts: RASTER, output: WEB_RASTER },
  { id: "image-converter", category: "image", path: "/image-converter/", accepts: RASTER, output: WEB_RASTER },
  { id: "image-compressor", category: "image", path: "/image-compressor/", accepts: WEB_RASTER, output: "preserve" },
  { id: "metadata-cleaner", category: "image", path: "/metadata-cleaner/", accepts: WEB_RASTER, output: "preserve" },
  { id: "image-joiner", category: "image", path: "/image-joiner/", accepts: RASTER, output: WEB_RASTER },
  { id: "image-splitter", category: "image", path: "/image-splitter/", accepts: ["png", "jpeg"], output: ["png"] },
  { id: "color-tool", category: "image", path: "/color-tool/", accepts: [...WEB_RASTER, "svg"], output: "preserve" },
  { id: "favicon-generator", category: "image", path: "/favicon-generator/", accepts: [...WEB_RASTER, "svg"], output: ["file"] },
  { id: "image-to-svg", category: "vector", path: "/image-to-svg/", accepts: WEB_RASTER, output: ["svg"] },
  { id: "svg-white-fill", category: "vector", path: "/svg-white-fill/", accepts: ["svg"], output: ["svg"] },
  { id: "svg-white-fill-editor", category: "vector", path: "/svg-white-fill/editor/", accepts: ["svg"], output: ["svg"] },
  { id: "svg-cleaner", category: "vector", path: "/svg-cleaner/", accepts: ["svg"], output: ["svg"] },
  { id: "svg-to-image", category: "vector", path: "/svg-to-image/", accepts: ["svg"], output: WEB_RASTER },
  { id: "pdf-merge", category: "pdf", path: "/pdf/merge/", accepts: ["pdf"], output: ["pdf"] },
  { id: "pdf-split", category: "pdf", path: "/pdf/split/", accepts: ["pdf"], output: ["pdf"] },
  { id: "pdf-reorder", category: "pdf", path: "/pdf/reorder/", accepts: ["pdf"], output: ["pdf"] },
  { id: "pdf-interleave", category: "pdf", path: "/pdf/interleave/", accepts: ["pdf"], output: ["pdf"] },
  { id: "pdf-rotate", category: "pdf", path: "/pdf/rotate/", accepts: ["pdf"], output: ["pdf"] },
  { id: "pdf-delete-pages", category: "pdf", path: "/pdf/delete-pages/", accepts: ["pdf"], output: ["pdf"] },
  { id: "images-to-pdf", category: "pdf", path: "/pdf/images-to-pdf/", accepts: WEB_RASTER, output: ["pdf"] },
  { id: "batch-rename", category: "file", path: "/batch-rename/", accepts: INPUT_TYPES.files, output: "preserve" }
];

export function toolById(id) {
  return TOOL_CATALOG.find(tool => tool.id === id);
}

export function applyTool(types, toolOrId) {
  const tool = typeof toolOrId === "string" ? toolById(toolOrId) : toolOrId;
  if (!tool) return null;
  const accepted = [...new Set(types)].filter(type => tool.accepts.includes(type));
  if (!accepted.length) return null;
  return tool.output === "preserve" ? accepted : [...tool.output];
}

export function validateWorkflow(inputType, stepIds) {
  let types = [...(INPUT_TYPES[inputType] || [])];
  for (let index = 0; index < stepIds.length; index += 1) {
    const output = applyTool(types, stepIds[index]);
    if (!output) return { valid: false, invalidIndex: index, types };
    types = output;
  }
  return { valid: true, invalidIndex: -1, types };
}

export function typesBeforeStep(inputType, stepIds, index = stepIds.length) {
  return validateWorkflow(inputType, stepIds.slice(0, index)).types;
}

export function canAppend(inputType, stepIds, toolId) {
  return validateWorkflow(inputType, [...stepIds, toolId]).valid;
}

export function moveStep(inputType, stepIds, from, to) {
  const next = [...stepIds];
  if (from < 0 || to < 0 || from >= next.length || to >= next.length) return null;
  next.splice(to, 0, next.splice(from, 1)[0]);
  return validateWorkflow(inputType, next).valid ? next : null;
}

