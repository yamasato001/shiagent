export const WHITE_FILL_MODES = Object.freeze(["none", "auto", "manual"]);

export function whiteFillMode(fillEnabled, method = "auto") {
  if (!fillEnabled || fillEnabled === "none") return "none";
  return method === "manual" ? "manual" : "auto";
}

export function workflowSteps(mode) {
  const normalized = WHITE_FILL_MODES.includes(mode) ? mode : "none";
  return [
    "trim",
    "background",
    "vectorize",
    ...(normalized === "none" ? [] : [normalized === "manual" ? "manual-fill" : "auto-fill"]),
    "clean"
  ];
}

export function workflowOutputName(fileName, mode = "none") {
  const stem = String(fileName || "")
    .replace(/\.[^./\\]+$/, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim() || "line-art";
  return `${stem}${mode === "none" ? "" : "-white-filled"}.svg`;
}
