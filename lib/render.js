import { hero, phase, formatJst, countParts } from "./time.js";
import {
  circuitShort,
  esc,
  formatWeekend,
  hasUnconfirmed,
  humanize,
  isEmpty,
  padOrder,
  rich,
  safeJson,
  weekendExtra,
} from "./text.js";

const SHORT = {
  motegi: "Motegi",
  suzuka: "Suzuka",
  okayama: "Okayama",
  sugo: "SUGO",
  fuji: "Fuji",
};

export function renderHome(data, now = Date.now()) {
  const view = hero(data.races, now);
  const circuitById = indexCircuits(data);
  const body = `
    ${renderLead(view, circuitById, now)}
    <div class="wrap">
      <section class="block">
        <p class="section-kicker">The season</p>
        <h2 class="section-title">Eight weekends.</h2>
        <p class="deck">${esc(data.driver)}, car ${esc(data.car?.number)}. ${esc(data.car?.make_model || "")}, entered by ${esc(data.car?.entrant_team || "")}.</p>
        <p class="marker">${esc(data.unconfirmed_marker || "Anything marked unconfirmed is not confirmed fact.")}</p>
        <div class="calendar">${data.races.map((race) => renderRaceRow(race, circuitById)).join("")}</div>
      </section>
      <section class="block">
        <p class="section-kicker">The car</p>
        <h2 class="section-title">No. ${esc(data.car?.number)}.</h2>
        ${renderCar(data)}
      </section>
      ${renderSeries(data)}
      <section class="block">
        <p class="section-kicker">Where</p>
        <h2 class="section-title">Circuits.</h2>
        ${renderCircuitIndex(data.circuits, true)}
      </section>
      ${data.licence?.note ? `<section class="block"><p class="section-kicker">Paperwork</p><p class="prose">${rich(data.licence.note)}</p></section>` : ""}
    </div>`;
  return layout({
    title: "Shinkō1 · Ross Ogilvie 2026 Japan",
    description: `${data.driver}, car ${data.car?.number}, ${data.car?.make_model}. The 2026 Japan season with Circuit Orange Racing.`,
    current: "season",
    data,
    body,
    schedule: view.mode === "countdown" ? clientSchedule(view) : null,
  });
}

export function renderRace(data, race, now = Date.now()) {
  const circuitById = indexCircuits(data);
  const circuit = circuitById.get(race.circuit_id);
  const view = hero(data.races, now);
  const isHero = view.race?.id === race.id;
  const flagged = hasUnconfirmed(race);
  const name = SHORT[race.circuit_id] || circuitShort(circuit);
  const when = formatWeekend(race.dates?.weekend);
  const extra = weekendExtra(race.dates?.weekend);
  const body = `
    <div class="wrap race">
      <p class="crumb"><a href="/">Season</a> · ${esc(padOrder(race.order))}</p>
      <header class="race-head">
        <p class="status ${phase(race) === "current" ? "now" : ""}">${esc(statusText(race))}</p>
        <h1>${esc(name)}</h1>
        <p class="deck">${rich(race.series || "")}</p>
        ${race.round ? `<p class="round">${rich(race.round)}</p>` : ""}
        <p class="when-lg">${esc(when)}${extra ? ` <span class="extra">${rich(extra)}</span>` : ""}</p>
        ${flagged ? `<p class="banner">${esc(data.unconfirmed_marker || "Anything marked unconfirmed is not confirmed fact.")}</p>` : ""}
      </header>
      ${isHero && view.mode === "countdown" ? `<div class="panel">${renderCountdown(view, now)}</div>` : ""}
      ${isHero && view.mode === "underway" ? `<p class="banner">This weekend is underway. The next session time is not still ahead on the sheet.</p>` : ""}
      <dl class="facts">
        ${fact("Class", race.class)}
        ${fact("Format", race.format)}
        ${fact("Car", race.car_number ?? data.car?.number)}
        ${fact("Car name", race.car_name)}
        ${fact("Team", race.team || data.car?.entrant_team)}
        ${fact("Drivers", race.drivers)}
      </dl>
      <div class="split">
        <section>
          <h2>Sessions</h2>
          ${renderSessions(race)}
        </section>
        <section>
          <h2>The sheet</h2>
          ${renderResults(race.results)}
        </section>
      </div>
      ${renderLaps(race.results)}
      ${renderNotes(race.notes)}
      ${renderSources(race.sources)}
      ${circuit ? `<p class="onward"><a href="/circuits/${esc(circuit.id)}">Circuit guide · ${esc(circuit.official_name)}</a></p>` : ""}
    </div>`;
  return layout({
    title: `${name} · ${race.round || race.series} · Shinkō1`,
    description: `${name}, ${when}. ${race.series || ""}`.slice(0, 180),
    current: "season",
    data,
    body,
    schedule: isHero && view.mode === "countdown" ? clientSchedule(view) : null,
  });
}

