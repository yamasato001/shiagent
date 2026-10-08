await import("/assets/js/image-before-after.js");

const svg = (label, color, shape) => `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="#f6f6f2"/><${shape} fill="${color}"/><text x="48" y="540" font-family="sans-serif" font-size="48">${label}</text></svg>`;
const sources = [
  new File([svg("元画像 1", "#d43131", 'circle cx="480" cy="270" r="180"')], "sample-01.svg", { type: "image/svg+xml" }),
  new File([svg("元画像 2", "#2070d4", 'rect x="280" y="90" width="400" height="360"')], "sample-02.svg", { type: "image/svg+xml" })
];
const outputs = [
  new File([svg("完成画像 1", "#111111", 'circle cx="480" cy="270" r="140"')], "sample-01-result.svg", { type: "image/svg+xml" }),
  new File([svg("完成画像 2", "#111111", 'rect x="330" y="140" width="300" height="260"')], "sample-02-result.svg", { type: "image/svg+xml" })
];
const transfer = new DataTransfer();
sources.forEach(file => transfer.items.add(file));
const input = document.querySelector("#fixtureInput");
input.files = transfer.files;
input.dispatchEvent(new Event("change", { bubbles: true }));
document.dispatchEvent(new CustomEvent("shiagent:outputs", { detail: { files: outputs, source: "fixture" } }));
