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
    const params = new URLSearchParams(location.search);
    params.delete("hl");
    const query = params.toString();
    location.replace(`/ja${query ? `?${query}` : ""}${location.hash}`);
    return;
  }
  try {
    localStorage.setItem("lang", forced ? "en" : here);
  } catch {
    /* storage can be blocked */
  }
  document.querySelectorAll(".langs a").forEach((link) => {
    link.addEventListener("click", () => {
      const url = new URL(link.getAttribute("href"), location.origin);
      const current = new URLSearchParams(location.search);
      current.forEach((value, key) => {
        if (key === "hl") return;
        if (!url.searchParams.has(key)) url.searchParams.set(key, value);
      });
      if (location.hash) url.hash = location.hash;
      link.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
    });
  });
})();