export function renderCircuits(data) {
  const body = `
    <div class="wrap">
      <section class="block">
        <p class="section-kicker">Circuit guide</p>
        <h1 class="section-title">Five tracks.</h1>
        <p class="deck">Facts and maps from the season sheet. Lengths, corners and lap records are printed as published, including conflicts and anything marked unconfirmed.</p>
        ${renderCircuitIndex(data.circuits, false)}
      </section>
    </div>`;
  return layout({
    title: "Circuits · Shinkō1 2026",
    description: "Motegi, Suzuka, Okayama, SUGO and Fuji. Maps and the facts on the 2026 sheet.",
    current: "circuits",
    data,
    body,
  });
}

export function renderCircuit(data, circuit) {
  const races = data.races.filter((race) => race.circuit_id === circuit.id);
  const image = (circuit.images || [])[0];
  const credit = imageCredit(circuit, image, data.licenses);
  const src = image ? `/${String(image.file || image.png || "").replace(/^\/+/, "")}` : "";
  const body = `
    <div class="wrap circuit-page">
      <p class="crumb"><a href="/circuits">Circuits</a></p>
      <header class="race-head">
        <h1>${esc(SHORT[circuit.id] || circuitShort(circuit))}</h1>
        <p class="deck">${esc(circuit.official_name || "")}</p>
        <p class="where-line">${rich(circuit.location || "")}</p>
      </header>
      ${src ? `<figure class="map"><img src="${esc(src)}" alt="Track map of ${esc(circuit.official_name || circuit.id)}">${creditHtml(credit)}</figure>` : ""}
      <dl class="facts">
        ${fact("Length", lengthFact(circuit))}
        ${fact("Turns", circuit.turns)}
        ${fact("Direction", circuit.direction)}
        ${fact("Lap record", circuit.lap_record)}
      </dl>
      ${circuit.length_note ? `<p class="prose">${rich(circuit.length_note)}</p>` : ""}
      ${circuit.website ? `<p class="onward"><a href="${esc(circuit.website)}">Circuit website</a></p>` : ""}
      <section class="block">
        <h2>On this sheet</h2>
        ${races.length ? `<div class="calendar">${races.map((race) => renderRaceRow(race, new Map([[circuit.id, circuit]]))).join("")}</div>` : `<p class="missing">No weekend at this circuit is on the sheet.</p>`}
      </section>
    </div>`;
  return layout({
    title: `${circuit.official_name} · Shinkō1`,
    description: `${circuit.official_name}. ${circuit.location || ""}`.slice(0, 180),
    current: "circuits",
    data,
    body,
  });
}

export function renderNotFound() {
  return layout({
    title: "Not on the sheet · Shinkō1",
    description: "That page is not on the 2026 season sheet.",
    current: "",
    data: { car: {}, races: [], circuits: [], licenses: [] },
    body: `<div class="wrap block"><h1 class="section-title">Not on the sheet.</h1><p><a href="/">Back to the season</a></p></div>`,
  });
}

