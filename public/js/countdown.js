(function () {
  const root = document.querySelector("[data-countdown-root]");
  const slot = document.getElementById("schedule");
  if (!root || !slot) return;

  let schedule = [];
  try {
    schedule = JSON.parse(slot.textContent || "[]");
  } catch {
    return;
  }
  if (!schedule.length) return;

  const label = root.querySelector("[data-session-label]");
  const units = {
    d: root.querySelector("[data-unit=d]"),
    h: root.querySelector("[data-unit=h]"),
    m: root.querySelector("[data-unit=m]"),
    s: root.querySelector("[data-unit=s]"),
  };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function current() {
    const now = Date.now();
    return schedule.find((item) => Date.parse(item.iso) > now) || null;
  }

  function paint() {
    const item = current();
    if (!item) {
      if (label) label.textContent = root.getAttribute("data-reached") || "Session time reached.";
      for (const key of Object.keys(units)) {
        if (units[key]) units[key].textContent = "00";
      }
      return;
    }
    if (label) {
      label.textContent = item.detail || item.label || "";
      if (item.unconfirmed) {
        const flag = document.createElement("span");
        flag.className = "flag";
        flag.textContent = root.getAttribute("data-flag") || "Unconfirmed";
        label.append(" ");
        label.append(flag);
      }
    }
    const diff = Math.max(0, Date.parse(item.iso) - Date.now());
    const total = Math.floor(diff / 1000);
    if (units.d) units.d.textContent = pad(Math.floor(total / 86400));
    if (units.h) units.h.textContent = pad(Math.floor((total % 86400) / 3600));
    if (units.m) units.m.textContent = pad(Math.floor((total % 3600) / 60));
    if (units.s) units.s.textContent = pad(total % 60);
  }

  paint();
  setInterval(paint, 1000);
})();
