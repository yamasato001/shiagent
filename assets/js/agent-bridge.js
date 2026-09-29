const CATALOG_URL = "/ai/tools.json";
const currentPath = location.pathname.replace(/^\/ja(?=\/)/, "");
let lastEvent = null;

const ready = fetch(CATALOG_URL, { credentials: "same-origin" })
  .then(response => {
    if (!response.ok) throw new Error(`Tool catalog request failed: ${response.status}`);
    return response.json();
  })
  .then(catalog => {
    const tool = catalog.tools.find(item => Object.values(item.paths).includes(currentPath)) || null;
    installStableHooks(tool);
    installStructuredData(tool);
    document.dispatchEvent(new CustomEvent("shiagent:ready", { detail: { tool, catalogVersion: catalog.version } }));
    return { catalog, tool };
  });

function selectorElement(selector) {
  return selector ? document.querySelector(selector) : null;
}

function installStableHooks(tool) {
  if (!tool) return;
  document.documentElement.dataset.shiagentTool = tool.id;
  const hooks = {
    input: tool.automation.input,
    run: tool.automation.action,
    result: tool.automation.result,
    download: tool.automation.download,
  };
  for (const [name, selector] of Object.entries(hooks)) {
    const element = selectorElement(selector);
    if (element) element.dataset.ai = name;
  }
}

function installStructuredData(tool) {
  if (!tool || document.querySelector('script[data-seo="software-application"]')) return;
  const locale = document.documentElement.lang || "en";
  const name = tool.name[locale] || tool.name.en;
  const description = tool.description[locale] || tool.description.en;
  const data = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url: location.href.split(/[?#]/)[0],
    applicationCategory: tool.category,
    operatingSystem: "Any",
    browserRequirements: "Requires a modern web browser with JavaScript enabled",
    inLanguage: locale,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: ["On-device processing", "No file upload", "Browser-based batch processing"],
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.dataset.seo = "software-application";
  script.textContent = JSON.stringify(data);
  document.head.append(script);
}

async function contract() {
  return (await ready).tool;
}

async function getState() {
  const tool = await contract();
  if (!tool) return { tool: null, status: "catalog-only" };
  const input = selectorElement(tool.automation.input);
  const result = selectorElement(tool.automation.result);
  const status = document.querySelector('[role="status"]');
  return {
    tool: tool.id,
    availability: tool.status,
    inputCount: input?.files?.length ?? null,
    resultVisible: result ? !result.hidden : null,
    busy: Boolean(selectorElement(tool.automation.action)?.disabled),
    statusText: status?.textContent?.trim() || "",
    lastEvent,
  };
}

async function loadFiles(files) {
  const tool = await contract();
  const input = selectorElement(tool?.automation.input);
  if (!input) throw new Error("This page does not expose a file input.");
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return getState();
}

async function setValue(selector, value) {
  const element = selectorElement(selector);
  if (!element) throw new Error(`Control not found: ${selector}`);
  if (element.type === "checkbox" || element.type === "radio") element.checked = Boolean(value);
  else element.value = String(value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return getState();
}

async function activate(kind = "action") {
  const tool = await contract();
  const selector = tool?.automation[kind];
  const element = selectorElement(selector);
  if (!element) throw new Error(`Tool action is unavailable: ${kind}`);
  if (element.disabled) throw new Error(`Tool action is disabled: ${kind}`);
  element.click();
  return getState();
}

function waitFor(type = "shiagent:statechange", timeout = 120000) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      document.removeEventListener(type, done);
      reject(new Error(`Timed out waiting for ${type}`));
    }, timeout);
    function done(event) {
      window.clearTimeout(timer);
      document.removeEventListener(type, done);
      resolve(event.detail);
    }
    document.addEventListener(type, done, { once: true });
  });
}

for (const type of ["shiagent:outputs", "shiagent:traychange", "shiagent:error"]) {
  document.addEventListener(type, event => {
    lastEvent = { type, detail: event.detail || null, at: new Date().toISOString() };
  });
}

let stateTimer;
new MutationObserver(() => {
  window.clearTimeout(stateTimer);
  stateTimer = window.setTimeout(async () => {
    document.dispatchEvent(new CustomEvent("shiagent:statechange", { detail: await getState() }));
  }, 60);
}).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "disabled", "class"] });

window.SHIAGENT = Object.freeze({
  version: "1.0",
  ready,
  getCatalog: async () => (await ready).catalog,
  getContract: contract,
  getState,
  loadFiles,
  setValue,
  run: () => activate("action"),
  download: () => activate("download"),
  waitFor,
  navigate: async (toolId, options = {}) => {
    const { catalog } = await ready;
    const target = catalog.tools.find(item => item.id === toolId);
    if (!target) throw new Error(`Unknown tool: ${toolId}`);
    const locale = document.documentElement.lang === "ja" ? "ja" : "en";
    location.href = `${target.paths[locale]}${options.tray ? "?tray=1" : ""}`;
  },
});
