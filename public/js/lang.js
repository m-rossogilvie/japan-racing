(function () {
  const here = document.documentElement.lang === "ja" ? "ja" : "en";
  let stored = "";
  try {
    stored = localStorage.getItem("lang") || "";
  } catch {
    stored = "";
  }
  const forced = /(?:^|[?&])hl=en(?:&|$)/.test(location.search);
  if (!forced && here === "en" && stored === "ja" && location.pathname === "/") {
    location.replace("/ja" + location.hash);
    return;
  }
  try {
    localStorage.setItem("lang", forced ? "en" : here);
  } catch {
    /* storage can be blocked */
  }
  document.querySelectorAll(".langs a").forEach((link) => {
    link.addEventListener("click", () => {
      if (!location.hash) return;
      const url = new URL(link.getAttribute("href"), location.origin);
      url.hash = location.hash;
      link.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
    });
  });
})();
