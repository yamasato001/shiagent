// Google Analytics 4. Loaded from our own file because the site's CSP forbids
// inline scripts, so the standard gtag snippet cannot be pasted into the pages.
//
// - Japanese pages measure every visit unless the visitor turned analytics off.
// - English pages ask first (visitors may be in the EU/UK) and measure only after "Allow".
// - Only the page path is reported. Query strings are dropped because they can
//   carry user data (?customWorkflow=…), and nothing about loaded files is sent.
import { lang, localPath, pick } from "./i18n.js";
import analyticsText from "./i18n/analytics.js";

export const MEASUREMENT_ID = "G-9W13K3S1GQ";
const STORAGE_KEY = "shiagent-analytics"; // "granted" | "denied"
const copy = pick(analyticsText);
// Local previews and other hosts never report.
const production = location.hostname === "shiagent.com";

function storedChoice() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function storeChoice(value) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* storage unavailable */ }
}

function enabled() {
  const choice = storedChoice();
  if (choice === "denied") return false;
  return lang === "ja" || choice === "granted";
}

function withoutQuery(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch { return ""; }
}

let loaded = false;
function load() {
  if (loaded || !production) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  // gtag expects the raw `arguments` object, not an array.
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    page_location: location.origin + location.pathname,
    page_referrer: document.referrer ? withoutQuery(document.referrer) : "",
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.append(script);
}

function showBanner() {
  const banner = document.createElement("div");
  banner.className = "analytics-consent";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", copy.bannerLabel);
  const text = document.createElement("p");
  const link = document.createElement("a");
  link.href = localPath("/privacy/");
  link.textContent = copy.privacyLink;
  text.append(`${copy.bannerText} `, link);
  const actions = document.createElement("div");
  for (const [label, value, className] of [[copy.decline, "denied", "analytics-consent-decline"], [copy.accept, "granted", "analytics-consent-accept"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", () => {
      storeChoice(value);
      banner.remove();
      if (value === "granted") load();
    });
    actions.append(button);
  }
  banner.append(text, actions);
  document.body.append(banner);
}

// Privacy page: lets the visitor see and change the setting in either language.
function bindPreference() {
  const button = document.querySelector("[data-analytics-toggle]");
  const status = document.querySelector("[data-analytics-status]");
  if (!button || !status) return;
  const render = message => {
    const on = enabled();
    status.textContent = message || (on ? copy.statusOn : copy.statusOff);
    button.textContent = on ? copy.turnOff : copy.turnOn;
  };
  button.addEventListener("click", () => {
    const next = enabled() ? "denied" : "granted";
    storeChoice(next);
    // Stops further hits from an already loaded tag on this page.
    window[`ga-disable-${MEASUREMENT_ID}`] = next === "denied";
    document.querySelector(".analytics-consent")?.remove();
    if (next === "granted") load();
    render(`${next === "granted" ? copy.statusOn : copy.statusOff} ${copy.applied}`);
    button.textContent = next === "granted" ? copy.turnOff : copy.turnOn;
  });
  button.hidden = false;
  render();
}

if (enabled()) load();
else if (storedChoice() !== "denied") showBanner();
bindPreference();