function layout({ title, description, current, data, body, schedule = null }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#030000">
  <meta name="description" content="${esc(description || "")}">
  <title>${esc(title)}</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="/fonts/Figtree-Bold.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/site.css">
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  <header class="mast">
    <div class="wrap mast-grid">
      <a class="brand" href="/">
        <span class="hanko" lang="ja">新興</span>
        <span class="wordmark">Shinkō1</span>
      </a>
      <p class="issue"><span>Japan motor racing</span><span>Season ${esc(data.season || "2026")}</span></p>
      <p class="carno"><span>Car</span>${esc(data.car?.number || "213")}</p>
    </div>
    <nav class="nav" aria-label="Sections">
      <div class="wrap nav-row">
        <a href="/" ${current === "season" ? 'aria-current="page"' : ""}>Season</a>
        <a href="/circuits" ${current === "circuits" ? 'aria-current="page"' : ""}>Circuits</a>
        <span class="nav-id">${esc(data.driver || "Ross Ogilvie")} · West Racing v.Granz · Circuit Orange Racing</span>
      </div>
    </nav>
  </header>
  <div class="redrule" aria-hidden="true"></div>
  <main id="content">
    ${body}
  </main>
  ${renderFooter(data)}
  ${schedule ? `<script type="application/json" id="schedule">${safeJson(schedule)}</script>` : ""}
  <script src="/js/countdown.js" defer></script>
</body>
</html>`;
}

function renderLead(view, circuitById, now) {
  const race = view.race;
  if (!race) {
    return `<section class="lead"><div class="wrap"><p class="kicker">Season</p><h1>No races on the sheet.</h1></div></section>`;
  }
  const circuit = circuitById.get(race.circuit_id);
  const name = SHORT[race.circuit_id] || circuitShort(circuit);
  const when = formatWeekend(race.dates?.weekend);
  if (view.mode === "complete") {
    return `<section class="lead"><div class="wrap lead-grid"><div><p class="kicker">Season</p><h1>${esc(name)}</h1><p class="deck">${rich(race.series || "")}</p><p class="session">The published weekends are complete.</p></div></div></section>`;
  }
  const kicker = view.mode === "underway" ? "Now" : "Next";
  const clock = view.mode === "countdown"
    ? renderCountdown(view, now)
    : `<p class="session">${view.mode === "underway" ? "Session clock has passed. Results are not on the sheet yet." : "No session clock is published for this weekend."}</p>`;
  return `<section class="lead">
    <div class="wrap lead-grid">
      <p class="kicker">${kicker}</p>
      <h1>${esc(name)}</h1>
      <div class="lead-clock">${clock}</div>
      <p class="when-line">${esc(when)}</p>
      <p class="deck">${rich(race.series || "")}</p>
      <a class="go" href="/races/${esc(race.id)}">Open the weekend</a>
    </div>
  </section>`;
}

function renderCountdown(view, now) {
  const next = view.schedule[0];
  const parts = countParts(next.iso, now);
  const detail = `${next.label} · ${formatJst(next.iso)}`;
  return `<div data-countdown-root>
    <p class="session" data-session-label>${esc(detail)}${next.unconfirmed ? ` <span class="flag">Unconfirmed</span>` : ""}</p>
    <div class="count" aria-hidden="true">
      <div><b data-unit="d">${parts.d}</b><span>Days</span></div>
      <div><b data-unit="h">${parts.h}</b><span>Hrs</span></div>
      <div><b data-unit="m">${parts.m}</b><span>Min</span></div>
      <div><b data-unit="s">${parts.s}</b><span>Sec</span></div>
    </div>
  </div>`;
}

function clientSchedule(view) {
  return view.schedule.map((item) => ({
    iso: item.iso,
    label: item.label,
    detail: `${item.label} · ${formatJst(item.iso)}`,
    unconfirmed: item.unconfirmed,
  }));
}

function renderRaceRow(race, circuitById) {
  const circuit = circuitById.get(race.circuit_id);
  const name = SHORT[race.circuit_id] || circuitShort(circuit);
  const lines = summaryLines(race);
  const flag = rowNeedsFlag(race) ? `<span class="flag">Unconfirmed</span>` : "";
  const label = race.round && race.round.length < 140 ? race.round : (race.series || race.round || "");
  return `<a class="race-row" href="/races/${esc(race.id)}">
    <span class="ord">${esc(padOrder(race.order))}</span>
    <span class="when">${esc(formatWeekend(race.dates?.weekend))}</span>
    <span>
      <span class="circuit">${esc(name)}</span>
      <span class="series">${rich(label)}</span>
    </span>
    <span class="result">
      <span class="status ${phase(race) === "current" ? "now" : ""}">${esc(statusText(race))}</span>
      ${flag}
      ${lines || `<span class="missing">${phase(race) === "past" ? "No result published" : phase(race) === "current" ? "Result not published" : "Ahead"}</span>`}
    </span>
  </a>`;
}

function summaryLines(race) {
  const results = race.results || {};
  const bits = [];
  if (results.race1?.position || results.race2?.position) {
    if (results.race1?.position) bits.push(line("Race 1", results.race1.position, results.race1.best_lap));
    if (results.race2?.position) bits.push(line("Race 2", results.race2.position, results.race2.best_lap));
  } else {
    if (results.qualifying?.position) bits.push(line("Qualifying", results.qualifying.position, results.qualifying.car_best_lap));
    if (results.race?.position) bits.push(line("Race", results.race.position, results.race.best_lap_ross || results.race.best_lap));
  }
  if (!bits.length) return "";
  return `<span class="lines">${bits.join("")}</span>`;
}

function line(label, position, lap) {
  const lapHtml = lap ? `<span class="lap">${rich(lap)}</span>` : "";
  return `<span class="line"><span class="lbl">${esc(label)}</span> ${rich(position)}${lapHtml}</span>`;
}

function rowNeedsFlag(race) {
  if (/completed/i.test(race.status || "")) return false;
  return hasUnconfirmed(race.status) || hasUnconfirmed(race.class) || hasUnconfirmed(race.car_number) || hasUnconfirmed(race.team) || hasUnconfirmed(race.drivers) || hasUnconfirmed(race.round) || hasUnconfirmed(race.series) || hasUnconfirmed(race.dates) || hasUnconfirmed(race.format);
}

function statusText(race) {
  const status = race.status || "";
  if (/in progress/i.test(status)) return "In progress";
  if (/completed/i.test(status)) return "Completed";
  if (/upcoming/i.test(status)) return "Upcoming";
  return status || "Upcoming";
}

function renderCar(data) {
  const car = data.car || {};
  const names = (car.car_name_on_entries || []).map((name) => `<li>${esc(name)}</li>`).join("");
  const kyle = (data.races || [])
    .filter((race) => (race.drivers || []).some((driver) => /Kyle Wynne/i.test(driver)))
    .map((race) => race.round || race.series);
  return `<div class="dossier">
    <div>
      <p class="prose">${esc(car.make_model || "")}. ${esc(car.engine || "")}.</p>
      <p class="prose">${esc(car.tyres_2026 || "")}.</p>
      ${kyle.length ? `<p class="prose">Kyle Wynne is named on ${kyle.map((item) => esc(item)).join("; ")}.</p>` : ""}
    </div>
    <dl class="spec">
      ${fact("Number", car.number)}
      ${fact("Minimum weight", car.min_race_weight_kg ? `${car.min_race_weight_kg} kg` : "")}
      ${fact("Entrant", car.entrant_team)}
      ${fact("Prepared by", car.mechanics)}
    </dl>
  </div>
  ${names ? `<h3>Names on the sheets</h3><ul class="names">${names}</ul>` : ""}`;
}

function renderSeries(data) {
  const series = data.series || [];
  if (!series.length) return "";
  const cards = series.map((item) => {
    const bits = [
      item.what_champions_cup_means,
      item.ross_class ? `Ross's class on the sheet: ${item.ross_class}` : "",
      item.format,
      item.format_rd4 ? `Round 4 format: ${item.format_rd4}` : "",
      item.organiser ? `Organiser: ${item.organiser}` : "",
    ].filter(Boolean);
    return `<article><h3>${rich(item.name || "")}</h3>${bits.map((bit) => `<p>${rich(bit)}</p>`).join("")}</article>`;
  }).join("");
  return `<section class="block"><p class="section-kicker">What he is racing</p><h2 class="section-title">The championships.</h2><div class="cols">${cards}</div></section>`;
}

