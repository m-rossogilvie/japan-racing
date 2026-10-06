import { makeLocale } from "./i18n.js";
import { renderClassifications, sessionHasDecisions, sessionsById, sessionsFor } from "./tables.js";
import { phrase } from "./phrase.js";
import { activeSession, hero, phase, formatJst, countParts, clockIso } from "./time.js";
import {
  circuitShort,
  esc,
  formatWeekend,
  hasUnconfirmed,
  isEmpty,
  padOrder,
  rich,
  safeJson,
  weekendExtra,
} from "./text.js";

let L = makeLocale("en");
let NOW = Date.now();

function bind(lang, strings, now = Date.now()) {
  L = makeLocale(lang, strings || {});
  NOW = now;
  return L;
}

export function renderHome(data, now = Date.now(), lang = "en", origin = "", path = "/") {
  bind(lang, data.jaStrings, now);
  const view = hero(data.races, now);
  const circuitById = indexCircuits(data);
  const count = data.races.length;
  const body = `
    ${renderLead(view, circuitById, now)}
    <div class="wrap">
      <section class="block">
        <p class="section-kicker">${esc(L.t("the_season"))}</p>
        <h2 class="section-title">${esc(L.t("weekends", count))}</h2>
        <p class="deck">${L.ja
          ? `${esc(data.driver)}、ゼッケン${esc(data.car?.number)}。${esc(L.tr(data.car?.make_model || ""))}。エントラントは${esc(L.tr(data.car?.entrant_team || ""))}。`
          : `${esc(data.driver)}, car ${esc(data.car?.number)}. ${esc(data.car?.make_model || "")}, entered by ${esc(data.car?.entrant_team || "")}.`}</p>
        <p class="marker">${esc(L.tr(data.unconfirmed_marker || ""))}</p>
        <div class="calendar">${data.races.map((race) => renderRaceRow(race, circuitById)).join("")}</div>
      </section>
      <section class="block">
        <p class="section-kicker">${esc(L.t("the_car"))}</p>
        <h2 class="section-title">${esc(L.t("no_dot"))} ${esc(data.car?.number)}.</h2>
        ${renderCar(data)}
      </section>
      ${renderSeries(data)}
      <section class="block">
        <p class="section-kicker">${esc(L.t("where"))}</p>
        <h2 class="section-title">${esc(L.t("circuits_title"))}</h2>
        ${renderCircuitIndex(data.circuits, true)}
      </section>
      ${data.licence?.note ? `<section class="block"><p class="section-kicker">${esc(L.t("paperwork"))}</p><p class="prose">${rich(data.licence.note, L)}</p></section>` : ""}
    </div>`;
  return layout({
    title: "Shinkō1 · Ross Ogilvie 2026 Japan",
    description: `${data.driver}, car ${data.car?.number}, ${data.car?.make_model}. The 2026 Japan season with Circuit Orange Racing.`,
    current: "season",
    data,
    body,
    schedule: view.mode === "countdown" ? clientSchedule(view) : null,
    nextBar: renderNextBar(view, now),
    origin,
    path,
  });
}

export function renderRace(data, race, now = Date.now(), lang = "en", origin = "", path = "/") {
  bind(lang, data.jaStrings, now);
  const circuitById = indexCircuits(data);
  const circuit = circuitById.get(race.circuit_id);
  const view = hero(data.races, now);
  const isHero = view.race?.id === race.id;
  const flagged = hasUnconfirmed(race);
  const name = L.circuit(race.circuit_id, circuitShort(circuit));
  const when = formatWeekend(race.dates?.weekend, L.lang);
  const extra = weekendExtra(race.dates?.weekend);
  const sessions = sessionsFor(data.results, race);
  const live = isHero && view.mode === "underway" ? activeSession(race, now) : null;
  const clock = isHero && view.mode === "countdown"
    ? `<div class="panel"><div class="wrap">${renderCountdown(view, now)}</div></div>`
    : isHero && live
      ? `<div class="panel"><div class="wrap">${renderLive(live)}</div></div>`
      : isHero && view.mode === "tbc"
        ? `<div class="panel"><div class="wrap">${renderTimeTbc()}</div></div>`
        : "";
  const jumps = jumpNav([
    ["sessions", race.timetable ? L.t("jump_times") : L.t("jump_sessions")],
    ["sheet", L.t("jump_sheet")],
    sessions.some((session) => !session.related) ? ["results", L.t("jump_results")] : null,
    sessions.some(sessionHasDecisions) ? ["penalties", L.t("penalties_jump")] : null,
    race.notes?.length ? ["notes", L.t("jump_notes")] : null,
  ]);
  const body = `
    <div class="race-sheet">
    <div class="wrap race">
      <p class="crumb"><a href="${esc(L.href("/"))}">${esc(L.t("season"))}</a> · ${esc(padOrder(race.order))}</p>
    </div>
    ${jumps}
    <div class="wrap race">
      <header class="race-head">
        <p class="status ${phase(race, NOW) === "current" ? "now" : ""}">${esc(statusText(race))}</p>
        <h1>${phrase(name)}</h1>
      </header>
    </div>
    ${clock}
    <div class="wrap race">
      <div class="race-head">
        <p class="deck">${rich(race.series || "", L)}</p>
        ${race.round ? `<p class="round">${rich(race.round, L)}</p>` : ""}
        <p class="when-lg">${esc(when)}${extra ? ` <span class="extra">${rich(extra, L)}</span>` : ""}</p>
        ${flagged ? `<p class="banner">${esc(L.tr(data.unconfirmed_marker || ""))}</p>` : ""}
      </div>
      ${isHero && view.mode === "underway" && !live ? `<p class="banner">${esc(L.t("underway"))}</p>` : ""}
      <dl class="facts">
        ${fact(L.t("class"), race.class)}
        ${fact(L.t("format"), race.format)}
        ${fact(L.t("car"), race.car_number ?? data.car?.number)}
        ${fact(L.t("car_name"), race.car_name)}
        ${fact(L.t("team"), race.team || data.car?.entrant_team)}
        ${fact(L.t("drivers"), race.drivers)}
      </dl>
      <div class="split">
        <section id="sessions">
          <h2>${esc(race.timetable ? L.t("timetable") : L.t("sessions"))}</h2>
          ${race.timetable ? renderTimetable(race, { heading: false }) : `${renderSessions(race)}${calendarLink(race)}`}
        </section>
        <section id="sheet">
          <h2>${esc(L.t("the_sheet"))}</h2>
          ${renderResults(race.results)}
        </section>
      </div>
      ${renderLaps(race.results)}
      ${renderClassifications(sessions, L)}
      ${renderNotes(race.notes, "notes")}
      ${renderSources(race.sources)}
      ${circuit ? `<p class="onward"><a href="${esc(L.href(`/circuits/${circuit.id}`))}">${esc(L.t("circuit_guide"))} · ${esc(L.tr(circuit.official_name))}</a></p>` : ""}
    </div>
    </div>`;
  return layout({
    title: `${name} · ${race.round || race.series} · Shinkō1`,
    description: `${name}, ${when}. ${race.series || ""}`.slice(0, 180),
    current: "season",
    data,
    body,
    schedule: isHero && view.mode === "countdown" ? clientSchedule(view) : null,
    nextBar: isHero ? renderNextBar(view, now, { here: true }) : "",
    origin,
    path,
  });
}

