const AEST_PARENS = /\([^)]*AEST[^)]*\)/gi;
const TIME_RE = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g;
const DATE_RE = /20\d{2}-\d{2}-\d{2}/g;
const MONTHS = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sept: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const DAY_MONTH_RE = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_RE})\\b`, "gi");
const MONTH_DAY_RE = new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})\\b`, "gi");
const DAY_MS = 24 * 60 * 60 * 1000;

// Listed clocks are session starts. Three hours lets a sprint, a delay and the rest of that session finish before the weekend rolls over.
export const SESSION_BUFFER_MS = 3 * 60 * 60 * 1000;

export function phase(race, now = Date.now()) {
  const status = race?.status || "";
  if (/not a race/i.test(status)) return "skip";
  const window = sessionWindow(race);
  if (window) {
    if (now >= window.finish) return "past";
    if (now >= window.start) return "current";
    return "future";
  }
  if (/completed/i.test(status)) return "past";
  if (/in progress/i.test(status)) return "current";
  return "future";
}

function sessionWindow(race) {
  const instants = sessionInstants(race);
  if (instants.length) {
    const last = instants[instants.length - 1];
    return {
      start: Date.parse(instants[0].iso),
      finish: Date.parse(last.iso) + (last.dateOnly ? DAY_MS : SESSION_BUFFER_MS),
    };
  }
  const dates = weekendDates(race);
  if (!dates.length) return null;
  return {
    start: Date.parse(`${dates[0]}T00:00:00+09:00`),
    finish: Date.parse(`${dates[dates.length - 1]}T00:00:00+09:00`) + DAY_MS,
  };
}

function weekendDates(race) {
  return [...String(race?.dates?.weekend || "").matchAll(DATE_RE)].map((match) => match[0]);
}

export function extractInstants(text, { raceStart = false } = {}) {
  if (!text || typeof text !== "string") return [];
  const cleaned = text.replace(AEST_PARENS, " ");
  const unconfirmed = /unconfirmed/i.test(text);
  const dates = [...cleaned.matchAll(DATE_RE)];
  if (!dates.length) return [];

  const instants = [];
  for (const match of cleaned.matchAll(TIME_RE)) {
    if (match.index > 0 && cleaned[match.index - 1] === "-") continue;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = Number(match[3] || 0);
    if (hour > 23 || minute > 59 || second > 59) continue;
    let date = dates[0][0];
    for (const found of dates) {
      if (found.index < match.index) date = found[0];
    }
    const iso = `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+09:00`;
    instants.push({ iso, unconfirmed, index: match.index });
  }

  if (raceStart) {
    const at = cleaned.search(/race start/i);
    if (at >= 0) {
      const before = instants.filter((item) => item.index < at);
      if (before.length) return [before[before.length - 1]];
    }
  }
  return instants;
}

function yearFor(race, month) {
  const dates = weekendDates(race);
  const same = dates.find((iso) => Number(iso.slice(5, 7)) === month);
  return (same || dates[0] || "").slice(0, 4);
}

function extractDateOnly(text, yearHint) {
  if (!text || typeof text !== "string") return [];
  const unconfirmed = /unconfirmed/i.test(text);
  const dates = new Set([...text.matchAll(DATE_RE)].map((match) => match[0]));
  const add = (day, monthName) => {
    const month = MONTHS[monthName.toLowerCase()];
    const date = Number(day);
    if (!month || date < 1 || date > 31) return;
    const year = yearHint(month);
    if (!year) return;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    if (Number.isNaN(Date.parse(`${iso}T00:00:00+09:00`))) return;
    dates.add(iso);
  };
  for (const match of text.matchAll(DAY_MONTH_RE)) add(match[1], match[2]);
  for (const match of text.matchAll(MONTH_DAY_RE)) add(match[2], match[1]);
  return [...dates].sort().map((iso) => ({
    iso: `${iso}T00:00:00+09:00`,
    unconfirmed,
    dateOnly: true,
  }));
}

export function sessionInstants(race) {
  const dates = race?.dates || {};
  const out = [];
  for (const key of ["practice", "qualifying", "race"]) {
    const raw = dates[key];
    if (raw == null || raw === "") continue;
    const texts = Array.isArray(raw) ? raw : [raw];
    texts.forEach((text, index) => {
      if (typeof text !== "string" || !text.trim()) return;
      const label = texts.length > 1 ? `${labelFor(key)} ${index + 1}` : labelFor(key);
      const timed = extractInstants(text, { raceStart: key === "race" });
      const instants = timed.length ? timed : extractDateOnly(text, (month) => yearFor(race, month));
      for (const instant of instants) {
        out.push({
          iso: instant.iso,
          unconfirmed: instant.unconfirmed,
          dateOnly: Boolean(instant.dateOnly),
          label,
        });
      }
    });
  }
  out.sort((a, b) => Date.parse(a.iso) - Date.parse(b.iso));
  return out;
}

function labelFor(key) {
  if (key === "practice") return "Practice";
  if (key === "qualifying") return "Qualifying";
  return "Race";
}

export function hero(races, now = Date.now()) {
  const ordered = [...(races || [])].sort((a, b) => Number(a.order) - Number(b.order));
  const open = ordered.filter((race) => {
    const state = phase(race, now);
    return state !== "past" && state !== "skip";
  });
  if (!open.length) {
    return { mode: "complete", race: ordered.at(-1) || null, schedule: [] };
  }
  const race = open[0];
  const schedule = sessionInstants(race).filter((item) => Date.parse(item.iso) > now);
  if (schedule.length) return { mode: "countdown", race, schedule };
  if (phase(race, now) === "current") return { mode: "underway", race, schedule: [] };
  return { mode: "untimed", race, schedule: [] };
}

export function formatJst(iso, lang = "en", { dateOnly = false } = {}) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-GB", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
    day: "numeric",
    month: lang === "ja" ? "numeric" : "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  if (dateOnly) {
    if (lang === "ja") return `${get("month")}月${get("day")}日（${get("weekday")}）`;
    return `${get("weekday")} ${get("day")} ${get("month")}`;
  }
  const clock = get("second") === "00"
    ? `${get("hour")}:${get("minute")}`
    : `${get("hour")}:${get("minute")}:${get("second")}`;
  if (lang === "ja") return `${get("month")}月${get("day")}日（${get("weekday")}）${clock} JST`;
  return `${get("weekday")} ${get("day")} ${get("month")} · ${clock} JST`;
}

export function countParts(iso, now = Date.now()) {
  const diff = Math.max(0, Date.parse(iso) - now);
  const total = Math.floor(diff / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    d: pad(Math.floor(total / 86400)),
    h: pad(Math.floor((total % 86400) / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  };
}
