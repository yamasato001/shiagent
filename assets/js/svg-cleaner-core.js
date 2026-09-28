const SVG_NS = "http://www.w3.org/2000/svg";
const removableTags = new Set(["metadata", "title", "desc"]);
const numericAttributes = new Set(["d", "points", "transform", "viewBox", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "stroke-width", "stroke-dasharray", "stroke-dashoffset", "opacity", "fill-opacity", "stroke-opacity"]);
const editorFragments = ["sodipodi", "inkscape", "rdf", "dc", "cc"];

const localName = value => String(value).split(":").pop();
const formatNumber = value => {
  const rounded = Math.abs(value) < .0001 ? 0 : Math.round(value * 1000) / 1000;
  return String(rounded).replace(/^(-?)0\./, "$1.");
};

export function compactNumericText(value) {
  return String(value).replace(/(?<![A-Za-z_])[-+]?(?:\d+\.\d+|\d+\.|\.\d+)(?:[eE][-+]?\d+)?/g, match => formatNumber(Number(match))).replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").trim();
}

export function cleanSvg(svgText) {
  const documentNode = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) throw new Error("SVGを解析できませんでした。");
  const root = documentNode.documentElement;
  if (root.localName !== "svg") throw new Error("SVGファイルではありません。");
  let removedNodes = 0;
  let removedAttributes = 0;
  const walk = element => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || editorFragments.some(fragment => name.includes(fragment)) || (/^(?:href|xlink:href)$/.test(name) && /^\s*javascript:/i.test(attribute.value))) {
        element.removeAttribute(attribute.name);
        removedAttributes += 1;
      } else if (numericAttributes.has(localName(attribute.name))) {
        attribute.value = compactNumericText(attribute.value);
      }
    }
    for (const child of [...element.children]) {
      const name = child.localName;
      if (removableTags.has(name) || ["script", "foreignObject", "iframe"].includes(name) || editorFragments.some(fragment => child.namespaceURI?.includes(fragment))) {
        child.remove();
        removedNodes += 1;
      } else walk(child);
    }
  };
  for (const attribute of ["version", "baseProfile", "contentScriptType", "contentStyleType"]) {
    if (root.hasAttribute(attribute)) { root.removeAttribute(attribute); removedAttributes += 1; }
  }
  if (root.getAttribute("preserveAspectRatio") === "xMidYMid meet") { root.removeAttribute("preserveAspectRatio"); removedAttributes += 1; }
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", SVG_NS);
  walk(root);
  for (const node of [...documentNode.childNodes]) if (node.nodeType === Node.COMMENT_NODE || node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) { node.remove(); removedNodes += 1; }
  const svg = new XMLSerializer().serializeToString(root).replace(/>\s+</g, "><").trim();
  return { svg, removedNodes, removedAttributes, beforeBytes: new TextEncoder().encode(svgText).length, afterBytes: new TextEncoder().encode(svg).length };
}

