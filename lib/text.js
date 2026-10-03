const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WORD = {
  ross: "Ross",
  kyle: "Kyle",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
  jst: "JST",
  aest: "AEST",
  mec: "MEC",
  scr: "SCR",
};

export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function humanize(key) {
  const spaced = String(key)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(\d+)/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((word) => WORD[word] || word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function hasUnconfirmed(value) {
  if (typeof value === "string") return /unconfirmed/i.test(value);
  if (Array.isArray(value)) return value.some(hasUnconfirmed);
  if (value && typeof value === "object") return Object.values(value).some(hasUnconfirmed);
  return false;
}

export function linkify(escaped) {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (url) => {
    const clean = url.replace(/[),.;]+$/g, "");
    const trail = url.slice(clean.length);
    return `<a href="${clean}">${clean}</a>${trail}`;
  });
}

export function rich(value, locale) {
  const original = String(value);
  const text = locale?.tr ? locale.tr(original) : original;
  let html = linkify(esc(text)).replace(/\n/g, "<br>");
  if (locale?.href) {
    const href = locale.href("/kyle-wynne");
    html = html.replace(/Kyle Wynne/g, `<a href="${href}">Kyle Wynne</a>`);
  }
  const flags = [];
  if (/unconfirmed/i.test(text) || /未確認/.test(text)) flags.push(flag(locale, "flag_unconfirmed", "Unconfirmed"));
  if (/provisional/i.test(text) || /暫定/.test(text)) flags.push(flag(locale, "flag_provisional", "Provisional"));
  return flags.length ? `${html} ${flags.join(" ")}` : html;
}

function flag(locale, key, fallback) {
  const label = locale?.t ? locale.t(key) : fallback;
  return `<span class="flag">${esc(label)}</span>`;
}

export function formatWeekend(raw, lang = "en") {
  const text = String(raw || "");
  const dates = [...text.matchAll(/20\d{2}-\d{2}-\d{2}/g)].map((match) => match[0]);
  if (!dates.length) return text;
  const parts = dates.map((iso) => {
    const [year, month, day] = iso.split("-").map(Number);
    return { year, month, day, mon: MONTHS[month - 1] };
  });
  const [a, b] = parts;
  if (lang === "ja") {
    if (!b || dates[0] === dates[1]) return `${a.year}年${a.month}月${a.day}日`;
    if (a.year === b.year && a.month === b.month) return `${a.year}年${a.month}月${a.day}–${b.day}日`;
    if (a.year === b.year) return `${a.year}年${a.month}月${a.day}日–${b.month}月${b.day}日`;
    return `${a.year}年${a.month}月${a.day}日–${b.year}年${b.month}月${b.day}日`;
  }
  if (!b || dates[0] === dates[1]) return `${a.day} ${a.mon} ${a.year}`;
  if (a.year === b.year && a.month === b.month) return `${a.day}–${b.day} ${a.mon} ${a.year}`;
  if (a.year === b.year) return `${a.day} ${a.mon} – ${b.day} ${b.mon} ${a.year}`;
  return `${a.day} ${a.mon} ${a.year} – ${b.day} ${b.mon} ${b.year}`;
}

export function weekendExtra(raw) {
  return String(raw || "")
    .replace(/20\d{2}-\d{2}-\d{2}/g, "")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function padOrder(order) {
  const n = Math.trunc(Number(order));
  if (!Number.isFinite(n)) return "";
  return String(n).padStart(2, "0");
}

export function circuitShort(circuit) {
  if (!circuit) return "Circuit";
  if (circuit.id === "sugo") return "SUGO";
  const name = circuit.official_name || circuit.id || "Circuit";
  if (circuit.id === "motegi") return "Motegi";
  if (circuit.id === "suzuka") return "Suzuka";
  if (circuit.id === "okayama") return "Okayama";
  if (circuit.id === "fuji") return "Fuji";
  return name.split("(")[0].trim();
}

export function isEmpty(value) {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

export function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
