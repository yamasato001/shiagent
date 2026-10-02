export const DRAWABLE_SELECTOR = "path,rect,circle,ellipse,line,polyline,polygon,text,use";
const DEFINITION_SELECTOR = "defs,clipPath,mask,marker,pattern,symbol";
const FORBIDDEN_SELECTOR = "script,foreignObject,iframe,object,embed,audio,video,canvas";

export function clampStyleValue(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function safePaint(value, fallback = "#000000") {
  const paint = String(value || "").trim();
  if (paint === "none") return "none";
  if (/^#[0-9a-f]{6}$/i.test(paint)) return paint.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(paint)) return `#${[...paint.slice(1)].map(char => char + char).join("")}`.toLowerCase();
  return fallback;
}

function scrubCss(css) {
  return String(css || "")
    .replace(/@import[^;]*(?:;|$)/gi, "")
    .replace(/url\(\s*(['"]?)(?!#)[^)]+\1\s*\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "");
}

export function sanitizeSvgDocument(documentNode) {
  const root = documentNode?.documentElement;
  if (!root || root.localName?.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) {
    throw new Error("INVALID_SVG");
  }
  root.querySelectorAll(FORBIDDEN_SELECTOR).forEach(node => node.remove());
  root.querySelectorAll("style").forEach(node => { node.textContent = scrubCss(node.textContent); });
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || /javascript\s*:/i.test(value)) element.removeAttribute(attribute.name);
      else if ((name === "href" || name === "xlink:href") && value && !value.startsWith("#") && !value.startsWith("data:image/")) element.removeAttribute(attribute.name);
      else if (name === "style") element.setAttribute(attribute.name, scrubCss(value));
    }
  }
  if (!root.hasAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return documentNode;
}

export function editableElements(root) {
  return [...root.querySelectorAll(DRAWABLE_SELECTOR)].filter(element => !element.closest(DEFINITION_SELECTOR));
}

export function splitAbsoluteCompoundPath(data) {
  const source = String(data || "").trim();
  if (!source || /m/.test(source)) return [source].filter(Boolean);
  const fragments = source.match(/M[^Mm]*/g)?.map(fragment => fragment.trim()).filter(Boolean) || [];
  return fragments.length ? fragments : [source];
}

export function applySvgStyle(elements, style) {
  const targets = [...elements];
  const fill = style.fillNone ? "none" : safePaint(style.fill, "#000000");
  const stroke = style.strokeNone ? "none" : safePaint(style.stroke, "#000000");
  const width = String(clampStyleValue(style.strokeWidth, 0, 100, 1));
  const opacity = String(clampStyleValue(style.opacity, 0, 1, 1));
  for (const element of targets) {
    element.setAttribute("fill", fill);
    element.style.fill = fill;
    element.setAttribute("stroke", stroke);
    element.style.stroke = stroke;
    element.setAttribute("stroke-width", width);
    element.style.strokeWidth = width;
    element.setAttribute("opacity", opacity);
    element.style.opacity = opacity;
  }
  return targets.length;
}

export function serializeSvg(root, Serializer = XMLSerializer) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll("[data-shiagent-selected]").forEach(element => element.removeAttribute("data-shiagent-selected"));
  clone.removeAttribute("data-shiagent-selected");
  return new Serializer().serializeToString(clone);
}