function renderCircuitIndex(circuits, compact) {
  const items = (circuits || []).map((circuit) => {
    const length = typeof circuit.length_m === "number"
      ? `${circuit.length_m.toLocaleString("en-AU")} m`
      : "";
    return `<a class="circuit-link" href="/circuits/${esc(circuit.id)}">
      <span>
        <span class="circuit">${esc(SHORT[circuit.id] || circuitShort(circuit))}</span>
        ${compact ? "" : `<span class="series">${esc(circuit.official_name || "")}</span>`}
      </span>
      <span class="when">${esc(length)}</span>
    </a>`;
  }).join("");
  return `<div class="circuit-index">${items}</div>`;
}

function renderSessions(race) {
  const dates = race.dates || {};
  const keys = Object.keys(dates).filter((key) => key !== "calendar_block");
  if (!keys.length) return `<p class="missing">No session times published.</p>`;
  const rows = keys.map((key) => {
    const value = dates[key];
    let html;
    if (key === "weekend") {
      const extra = weekendExtra(value);
      html = `${esc(formatWeekend(value))}${extra ? ` ${rich(extra)}` : ""}`;
    } else {
      html = renderValue(value);
    }
    return `<div><dt>${esc(humanize(key))}</dt><dd>${html}</dd></div>`;
  }).join("");
  return `<dl class="kv">${rows}</dl>`;
}

