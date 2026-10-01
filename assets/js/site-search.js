// Header search: suggestions as you type (ARIA combobox + listbox).
// Ranking lives in site-search-core.js. Also keeps --site-header-height in sync
// for the sticky header (scroll padding, other sticky bars).
import { searchSite } from "./site-search-core.js";
import { lang, localPath, pick } from "./i18n.js";
import searchText from "./i18n/site-search.js";

const copy = pick(searchText);
const header = document.querySelector(".site-header");

if (header && "ResizeObserver" in window) {
  const sync = () => document.documentElement.style.setProperty("--site-header-height", `${header.offsetHeight}px`);
  new ResizeObserver(sync).observe(header);
  sync();
}

const form = document.querySelector("[data-site-search]");
const input = form?.querySelector("input[type=search]");

if (form && input) {
  const list = document.createElement("div");
  list.className = "site-search-results";
  list.id = "siteSearchResults";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", copy.results);
  list.hidden = true;
  const status = document.createElement("span");
  status.className = "site-search-status";
  status.setAttribute("role", "status");
  form.append(list, status);

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");

  let results = [];
  let active = -1;

  const optionId = index => `siteSearchOption${index}`;
  const close = () => {
    list.hidden = true;
    active = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };
  const setActive = index => {
    active = index;
    list.querySelectorAll("[role=option]").forEach((option, i) => {
      option.classList.toggle("is-active", i === index);
      option.setAttribute("aria-selected", String(i === index));
    });
    if (index >= 0) {
      input.setAttribute("aria-activedescendant", optionId(index));
      document.getElementById(optionId(index))?.scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  };

  const render = () => {
    const query = input.value.trim();
    if (!query) { close(); status.textContent = ""; return; }
    results = searchSite(query);
    list.replaceChildren();
    if (!results.length) {
      const empty = document.createElement("p");
      empty.className = "site-search-empty";
      const link = document.createElement("a");
      link.href = `${localPath("/")}#tools`;
      link.textContent = copy.browseAll;
      empty.append(`${copy.noResults} `, link);
      list.append(empty);
    }
    results.forEach((entry, index) => {
      const option = document.createElement("a");
      option.className = "site-search-option";
      option.id = optionId(index);
      option.href = localPath(entry.path);
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.tabIndex = -1;
      const kind = document.createElement("span");
      kind.textContent = copy.kind[entry.kind];
      const name = document.createElement("strong");
      name.textContent = entry.name[lang];
      const description = document.createElement("small");
      description.textContent = entry.description[lang];
      option.append(kind, name, description);
      // Navigate on pointerdown so the input's blur does not close the list first.
      option.addEventListener("pointerdown", event => { event.preventDefault(); location.href = option.href; });
      list.append(option);
    });
    list.hidden = false;
    input.setAttribute("aria-expanded", String(results.length > 0));
    status.textContent = results.length ? copy.count(results.length) : copy.noResults;
    setActive(results.length ? 0 : -1);
  };

  input.addEventListener("input", render);
  input.addEventListener("focus", () => { if (input.value.trim()) render(); });
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      if (list.hidden) render(); else setActive((active + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActive((active - 1 + results.length) % results.length);
    } else if (event.key === "Escape") {
      if (!list.hidden) { event.preventDefault(); close(); }
      else input.value = "";
    }
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!input.value.trim()) return;
    if (list.hidden) render();
    const target = results[Math.max(active, 0)];
    if (target) location.href = localPath(target.path);
  });

  // "/" focuses the search box, unless the visitor is typing somewhere.
  document.addEventListener("keydown", event => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
    event.preventDefault();
    input.focus();
  });

  // Without JavaScript the form submits to the home page with ?q=; show those results.
  const initial = new URLSearchParams(location.search).get("q");
  if (initial) { input.value = initial; render(); input.focus(); }
}
