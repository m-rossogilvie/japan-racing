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

const PHONE = new Set(["pos", "no", "name", "drivers", "gap", "best"]);
const PHONE_ORDER = ["pos", "no", "name", "drivers", "gap", "best"];

export function sessionsFor(results, race) {
  const ids = new Set(race.result_race_ids?.length ? race.result_race_ids : [race.id]);
  return (results?.sessions || []).filter((session) => ids.has(session.race_id));
}

export function sessionsById(results, ids) {
  const wanted = new Set(ids || []);
  return (results?.sessions || []).filter((session) => wanted.has(session.id));
}

export function sessionHasDecisions(session) {
  if (!session) return false;
  if (session.penalties?.length || session.deleted_laps?.length || session.red_flags?.length || session.safety_car?.length) return true;
  if (session.nc_213) return true;
  const record = session.course_record;
  return Boolean(record && typeof record === "object" && (record.previous || record.new));
}

export function renderClassifications(sessions, L) {
  if (!sessions?.length) return "";
  const main = sessions.filter((session) => !session.related);
  const related = sessions.filter((session) => session.related);
  const names = nameIndex(sessions);
  const state = { penalties: false };
  const mainHtml = block(main, L, names, L.t("classification"), main.length ? "results" : "", state);
  const relatedHtml = block(related, L, names, L.t("related"), main.length ? "" : "results", state);
  return `${mainHtml}${relatedHtml}`;
}

function block(sessions, L, names, heading, id, state) {
  if (!sessions.length) return "";
  const articles = sessions.map((session) => renderSession(session, L, names, state)).join("");
  const anchor = id ? ` id="${esc(id)}"` : "";
  return `<section class="block results-block"${anchor}><h2>${esc(heading)}</h2>${articles}</section>`;
}