function renderResults(results) {
  if (isEmpty(results)) return `<p class="missing">No result published.</p>`;
  if (typeof results === "string") return `<p>${rich(results)}</p>`;
  return renderValue(results);
}

function renderValue(value) {
  if (isEmpty(value)) return `<span class="missing">Not published</span>`;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return rich(value);
  }
  if (Array.isArray(value)) {
    return `<ul class="plain">${value.map((item) => `<li>${renderValue(item)}</li>`).join("")}</ul>`;
  }
  const rows = Object.entries(value).map(([key, child]) => {
    const big = key === "position" ? "is-position" : "";
    return `<div><dt>${esc(humanize(key))}</dt><dd class="${big}">${renderValue(child)}</dd></div>`;
  }).join("");
  return `<dl class="kv">${rows}</dl>`;
}

function renderLaps(results) {
  const laps = collectLaps(results);
  if (!laps.length) return "";
  const items = laps.map((item) => `<li><span class="who">${esc(lapWho(item))}</span><span class="time">${rich(item.value)}</span></li>`).join("");
  return `<section class="block"><h2>Best laps</h2><ul class="laps">${items}</ul></section>`;
}

function collectLaps(value, trail = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const out = [];
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object" && !Array.isArray(child)) {
      out.push(...collectLaps(child, [...trail, key]));
    } else if (typeof child === "string" && isLapField(key)) {
      out.push({ key, trail, value: child });
    }
  }
  return out;
}

function isLapField(key) {
  if (/^(laps|gap|conditions|position|total_time|note)$/.test(key)) return false;
  return /best|ross_time|kyle/.test(key);
}

function lapWho(item) {
  let who = "Best lap";
  if (/kyle/i.test(item.key)) who = "Kyle Wynne";
  else if (/ross/i.test(item.key)) who = "Ross Ogilvie";
  else if (/car_best/.test(item.key)) who = "Car";
  const session = item.trail.map(humanize).join(" · ");
  return session ? `${who} · ${session}` : who;
}

function renderNotes(notes) {
  if (!notes?.length) return "";
  const items = notes.map((note) => `<li>${rich(note)}</li>`).join("");
  return `<section class="block"><h2>Notes</h2><ol class="notes">${items}</ol></section>`;
}

function renderSources(sources) {
  if (!sources?.length) return "";
  const items = sources.map((source) => {
    const parsed = parseSource(source);
    if (!parsed) return "";
    return `<li><a href="${esc(parsed.url)}">${esc(parsed.label)}</a></li>`;
  }).join("");
  if (!items.trim()) return "";
  return `<section class="block sources"><h2>Sources</h2><ul>${items}</ul></section>`;
}

function parseSource(source) {
  if (typeof source !== "string") return null;
  const match = source.match(/https?:\/\/[^\s)]+/);
  if (!match) return null;
  const url = match[0].replace(/[.,;]+$/, "");
  let label = source.replace(match[0], "").replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  if (!label) {
    try {
      label = new URL(url).host;
    } catch {
      label = url;
    }
  }
  return { url, label };
}

