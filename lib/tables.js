import { phrase } from "./phrase.js";
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

const ORDER = ["pos", "no", "name", "drivers", "gap", "best", "laps", "total", "class", "car", "team", "penalty_ref", "cp", "type", "tyre", "gap_prev", "best_lap", "course_record", "row"];
const RESULT = new Set(["gap", "row"]);
const TIMES = new Set(["best", "laps", "total"]);
const CAR = new Set(["class", "car", "team"]);
const TAB_ORDER = ["practice", "qualifying", "grid", "race", "other"];

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
  const groups = groupSessions(sessions);
  const inner = groups.length > 1
    ? renderTabs(groups, L, names, state, id || "related")
    : sessions.map((session) => renderSession(session, L, names, state)).join("");
  const anchor = id ? ` id="${esc(id)}"` : "";
  return `<section class="block results-block"${anchor}><h2>${phrase(heading)}</h2>${inner}</section>`;
}

function groupSessions(sessions) {
  const map = new Map();
  for (const session of sessions) {
    const kind = sessionKind(session);
    if (!map.has(kind)) map.set(kind, []);
    map.get(kind).push(session);
  }
  return TAB_ORDER.filter((kind) => map.has(kind)).map((kind) => ({ kind, sessions: map.get(kind) }));
}

function sessionKind(session) {
  const title = `${session.id} ${session.title || ""}`;
  const ja = session.title_ja || "";
  if (/\bgrid\b/i.test(session.title || "") || /-grid\b/i.test(session.id)) return "grid";
  if (/free|practice|フリー|練習/i.test(`${title} ${ja}`)) return "practice";
  if (/qualif|予選/i.test(`${title} ${ja}`)) return "qualifying";
  if (/\brace\b|決勝/i.test(`${title} ${ja}`)) return "race";
  return "other";
}

function tabLabel(kind, L) {
  if (kind === "practice" || kind === "qualifying" || kind === "race" || kind === "grid") return L.t(kind);
  return L.t("classification");
}

function preferredKind(groups) {
  const withCar = groups.filter((group) => group.sessions.some(sessionHasCar));
  if (withCar.some((group) => group.kind === "race")) return "race";
  if (withCar.length) return withCar[0].kind;
  if (groups.some((group) => group.kind === "race")) return "race";
  return groups[0].kind;
}

function sessionHasCar(session) {
  if ((session.rows || []).some((row) => row.highlight === "primary" || isRossNo(row.no))) return true;
  const highs = (session.highlight_nos || []).map(String);
  if (highs.includes("213")) return true;
  return (session.grid || []).some((no) => String(no) === "213" || highs.includes(String(no)));
}

function renderTabs(groups, L, names, state, prefix) {
  const preferred = preferredKind(groups);
  const tabs = groups.map((group) => {
    const selected = group.kind === preferred;
    const tabId = `${prefix}-tab-${group.kind}`;
    const panelId = `${prefix}-panel-${group.kind}`;
    return `<button type="button" role="tab" id="${esc(tabId)}" aria-controls="${esc(panelId)}" aria-selected="${selected ? "true" : "false"}" tabindex="${selected ? "0" : "-1"}">${esc(tabLabel(group.kind, L))}</button>`;
  }).join("");
  const panels = groups.map((group) => {
    const selected = group.kind === preferred;
    const tabId = `${prefix}-tab-${group.kind}`;
    const panelId = `${prefix}-panel-${group.kind}`;
    const articles = group.sessions.map((session) => renderSession(session, L, names, state)).join("");
    return `<div role="tabpanel" id="${esc(panelId)}" aria-labelledby="${esc(tabId)}"${selected ? "" : " hidden"}>${articles}</div>`;
  }).join("");
  return `<div class="session-tabs" data-tabs><div class="seg" role="tablist" aria-label="${esc(L.t("session_tabs"))}">${tabs}</div>${panels}</div>`;
}

