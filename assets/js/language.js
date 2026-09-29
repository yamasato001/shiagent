// Remembers the language a visitor picks in the header switch and, on later
// visits, sends them to that language's version of the page (from the
// <link rel="alternate" hreflang> tags). Only a manual choice is honored;
// the browser language is never used, so crawlers see every URL as-is.
// Loaded as a classic script in <head>, after the alternate links.
(() => {
  const KEY = "shiagent-lang";
  const current = document.documentElement.lang === "en" ? "en" : "ja";
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
  if ((saved === "en" || saved === "ja") && saved !== current) {
    const alternate = document.querySelector(`link[rel="alternate"][hreflang="${saved}"]`);
    if (alternate) {
      location.replace(new URL(alternate.getAttribute("href"), location.href).pathname + location.search + location.hash);
      return;
    }
  }
  document.addEventListener("click", event => {
    const link = event.target instanceof Element ? event.target.closest(".language a[hreflang]") : null;
    if (!link) return;
    try { localStorage.setItem(KEY, link.getAttribute("hreflang")); } catch { /* storage unavailable */ }
  });
  if (new URLSearchParams(location.search).has("customWorkflow")) {
    const loadRunner = () => import("/assets/js/custom-workflow-runtime.js").catch(error => console.error("Custom workflow could not start", error));
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadRunner, { once: true });
    else loadRunner();
  }
})();