export function renderKyle(data, lang = "en", origin = "", path = "/kyle-wynne") {
  bind(lang, data.jaStrings);
  const kyle = data.results?.kyle_wynne;
  if (!kyle) return renderNotFound(lang, origin, path);
  const races = kyle.vita_races || [];
  const cards = races.map((race) => renderVitaCard(race, data)).join("");
  const mec = (kyle.mec120_with_ross || []).map((item) => {
    const href = item.race_id ? L.href(`/races/${item.race_id}`) : "";
    const title = href ? `<a href="${esc(href)}">${rich(item.event, L)}</a>` : rich(item.event, L);
    return `<li><p>${title}</p><p>${rich(item.summary, L)}</p></li>`;
  }).join("");
  const gaps = (kyle.gaps || []).map((gap) => `<li>${rich(gap, L)}</li>`).join("");
  const sessionIds = races.flatMap((race) => race.sessions || []);
  const kyleSessions = sessionsById(data.results, sessionIds);
  const jumps = jumpNav([
    races.length ? ["programme", L.t("jump_programme")] : null,
    kyleSessions.length ? ["results", L.t("jump_results")] : null,
    kyleSessions.some(sessionHasDecisions) ? ["penalties", L.t("penalties_jump")] : null,
    (kyle.gaps || []).length ? ["gaps", L.t("jump_gaps")] : null,
  ]);
  const body = `
    <div class="wrap">
      <p class="crumb"><a href="${esc(L.href("/"))}">${esc(L.t("season"))}</a></p>
      ${jumps}
      <header class="race-head">
        <p class="section-kicker">${esc(L.t("kyle_kicker"))}</p>
        <h1>${phrase(L.t("kyle_title"))}</h1>
        <p class="deck">${rich(kyle.role || "", L)}</p>
        <p class="when-lg">${esc(kyle.team || "")} · ${esc(kyle.car || "")}</p>
      </header>
      <section class="block" id="programme">
        <h2>${esc(L.t("vita_programme"))}</h2>
        <div class="vita-list">${cards}</div>
      </section>
      ${mec ? `<section class="block"><h2>${esc(L.t("mec_with_ross"))}</h2><ol class="notes">${mec}</ol></section>` : ""}
      ${renderClassifications(kyleSessions, L)}
      ${gaps ? `<section class="block" id="gaps"><h2>${esc(L.t("gaps"))}</h2><ul class="notes">${gaps}</ul></section>` : ""}
    </div>`;
  return layout({
    title: "Kyle Wynne · VITA · Shinkō1",
    description: `${kyle.name}, ${kyle.team}. VITA races and MEC120 co-drives with Ross Ogilvie.`,
    current: "kyle",
    data,
    body,
    origin,
    path,
  });
}

function renderVitaCard(race, data) {
  const title = L.ja && race.event_ja ? race.event_ja : L.tr(race.event);
  const target = vitaHref(race, data);
  const flags = (race.unconfirmed || []).map((item) => rich(item, L)).join("<br>");
  const provisional = /provisional/i.test(race.status || "") || /provisional/i.test(race.quali || "");
  return `<article class="vita-card">
    <h3>${target ? `<a href="${esc(target)}">${esc(title)}</a>` : esc(title)}</h3>
    <p>${esc(race.date || "")} · ${esc(race.car || "")}${provisional ? ` <span class="flag">${esc(L.t("flag_provisional"))}</span>` : ""}</p>
    <p><span class="lbl">${esc(L.t("qualifying"))}</span> ${rich(race.quali || "", L)}</p>
    <p><span class="lbl">${esc(L.t("race"))}</span> ${rich(race.race || "", L)}</p>
    ${race.conditions ? `<p><span class="lbl">${esc(L.t("conditions"))}</span> ${rich(race.conditions, L)}</p>` : ""}
    ${flags ? `<p>${flags}</p>` : ""}
    ${target ? `<p class="onward"><a href="${esc(target)}">${esc(L.t("open_race"))}</a></p>` : ""}
  </article>`;
}

