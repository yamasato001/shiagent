import { installOutputNaming } from "./output-name.js";
import { installOutputSaving } from "./output-save.js";
import { installDriveInput } from "./drive-input.js";

const CATALOG_URL = "/ai/tools.json";
const currentPath = location.pathname.replace(/^\/ja(?=\/)/, "");
let lastEvent = null;
let currentTool = null;

const ready = fetch(CATALOG_URL, { credentials: "same-origin" })
  .then(response => {
    if (!response.ok) throw new Error(`Tool catalog request failed: ${response.status}`);
    return response.json();
  })
  .then(catalog => {
    const tool = catalog.tools.find(item => Object.values(item.paths).includes(currentPath)) || null;
    currentTool = tool;
    if (tool) {
      installOutputNaming();
      installOutputSaving();
      installDriveInput(tool.automation?.input);
      notifyOutputOptionsIfReady(tool);
    }
    installStableHooks(tool);
    installStructuredData(tool);
    document.dispatchEvent(new CustomEvent("shiagent:ready", { detail: { tool, catalogVersion: catalog.version } }));
    return { catalog, tool };
  });

function selectorElement(selector) {
  return selector ? document.querySelector(selector) : null;
}

function selectorElements(selector) {
  return selector ? [...document.querySelectorAll(selector)] : [];
}

function isVisible(element) {
  if (!element || element.hidden || element.closest("[hidden]")) return false;
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function notifyOutputOptionsIfReady(tool = currentTool) {
  const download = selectorElement(tool?.automation?.download);
  if (download && !download.disabled && isVisible(download)) {
    document.dispatchEvent(new CustomEvent("shiagent:output-options-ready"));
  }
}

function installStableHooks(tool) {
  if (!tool) return;
  document.documentElement.dataset.shiagentTool = tool.id;
  const hooks = {
    input: tool.automation.input,
    run: tool.automation.action,
    result: tool.automation.result,
    download: tool.automation.download,
    status: tool.automation.status,
  };
  const elementHooks = new Map();
  for (const [name, selector] of Object.entries(hooks)) {
    const element = selectorElement(selector);
    if (!element) continue;
    if (!elementHooks.has(element)) elementHooks.set(element, []);
    elementHooks.get(element).push(name);
  }
  for (const [element, names] of elementHooks) {
    element.dataset.ai = names.join(" ");
    for (const name of names) element.dataset[`ai${name[0].toUpperCase()}${name.slice(1)}`] = "";
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
  const status = selectorElement(tool.automation.status) || result?.querySelector?.('[role="status"]') || document.querySelector('[role="status"]');
  return {
    tool: tool.id,
    availability: tool.status,
    inputCount: input?.files?.length ?? null,
    resultVisible: result ? isVisible(result) : null,
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
  let element = selectorElement(selector);
  if (!element) throw new Error(`Control not found: ${selector}`);
  if (element.type === "radio" && typeof value === "string" && element.value !== value && element.name) {
    element = [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(element.name)}"]`)].find(candidate => candidate.value === value) || element;
  }
  if (element.type === "checkbox" || element.type === "radio") {
    const normalized = typeof value === "string" ? !["", "0", "false", "off", "no"].includes(value.trim().toLowerCase()) : Boolean(value);
    element.checked = normalized;
  } else element.value = String(value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return getState();
}

async function setValues(selector, values) {
  const elements = selectorElements(selector);
  if (!elements.length) throw new Error(`Controls not found: ${selector}`);
  if (!Array.isArray(values) || values.length !== elements.length) throw new Error(`Expected ${elements.length} values for ${selector}.`);
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    element.value = String(values[index]);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return getState();
}

async function click(selector) {
  const element = selectorElement(selector);
  if (!element) throw new Error(`Control not found: ${selector}`);
  if (element.disabled) throw new Error(`Control is disabled: ${selector}`);
  element.click();
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

function reportError(error, source = "tool") {
  const message = error?.message || String(error || "Tool error");
  document.dispatchEvent(new CustomEvent("shiagent:error", { detail: { message, source } }));
}

for (const type of ["shiagent:outputs", "shiagent:traychange", "shiagent:error"]) {
  document.addEventListener(type, event => {
    lastEvent = { type, detail: event.detail || null, at: new Date().toISOString() };
  });
}

let stateTimer;
let lastObservedError = "";
new MutationObserver(() => {
  window.clearTimeout(stateTimer);
  stateTimer = window.setTimeout(async () => {
    const errorStatus = [...document.querySelectorAll('[role="status"].is-error, [role="alert"]')].find(isVisible);
    const message = errorStatus?.textContent?.trim() || "";
    if (message && message !== lastObservedError) {
      lastObservedError = message;
      document.dispatchEvent(new CustomEvent("shiagent:error", { detail: { message, source: "visible-status" } }));
    }
    if (!message) lastObservedError = "";
    installStableHooks(currentTool);
    notifyOutputOptionsIfReady();
    document.dispatchEvent(new CustomEvent("shiagent:statechange", { detail: await getState() }));
  }, 60);
}).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "disabled", "class"] });

window.addEventListener("error", event => {
  reportError(event.message || "JavaScript error", "window-error");
});
window.addEventListener("unhandledrejection", event => {
  reportError(event.reason || "Unhandled promise rejection", "unhandled-rejection");
});

const originalConsoleError = console.error.bind(console);
console.error = (...values) => {
  originalConsoleError(...values);
  reportError(values.find(value => value instanceof Error) || values.map(value => String(value)).join(" "), "console-error");
};

window.SHIAGENT = Object.freeze({
  version: "1.0",
  ready,
  getCatalog: async () => (await ready).catalog,
  getContract: contract,
  getState,
  loadFiles,
  setValue,
  setValues,
  click,
  reportError,
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
