const header = document.querySelector(".site-header");
const toggle = header?.querySelector(".menu-toggle");
const mobileQuery = window.matchMedia("(max-width: 760px)");

function closeMenu({ restoreFocus = false } = {}) {
  if (!header || !toggle) return;
  header.classList.remove("is-menu-open");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", document.documentElement.lang === "ja" ? "メニューを開く" : "Open menu");
  if (restoreFocus) toggle.focus();
}

if (header && toggle) {
  toggle.addEventListener("click", () => {
    const willOpen = !header.classList.contains("is-menu-open");
    header.classList.toggle("is-menu-open", willOpen);
    toggle.setAttribute("aria-expanded", String(willOpen));
    toggle.setAttribute("aria-label", document.documentElement.lang === "ja"
      ? (willOpen ? "メニューを閉じる" : "メニューを開く")
      : (willOpen ? "Close menu" : "Open menu"));
  });

  header.addEventListener("click", event => {
    if (mobileQuery.matches && event.target.closest("nav a")) closeMenu();
  });

  header.querySelector(".site-search-input")?.addEventListener("focus", () => closeMenu());

  document.addEventListener("pointerdown", event => {
    if (mobileQuery.matches && header.classList.contains("is-menu-open") && !header.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && header.classList.contains("is-menu-open")) closeMenu({ restoreFocus: true });
  });

  mobileQuery.addEventListener("change", () => closeMenu());
}
