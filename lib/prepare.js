import fs from "node:fs";
import path from "node:path";

const DROP_KEYS = new Set([
  "accommodation",
  "travel",
  "hotel",
  "check_in",
  "check_out",
  "calendar_block",
]);

const PRIVATE = /hotel|dormy|marriott|peninsula|yunomori|yunogo|mashikokan|fairfield|mitsui|accommodation|\bflight\b|\bJL\d{2,}\b|check-in|\/home\/|gmail|google calendar|agent-data|ticket #\d+/i;

const LEAKS = /fairfield|marriott|dormy|mitsui|peninsula|yunomori|yunogo|mashikokan|accommodation|check_in|\bJL51\b|RO_ICV_|ticket #51293|\/home\/(?:box|ubuntu)|agent-data|gmail|google calendar/i;

export function scrubSeason(raw) {
  const data = scrub(structuredClone(raw));
  data.races = (data.races || [])
    .filter((race) => !/not a race/i.test(race.status || ""))
    .sort((a, b) => Number(a.order) - Number(b.order));

  if (data.licence) {
    const note = [data.licence.visa, data.licence.note, data.licence.statement]
      .filter((item) => typeof item === "string")
      .join(" ");
    const cleaned = note
      .replace(/RO_ICV_[A-Z0-9_]+/gi, "")
      .replace(/ticket #\d+/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.;])/g, "$1")
      .trim();
    data.licence = cleaned ? { note: cleanNote(cleaned) } : undefined;
    if (!data.licence?.note) delete data.licence;
  }

  assertPublic(data);
  return data;
}

export function assertPublic(data) {
  const found = JSON.stringify(data).match(LEAKS);
  if (found) {
    throw new Error(`Refusing to publish private data (${found[0]})`);
  }
}

export function loadSeason(root) {
  const file = path.join(root, "data", "season.json");
  const licensesFile = path.join(root, "data", "LICENSES.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const licenses = fs.existsSync(licensesFile)
    ? JSON.parse(fs.readFileSync(licensesFile, "utf8"))
    : [];
  const data = scrubSeason(raw);
  data.licenses = licenses;
  return data;
}

function scrub(value, key) {
  if (DROP_KEYS.has(key)) return undefined;
  if (typeof value === "string") {
    if (key === "notes" || key === "note" || key === "visa") return cleanNote(value) || undefined;
    if (isPrivateSource(key, value)) return undefined;
    return value;
  }
  if (Array.isArray(value)) {
    if (key === "notes") {
      return value.map((item) => (typeof item === "string" ? cleanNote(item) : item)).filter(Boolean);
    }
    if (key === "sources") return value.filter(isPublicSource);
    return value.map((item) => scrub(item)).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    if (key === "source_index") {
      const out = {};
      for (const [childKey, child] of Object.entries(value)) {
        if (isPublicSource(child)) out[childKey] = child;
      }
      return out;
    }
    const out = {};
    for (const [childKey, child] of Object.entries(value)) {
      if (DROP_KEYS.has(childKey)) continue;
      const next = scrub(child, childKey);
      if (next !== undefined && next !== "") out[childKey] = next;
    }
    return out;
  }
  return value;
}

function cleanNote(note) {
  if (typeof note !== "string") return "";
  let text = note.replace(/\s*\(from Gmail\)/gi, "").replace(/\s{2,}/g, " ").trim();
  text = text.replace(/no hotel or entry found/gi, "No entry found");
  const kept = text
    .split(/(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !PRIVATE.test(part));
  return kept.join(" ").trim();
}

function isPublicSource(value) {
  if (typeof value !== "string") return false;
  if (PRIVATE.test(value)) return false;
  return /https?:\/\//.test(value);
}

function isPrivateSource(key, value) {
  if (key !== "source") return false;
  return PRIVATE.test(value);
}
