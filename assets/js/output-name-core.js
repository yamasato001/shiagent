export function sanitizeOutputSuffix(value) {
  const cleaned = String(value || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, "-").replace(/^[._-]+/, "").replace(/[. _-]+$/, "");
  return cleaned ? `_${cleaned}` : "";
}

export function appendOutputSuffix(fileName, suffix) {
  const safeSuffix = sanitizeOutputSuffix(suffix);
  if (!safeSuffix) return String(fileName || "");
  const name = String(fileName || "file");
  const slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const dot = name.lastIndexOf(".");
  const hasExtension = dot > slash + 1;
  const stem = hasExtension ? name.slice(0, dot) : name;
  if (stem.toLocaleLowerCase("en-US").endsWith(safeSuffix.toLocaleLowerCase("en-US"))) return name;
  return hasExtension ? `${stem}${safeSuffix}${name.slice(dot)}` : `${stem}${safeSuffix}`;
}