function renderSession(session, L, names, state) {
  const title = L.ja && session.title_ja ? session.title_ja : session.title;
  const heading = `${session.status || ""} ${session.title || ""}`;
  const provisional = /provisional|暫定/i.test(heading);
  const unofficial = !provisional && /unofficial|非公式/i.test(heading);
  const flag = provisional
    ? ` <span class="flag">${esc(L.t("flag_provisional"))}</span>`
    : unofficial
      ? ` <span class="flag">${esc(L.t("flag_unofficial"))}</span>`
      : "";
  const titleId = `${session.id}-title`;
  const summary = session.grid ? gridSummary(session) : rowSummary(session);
  const table = session.grid ? renderGrid(session, L, names) : renderRows(session, L);
  const anchor = !state.penalties && sessionHasDecisions(session);
  if (anchor) state.penalties = true;
  return `<article class="session-result" id="${esc(session.id)}">
    <h3 id="${esc(titleId)}">${phrase(title || session.id)}${flag}</h3>
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
  const head = cols.map(([key, label]) => `<th scope="col" class="${colClass(key, keys)}">${esc(L.t(label))}</th>`).join("");
  const groups = groupRows(rows);
  const named = groups.filter((group) => group.name);
  const slugs = slugMap(named.map((group) => group.name));
  const oursName = oursClass(rows);
  const ours = oursName ? slugs.get(oursName) || "" : "";
  const bodies = groups.map((group) => {
    const slug = group.name ? slugs.get(group.name) || "" : "";
    const hide = Boolean(ours && slug && slug !== ours);
    const label = group.name ? `${classLabel(group.name, L)} · ${esc(L.t("entries_n", group.rows.length))}` : "";
    const headRow = label
      ? `<tr class="class-head"><th colspan="${cols.length}" scope="rowgroup">${label}</th></tr>`
      : "";
    const body = group.rows.map((row) => rowHtml(session, row, cols, keys, L)).join("");
    const attr = slug ? ` data-class="${esc(slug)}"` : "";
    return `<tbody${attr}${hide ? " hidden" : ""}>${headRow}${body}</tbody>`;
  }).join("");
  return tableWrap(session, L, cols, keys, head, bodies, {
    ours,
    classes: named.map((group) => ({ name: group.name, slug: slugs.get(group.name), count: group.rows.length })),
  });
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
  const keys = new Set(cols.map(([key]) => key));
  const head = cols.map(([key, label]) => `<th scope="col" class="${colClass(key, keys)}">${esc(L.t(label))}</th>`).join("");
  const body = grid.map((no, index) => {
    const key = String(no);
    const known = names.get(key);
    const cls = highs.has(key) ? "row-primary" : known?.highlight === "team" ? "row-team" : "";
    const who = known?.name || known?.drivers?.map((driver) => driver.name).filter(Boolean).join(" / ") || "";
    const team = known?.team || known?.car || "";
    const row = Math.floor(index / 2) + 1;
    const values = { pos: index + 1, no: key, name: who, row, team };
    const cells = cols.map(([col]) => `<td class="${colClass(col, keys)}">${cell(col, values[col], L)}</td>`).join("");
    return `<tr class="${cls}" id="${esc(`${session.id}-${key}`)}">${cells}</tr>`;
  }).join("");
  return tableWrap(session, L, cols, keys, head, `<tbody>${body}</tbody>`, { ours: "", classes: [] });
}

function tableWrap(session, L, cols, keys, head, body, meta) {
  const ours = meta?.ours || "";
  const oursAttr = ours ? ` data-ours="${esc(ours)}"` : "";
  const tools = `${viewSwitch(cols, keys, L)}${classSwitch(meta?.classes || [], ours, L)}`;
  return `<div class="sheet-views" data-view="result"${oursAttr}>${tools}<div class="table-wrap" role="region" tabindex="0" aria-labelledby="${esc(session.id)}-title"><table class="sheet"><thead><tr>${head}</tr></thead>${body}</table></div></div>`;
}

function viewSwitch(cols, keys, L) {
  if (!cols.some(([key]) => viewName(key, keys))) return "";
  const buttons = [
    segButton("result", L.t("view_result"), true),
    segButton("times", L.t("view_times"), false),
    segButton("car", L.t("view_car"), false),
    segButton("all", L.t("all_columns"), false),
  ];
  return `<div class="seg view-switch" role="group" aria-label="${esc(L.t("view_label"))}" data-pref="view">${buttons.join("")}</div>`;
}

function classSwitch(classes, ours, L) {
  if (classes.length < 2) return "";
  const buttons = classes.length <= 4
    ? [...classes.map((item) => segButton(item.slug, L.tr(item.name), item.slug === ours)), segButton("all", L.t("class_all"), false)]
    : [segButton("ours", L.t("our_class"), true), segButton("all", L.t("class_all"), false)];
  return `<div class="seg class-switch" role="group" aria-label="${esc(L.t("class_label"))}" data-pref="class">${buttons.join("")}</div>`;
}

function segButton(value, label, pressed) {
  return `<button type="button" data-value="${esc(value)}" aria-pressed="${pressed ? "true" : "false"}">${esc(label)}</button>`;
}

function groupRows(rows) {
  const groups = [];
  const index = new Map();
  for (const row of rows) {
    const name = row.class ? String(row.class) : "";
    if (!index.has(name)) {
      const group = { name, rows: [] };
      index.set(name, group);
      groups.push(group);
    }
    index.get(name).rows.push(row);
  }
  return groups;
}

function oursClass(rows) {
  const row = rows.find((item) => item.highlight === "primary") || rows.find((item) => isRossNo(item.no));
  return row?.class ? String(row.class) : "";
}

function slugMap(names) {
  const used = new Map();
  const out = new Map();
  for (const name of names) {
    if (out.has(name)) continue;
    let slug = classSlug(name);
    const seen = used.get(slug) || 0;
    used.set(slug, seen + 1);
    if (seen) slug = `${slug}-${seen + 1}`;
    out.set(name, slug);
  }
  return out;
}

function classSlug(name) {
  const slug = String(name || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "class";
}

function classLabel(name, L) {
  const text = L.tr(name);
  const html = phrase(text);
  return langAttr(text) ? `<span${langAttr(text)}>${html}</span>` : html;
}

function orderColumns(cols) {
  const rank = (key) => {
    const index = ORDER.indexOf(key);
    return index === -1 ? ORDER.length : index;
  };
  return cols
    .map((col, index) => ({ col, index }))
    .sort((a, b) => rank(a.col[0]) - rank(b.col[0]) || a.index - b.index)
    .map((item) => item.col);
}

function colClass(key, keys = null) {
  const view = viewName(key, keys);
  return view ? `c-${key} ${view}` : `c-${key} c-pin`;
}

function viewName(key, keys) {
  if (key === "pos" || key === "no") return "";
  if (key === "drivers") return "c-view-result";
  if (key === "name") return keys?.has("drivers") ? "c-view-all" : "c-view-result";
  if (RESULT.has(key)) return "c-view-result";
  if (TIMES.has(key)) return "c-view-times";
  if (CAR.has(key)) return "c-view-car";
  return "c-view-all";
}

function rowHtml(session, row, cols, keys, L) {
  const cls = row.highlight === "primary" ? "row-primary" : row.highlight === "team" ? "row-team" : "";
  const id = row.no != null && row.no !== "" ? ` id="${esc(`${session.id}-${row.no}`)}"` : "";
  const cells = cols.map(([key]) => `<td class="${colClass(key, keys)}">${key === "no" ? noCell(session, row, L) : cell(key, row[key], L)}</td>`).join("");
  return `<tr class="${cls}"${id}>${cells}</tr>`;
}

function noCell(session, row, L) {
  const base = cell("no", row.no, L);
  const ref = row.penalty_ref;
  if (!ref) return base;
  const slug = penSlug(ref);
  const known = (session.penalties || []).some((item) => item.ref && penSlug(item.ref) === slug);
  if (!known) return `${base}<span class="pen-badge">${esc(ref)}</span>`;
  return `${base}<a class="pen-badge" href="#${esc(`${session.id}-pen-${slug}`)}">${esc(ref)}</a>`;
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
  const own = ownNos(session);
  let index = 0;
  const chunks = [];
  for (const item of session.penalties || []) chunks.push(penaltyItem(session, item, L, own, index++));
  for (const item of session.deleted_laps || []) {
    const times = (item.times || []).join(", ");
    chunks.push(pair(L, `#${item.no} ${times}`.trim(), item.reason, item.ja, L.t("deleted"), isOwn(item.no, own), decisionId(session, null, index++)));
  }
  for (const item of session.red_flags || []) chunks.push(pair(L, "", item, null, L.t("red_flag"), false, decisionId(session, null, index++)));
  for (const item of session.safety_car || []) chunks.push(pair(L, "", item, null, L.t("safety_car"), false, decisionId(session, null, index++)));
  if (session.nc_213) chunks.push(ncItem(session, session.nc_213, L, decisionId(session, { ref: "nc" }, index++)));
  if (session.course_record && typeof session.course_record === "object") {
    const record = session.course_record;
    const text = [record.previous, record.new].filter(Boolean).join(" ");
    if (text) chunks.push(pair(L, "", text, record.ja, L.t("rec"), false, decisionId(session, null, index++)));
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

function penaltyItem(session, item, L, own, index) {
  const id = decisionId(session, item, index);
  const title = penaltyTitle(item, L);
  const who = [item.ref, item.no ? `#${item.no}` : ""].filter(Boolean).join(" ");
  return pair(L, who, item.decision || "", item.ja, "", isOwn(item.no, own), id, title);
}

function penaltyTitle(item, L) {
  const cars = String(item.no || "").split(",").map((part) => part.trim()).filter(Boolean);
  const carBit = cars.length ? L.t("pen_car", cars.join(", ")) : "";
  if (L.ja && item.ja) {
    const kind = jaKind(item.ja);
    const topic = jaTopic(item.ja);
    return joinTitle(carBit, kind, topic);
  }
  const kind = enKind(item.decision || "");
  const topic = enTopic(item.reason || "", item.decision || "");
  return joinTitle(carBit, kind, topic);
}

function joinTitle(car, kind, topic) {
  const parts = [car, kind].filter(Boolean);
  if (topic && topic.toLowerCase() !== String(kind || "").toLowerCase()) parts.push(topic);
  return parts.join(" · ");
}

function enKind(decision) {
  const head = String(decision).split("(")[0].split(":")[0].replace(/\bpenalty\b/ig, "").replace(/\s+/g, " ").trim();
  return head.length > 48 ? `${head.slice(0, 48).trim()}` : head;
}

function enTopic(reason, decision) {
  const source = `${reason || ""} ${decision || ""}`;
  const parens = [...source.matchAll(/\(([^)]+)\)/g)].map((match) => match[1].trim());
  const topical = [...parens].reverse().find((part) => part.length <= 60 && !/art\.?|rules|annex|appendix|\bisc\b|第\d|附則/i.test(part));
  if (topical) return topical;
  const after = String(decision || "").split(":").slice(1).join(":").split("(")[0].trim().replace(/\.$/, "");
  if (after && after.length <= 60 && !/rules|art\./i.test(after)) return after;
  const head = String(reason || "").split("(")[0].split(",")[0].trim();
  if (!head || /rules|art\./i.test(head) || head.length > 60) return "";
  return head;
}

