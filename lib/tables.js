import { esc, rich } from "./text.js";

const COLUMNS = [
  ["pos", "pos"],
  ["penalty_ref", "mark"],
  ["no", "no"],
  ["class", "class"],
  ["cp", "cl"],
  ["name", "driver"],
  ["drivers", "drivers"],
  ["team", "team"],
  ["car", "car_name"],
  ["type", "type"],
  ["tyre", "tyre"],
  ["laps", "laps"],
  ["total", "total"],
  ["gap", "gap"],
  ["gap_prev", "prev"],
  ["best", "best"],
  ["best_lap", "lap"],
  ["course_record", "rec"],
];

export function sessionsFor(results, race) {
  const ids = new Set(race.result_race_ids?.length ? race.result_race_ids : [race.id]);
  return (results?.sessions || []).filter((session) => ids.has(session.race_id));
}

export function sessionsById(results, ids) {
  const wanted = new Set(ids || []);
  return (results?.sessions || []).filter((session) => wanted.has(session.id));
}

export function renderClassifications(sessions, L) {
  if (!sessions?.length) return "";
  const main = sessions.filter((session) => !session.related);
  const related = sessions.filter((session) => session.related);
  const names = nameIndex(sessions);
  return `${block(main, L, names, L.t("classification"))}${block(related, L, names, L.t("related"))}`;
}

function block(sessions, L, names, heading) {
  if (!sessions.length) return "";
  const articles = sessions.map((session) => renderSession(session, L, names)).join("");
  return `<section class="block results-block"><h2>${esc(heading)}</h2>${articles}</section>`;
}

function renderSession(session, L, names) {
  const title = L.ja && session.title_ja ? session.title_ja : session.title;
  const provisional = /provisional|暫定/i.test(`${session.status || ""} ${session.title || ""}`);
  const flag = provisional ? ` <span class="flag">${esc(L.t("flag_provisional"))}</span>` : "";
  const table = session.grid ? renderGrid(session, L, names) : renderRows(session, L);
  return `<article class="session-result" id="${esc(session.id)}">
    <h3>${esc(title || session.id)}${flag}</h3>
    ${metaLine(session, L)}
    ${table}
    ${fastestLine(session, L)}
    ${classSummary(session, L)}
    ${decisions(session, L)}
    ${notesLine(session, L)}
    <p class="method">${esc(L.t("provenance"))}: ${rich(session.method || "", L)}</p>
    ${session.source ? `<p class="onward"><a href="${esc(session.source)}">${esc(L.t("official_pdf"))}</a></p>` : ""}
  </article>`;
}

function metaLine(session, L) {
  const bits = [];
  if (session.date) bits.push(esc(session.date));
  if (session.start) bits.push(esc(session.start));
  if (session.finish) bits.push(esc(session.finish));
  if (session.weather) bits.push(`${esc(L.t("weather"))} ${esc(L.tr(session.weather))}`);
  if (session.track) bits.push(`${esc(L.t("road"))} ${esc(L.tr(session.track))}`);
  if (session.entries != null) bits.push(`${esc(L.t("entries"))} ${esc(session.entries)}`);
  if (session.starters != null) bits.push(`${esc(L.t("starters"))} ${esc(session.starters)}`);
  if (session.finishers != null) bits.push(`${esc(L.t("finishers"))} ${esc(session.finishers)}`);
  if (session.qualifying_cutoff) bits.push(`${esc(L.t("cutoff"))} ${esc(session.qualifying_cutoff)}`);
  if (session.required_laps != null && typeof session.required_laps !== "object") {
    bits.push(`${esc(L.t("required"))} ${esc(session.required_laps)}`);
  }
  if (!bits.length) return "";
  return `<p class="session-meta">${bits.join(" · ")}</p>`;
}

