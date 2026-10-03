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
})();
