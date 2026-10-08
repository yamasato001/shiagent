const isJapanese = document.documentElement.lang.toLowerCase().startsWith("ja");
const text = isJapanese ? {
  title: "処理前後を大きく比較",
  tabs: "比較する画像",
  before: "処理前",
  after: "処理後",
  unavailable: "この形式はブラウザで直接プレビューできません"
} : {
  title: "Compare before and after",
  tabs: "Images to compare",
  before: "Before",
  after: "After",
  unavailable: "This format cannot be previewed directly in this browser"
};

const state = {
  sources: [],
  sourceUrls: new Map(),
  outputUrls: [],
  items: [],
  selected: 0,
  section: null,
  tabs: null,
  view: null,
  name: null
};

function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified || 0}`;
}

function rememberSources(files) {
  for (const file of [...files].filter(item => item instanceof Blob)) {
    const key = fileKey(file);
    if (!state.sources.some(item => fileKey(item) === key)) state.sources.push(file);
  }
}

function visibleSourceNames() {
  return [...document.querySelectorAll("#fileList .file-name")]
    .map(element => element.textContent.trim())
    .filter(Boolean);
}

function activeSources() {
  const names = visibleSourceNames();
  if (!names.length) return state.sources;
  const remaining = [...state.sources];
  const active = [];
  for (const name of names) {
    const index = remaining.findIndex(file => file.name === name);
    if (index >= 0) active.push(...remaining.splice(index, 1));
  }
  return active.length ? active : state.sources;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

function fileName(item, fallback) {
  return item?.name || item?.blob?.name || fallback;
}

function normalizeOutputs(items) {
  return [...(items || [])].map((item, index) => {
    const blob = item instanceof Blob ? item : item?.blob;
    if (!(blob instanceof Blob)) return null;
    return { blob, name: fileName(item, `output-${index + 1}`) };
  }).filter(Boolean).filter(item => {
    const extension = item.name.split(".").pop()?.toLowerCase();
    return item.blob.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(extension);
  });
}

function sourceUrl(file) {
  const key = fileKey(file);
  if (!state.sourceUrls.has(key)) state.sourceUrls.set(key, URL.createObjectURL(file));
  return state.sourceUrls.get(key);
}

function clearOutputUrls() {
  state.outputUrls.forEach(url => URL.revokeObjectURL(url));
  state.outputUrls = [];
}

function comparisonItems(sources, outputs) {
  if (!sources.length || !outputs.length) return [];
  const pair = (source, output, index) => {
    const afterUrl = URL.createObjectURL(output.blob);
    state.outputUrls.push(afterUrl);
    return {
      id: `${index}-${fileKey(source)}-${output.name}`,
      name: sources.length === outputs.length || sources.length === 1 ? output.name : source.name,
      beforeName: source.name,
      afterName: output.name,
      beforeSize: source.size,
      afterSize: output.blob.size,
      beforeUrl: sourceUrl(source),
      afterUrl
    };
  };

  if (sources.length === outputs.length) return outputs.map((output, index) => pair(sources[index], output, index));
  if (sources.length === 1) return outputs.map((output, index) => pair(sources[0], output, index));
  if (outputs.length === 1) return sources.map((source, index) => pair(source, outputs[0], index));
  return outputs.map((output, index) => pair(sources[Math.min(index, sources.length - 1)], output, index));
}

function ensureSection() {
  if (state.section?.isConnected) return true;
  const root = document.querySelector("#resultsPanel");
  if (!root) return false;

  const section = document.createElement("section");
  section.className = "compression-comparison image-before-after";
  section.dataset.imageBeforeAfter = "";
  section.setAttribute("aria-label", text.title);

  const heading = document.createElement("div");
  heading.className = "compression-comparison-heading";
  const titleWrap = document.createElement("div");
  const kicker = document.createElement("span");
  kicker.textContent = "PREVIEW";
  const title = document.createElement("h3");
  title.textContent = text.title;
  const name = document.createElement("p");
  titleWrap.append(kicker, title);
  heading.append(titleWrap, name);

  const tabs = document.createElement("div");
  tabs.className = "compression-comparison-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", text.tabs);
  const view = document.createElement("div");
  section.append(heading, tabs, view);

  const summary = root.querySelector(".summary-grid");
  if (summary) summary.after(section);
  else root.prepend(section);
  state.section = section;
  state.tabs = tabs;
  state.view = view;
  state.name = name;
  tabs.addEventListener("click", onTabClick);
  tabs.addEventListener("keydown", onTabKeydown);
  return true;
}

function imagePane(item, side) {
  const figure = document.createElement("figure");
  const caption = document.createElement("figcaption");
  caption.append(side === "before" ? text.before : text.after);
  const size = document.createElement("small");
  size.textContent = formatBytes(side === "before" ? item.beforeSize : item.afterSize);
  caption.append(size);
  const frame = document.createElement("div");
  const image = document.createElement("img");
  image.src = side === "before" ? item.beforeUrl : item.afterUrl;
  image.alt = `${side === "before" ? item.beforeName : item.afterName} — ${side === "before" ? text.before : text.after}`;
  const unavailable = document.createElement("p");
  unavailable.className = "image-before-after-placeholder";
  unavailable.textContent = text.unavailable;
  unavailable.hidden = true;
  image.addEventListener("error", () => { image.hidden = true; unavailable.hidden = false; }, { once: true });
  frame.append(image, unavailable);
  figure.append(caption, frame);
  return figure;
}

function renderSelected() {
  if (!state.items.length || !ensureSection()) return;
  const selected = state.items[Math.min(state.selected, state.items.length - 1)];
  state.name.textContent = selected.name;
  state.tabs.hidden = state.items.length < 2;
  state.tabs.replaceChildren(...state.items.map((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(index === state.selected));
    button.tabIndex = index === state.selected ? 0 : -1;
    button.dataset.comparisonIndex = String(index);
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    button.append(number, item.name);
    return button;
  }));
  const grid = document.createElement("div");
  grid.className = "compression-comparison-grid";
  grid.setAttribute("role", "tabpanel");
  grid.append(imagePane(selected, "before"), imagePane(selected, "after"));
  state.view.replaceChildren(grid);
}

function select(index, focus = false) {
  state.selected = Math.max(0, Math.min(index, state.items.length - 1));
  renderSelected();
  if (focus) state.tabs.querySelector(`[data-comparison-index="${state.selected}"]`)?.focus();
}

function onTabClick(event) {
  const button = event.target.closest("[data-comparison-index]");
  if (button) select(Number(button.dataset.comparisonIndex));
}

function onTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  let index = state.selected;
  if (event.key === "ArrowLeft") index = (index - 1 + state.items.length) % state.items.length;
  if (event.key === "ArrowRight") index = (index + 1) % state.items.length;
  if (event.key === "Home") index = 0;
  if (event.key === "End") index = state.items.length - 1;
  select(index, true);
}

function resetComparison() {
  clearOutputUrls();
  state.items = [];
  state.selected = 0;
  if (state.section) state.section.hidden = true;
}

document.addEventListener("change", event => {
  if (event.target instanceof HTMLInputElement && event.target.type === "file" && event.target.files?.length) {
    rememberSources(event.target.files);
    resetComparison();
  }
}, true);

document.addEventListener("drop", event => {
  if (event.dataTransfer?.files?.length) {
    rememberSources(event.dataTransfer.files);
    resetComparison();
  }
}, true);

document.addEventListener("click", event => {
  if (!event.target.closest("#clearButton, #removeAllButton, [data-remove]")) return;
  window.setTimeout(() => {
    if (!visibleSourceNames().length) {
      state.sources = [];
      for (const url of state.sourceUrls.values()) URL.revokeObjectURL(url);
      state.sourceUrls.clear();
    }
    resetComparison();
  });
});

document.addEventListener("shiagent:outputs", event => {
  const outputs = normalizeOutputs(event.detail?.files);
  if (!outputs.length) return;
  clearOutputUrls();
  state.items = comparisonItems(activeSources(), outputs);
  state.selected = 0;
  if (!state.items.length || !ensureSection()) return;
  state.section.hidden = false;
  renderSelected();
});

window.addEventListener("beforeunload", () => {
  clearOutputUrls();
  for (const url of state.sourceUrls.values()) URL.revokeObjectURL(url);
});