function jaKind(ja) {
  const head = String(ja).split(/[(（]/)[0].trim();
  return head.length > 40 ? head.slice(0, 40).trim() : head;
}

function jaTopic(ja) {
  const parens = [...String(ja).matchAll(/[（(]([^）)]+)[）)]/g)].map((match) => match[1].trim());
  const last = [...parens].reverse().find((part) => part.length <= 40 && !/第\d|規則|附則|art/i.test(part));
  return last || "";
}

function ncItem(session, nc, L, id) {
  const bits = [nc.sheet, nc.timing_evidence, nc.stints].filter(Boolean).map((part) => `<p>${rich(part, L)}</p>`).join("");
  const conclusion = nc.conclusion_unconfirmed ? `<p>${rich(nc.conclusion_unconfirmed, L)}</p>` : "";
  const idAttr = id ? ` id="${esc(id)}"` : "";
  return { ross: true, html: `<article class="decision is-ross"${idAttr}><h5 class="pen-title">${esc(L.t("pen_car", "213"))} · ${esc(L.t("not_classified"))}</h5><p class="who">${esc(L.t("not_classified"))} #213</p>${bits}${conclusion}</article>` };
}

function pair(L, who, en, ja, kind, ross, id = "", title = "") {
  const label = [kind, who].filter(Boolean).join(" ");
  const english = en ? para("en", literal(en, L), L.ja) : "";
  const japanese = ja ? para("ja", esc(ja), !L.ja) : "";
  const body = L.ja ? `${japanese}${english}` : `${english}${japanese}`;
  const cls = ross ? "decision is-ross" : "decision";
  const titleHtml = title ? `<h5 class="pen-title">${phrase(title)}</h5>` : "";
  const idAttr = id ? ` id="${esc(id)}"` : "";
  return { ross, html: `<article class="${cls}"${idAttr}>${titleHtml}${label ? `<p class="who">${esc(label)}</p>` : ""}${body}</article>` };
}

