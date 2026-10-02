const AEST_PARENS = /\([^)]*AEST[^)]*\)/gi;
const TIME_RE = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g;
const DATE_RE = /20\d{2}-\d{2}-\d{2}/g;

export function phase(race) {
  const status = race?.status || "";
  if (/not a race/i.test(status)) return "skip";
  if (/completed/i.test(status)) return "past";
  if (/in progress/i.test(status)) return "current";
  return "future";
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
      for (const instant of extractInstants(text, { raceStart: key === "race" })) {
        out.push({
          iso: instant.iso,
          unconfirmed: instant.unconfirmed,
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
  const open = ordered.filter((race) => phase(race) !== "past" && phase(race) !== "skip");
  if (!open.length) {
    return { mode: "complete", race: ordered.at(-1) || null, schedule: [] };
  }
  const race = open[0];
  const schedule = sessionInstants(race).filter((item) => Date.parse(item.iso) > now);
  if (schedule.length) return { mode: "countdown", race, schedule };
  if (phase(race) === "current") return { mode: "underway", race, schedule: [] };
  return { mode: "untimed", race, schedule: [] };
}

export function formatJst(iso) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  const clock = get("second") === "00"
    ? `${get("hour")}:${get("minute")}`
    : `${get("hour")}:${get("minute")}:${get("second")}`;
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
