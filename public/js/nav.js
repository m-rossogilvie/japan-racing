(function () {
  const siteMenu = document.querySelector("#site-menu");
  const menuSummary = siteMenu?.querySelector("summary");
  const racesMenu = document.querySelector(".races-menu");
  const racesSummary = racesMenu?.querySelector("summary");

  function focusable(root) {
    return [...root.querySelectorAll("a[href], button:not([disabled]), summary")].filter((el) => {
      if (el.closest("[hidden]")) return false;
      return el.getClientRects().length > 0;
    });
  }

  function syncMenu() {
    if (!siteMenu || !menuSummary) return;
    const open = siteMenu.open;
    menuSummary.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("menu-open", open);
    if (!open) return;
    const panel = siteMenu.querySelector(".menu-panel");
    const first = panel?.querySelector("a, button");
    first?.focus();
  }

  siteMenu?.addEventListener("toggle", syncMenu);

  racesMenu?.addEventListener("toggle", () => {
    racesSummary?.setAttribute("aria-expanded", racesMenu.open ? "true" : "false");
  });

  document.addEventListener("click", (event) => {
    if (!racesMenu?.open) return;
    if (racesMenu.contains(event.target)) return;
    racesMenu.open = false;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (siteMenu?.open) {
        event.preventDefault();
        siteMenu.open = false;
        menuSummary?.focus();
        return;
      }
      if (racesMenu?.open) {
        event.preventDefault();
        racesMenu.open = false;
        racesSummary?.focus();
      }
      return;
    }
    if (event.key !== "Tab" || !siteMenu?.open) return;
    const items = focusable(siteMenu);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const links = [...document.querySelectorAll(".jump a")];
  if (!links.length) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fromHash = links.find((link) => link.hash && link.hash === location.hash);
  (fromHash || links[0]).setAttribute("aria-current", "true");

  const sections = links
    .map((link) => document.getElementById(link.hash.slice(1)))
    .filter(Boolean);
  if (!sections.length || !("IntersectionObserver" in window)) return;
  const byId = new Map(links.map((link) => [link.hash.slice(1), link]));
  const observer = new IntersectionObserver((entries) => {
    const hit = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!hit) return;
    for (const link of links) link.removeAttribute("aria-current");
    const link = byId.get(hit.target.id);
    if (!link) return;
    link.setAttribute("aria-current", "true");
    const bar = link.parentElement;
    if (!bar) return;
    const left = link.offsetLeft - (bar.clientWidth - link.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, { rootMargin: "-25% 0px -65% 0px", threshold: 0 });
  for (const section of sections) observer.observe(section);
})();
