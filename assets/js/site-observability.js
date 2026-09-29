const STORAGE_KEY = "shiagent.diagnostics.v1";
const MAX_EVENTS = 30;
const startedAt = performance.now();

function clean(value) {
  return String(value || "")
    .replace(/[A-Z]:\\[^\s]+/gi, "[local-path]")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .replace(/blob:[^\s]+/g, "[blob-url]")
    .slice(0, 500);
}

function readEvents() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function record(type, detail = {}) {
  const event = {
    type,
    at: new Date().toISOString(),
    path: location.pathname,
    elapsedMs: Math.round(performance.now() - startedAt),
    detail: Object.fromEntries(Object.entries(detail).map(([key, value]) => [key, clean(value)])),
  };
  const events = [...readEvents(), event].slice(-MAX_EVENTS);
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch {}
  document.dispatchEvent(new CustomEvent("shiagent:diagnostic", { detail: event }));
}

function snapshot() {
  return {
    generatedAt: new Date().toISOString(),
    page: location.pathname,
    language: document.documentElement.lang,
    browser: navigator.userAgent,
    online: navigator.onLine,
    events: readEvents(),
  };
}

window.addEventListener("error", event => record("javascript-error", {
  message: event.message,
  source: event.filename ? new URL(event.filename, location.href).pathname : "",
  line: event.lineno,
  column: event.colno,
}));
window.addEventListener("unhandledrejection", event => record("promise-rejection", {
  message: event.reason?.message || event.reason,
}));
document.addEventListener("shiagent:ready", event => record("tool-ready", { tool: event.detail?.tool?.id || "catalog" }));
document.addEventListener("shiagent:outputs", event => record("tool-output", { count: event.detail?.files?.length || 0, source: event.detail?.source || "" }));
document.addEventListener("shiagent:traychange", event => record("tray-change", { count: event.detail?.count || 0, source: event.detail?.source || "" }));
document.addEventListener("shiagent:error", event => record("tool-error", { message: event.detail?.message || "Tool error" }));

window.SHIAGENT_DIAGNOSTICS = Object.freeze({ record, snapshot, clear: () => sessionStorage.removeItem(STORAGE_KEY) });