function vitaHref(race, data) {
  const ids = race.sessions || [];
  const first = (data.results?.sessions || []).find((session) => session.id === ids[0]);
  if (!first) return "";
  if (first.race_id === "kyle-2026-scr4-suzuka-vita") {
    const raceSession = ids.find((id) => /race/.test(id)) || first.id;
    return `${L.href("/races/2026-scr4-suzuka-vgranz")}#${raceSession}`;
  }
  const page = (data.races || []).find((item) => item.id === first.race_id);
  if (!page) return `${L.href("/kyle-wynne")}#${first.id}`;
  return `${L.href(`/races/${page.id}`)}#${ids[0]}`;
}

export function renderCircuits(data, lang = "en", origin = "", path = "/circuits") {
  bind(lang, data.jaStrings);
  const body = `
    <div class="wrap">
      <section class="block">
        <p class="section-kicker">${esc(L.t("circuit_guide"))}</p>
        <h1 class="section-title">${esc(L.t("five_tracks"))}</h1>
        <p class="deck">${esc(L.t("circuit_deck"))}</p>
        ${renderCircuitIndex(data.circuits, false)}
      </section>
    </div>`;
  return layout({
    title: "Circuits · Shinkō1 2026",
    description: "Motegi, Suzuka, Okayama, SUGO and Fuji. Maps and the facts on the 2026 sheet.",
    current: "circuits",
    data,
    body,
    origin,
    path,
  });
}

export function renderCircuit(data, circuit, lang = "en", origin = "", path = "/") {
  bind(lang, data.jaStrings);
  const races = data.races.filter((race) => race.circuit_id === circuit.id);
  const image = (circuit.images || [])[0];
  const credit = imageCredit(circuit, image, data.licenses);
  const src = image ? `/${String(image.file || image.png || "").replace(/^\/+/, "")}` : "";
  const name = L.circuit(circuit.id, circuitShort(circuit));
  const size = IMAGE_SIZE[circuit.id] || [];
  const alt = L.ja ? `${name}サーキット コース図` : `${name} circuit map`;
  const body = `
    <div class="wrap circuit-page">
      <p class="crumb"><a href="${esc(L.href("/circuits"))}">${esc(L.t("circuits"))}</a></p>
      <header class="race-head">
        <h1>${phrase(name)}</h1>
        <p class="deck">${esc(L.tr(circuit.official_name || ""))}</p>
        <p class="where-line">${rich(circuit.location || "", L)}</p>
      </header>
      ${src ? `<figure class="map"><img src="${esc(src)}" alt="${esc(alt)}"${size.length ? ` width="${size[0]}" height="${size[1]}"` : ""}>${creditHtml(credit)}</figure>` : ""}
      <dl class="facts">
        ${fact(L.t("length"), lengthFact(circuit))}
        ${fact(L.t("turns"), circuit.turns)}
        ${fact(L.t("direction"), circuit.direction)}
        ${fact(L.t("lap_record"), circuit.lap_record)}
      </dl>
      ${circuit.length_note ? `<p class="prose">${rich(circuit.length_note, L)}</p>` : ""}
      ${circuit.website ? `<p class="onward"><a href="${esc(circuit.website)}">${esc(L.t("circuit_website"))}</a></p>` : ""}
      <section class="block">
        <h2>${esc(L.t("on_this_sheet"))}</h2>
        ${races.length ? `<div class="calendar">${races.map((race) => renderRaceRow(race, new Map([[circuit.id, circuit]]))).join("")}</div>` : `<p class="missing">${esc(L.t("no_weekend"))}</p>`}
      </section>
    </div>`;
  return layout({
    title: `${circuit.official_name} · Shinkō1`,
    description: `${circuit.official_name}. ${circuit.location || ""}`.slice(0, 180),
    current: "circuits",
    data,
    body,
    origin,
    path,
  });
}

export function renderNotFound(lang = "en", origin = "", path = "/") {
  bind(lang, {});
  return layout({
    title: "Not on the sheet · Shinkō1",
    description: "That page is not on the 2026 season sheet.",
    current: "",
    data: { car: {}, races: [], circuits: [], licenses: [], season: "2026" },
    body: `<div class="wrap block"><h1 class="section-title">${esc(L.t("not_on_sheet"))}</h1><p><a href="${esc(L.href("/"))}">${esc(L.t("back"))}</a></p></div>`,
    origin,
    path,
  });
}

