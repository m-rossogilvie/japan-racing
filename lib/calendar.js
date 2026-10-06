import { makeLocale } from "./i18n.js";
import { clockIso } from "./time.js";

const DATE_RE = /20\d{2}-\d{2}-\d{2}/g;

export function renderCalendar(race, lang = "en", strings = {}) {
  const L = makeLocale(lang, strings);
  const events = eventsFor(race, L);
  const name = icsText(L.tr(race.round || race.series || race.id));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shinko1//2026 Japan season//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${name}`,
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Tokyo",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:JST",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...events.flatMap((event, index) => vevent(race, event, index)),
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

function eventsFor(race, L) {
  const events = [];
  for (const day of race.timetable?.days || []) {
    for (const item of day.items || []) {
      if (!item.start) continue;
      const start = clockIso(day.date, item.start);
      if (!start) continue;
      const end = item.end ? clockIso(day.date, item.end) : plusMinutes(start, 15);
      events.push({
        start,
        end,
        summary: L.tr(item.label || race.series || race.id),
        tentative: Boolean(item.unconfirmed),
      });
    }
  }
  if (events.length) return events;
  const dates = [...String(race.dates?.weekend || "").matchAll(DATE_RE)].map((match) => match[0]);
  if (!dates.length) return [];
  const start = dates[0].replace(/-/g, "");
  const end = addDays(dates[dates.length - 1], 1).replace(/-/g, "");
  return [{
    allDay: true,
    start,
    end,
    summary: L.tr(race.round || race.series || race.id),
    tentative: /unconfirmed/i.test(JSON.stringify(race.dates || {})),
  }];
}

function vevent(race, event, index) {
  const uid = `${race.id}-${index}@shinko1`;
  const stamp = utcStamp();
  const status = event.tentative ? "TENTATIVE" : "CONFIRMED";
  const summary = icsText(event.summary);
  if (event.allDay) {
    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${event.start}`,
      `DTEND;VALUE=DATE:${event.end}`,
      `SUMMARY:${summary}`,
      `STATUS:${status}`,
      "END:VEVENT",
    ];
  }
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Asia/Tokyo:${icsLocal(event.start)}`,
    `DTEND;TZID=Asia/Tokyo:${icsLocal(event.end)}`,
    `SUMMARY:${summary}`,
    `STATUS:${status}`,
    "END:VEVENT",
  ];
}

function icsLocal(iso) {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return "";
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}${match[6]}`;
}

function icsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function utcStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function plusMinutes(iso, minutes) {
  const date = new Date(Date.parse(iso) + minutes * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+09:00`;
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day) + days * 24 * 60 * 60 * 1000;
  const date = new Date(utc);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function fold(line) {
  const chunks = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    const limit = chunks.length === 0 ? 75 : 74;
    if (current && bytes + size > limit) {
      chunks.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  if (current) chunks.push(current);
  return chunks.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`)).join("\r\n");
}
