(function () {
  const VIEWS = ["result", "times", "car", "all"];

  function stored(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function remember(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage can be blocked */
    }
  }

  function read(key, fallback) {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get(key);
    if (fromUrl) return fromUrl;
    return stored(key) || fallback;
  }

  function reflect(key, value, fallback) {
    remember(key, value);
    const url = new URL(location.href);
    if (!value || value === fallback) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (next !== `${location.pathname}${location.search}${location.hash}`) {
      history.replaceState(null, "", next);
    }
  }

  function setPressed(group, value) {
    if (!group) return;
    group.querySelectorAll("button[data-value]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-value") === value ? "true" : "false");
    });
  }

  function applyView(value) {
    const view = VIEWS.includes(value) ? value : "result";
    document.querySelectorAll(".sheet-views").forEach((root) => {
      root.setAttribute("data-view", view);
      setPressed(root.querySelector(".view-switch"), view);
    });
    return view;
  }

  function applyClass(value) {
    document.querySelectorAll(".sheet-views").forEach((root) => {
      const bodies = [...root.querySelectorAll("tbody[data-class]")];
      const group = root.querySelector(".class-switch");
      if (!bodies.length) return;
      const ours = root.getAttribute("data-ours") || "";
      const showAll = value === "all";
      const wanted = !value || value === "ours" ? ours : value;
      const has = bodies.some((body) => body.getAttribute("data-class") === wanted);
      const slug = showAll ? "all" : has ? wanted : ours;
      bodies.forEach((body) => {
        body.hidden = slug !== "all" && body.getAttribute("data-class") !== slug;
      });
      root.setAttribute("data-class", slug || "all");
      const buttons = group ? [...group.querySelectorAll("button[data-value]")] : [];
      const values = buttons.map((btn) => btn.getAttribute("data-value"));
      let pressed = slug;
      if (!values.includes(pressed) && values.includes("ours") && (value === "ours" || slug === ours)) pressed = "ours";
      if (!values.includes(pressed) && values.includes("all") && !slug) pressed = "all";
      setPressed(group, pressed);
    });
  }

  function applyTz(value) {
    const tz = value === "syd" ? "syd" : "jst";
    document.body.setAttribute("data-tz", tz);
    document.querySelectorAll(".tz-switch").forEach((group) => setPressed(group, tz));
    return tz;
  }

  const view = applyView(read("view", "result"));
  applyClass(read("class", "ours"));
  const tz = applyTz(read("tz", "jst"));
  reflect("view", view, "result");
  const classValue = read("class", "ours");
  reflect("class", classValue === "ours" ? "ours" : classValue, "ours");
  reflect("tz", tz, "jst");

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pref] button[data-value]");
    if (!button) return;
    const group = button.closest("[data-pref]");
    const key = group.getAttribute("data-pref");
    const value = button.getAttribute("data-value");
    if (key === "view") {
      const next = applyView(value);
      reflect("view", next, "result");
    } else if (key === "class") {
      const root = group.closest(".sheet-views");
      const ours = root?.getAttribute("data-ours") || "";
      const storedValue = value === ours ? "ours" : value;
      applyClass(storedValue);
      reflect("class", storedValue, "ours");
    } else if (key === "tz") {
      const next = applyTz(value);
      reflect("tz", next, "jst");
    }
  });

  function selectTab(tab) {
    const root = tab.closest("[data-tabs]");
    if (!root) return;
    const tabs = [...root.querySelectorAll("[role=tab]")];
    const panels = [...root.querySelectorAll("[role=tabpanel]")];
    tabs.forEach((item) => {
      const on = item === tab;
      item.setAttribute("aria-selected", on ? "true" : "false");
      item.tabIndex = on ? 0 : -1;
    });
    const panelId = tab.getAttribute("aria-controls");
    panels.forEach((panel) => {
      panel.hidden = panel.id !== panelId;
    });
  }

  document.querySelectorAll("[data-tabs] [role=tablist]").forEach((list) => {
    list.addEventListener("keydown", (event) => {
      const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
      if (!keys.includes(event.key)) return;
      const tabs = [...list.querySelectorAll("[role=tab]")];
      const current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      let next = current;
      if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
      if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      tabs[next].focus();
      selectTab(tabs[next]);
    });
  });

  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[role=tab]");
    if (tab) selectTab(tab);
  });

  function revealHash() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    const panel = el.closest("[role=tabpanel]");
    if (panel) {
      const tab = document.getElementById(panel.getAttribute("aria-labelledby") || "");
      if (tab) selectTab(tab);
    }
    const details = el.closest("details");
    if (details) details.open = true;
  }

  revealHash();
  window.addEventListener("hashchange", revealHash);
})();