function decisionId(session, item, index) {
  if (item?.ref) return `${session.id}-pen-${penSlug(item.ref)}`;
  return `${session.id}-dec-${index}`;
}

function penSlug(ref) {
  return String(ref || "").replace(/^\*/, "").replace(/[^\w]+/g, "") || "x";
}

function para(lang, html, alt) {
  return `<p lang="${lang}"${alt ? ` class="alt"` : ""}>${html}</p>`;
}

function literal(text, L) {
  const flags = [];
  if (/unconfirmed/i.test(text)) flags.push(`<span class="flag">${esc(L.t("flag_unconfirmed"))}</span>`);
  if (/provisional/i.test(text)) flags.push(`<span class="flag">${esc(L.t("flag_provisional"))}</span>`);
  if (/unofficial/i.test(text)) flags.push(`<span class="flag">${esc(L.t("flag_unofficial"))}</span>`);
  return `${esc(text)}${flags.length ? ` ${flags.join(" ")}` : ""}`;
}

function ownNos(session) {
  const set = new Set(["213"]);
  for (const row of session.rows || []) {
    if (row.highlight === "primary" && row.no != null && row.no !== "") set.add(String(row.no));
  }
  for (const no of session.highlight_nos || []) set.add(String(no));
  return set;
}

function isOwn(no, own) {
  if (no == null || no === "") return false;
  return String(no).split(/[^\d]+/).some((part) => part && own.has(part));
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