function fact(label, value) {
  let inner;
  if (isEmpty(value)) inner = `<span class="missing">Not published</span>`;
  else if (typeof value === "string" || typeof value === "number") inner = rich(value);
  else if (Array.isArray(value)) inner = value.map((item) => rich(item)).join("<br>");
  else if (value && typeof value === "object" && (value.time || value.driver)) {
    const unverified = /not verified/i.test(value.source || "") && !/unconfirmed/i.test(value.source || "");
    inner = `<span class="record">${esc(value.time || "")}</span> ${esc([value.driver, value.car, value.year].filter(Boolean).join(" · "))}${value.source ? `<span class="source-line">${rich(value.source)}</span>` : ""}${unverified ? ` <span class="flag">Not verified</span>` : ""}`;
  } else inner = renderValue(value);
  return `<div><dt>${esc(label)}</dt><dd>${inner}</dd></div>`;
}

function lengthFact(circuit) {
  if (typeof circuit.length_m === "number") return `${circuit.length_m.toLocaleString("en-AU")} m`;
  return circuit.length_m || "";
}

function imageCredit(circuit, image, licenses) {
  if (!image) return null;
  const file = String(image.file || image.png || "").split("/").pop();
  const lic = (licenses || []).find((item) => (item.files || []).includes(file))
    || (licenses || []).find((item) => item.circuit === circuit.id);
  return {
    author: image.author || cleanAuthor(lic?.author),
    license: image.license || lic?.license || "",
    licenseUrl: lic?.license_url || "",
    commons: image.source || lic?.commons_page || "",
    note: image.note || "",
  };
}

function cleanAuthor(author) {
  if (!author) return "";
  const original = String(author).match(/Original text:\s*([^)\n]+)/i);
  if (original) return original[1].trim();
  return String(author).replace(/\s+/g, " ").trim();
}

function creditHtml(credit) {
  if (!credit) return "";
  const bits = [];
  if (credit.commons) bits.push(`<a href="${esc(credit.commons)}">Track map</a>`);
  else bits.push("Track map");
  if (credit.author) bits.push(`by ${esc(credit.author)}`);
  if (credit.license && credit.licenseUrl) bits.push(`<a href="${esc(credit.licenseUrl)}">${esc(credit.license)}</a>`);
  else if (credit.license) bits.push(esc(credit.license));
  let text = bits.join(", ");
  if (/BY-SA/i.test(credit.license)) {
    text += ". Adaptations of this map stay under the same licence.";
  }
  if (credit.note) {
    const note = credit.note.charAt(0).toUpperCase() + credit.note.slice(1);
    text += ` ${rich(note)}`;
  }
  return `<figcaption class="credit">${text}</figcaption>`;
}

function renderFooter(data) {
  const credits = [];
  for (const circuit of data.circuits || []) {
    for (const image of circuit.images || []) {
      const credit = imageCredit(circuit, image, data.licenses);
      if (!credit) continue;
      credits.push(`<li><strong>${esc(SHORT[circuit.id] || circuit.id)}</strong> — ${creditHtml(credit).replace(/^<figcaption class="credit">|<\/figcaption>$/g, "")}</li>`);
    }
  }
  return `<footer class="colophon">
    <div class="wrap">
      <p class="belief">The past informs, refines, and builds our future.</p>
      <p class="kanji-note"><span class="jp" lang="ja">新興</span> Shinkō. Belief in what we do. Emerging, rising, new origins.</p>
      <p>${esc(data.driver || "Ross Ogilvie")} · Car ${esc(data.car?.number || "")} · ${esc(data.car?.make_model || "")} · ${esc(data.car?.entrant_team || "")}</p>
      <p>${esc(data.timezone_note || "Times are in JST (UTC+9).")}</p>
      <h2>Map credits</h2>
      <ul class="credits">${credits.join("")}</ul>
      <p class="generated">Sheet dated ${esc(data.generated || "")}. Edit <code>data/season.json</code> to update the site. Lines marked unconfirmed are not fact.</p>
    </div>
  </footer>`;
}

export function indexCircuits(data) {
  return new Map((data.circuits || []).map((circuit) => [circuit.id, circuit]));
}

export function findRace(data, id) {
  return (data.races || []).find((race) => race.id === id) || null;
}

export function findCircuit(data, id) {
  return (data.circuits || []).find((circuit) => circuit.id === id) || null;
}