function layout({ title, description, current, data, body, schedule = null, nextBar = "", origin = "", path = "/" }) {
  const enPath = path || "/";
  const jaPath = enPath === "/" ? "/ja" : `/ja${enPath}`;
  const enHref = `${origin}${enPath === "/" ? "/?hl=en" : enPath}`;
  const jaHref = `${origin}${jaPath}`;
  const here = L.lang;
  const langs = langSwitch(enHref, jaHref, here);
  const races = renderRaceMenu(data, path, NOW);
  const onRace = path.startsWith("/races/");
  return `<!DOCTYPE html>
<html lang="${here}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#030000">
  <meta name="description" content="${esc(description || "")}">
  <title>${esc(title)}</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate" hreflang="en" href="${esc(origin ? `${origin}${enPath}` : enPath)}">
  <link rel="alternate" hreflang="ja" href="${esc(origin ? jaHref : jaPath)}">
  <link rel="alternate" hreflang="x-default" href="${esc(origin ? `${origin}${enPath}` : enPath)}">
  <link rel="preload" href="/fonts/Figtree-Bold.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/site.css?v=hero">
</head>
<body class="${path === "/" ? "is-home" : "is-inner"}${nextBar ? " has-next-bar" : ""}">
  <a class="skip" href="#content">${esc(L.t("skip"))}</a>
  <header class="mast">
    <div class="wrap mast-grid">
      <a class="brand" href="${esc(L.href("/"))}">
        <span class="hanko" lang="ja">新興</span>
        <span class="wordmark">Shinkō1</span>
      </a>
      <p class="issue"><span>${esc(L.t("issue_a"))}</span><span>${esc(L.t("issue_b"))} ${esc(data.season || "2026")}</span></p>
      <p class="carno"><span>${esc(L.t("car"))}</span>${esc(data.car?.number || "213")}</p>
      <details class="sheet-menu" id="site-menu">
        <summary class="menu-btn" aria-expanded="false" aria-controls="site-menu-panel">
          <span class="menu-bars" aria-hidden="true"></span>
          <span class="when-closed">${esc(L.t("menu"))}</span>
          <span class="when-open">${esc(L.t("close"))}</span>
        </summary>
        <div class="menu-panel" id="site-menu-panel" role="dialog" aria-modal="true" aria-label="${esc(L.t("menu"))}">
          <div class="menu-scroll">
            <p class="menu-issue">${esc(L.t("issue_a"))} · ${esc(L.t("issue_b"))} ${esc(data.season || "2026")}</p>
            <p class="menu-car"><span>${esc(L.t("car"))}</span> ${esc(data.car?.number || "213")}</p>
            <a class="menu-main" href="${esc(L.href("/"))}" ${current === "season" ? 'aria-current="page"' : ""}>${esc(L.t("season"))}</a>
            <a class="menu-main" href="${esc(L.href("/circuits"))}" ${current === "circuits" ? 'aria-current="page"' : ""}>${esc(L.t("circuits"))}</a>
            <a class="menu-main" href="${esc(L.href("/kyle-wynne"))}" ${current === "kyle" ? 'aria-current="page"' : ""}>${esc(L.t("kyle"))}</a>
            <p class="menu-kicker menu-kicker-first">${esc(L.t("races"))}</p>
            ${races}
          </div>
          <div class="menu-foot">${langs}</div>
        </div>
      </details>
    </div>
    <div class="redrule redrule-mast" aria-hidden="true"></div>
    <nav class="nav" aria-label="${esc(L.t("nav"))}">
      <div class="wrap nav-row">
        <a href="${esc(L.href("/"))}" ${current === "season" ? 'aria-current="page"' : ""}>${esc(L.t("season"))}</a>
        <details class="races-menu">
          <summary class="races-btn" aria-expanded="false" aria-controls="race-list" ${onRace ? 'aria-current="page"' : ""}>${esc(L.t("races"))}</summary>
          <div class="race-drop" id="race-list">${races}</div>
        </details>
        <a href="${esc(L.href("/circuits"))}" ${current === "circuits" ? 'aria-current="page"' : ""}>${esc(L.t("circuits"))}</a>
        <a href="${esc(L.href("/kyle-wynne"))}" ${current === "kyle" ? 'aria-current="page"' : ""}>${esc(L.t("kyle"))}</a>
        <span class="nav-id">${esc(data.driver || "Ross Ogilvie")} · West Racing v.Granz · Circuit Orange Racing</span>
        ${langs}
      </div>
      <div class="redrule redrule-nav" aria-hidden="true"></div>
    </nav>
  </header>
  <main id="content">
    ${body}
  </main>
  ${renderFooter(data)}
  ${nextBar}
  ${schedule ? `<script type="application/json" id="schedule">${safeJson(schedule)}</script>` : ""}
  <script src="/js/lang.js" defer></script>
  <script src="/js/prefs.js" defer></script>
  <script src="/js/nav.js" defer></script>
  <script src="/js/clocks.js" defer></script>
  <script src="/js/countdown.js" defer></script>
</body>
</html>`;
}

function langSwitch(enHref, jaHref, here) {
  return `<span class="langs" role="group" aria-label="${esc(L.t("language"))}">
    <a href="${esc(enHref)}" hreflang="en" lang="en" ${here === "en" ? 'aria-current="true"' : ""}>EN</a>
    <a href="${esc(jaHref)}" hreflang="ja" lang="ja" ${here === "ja" ? 'aria-current="true"' : ""}>日本語</a>
  </span>`;
}

function renderRaceMenu(data, path, now = NOW) {
  const circuitById = indexCircuits(data);
  const races = [...(data.races || [])].sort((a, b) => Number(a.order) - Number(b.order));
  const spot = spotlight(races, now);
  let month = "";
  const parts = [];
  for (const race of races) {
    const iso = (String(race.dates?.weekend || "").match(/20\d{2}-\d{2}-\d{2}/) || [])[0] || "";
    const key = iso.slice(0, 7);
    if (key && key !== month) {
      month = key;
      parts.push(`<p class="menu-kicker">${esc(monthLabel(iso))}</p>`);
    }
    const circuit = circuitById.get(race.circuit_id);
    const name = L.circuit(race.circuit_id, circuitShort(circuit));
    const when = formatWeekend(race.dates?.weekend, L.lang);
    const mark = race.id === spot.id ? `<span class="flag">${esc(L.t(spot.key))}</span>` : "";
    const current = path === `/races/${race.id}` ? ' aria-current="page"' : "";
    const cls = race.id === spot.id ? "menu-race is-spot" : "menu-race";
    parts.push(`<a class="${cls}" href="${esc(L.href(`/races/${race.id}`))}"${current}><span class="ord">${esc(padOrder(race.order))}</span><span class="menu-race-copy"><span class="menu-race-name">${esc(name)} <span class="when">${esc(when)}</span></span><span class="menu-race-sub">${esc(menuSub(race))}</span></span>${mark}</a>`);
  }
  return parts.join("");
}

