// Tools / Workflows tabs on the home page (WAI-ARIA tabs pattern).
// The selected tab is kept in ?tab= so it can be linked and survives reloads.
const tabs = [...document.querySelectorAll('.catalog-tabs [role="tab"]')];
const eyebrow = document.querySelector("#catalogEyebrow");
const heading = document.querySelector("#tools-title");
const filters = document.querySelector("#toolFilters");
let category = "all";

function categoryFor(card) {
  const path = new URL(card.href, location.href).pathname.toLowerCase();
  if (path === "/pdf/" || path === "/ja/pdf/") return "pdf";
  if (path.includes("batch-rename")) return "file";
  if (path.includes("svg")) return "vector";
  return "image";
}

function filterTools() {
  for (const card of document.querySelectorAll("#panel-tools .tool-card")) {
    card.hidden = category !== "all" && categoryFor(card) !== category;
  }
}

function cardsIn(tab) {
  return document.getElementById(tab.getAttribute("aria-controls")).querySelectorAll(".tool-card").length;
}

function select(tab, { focus = false, updateUrl = true } = {}) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute("aria-controls")).hidden = !selected;
  }
  // The section heading follows the tab: "All tools" / "All workflows".
  eyebrow.textContent = tab.dataset.eyebrow;
  heading.textContent = tab.dataset.heading;
  if (filters) filters.hidden = tab.dataset.tab !== "tools";
  if (focus) tab.focus();
  if (updateUrl) {
    const url = new URL(location.href);
    if (tab === tabs[0]) url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab.dataset.tab);
    history.replaceState(null, "", url);
  }
}

filters?.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  category = button.dataset.category;
  filters.querySelectorAll("[data-category]").forEach(item => item.classList.toggle("is-active", item === button));
  filterTools();
});

if (tabs.length) {
  tabs.forEach(tab => tab.querySelector("span").textContent = String(cardsIn(tab)));
  tabs.forEach(tab => tab.addEventListener("click", () => select(tab)));
  tabs[0].parentElement.addEventListener("keydown", event => {
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length], { focus: true });
  });
  const tabFor = params => tabs.find(tab => tab.dataset.tab === params.get("tab")) || tabs[0];
  select(tabFor(new URLSearchParams(location.search)), { updateUrl: false });

  // Header "Tools" / "Workflows" links (/#tools, /?tab=workflows#tools) switch
  // the tab in place on the home page instead of reloading it.
  document.addEventListener("click", event => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.hash !== "#tools") return;
    event.preventDefault();
    select(tabFor(url.searchParams));
    history.replaceState(null, "", `${location.pathname}${location.search}#tools`);
    document.getElementById("tools").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