function renderRows(session, L) {
  const rows = session.rows || [];
  if (!rows.length) return "";
  const cols = COLUMNS.filter(([key]) => rows.some((row) => row[key] != null && row[key] !== ""));
  const head = cols.map(([, label]) => `<th>${esc(L.t(label))}</th>`).join("");
  const body = rows.map((row) => {
    const cls = row.highlight === "primary" ? "row-primary" : row.highlight === "team" ? "row-team" : "";
    const cells = cols.map(([key]) => `<td>${cell(key, row[key], L)}</td>`).join("");
    return `<tr class="${cls}">${cells}</tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="sheet"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderGrid(session, L, names) {
  const grid = session.grid || [];
  if (!grid.length) return "";
  const highs = new Set((session.highlight_nos || []).map(String));
  const body = grid.map((no, index) => {
    const key = String(no);
    const known = names.get(key);
    const cls = highs.has(key) ? "row-primary" : known?.highlight === "team" ? "row-team" : "";
    const who = known?.name || known?.drivers?.map((driver) => driver.name).filter(Boolean).join(" / ") || "";
    const team = known?.team || known?.car || "";
    const row = Math.floor(index / 2) + 1;
    return `<tr class="${cls}"><td>${index + 1}</td><td>${row}</td><td>${esc(key)}</td><td>${who ? rich(who, L) : ""}</td><td>${team ? rich(team, L) : ""}</td></tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="sheet"><thead><tr><th>${esc(L.t("pos"))}</th><th>${esc(L.t("row"))}</th><th>${esc(L.t("no"))}</th><th>${esc(L.t("driver"))}</th><th>${esc(L.t("team"))}</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function cell(key, value, L) {
  if (value == null || value === "") return "";
  if (key === "drivers" && Array.isArray(value)) {
    return value.map((driver) => {
      const bits = [driver.name, driver.laps != null ? `${driver.laps}` : "", driver.best || ""].filter(Boolean);
      return `<span class="driver-bit">${rich(bits.join(" · "), L)}</span>`;
    }).join("");
  }
  if (typeof value === "number") return esc(value);
  return rich(value, L);
}

function fastestLine(session, L) {
  const items = session.fastest_laps || (session.fastest_lap ? [session.fastest_lap] : []);
  if (!items.length) return "";
  const lines = items.map((item) => {
    const bits = [item.class, item.no ? `#${item.no}` : "", item.name || item.drivers || "", item.time, item.lap, item.kmh ? `${item.kmh} km/h` : ""].filter(Boolean);
    return `<li>${rich(bits.join(" · "), L)}</li>`;
  }).join("");
  return `<p class="who">${esc(L.t("fastest"))}</p><ul class="plain">${lines}</ul>`;
}

function classSummary(session, L) {
  const summary = session.class_summary;
  if (!summary || typeof summary !== "object") return "";
  const items = Object.entries(summary).map(([name, text]) => `<li>${esc(name)} — ${rich(text, L)}</li>`).join("");
  return `<ul class="plain">${items}</ul>`;
}

function notesLine(session, L) {
  if (!session.notes?.length) return "";
  return `<ul class="plain">${session.notes.map((note) => `<li>${rich(note, L)}</li>`).join("")}</ul>`;
}

function decisions(session, L) {
  const chunks = [];
  for (const item of session.penalties || []) chunks.push(penaltyItem(item, L));
  for (const item of session.deleted_laps || []) {
    const times = (item.times || []).join(", ");
    chunks.push(pair(L, `#${item.no} ${times}`.trim(), item.reason, item.ja, L.t("deleted")));
  }
  for (const item of session.red_flags || []) chunks.push(pair(L, "", item, null, L.t("red_flag")));
  for (const item of session.safety_car || []) chunks.push(pair(L, "", item, null, L.t("safety_car")));
  if (session.nc_213) chunks.push(ncItem(session.nc_213, L));
  if (session.course_record && typeof session.course_record === "object") {
    const record = session.course_record;
    const text = [record.previous, record.new].filter(Boolean).join(" ");
    if (text) chunks.push(pair(L, "", text, record.ja, L.t("rec")));
  }
  if (!chunks.length) return "";
  return `<section class="decisions"><h4>${esc(L.t("penalties"))}</h4>${chunks.join("")}</section>`;
}

function penaltyItem(item, L) {
  const who = [item.ref, item.no ? `#${item.no}` : ""].filter(Boolean).join(" ");
  return pair(L, who, item.decision || "", item.ja, "");
}

function ncItem(nc, L) {
  const bits = [nc.sheet, nc.timing_evidence, nc.stints].filter(Boolean).map((part) => `<p>${rich(part, L)}</p>`).join("");
  const conclusion = nc.conclusion_unconfirmed ? `<p>${rich(nc.conclusion_unconfirmed, L)}</p>` : "";
  return `<article class="decision"><p class="who">${esc(L.t("not_classified"))} #213</p>${bits}${conclusion}</article>`;
}

function pair(L, who, en, ja, kind) {
  const label = [kind, who].filter(Boolean).join(" ");
  const english = en ? `<p lang="en">${literal(en, L)}</p>` : "";
  const japanese = ja ? `<p lang="ja">${esc(ja)}</p>` : "";
  return `<article class="decision">${label ? `<p class="who">${esc(label)}</p>` : ""}${english}${japanese}</article>`;
}

function literal(text, L) {
  const flags = [];
  if (/unconfirmed/i.test(text)) flags.push(`<span class="flag">${esc(L.t("flag_unconfirmed"))}</span>`);
  if (/provisional/i.test(text)) flags.push(`<span class="flag">${esc(L.t("flag_provisional"))}</span>`);
  return `${esc(text)}${flags.length ? ` ${flags.join(" ")}` : ""}`;
}

function nameIndex(sessions) {
  const map = new Map();
  for (const session of sessions) {
    for (const row of session.rows || []) {
      if (row.no == null) continue;
      const prev = map.get(String(row.no));
      if (!prev || row.name || row.drivers) map.set(String(row.no), row);
    }
  }
  return map;
}