function spotlight(races, now = NOW) {
  const current = races.find((race) => phase(race, now) === "current");
  if (current) return { id: current.id, key: "now" };
  const upcoming = races.find((race) => phase(race, now) === "future");
  if (upcoming) return { id: upcoming.id, key: "next" };
  return { id: "", key: "now" };
}

function menuSub(race) {
  const round = String(race.round || "").replace(/\s+/g, " ").trim();
  if (round && round.length <= 48 && !/unconfirmed/i.test(round)) return round;
  const series = String(race.series || "").replace(/\s+/g, " ").trim();
  const parts = series.split(":");
  const tail = (parts.length > 1 ? parts.slice(1).join(":") : series).split(",")[0].trim();
  return tail;
}

function monthLabel(iso) {
  const [year, month] = iso.split("-").map(Number);
  if (L.ja) return `${year}年${month}月`;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[month - 1]} ${year}`;
}

function renderLead(view, circuitById, now) {
  const race = view.race;
  if (!race) {
    return `<section class="lead"><div class="wrap"><p class="kicker">${esc(L.t("season_kicker"))}</p><h1>${esc(L.t("no_races"))}</h1></div></section>`;
  }
  const circuit = circuitById.get(race.circuit_id);
  const name = L.circuit(race.circuit_id, circuitShort(circuit));
  const when = formatWeekend(race.dates?.weekend, L.lang);
  if (view.mode === "complete") {
    return `<section class="lead"><div class="wrap lead-grid"><div><p class="kicker">${esc(L.t("season_kicker"))}</p><h1>${phrase(name)}</h1><p class="deck">${rich(race.series || "", L)}</p><p class="session">${esc(L.t("complete"))}</p></div></div></section>`;
  }
  const kicker = view.mode === "underway" ? L.t("now") : L.t("next");
  const live = view.mode === "underway" ? activeSession(race, now) : null;
  const clock = view.mode === "countdown"
    ? renderCountdown(view, now)
    : live
      ? renderLive(live)
      : view.mode === "tbc"
        ? renderTimeTbc()
        : `<p class="session">${esc(view.mode === "underway" ? L.t("clock_passed") : L.t("no_clock"))}</p>`;
  const timetable = race.timetable ? `<section class="feature-tt"><div class="wrap">${renderTimetable(race)}</div></section>` : "";
  return `<section class="lead">
    <div class="wrap lead-grid">
      <p class="kicker">${esc(kicker)}</p>
      <h1>${phrase(name)}</h1>
      <div class="lead-clock">${clock}</div>
      <p class="when-line">${esc(when)}</p>
      <p class="deck">${rich(race.series || "", L)}</p>
      <a class="go" href="${esc(L.href(`/races/${race.id}`))}">${esc(L.t("open"))}</a>
    </div>
  </section>
  ${timetable}`;
}

function renderTimeTbc() {
  return `<p class="session">${esc(L.t("time_tbc"))}</p><p class="deck">${esc(L.t("race_start_tbc"))}</p>`;
}

function renderCountdown(view, now) {
  const next = view.schedule[0];
  const parts = countParts(next.iso, now);
  const label = localLabel(next.label);
  const detail = formatJst(next.iso, L.lang, { dateOnly: next.dateOnly });
  const state = L.t("next_session", label);
  return `<div data-countdown-root data-reached="${esc(L.t("reached"))}" data-live="${esc(L.t("live_now"))}" data-flag="${esc(L.t("flag_unconfirmed"))}">
    ${tzSwitch()}
    <p class="session state-line" data-state>${esc(state)}</p>
    <p class="session" data-session-label>${esc(detail)}${next.unconfirmed ? ` <span class="flag">${esc(L.t("flag_unconfirmed"))}</span>` : ""}</p>
    <div class="count" aria-hidden="true">
      <div><b data-unit="d">${parts.d}</b><span>${esc(L.t("days"))}</span></div>
      <div><b data-unit="h">${parts.h}</b><span>${esc(L.t("hrs"))}</span></div>
      <div><b data-unit="m">${parts.m}</b><span>${esc(L.t("min"))}</span></div>
      <div><b data-unit="s">${parts.s}</b><span>${esc(L.t("sec"))}</span></div>
    </div>
    <p class="zones">
      <span data-clock="jst">${esc(formatJst(next.iso, L.lang, { dateOnly: next.dateOnly }))}</span>
      <span data-sydney data-iso="${esc(next.iso)}"></span>
    </p>
  </div>`;
}

function renderLive(item) {
  const label = localLabel(item.label);
  const open = formatJst(item.iso, L.lang);
  const close = item.end ? formatJst(item.end, L.lang) : "";
  return `<div class="live-now">
    ${tzSwitch()}
    <p class="session">${esc(L.t("live_now"))}</p>
    <p class="deck">${phrase(label)}</p>
    <p class="zones">
      <span data-clock="jst">${esc(close ? `${open} – ${close}` : open)}</span>
      <span data-sydney data-iso="${esc(item.iso)}"${item.end ? ` data-end="${esc(item.end)}"` : ""}></span>
    </p>
  </div>`;
}

function renderNextBar(view, now, { here = false } = {}) {
  if (!view?.race) return "";
  const live = view.mode === "underway" ? activeSession(view.race, now) : null;
  let text = "";
  if (view.mode === "countdown" && view.schedule[0]) text = L.t("next_session", localLabel(view.schedule[0].label));
  else if (live) text = `${L.t("live_now")} · ${localLabel(live.label)}`;
  else if (view.mode === "tbc") text = L.t("time_tbc");
  else return "";
  const href = here ? "#sessions" : L.href(`/races/${view.race.id}`);
  return `<aside class="next-bar"><p>${esc(text)}</p><a href="${esc(href)}">${esc(L.t("bar_open"))}</a></aside>`;
}

function tzSwitch() {
  return `<div class="seg tz-switch" role="group" aria-label="${esc(L.t("tz_label"))}" data-pref="tz" data-default="jst"><button type="button" data-value="jst" aria-pressed="true">${esc(L.t("track_time"))}</button><button type="button" data-value="syd" aria-pressed="false">${esc(L.t("my_time"))}</button></div>`;
}

function calendarLink(race) {
  return `<p class="onward"><a class="cal-link" href="${esc(L.href(`/races/${race.id}.ics`))}">${esc(L.t("add_calendar"))}</a></p>`;
}

function clientSchedule(view) {
  return view.schedule.map((item) => {
    const label = localLabel(item.label);
    return {
      iso: item.iso,
      label,
      next: L.t("next_session", label),
      detail: formatJst(item.iso, L.lang, { dateOnly: item.dateOnly }),
      unconfirmed: item.unconfirmed,
    };
  });
}

function localLabel(label) {
  if (label === "Practice") return L.t("practice");
  if (label === "Qualifying") return L.t("qualifying");
  if (label === "Race") return L.t("race");
  const race = String(label).match(/^Race (\d+)$/);
  if (race) return L.t("race_n", Number(race[1]));
  const qualifying = String(label).match(/^Qualifying (\d+)$/);
  if (qualifying) return L.t("qualifying_n", Number(qualifying[1]));
  return L.tr(label);
}

function renderRaceRow(race, circuitById) {
  const circuit = circuitById.get(race.circuit_id);
  const name = L.circuit(race.circuit_id, circuitShort(circuit));
  const lines = summaryLines(race);
  const flag = rowNeedsFlag(race) ? `<span class="flag">${esc(L.t("flag_unconfirmed"))}</span>` : "";
  const label = race.round && race.round.length < 140 ? race.round : (race.series || race.round || "");
  return `<a class="race-row" href="${esc(L.href(`/races/${race.id}`))}">
    <span class="ord">${esc(padOrder(race.order))}</span>
    <span class="when">${esc(formatWeekend(race.dates?.weekend, L.lang))}</span>
    <span>
      <span class="circuit">${esc(name)}</span>
      <span class="series">${rich(label, L, { links: false })}</span>
    </span>
    <span class="result">
      <span class="status ${phase(race, NOW) === "current" ? "now" : ""}">${esc(statusText(race))}</span>
      ${flag}
      ${lines || `<span class="missing">${esc(phase(race, NOW) === "past" ? L.t("no_result") : phase(race, NOW) === "current" ? L.t("result_not") : L.t("ahead"))}</span>`}
    </span>
  </a>`;
}

function summaryLines(race) {
  const results = race.results || {};
  const bits = [];
  if (results.race1?.position || results.race2?.position) {
    if (results.race1?.position) bits.push(line(L.t("race_n", 1), results.race1.position, results.race1.best_lap));
    if (results.race2?.position) bits.push(line(L.t("race_n", 2), results.race2.position, results.race2.best_lap));
  } else {
    if (results.qualifying?.position) bits.push(line(L.t("qualifying"), results.qualifying.position, results.qualifying.car_best_lap || results.qualifying.best_lap));
    if (results.race?.position) bits.push(line(L.t("race"), results.race.position, results.race.best_lap_ross || results.race.best_lap || results.race.best_lap_kyle));
  }
  if (!bits.length) return "";
  return `<span class="lines">${bits.join("")}</span>`;
}

function line(label, position, lap) {
  const lapHtml = lap ? `<span class="lap">${rich(lap, L, { links: false })}</span>` : "";
  return `<span class="line"><span class="lbl">${esc(label)}</span> ${rich(position, L, { links: false })}${lapHtml}</span>`;
}

function rowNeedsFlag(race) {
  if (phase(race, NOW) === "past") return false;
  return hasUnconfirmed(race.status) || hasUnconfirmed(race.class) || hasUnconfirmed(race.car_number) || hasUnconfirmed(race.team) || hasUnconfirmed(race.drivers) || hasUnconfirmed(race.round) || hasUnconfirmed(race.series) || hasUnconfirmed(race.dates) || hasUnconfirmed(race.format);
}

function statusText(race) {
  const state = phase(race, NOW);
  if (state === "current") return L.t("in_progress");
  if (state === "past") return L.t("completed");
  if (state === "future") return L.t("upcoming");
  return L.tr(race.status || L.t("upcoming"));
}

function renderCar(data) {
  const car = data.car || {};
  const names = (car.car_name_on_entries || []).map((name) => `<li>${rich(name, L)}</li>`).join("");
  const kyle = (data.races || [])
    .filter((race) => (race.drivers || []).some((driver) => /Kyle Wynne/i.test(driver)) && !String(race.id).startsWith("kyle-"))
    .map((race) => L.tr(race.round || race.series));
  return `<div class="dossier">
    <div>
      <p class="prose">${esc(L.tr(car.make_model || ""))}. ${esc(L.tr(car.engine || ""))}.</p>
      <p class="prose">${esc(L.tr(car.tyres_2026 || ""))}.</p>
      ${kyle.length ? `<p class="prose">${L.t("car_blurb_kyle", kyle.map((item) => esc(item)).join("; "))}</p>` : ""}
    </div>
    <dl class="spec">
      ${fact(L.t("number"), car.number)}
      ${fact(L.t("min_weight"), car.min_race_weight_kg ? `${car.min_race_weight_kg} kg` : "")}
      ${fact(L.t("entrant"), car.entrant_team)}
      ${fact(L.t("prepared"), car.mechanics)}
    </dl>
  </div>
  ${names ? `<h3>${esc(L.t("names_on_sheets"))}</h3><ul class="names">${names}</ul>` : ""}`;
}

function renderSeries(data) {
  const series = data.series || [];
  if (!series.length) return "";
  const cards = series.map((item) => {
    const bits = [
      item.what_champions_cup_means,
      item.ross_class ? `${L.t("ross_class")}: ${item.ross_class}` : "",
      item.format,
      item.format_rd4 ? `${L.t("round_format")}: ${item.format_rd4}` : "",
      item.organiser ? `${L.t("organiser")}: ${item.organiser}` : "",
    ].filter(Boolean);
    return `<article><h3>${rich(item.name || "", L)}</h3>${bits.map((bit) => `<p>${rich(bit, L)}</p>`).join("")}</article>`;
  }).join("");
  return `<section class="block"><p class="section-kicker">${esc(L.t("championships_kicker"))}</p><h2 class="section-title">${esc(L.t("championships"))}</h2><div class="cols">${cards}</div></section>`;
}

function renderCircuitIndex(circuits, compact) {
  const items = (circuits || []).map((circuit) => {
    const length = typeof circuit.length_m === "number"
      ? `${circuit.length_m.toLocaleString(L.ja ? "ja-JP" : "en-AU")} m`
      : "";
    return `<a class="circuit-link" href="${esc(L.href(`/circuits/${circuit.id}`))}">
      <span>
        <span class="circuit">${esc(L.circuit(circuit.id, circuitShort(circuit)))}</span>
        ${compact ? "" : `<span class="series">${esc(L.tr(circuit.official_name || ""))}</span>`}
      </span>
      <span class="when">${esc(length)}</span>
    </a>`;
  }).join("");
  return `<div class="circuit-index">${items}</div>`;
}

function renderTimetable(race, { heading = true } = {}) {
  const table = race.timetable || {};
  const sources = table.sources || {};
  const days = (table.days || []).map((day) => {
    const items = (day.items || []).map((item) => {
      const start = clockIso(day.date, item.start);
      const end = item.end ? clockIso(day.date, item.end) : "";
      const badges = (item.who || []).map((who) => {
        const key = who === "kyle" ? "badge_kyle" : "badge_ross";
        return `<span class="who">${esc(L.t(key))}</span>`;
      }).join("");
      const source = sources[item.source];
      const sourceHtml = source?.url
        ? `<a class="tt-source" href="${esc(source.url)}">${esc(L.tr(source.label || item.source))}</a>`
        : "";
      const flag = item.unconfirmed ? `<span class="flag">${esc(L.t("flag_unconfirmed"))}</span>` : "";
      return `<li class="tt-item">
        <span class="tt-clocks">
          <span class="tt-jst">${esc(jstClock(item.start, item.end))}</span>
          <span class="tt-syd" data-sydney data-iso="${esc(start)}"${end ? ` data-end="${esc(end)}"` : ""}></span>
        </span>
        <span class="tt-what">${esc(L.tr(item.label || ""))}</span>
        <span class="tt-meta">${badges}${flag}${sourceHtml}</span>
      </li>`;
    }).join("");
    return `<section class="tt-day">
      <h3>${esc(formatJst(`${day.date}T12:00:00+09:00`, L.lang, { dateOnly: true }))}</h3>
      <ol class="tt-list">${items}</ol>
    </section>`;
  }).join("");
  const gaps = (table.gaps || []).map((gap) => `<li>${rich(gap, L)}</li>`).join("");
  return `<div class="timetable">
    <div class="tt-tools">${heading ? `<h2 class="section-title">${phrase(L.t("timetable"))}</h2>` : ""}${tzSwitch()}</div>
    ${days}
    ${gaps ? `<ul class="tt-gaps">${gaps}</ul>` : ""}
    ${calendarLink(race)}
  </div>`;
}

function jstClock(start, end) {
  const open = String(start || "");
  if (!end) return `${open} JST`;
  return `${open}–${end} JST`;
}

function renderSessions(race) {
  const dates = race.dates || {};
  const keys = Object.keys(dates).filter((key) => key !== "calendar_block");
  if (!keys.length) return `<p class="missing">${esc(L.t("no_sessions"))}</p>`;
  const rows = keys.map((key) => {
    const value = dates[key];
    let html;
    if (key === "weekend") {
      const extra = weekendExtra(value);
      html = `${esc(formatWeekend(value, L.lang))}${extra ? ` ${rich(extra, L)}` : ""}`;
    } else {
      html = renderValue(value);
    }
    return `<div><dt>${esc(L.field(key))}</dt><dd>${html}</dd></div>`;
  }).join("");
  return `<dl class="kv">${rows}</dl>`;
}

function renderResults(results) {
  if (isEmpty(results)) return `<p class="missing">${esc(L.t("no_result"))}</p>`;
  if (typeof results === "string") return `<p>${rich(results, L)}</p>`;
  return renderValue(results);
}

function renderValue(value) {
  if (isEmpty(value)) return `<span class="missing">${esc(L.t("not_published"))}</span>`;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return rich(value, L);
  }
  if (Array.isArray(value)) {
    return `<ul class="plain">${value.map((item) => `<li>${renderValue(item)}</li>`).join("")}</ul>`;
  }
  const rows = Object.entries(value).map(([key, child]) => {
    const big = key === "position" ? "is-position" : "";
    return `<div><dt>${esc(L.field(key))}</dt><dd class="${big}">${renderValue(child)}</dd></div>`;
  }).join("");
  return `<dl class="kv">${rows}</dl>`;
}

function renderLaps(results) {
  const laps = collectLaps(results);
  if (!laps.length) return "";
  const items = laps.map((item) => `<li><span class="who">${esc(lapWho(item))}</span><span class="time">${rich(item.value, L)}</span></li>`).join("");
  return `<section class="block"><h2>${esc(L.t("best_laps"))}</h2><ul class="laps">${items}</ul></section>`;
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
  let who = L.t("best");
  if (/kyle/i.test(item.key)) who = "Kyle Wynne";
  else if (/ross/i.test(item.key)) who = "Ross Ogilvie";
  else if (/car_best/.test(item.key)) who = L.t("car");
  const session = item.trail.map((key) => L.field(key)).join(" · ");
  return session ? `${who} · ${session}` : who;
}

function renderNotes(notes, id = "") {
  if (!notes?.length) return "";
  const items = notes.map((note) => `<li>${rich(note, L)}</li>`).join("");
  const anchor = id ? ` id="${esc(id)}"` : "";
  return `<section class="block"${anchor}><h2>${esc(L.t("notes"))}</h2><ol class="notes">${items}</ol></section>`;
}

function jumpNav(items) {
  const links = items.filter(Boolean);
  if (links.length < 2) return "";
  return `<div class="jump-stick"><nav class="jump" aria-label="${esc(L.t("jump"))}">${links.map(([id, label]) => `<a href="#${esc(id)}">${esc(label)}</a>`).join("")}</nav><span class="jump-hint" aria-hidden="true">→</span></div>`;
}

const IMAGE_SIZE = {
  fuji: [1380, 470],
  motegi: [1000, 720],
  okayama: [470, 490],
  sugo: [700, 400],
  suzuka: [1273, 983],
};

function renderSources(sources) {
  if (!sources?.length) return "";
  const items = sources.map((source) => {
    const parsed = parseSource(source);
    if (!parsed) return "";
    return `<li><a href="${esc(parsed.url)}">${esc(L.tr(parsed.label))}</a></li>`;
  }).join("");
  if (!items.trim()) return "";
  return `<section class="block sources"><h2>${esc(L.t("sources"))}</h2><ul>${items}</ul></section>`;
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
  if (isEmpty(value)) inner = `<span class="missing">${esc(L.t("not_published"))}</span>`;
  else if (typeof value === "string" || typeof value === "number") inner = rich(value, L);
  else if (Array.isArray(value)) inner = value.map((item) => rich(item, L)).join("<br>");
  else if (value && typeof value === "object" && (value.time || value.driver)) {
    const unverified = /not verified/i.test(value.source || "") && !/unconfirmed/i.test(value.source || "");
    inner = `<span class="record">${esc(value.time || "")}</span> ${esc([value.driver, value.car, value.year].filter(Boolean).join(" · "))}${value.source ? `<span class="source-line">${rich(value.source, L)}</span>` : ""}${unverified ? ` <span class="flag">${esc(L.t("flag_unverified"))}</span>` : ""}`;
  } else inner = renderValue(value);
  return `<div><dt>${esc(label)}</dt><dd>${inner}</dd></div>`;
}

function lengthFact(circuit) {
  if (typeof circuit.length_m === "number") return `${circuit.length_m.toLocaleString(L.ja ? "ja-JP" : "en-AU")} m`;
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
  if (credit.commons) bits.push(`<a href="${esc(credit.commons)}">${esc(L.t("track_map"))}</a>`);
  else bits.push(esc(L.t("track_map")));
  if (credit.author) bits.push(`${esc(L.t("by"))} ${esc(credit.author)}`);
  const license = L.tr(credit.license || "");
  if (credit.license && credit.licenseUrl) bits.push(`<a href="${esc(credit.licenseUrl)}">${esc(license)}</a>`);
  else if (credit.license) bits.push(esc(license));
  let text = bits.join(", ");
  if (/BY-SA/i.test(credit.license)) text += ` ${esc(L.t("adaptations"))}`;
  if (credit.note) {
    const note = credit.note.charAt(0).toUpperCase() + credit.note.slice(1);
    text += ` ${rich(note, L)}`;
  }
  return `<figcaption class="credit">${text}</figcaption>`;
}

function renderFooter(data) {
  const credits = [];
  for (const circuit of data.circuits || []) {
    for (const image of circuit.images || []) {
      const credit = imageCredit(circuit, image, data.licenses);
      if (!credit) continue;
      credits.push(`<li><strong>${esc(L.circuit(circuit.id, circuit.id))}</strong> — ${creditHtml(credit).replace(/^<figcaption class="credit">|<\/figcaption>$/g, "")}</li>`);
    }
  }
  return `<footer class="colophon">
    <div class="wrap">
      <p class="belief">${esc(L.t("belief"))}</p>
      <p class="kanji-note"><span class="jp" lang="ja">新興</span> ${esc(L.t("kanji_note"))}</p>
      <p>${esc(data.driver || "Ross Ogilvie")} · ${esc(L.t("car"))} ${esc(data.car?.number || "")} · ${esc(L.tr(data.car?.make_model || ""))} · ${esc(L.tr(data.car?.entrant_team || ""))}</p>
      <p>${rich(data.timezone_note || "Times are in JST (UTC+9).", L)}</p>
      <h2>${esc(L.t("map_credits"))}</h2>
      <ul class="credits">${credits.join("")}</ul>
      <p class="generated">${esc(L.t("generated"))} ${esc(data.generated || "")}. ${esc(L.t("edit_note"))}</p>
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