function renderSession(session, L, names, state) {
  const title = L.ja && session.title_ja ? session.title_ja : session.title;
  const provisional = /provisional|暫定/i.test(`${session.status || ""} ${session.title || ""}`);
  const flag = provisional ? ` <span class="flag">${esc(L.t("flag_provisional"))}</span>` : "";
  const titleId = `${session.id}-title`;
  const summary = session.grid ? gridSummary(session) : rowSummary(session);
  const table = session.grid ? renderGrid(session, L, names) : renderRows(session, L);
  const anchor = !state.penalties && sessionHasDecisions(session);
  if (anchor) state.penalties = true;
  return `<article class="session-result" id="${esc(session.id)}">
    <h3 id="${esc(titleId)}">${esc(title || session.id)}${flag}</h3>
    ${summary}
    ${metaLine(session, L)}
    ${table}
    ${fastestLine(session, L)}
    ${classSummary(session, L)}
    ${decisions(session, L, anchor)}
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
  const present = COLUMNS.filter(([key]) => rows.some((row) => row[key] != null && row[key] !== ""));
  const cols = orderColumns(present);
  const keys = new Set(cols.map(([key]) => key));
  const optional = cols.some(([key]) => !isPhoneCol(key, keys));
  const head = cols.map(([key, label]) => `<th scope="col" class="${colClass(key, keys)}">${esc(L.t(label))}</th>`).join("");
  const body = rows.map((row) => {
    const cls = row.highlight === "primary" ? "row-primary" : row.highlight === "team" ? "row-team" : "";
    const id = row.no != null && row.no !== "" ? ` id="${esc(`${session.id}-${row.no}`)}"` : "";
    const cells = cols.map(([key]) => `<td class="${colClass(key, keys)}">${cell(key, row[key], L)}</td>`).join("");
    return `<tr class="${cls}"${id}>${cells}</tr>`;
  }).join("");
  return tableWrap(session, L, optional, head, body);
}

function renderGrid(session, L, names) {
  const grid = session.grid || [];
  if (!grid.length) return "";
  const highs = new Set((session.highlight_nos || []).map(String));
  const cols = [
    ["pos", "pos"],
    ["no", "no"],
    ["name", "driver"],
    ["row", "row"],
    ["team", "team"],
  ];
  const head = cols.map(([key, label]) => `<th scope="col" class="${colClass(key)}">${esc(L.t(label))}</th>`).join("");
  const body = grid.map((no, index) => {
    const key = String(no);
    const known = names.get(key);
    const cls = highs.has(key) ? "row-primary" : known?.highlight === "team" ? "row-team" : "";
    const who = known?.name || known?.drivers?.map((driver) => driver.name).filter(Boolean).join(" / ") || "";
    const team = known?.team || known?.car || "";
    const row = Math.floor(index / 2) + 1;
    const values = {
      pos: index + 1,
      no: key,
      name: who,
      row,
      team,
    };
    const cells = cols.map(([col]) => `<td class="${colClass(col)}">${cell(col, values[col], L)}</td>`).join("");
    return `<tr class="${cls}" id="${esc(`${session.id}-${key}`)}">${cells}</tr>`;
  }).join("");
  return tableWrap(session, L, true, head, body);
}

function tableWrap(session, L, optional, head, body) {
  const toggle = optional
    ? `<label class="allcols"><input type="checkbox"> ${esc(L.t("all_columns"))}</label>`
    : "";
  return `${toggle}<div class="table-wrap" role="region" tabindex="0" aria-labelledby="${esc(session.id)}-title"><table class="sheet"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function orderColumns(cols) {
  const rank = (key) => {
    const index = PHONE_ORDER.indexOf(key);
    return index === -1 ? PHONE_ORDER.length : index;
  };
  return cols
    .map((col, index) => ({ col, index }))
    .sort((a, b) => rank(a.col[0]) - rank(b.col[0]) || a.index - b.index)
    .map((item) => item.col);
}

function colClass(key, keys = null) {
  return isPhoneCol(key, keys) ? `c-${key}` : `c-${key} c-opt`;
}

function isPhoneCol(key, keys) {
  if (!PHONE.has(key)) return false;
  if (key === "drivers" && keys?.has("name")) return false;
  return true;
}

function rowSummary(session) {
  const rows = session.rows || [];
  const row = rows.find((item) => item.highlight === "primary")
    || rows.find((item) => isRossNo(item.no));
  if (!row || row.no == null || row.no === "") return "";
  const bits = [`#${row.no}`];
  const pos = posLabel(row.pos);
  if (pos) bits.push(pos);
  const time = row.best || row.total || "";
  if (time) bits.push(time);
  const gap = gapLabel(row.gap);
  if (gap) bits.push(gap);
  return summaryLink(session.id, row.no, bits.join(" · "));
}

function gridSummary(session) {
  const grid = session.grid || [];
  const preferred = (session.highlight_nos || []).map(String);
  const no = preferred.find((item) => grid.some((entry) => String(entry) === item))
    || grid.map(String).find((item) => item === "213");
  if (!no) return "";
  const index = grid.findIndex((entry) => String(entry) === no);
  if (index < 0) return "";
  return summaryLink(session.id, no, `#${no} · P${index + 1}`);
}

function summaryLink(sessionId, no, text) {
  return `<p class="row-jump"><a href="#${esc(`${sessionId}-${no}`)}">${esc(text)}</a></p>`;
}

function posLabel(pos) {
  if (pos == null || pos === "") return "";
  const text = String(pos);
  return /^\d+$/.test(text) ? `P${text}` : text;
}

function gapLabel(gap) {
  if (gap == null || gap === "") return "";
  const text = String(gap).trim();
  if (!text || text === "—" || text === "-") return "";
  if (/^[+-]/.test(text)) return text;
  if (/^[\d'′:.]/.test(text)) return `+${text}`;
  return text;
}

function cell(key, value, L) {
  if (value == null || value === "") return "";
  if (key === "drivers" && Array.isArray(value)) {
    return value.map((driver) => {
      const bits = [driver.name, driver.laps != null ? `${driver.laps}` : "", driver.best || ""].filter(Boolean);
      const text = bits.join(" · ");
      return `<span class="driver-bit"${langAttr(text)}>${rich(text, L)}</span>`;
    }).join("");
  }
  if (typeof value === "number") return esc(value);
  const html = rich(value, L);
  return langAttr(value) ? `<span${langAttr(value)}>${html}</span>` : html;
}

function langAttr(value) {
  return typeof value === "string" && /[\u3040-\u30ff\u4e00-\u9fff]/.test(value) ? ` lang="ja"` : "";
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

function decisions(session, L, anchor) {
  const chunks = [];
  for (const item of session.penalties || []) chunks.push(penaltyItem(item, L));
  for (const item of session.deleted_laps || []) {
    const times = (item.times || []).join(", ");
    chunks.push(pair(L, `#${item.no} ${times}`.trim(), item.reason, item.ja, L.t("deleted"), isRossNo(item.no)));
  }
  for (const item of session.red_flags || []) chunks.push(pair(L, "", item, null, L.t("red_flag"), false));
  for (const item of session.safety_car || []) chunks.push(pair(L, "", item, null, L.t("safety_car"), false));
  if (session.nc_213) chunks.push(ncItem(session.nc_213, L));
  if (session.course_record && typeof session.course_record === "object") {
    const record = session.course_record;
    const text = [record.previous, record.new].filter(Boolean).join(" ");
    if (text) chunks.push(pair(L, "", text, record.ja, L.t("rec"), false));
  }
  if (!chunks.length) return "";
  const ross = chunks.filter((item) => item.ross).map((item) => item.html).join("");
  const rest = chunks.filter((item) => !item.ross).map((item) => item.html).join("");
  const more = rest
    ? `<details class="more-decisions"><summary>${esc(L.t("penalties_jump"))} (${chunks.filter((item) => !item.ross).length})</summary>${rest}</details>`
    : "";
  const id = anchor ? ` id="penalties"` : "";
  return `<section class="decisions"${id}><h4>${esc(L.t("penalties"))}</h4>${ross}${more}</section>`;
}

function penaltyItem(item, L) {
  const who = [item.ref, item.no ? `#${item.no}` : ""].filter(Boolean).join(" ");
  return pair(L, who, item.decision || "", item.ja, "", isRossNo(item.no));
}

function ncItem(nc, L) {
  const bits = [nc.sheet, nc.timing_evidence, nc.stints].filter(Boolean).map((part) => `<p>${rich(part, L)}</p>`).join("");
  const conclusion = nc.conclusion_unconfirmed ? `<p>${rich(nc.conclusion_unconfirmed, L)}</p>` : "";
  return { ross: true, html: `<article class="decision is-ross"><p class="who">${esc(L.t("not_classified"))} #213</p>${bits}${conclusion}</article>` };
}

function pair(L, who, en, ja, kind, ross) {
  const label = [kind, who].filter(Boolean).join(" ");
  const english = en ? para("en", literal(en, L), L.ja) : "";
  const japanese = ja ? para("ja", esc(ja), !L.ja) : "";
  const body = L.ja ? `${japanese}${english}` : `${english}${japanese}`;
  const cls = ross ? "decision is-ross" : "decision";
  return { ross, html: `<article class="${cls}">${label ? `<p class="who">${esc(label)}</p>` : ""}${body}</article>` };
}

function para(lang, html, alt) {
  return `<p lang="${lang}"${alt ? ` class="alt"` : ""}>${html}</p>`;
}

function literal(text, L) {
  const flags = [];
  if (/unconfirmed/i.test(text)) flags.push(`<span class="flag">${esc(L.t("flag_unconfirmed"))}</span>`);
  if (/provisional/i.test(text)) flags.push(`<span class="flag">${esc(L.t("flag_provisional"))}</span>`);
  return `${esc(text)}${flags.length ? ` ${flags.join(" ")}` : ""}`;
}

function isRossNo(no) {
  if (no == null || no === "") return false;
  return String(no).split(/[^\d]+/).includes("213");
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
