(function () {
  function zone(iso) {
    // en-AU is what returns AEST or AEDT. ja-JP names the same zone GMT+10 or GMT+11.
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    }).formatToParts(new Date(iso));
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return { clock: `${get("hour")}:${get("minute")}`, name: get("timeZoneName") };
  }

  function paint(el) {
    const start = el.getAttribute("data-iso");
    if (!start) return;
    const open = zone(start);
    const endIso = el.getAttribute("data-end");
    if (!endIso) {
      el.textContent = `${open.clock} ${open.name}`;
      return;
    }
    const close = zone(endIso);
    const name = open.name === close.name ? open.name : `${open.name}–${close.name}`;
    el.textContent = `${open.clock}–${close.clock} ${name}`;
  }

  document.querySelectorAll("[data-sydney]").forEach(paint);
})();
