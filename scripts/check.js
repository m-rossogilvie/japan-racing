import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";
import { scrubSeason } from "../lib/prepare.js";
import { extractInstants, hero, phase, SESSION_BUFFER_MS } from "../lib/time.js";
import { createServer } from "../server.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const season = JSON.parse(fs.readFileSync(path.join(root, "data", "season.json"), "utf8"));
const css = fs.readFileSync(path.join(root, "public/css/site.css"), "utf8");

const leaks = /fairfield|marriott|dormy|mitsui|peninsula|yunomori|yunogo|mashikokan|accommodation|check_in|\bJL51\b|RO_ICV_|ticket #51293|\/home\/|agent-data|gmail|google calendar|z05jUIPxHPY/i;
assert.equal(leaks.test(JSON.stringify(season)), false, "season.json contains private data");
assert.equal(season.races.length, 11);
assert.equal(season.races.some((race) => /not a race/i.test(race.status || "")), false);

const now = Date.parse("2026-10-02T20:47:00+09:00");
const view = hero(season.races, now);
assert.equal(view.mode, "countdown");
assert.equal(view.race.id, "2026-scr4-suzuka-vgranz");
assert.equal(view.schedule[0].iso, "2026-10-04T13:25:00+09:00");
assert.equal(view.schedule[0].label, "Race");
assert.equal(view.schedule[0].unconfirmed, false);

const scr4 = season.races.find((race) => race.id === "2026-scr4-suzuka-vgranz");
const duringRace = Date.parse("2026-10-04T14:00:00+09:00");
const beforeBuffer = Date.parse("2026-10-04T13:25:00+09:00") + SESSION_BUFFER_MS - 1000;
const afterBuffer = Date.parse("2026-10-04T13:25:00+09:00") + SESSION_BUFFER_MS;
assert.equal(phase(scr4, duringRace), "current");
assert.equal(hero(season.races, duringRace).mode, "underway");
assert.equal(hero(season.races, duringRace).race.id, "2026-scr4-suzuka-vgranz");
assert.equal(phase(scr4, beforeBuffer), "current");
assert.equal(phase(scr4, afterBuffer), "past");
const rolled = hero(season.races, afterBuffer);
assert.equal(rolled.mode, "tbc");
assert.equal(rolled.race.id, "2026-mec120-rd3-okayama");
assert.equal(rolled.schedule.length, 0);
const tuesday = hero(season.races, Date.parse("2026-10-06T09:00:00+09:00"));
assert.equal(tuesday.race.id, "2026-mec120-rd3-okayama");
assert.equal(tuesday.mode, "tbc");
const okayamaRace = season.races.find((race) => race.id === "2026-mec120-rd3-okayama");
assert.equal(phase(okayamaRace, Date.parse("2026-10-09T05:00:00+09:00")), "future");
assert.equal(phase(okayamaRace, Date.parse("2026-10-09T07:00:00+09:00")), "current");
assert.equal(phase(okayamaRace, Date.parse("2026-10-11T18:00:00+09:00")), "current");
assert.equal(phase(okayamaRace, Date.parse("2026-10-11T19:00:00+09:00")), "past");

const raceText = "Sun 2026-10-04: 13:10 start procedure, about 13:25 JST race start (14:25 AEST), read from a timetable photo, so unconfirmed";
const raceInstants = extractInstants(raceText, { raceStart: true });
assert.equal(raceInstants.length, 1);
assert.equal(raceInstants[0].iso, "2026-10-04T13:25:00+09:00");

const qText = "Sat 2026-10-03 13:10-13:30 JST (14:10 AEST), provisional timetable";
const qInstants = extractInstants(qText);
assert.deepEqual(qInstants.map((item) => item.iso), ["2026-10-03T13:10:00+09:00"]);

const poisoned = structuredClone(season);
poisoned.races[0].accommodation = [{ hotel: "Fairfield by Marriott Tochigi Motegi" }];
poisoned.races[0].travel = "JL51 HND-SYD";
poisoned.races[0].notes.push("Stay at the Peninsula.");
const cleaned = scrubSeason(poisoned);
assert.equal(JSON.stringify(cleaned).includes("Fairfield"), false);
assert.equal(JSON.stringify(cleaned).includes("Peninsula"), false);
assert.equal(JSON.stringify(cleaned).includes("JL51"), false);

const hexes = css.match(/#[0-9a-fA-F]{3,8}/g) || [];
const allowed = new Set(["#030000", "#3d3c3c", "#f9f7f7", "#fe0043"]);
for (const hex of hexes) {
  assert.ok(allowed.has(hex.toLowerCase()), `unexpected colour ${hex}`);
}
assert.equal(/rgb\(|hsl\(|oklch\(/i.test(css), false);
assert.match(css, /Figtree/);
assert.match(css, /Noto Serif JP/);
assert.match(css, /Noto Sans JP/);

const server = createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

async function get(pathname) {
  const response = await fetch(base + pathname);
  const text = await response.text();
  return { status: response.status, type: response.headers.get("content-type"), text };
}

const home = await get("/");
assert.equal(home.status, 200);
assert.match(home.text, /Shinkō1/);
assert.match(home.text, /class="menu-btn"/);
assert.match(home.text, /id="race-list"/);
assert.match(home.text, /id="site-menu"/);
assert.match(home.text, /新興/);
assert.match(home.text, /P18 of 23 starters/);
assert.match(home.text, /class="kicker">Next/);
assert.match(home.text, /Okayama/);
assert.match(home.text, /Time TBC/);
assert.match(home.text, /10:10–11:10 JST/);
assert.match(home.text, /class="who">Ross/);
assert.match(home.text, /1790602013\.pdf/);
assert.match(home.text, /1790602277\.pdf/);
assert.match(home.text, /1790602193\.pdf/);
assert.match(home.text, /data-sydney/);
assert.doesNotMatch(home.text, /Timetable not found/);
assert.doesNotMatch(home.text, /AEST \(UTC\+10\)/);
assert.match(home.text, /class="menu-race is-spot" href="\/races\/2026-mec120-rd3-okayama"/);
assert.match(home.text, /class="flag">Next/);
assert.doesNotMatch(home.text, /Session clock has passed\./);
assert.doesNotMatch(home.text, /class="kicker">Now/);
const suzukaRow = (home.text.match(/<a class="race-row"[\s\S]*?<\/a>/g) || []).find((row) => row.includes("2026-scr4-suzuka-vgranz"));
assert.ok(suzukaRow, "Suzuka row missing");
assert.match(suzukaRow, />Completed</);
assert.doesNotMatch(suzukaRow, /In progress/);
assert.doesNotMatch(suzukaRow, /class="flag">Unconfirmed/);
assert.match(home.text, /P16 of 21 classified, from grid P18/);
assert.match(home.text, /2'19\.693/);
assert.doesNotMatch(home.text, /34'01\.255/);
assert.doesNotMatch(home.text, /class="flag">Unofficial/);
assert.match(home.text, /12th \(last of 12 classified/);
assert.match(home.text, /9th of 14 classified/);
assert.match(home.text, /Not classified/);
assert.match(home.text, /Kyle Wynne/);
assert.match(home.text, /2'09\.643/);
assert.match(home.text, /Circuit Orange/);
assert.match(home.text, /Ronny Astrada/);
assert.match(home.text, /Will Pittenger/);
assert.match(home.text, /Chris Ssk/);
assert.match(home.text, /Public domain/);
assert.match(home.text, /creativecommons\.org\/licenses\/by-sa\/3\.0/);
assert.equal(leaks.test(home.text), false, "homepage leaked private data");
const raceIds = [...home.text.matchAll(/href="\/races\/([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(raceIds).size, 11);
const rows = home.text.match(/<a class="race-row"[\s\S]*?<\/a>/g) || [];
assert.ok(rows.length >= 11);
for (const row of rows) assert.equal((row.match(/<a /g) || []).length, 1, "nested link in a calendar row");

const pages = [
  "/races/2026-motegi-ccr3-vgranz",
  "/races/2026-mec120-rd1-suzuka",
  "/races/2026-mec120-rd2-motegi",
  "/races/2026-scr4-suzuka-vgranz",
  "/races/2026-mec120-rd3-okayama",
  "/races/2026-sugo-ccr7-vgranz",
  "/races/2026-scr-final-suzuka",
  "/races/2026-mec120-rd4-fuji",
  "/circuits",
  "/circuits/motegi",
  "/circuits/suzuka",
  "/circuits/okayama",
  "/circuits/sugo",
  "/circuits/fuji",
  "/health",
  "/css/site.css",
  "/images/suzuka_track_map.svg",
  "/images/okayama_track_map.png",
];

for (const pathname of pages) {
  const response = await get(pathname);
  assert.equal(response.status, 200, pathname);
  assert.equal(leaks.test(response.text), false, pathname);
}

const motegi = await get("/races/2026-motegi-ccr3-vgranz");
assert.match(motegi.text, /class="flag">Unconfirmed/);
assert.match(motegi.text, /2'20\.180/);
assert.match(motegi.text, /Best laps/);

const suzuka = await get("/races/2026-mec120-rd1-suzuka");
assert.match(suzuka.text, /2'24\.934/);
assert.match(suzuka.text, /2'18\.197/);
assert.match(suzuka.text, /Kyle Wynne/);
assert.match(suzuka.text, /2'17\.082/);
assert.match(suzuka.text, /href="\/kyle-wynne"/);
assert.doesNotMatch(suzuka.text, /does not say which driver/);

const rd2 = await get("/races/2026-mec120-rd2-motegi");
assert.match(rd2.text, /Not classified/);
assert.match(rd2.text, /2'03\.991/);
assert.match(rd2.text, /2'06\.495/);
assert.match(rd2.text, /2'05\.867/);
assert.match(rd2.text, /did not take the flag \(unconfirmed\)/);
assert.doesNotMatch(rd2.text, /reason not stated/);
assert.match(rd2.text, /Penalties and stewards/);

const live = await get("/races/2026-scr4-suzuka-vgranz");
assert.match(live.text, /class="flag">Unconfirmed/);
assert.match(live.text, /13:25/);
assert.match(live.text, /15:25 AEDT/);
assert.doesNotMatch(live.text, /14:25 AEST/);
assert.match(live.text, /2'18\.414/);
assert.match(live.text, /P18 of 23 starters/);
assert.match(live.text, /shinko1 with COR/);
assert.match(live.text, /provisional/i);
assert.match(live.text, /Hana Burton/);
assert.match(live.text, /Kyle Wynne/);
assert.doesNotMatch(live.text, /Not published/);
assert.doesNotMatch(live.text, /about 13:25/);
assert.match(live.text, /class="status ">Completed/);
assert.doesNotMatch(live.text, /In progress/);
assert.doesNotMatch(live.text, /This weekend is underway/);
assert.match(live.text, /29'59\.572/);
assert.match(live.text, /2'19\.693/);
assert.match(live.text, /2'14\.385/);
assert.match(live.text, /29'33\.374/);
assert.match(live.text, /191166/);
assert.match(live.text, /191160/);
assert.match(live.text, /v\.Granz race \(official\)/);
assert.match(live.text, /児島 弘訓/);
assert.match(live.text, /Starters 22/);
assert.match(live.text, /Finishers 21/);
assert.match(live.text, /false start/);
assert.match(live.text, /Drive-through/);
assert.match(live.text, />NC</);
assert.match(live.text, /id="scr4-vgranz-race-213"/);
assert.doesNotMatch(live.text, /34'01\.255/);
assert.doesNotMatch(live.text, /2'19\.692/);
assert.doesNotMatch(live.text, /33'35\.057/);
assert.match(live.text, /20'22\.926/);
assert.match(live.text, /2'29\.049/);
assert.match(live.text, /20'26\.513/);
assert.match(live.text, /191185/);
assert.match(live.text, /191183/);
assert.match(live.text, /191011/);
assert.match(live.text, /id="scr4-vita-race-213"/);
assert.match(live.text, /start procedure/);
assert.match(live.text, /Finishers 33/);
assert.doesNotMatch(live.text, /class="flag">Unofficial/);
assert.doesNotMatch(live.text, /Speedhive/);
assert.doesNotMatch(live.text, /20'22\.927/);
assert.doesNotMatch(live.text, /20'21\.514/);
assert.doesNotMatch(live.text, /awaiting official sheet/);
assert.doesNotMatch(live.text, /VITA qualifying \(PROVISIONAL\)/);
assert.doesNotMatch(live.text, /VITA race \(UNOFFICIAL\)/);
assert.match(live.text, /yellow flags/);
assert.match(live.text, /191172/);
assert.match(live.text, /Rd\.6 race \(official\)/);
assert.doesNotMatch(live.text, /v\.Granz race \(PROVISIONAL\)/);
assert.doesNotMatch(live.text, /Rd\.6 race \(PROVISIONAL\)/);
assert.doesNotMatch(live.text, /P17 of 23/);
assert.match(live.text, /row-primary/);
assert.match(live.text, /徳升 広平/);
assert.match(live.text, /2'26\.364/);
assert.match(live.text, /24'01\.616/);
assert.match(live.text, /2'28\.347/);
assert.match(live.text, /191150/);
assert.match(live.text, /Full classification to come/);
assert.match(live.text, /Black-and-white flag/);
assert.match(live.text, /class="flag">Provisional/);
assert.match(live.text, /190992/);
assert.match(live.text, /金澤 力也/);
assert.match(live.text, /romanised, unconfirmed/);
assert.match(live.text, /class="jump"/);
assert.match(live.text, /class="allcols"/);
assert.match(live.text, /class="row-jump"/);
assert.match(live.text, /All columns/);

const okayama = await get("/races/2026-mec120-rd3-okayama");
assert.match(okayama.text, /class="flag">Unconfirmed/);
assert.match(okayama.text, /co-driver unconfirmed/i);
assert.match(okayama.text, /Not published/);
assert.match(okayama.text, /Time TBC/);
assert.match(okayama.text, /06:00–23:00 JST/);
assert.match(okayama.text, /14:25 JST/);
assert.match(okayama.text, /omitted rather than guessed/);
assert.doesNotMatch(okayama.text, /Timetable not found/);

const sugo = await get("/circuits/sugo");
assert.match(sugo.text, /Chris Ssk/);
assert.match(sugo.text, /CC BY-SA 3.0/);
assert.match(sugo.text, /class="flag">Unconfirmed/);
assert.match(sugo.text, /3,586\.57 m/);

const okaCircuit = await get("/circuits/okayama");
assert.match(okaCircuit.text, /Public domain/);
assert.match(okaCircuit.text, /commons\.wikimedia\.org/);

const fuji = await get("/circuits/fuji");
assert.match(fuji.text, /Will Pittenger/);
assert.match(fuji.text, /English Wikipedia infobox/);

const suzukaCircuit = await get("/circuits/suzuka");
assert.match(suzukaCircuit.text, /width="1273"/);
assert.match(suzukaCircuit.text, /height="983"/);
assert.match(suzukaCircuit.text, /Suzuka circuit map/);

const motegiCircuit = await get("/circuits/motegi");
assert.match(motegiCircuit.text, /Ronny Astrada/);
assert.match(motegiCircuit.text, /class="flag">Not verified/);

const kyle = await get("/kyle-wynne");
assert.equal(kyle.status, 200);
assert.match(kyle.text, /FCR-VITA/);
assert.match(kyle.text, /2'26\.019/);
assert.match(kyle.text, /href="\/races\/2026-mec120-rd1-suzuka"/);
assert.match(kyle.text, /row-primary/);
assert.match(kyle.text, /20'22\.926/);
assert.doesNotMatch(kyle.text, /class="flag">Unofficial/);
assert.doesNotMatch(kyle.text, /20'22\.927/);
assert.match(kyle.text, /href="\/races\/2026-scr4-suzuka-vgranz#scr4-vita-race"/);
assert.equal(leaks.test(kyle.text), false);

const fujiKyle = await get("/races/kyle-2026-fcr-vita-rd1-fuji");
assert.equal(fujiKyle.status, 200);
assert.match(fujiKyle.text, /1'59\.336/);
assert.match(fujiKyle.text, /row-primary/);

const scr2 = await get("/races/kyle-2026-scr2-suzuka-vita");
assert.equal(scr2.status, 200);
assert.match(scr2.text, /2'26\.019/);
assert.doesNotMatch(scr2.text, /20'22\.926/);

const jaHome = await get("/ja");
assert.equal(jaHome.status, 200);
assert.match(jaHome.text, /<html lang="ja">/);
assert.match(jaHome.text, /hreflang="en"/);
assert.match(jaHome.text, /シーズン/);
assert.match(jaHome.text, /鈴鹿/);
assert.match(jaHome.text, /岡山/);
assert.match(jaHome.text, /class="kicker">次/);
assert.match(jaHome.text, /class="flag">次/);
assert.match(jaHome.text, /時刻未定/);
assert.match(jaHome.text, /パドックゲート/);
assert.match(jaHome.text, /MEC特別スポーツ走行 ②/);
assert.match(jaHome.text, /フォーメーションラップ/);
assert.doesNotMatch(jaHome.text, /進行中/);

const jaLive = await get("/ja/races/2026-scr4-suzuka-vgranz");
assert.equal(jaLive.status, 200);
assert.match(jaLive.text, /<html lang="ja">/);
assert.match(jaLive.text, /class="status ">終了/);
assert.doesNotMatch(jaLive.text, /進行中/);
assert.match(jaLive.text, /金澤 力也/);
assert.match(jaLive.text, /暫定/);
assert.match(jaLive.text, /29'59\.572/);
assert.match(jaLive.text, /児島 弘訓/);
assert.match(jaLive.text, /反則スタート/);
assert.match(jaLive.text, /ドライブスルー/);
assert.match(jaLive.text, /正式/);
assert.match(jaLive.text, /20'22\.926/);
assert.match(jaLive.text, /スタート手順/);
assert.doesNotMatch(jaLive.text, /非公式/);
assert.doesNotMatch(jaLive.text, /20'22\.927/);
assert.match(jaLive.text, /黄旗中の追越し/);
assert.doesNotMatch(jaLive.text, /34'01\.255/);
assert.match(jaLive.text, /公式結果/);
assert.match(jaLive.text, /ペナルティと審査委員会の決定/);
assert.match(jaLive.text, /全項目/);
assert.match(jaLive.text, /class="jump"/);

const jaKyle = await get("/ja/kyle-wynne");
assert.equal(jaKyle.status, 200);
assert.match(jaKyle.text, /<html lang="ja">/);
assert.match(jaKyle.text, /Kyle Wynne/);
assert.match(jaKyle.text, /VITAのレース/);

const missing = await get("/races/nope");
assert.equal(missing.status, 404);

const { webkit, devices } = playwright;
const phone = devices["iPhone 14"];
assert.equal(phone.isMobile, true);
assert.equal(phone.hasTouch, true);
assert.equal(phone.deviceScaleFactor, 3);
assert.equal(phone.viewport.width, 390);

function measureFit() {
  const inner = window.innerWidth;
  const scroll = document.documentElement.scrollWidth;
  const sticky = [];
  const loose = [];
  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) continue;
    const right = rect.right + window.scrollX;
    const left = rect.left + window.scrollX;
    if (style.position === "sticky" && (el.scrollWidth > inner + 1 || rect.width > inner + 1)) {
      sticky.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} sw=${el.scrollWidth} w=${Math.round(rect.width)}`);
    }
    if (right <= inner + 1 && left >= -1) continue;
    let contained = false;
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const ox = getComputedStyle(node).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") {
        const box = node.getBoundingClientRect();
        const boxRight = box.right + window.scrollX;
        const boxLeft = box.left + window.scrollX;
        if (boxRight <= inner + 1 && boxLeft >= -1) contained = true;
        break;
      }
    }
    if (!contained && loose.length < 6) {
      loose.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} L${Math.round(left)} R${Math.round(right)}`);
    }
  }
  return { inner, scroll, sticky, loose };
}

const enPaths = [
  "/",
  "/circuits",
  "/kyle-wynne",
  ...season.races.map((race) => `/races/${race.id}`),
  ...season.circuits.map((circuit) => `/circuits/${circuit.id}`),
];
const urls = enPaths.flatMap((pathname) => (pathname === "/" ? [pathname, "/ja"] : [pathname, `/ja${pathname}`]));
const browser = await webkit.launch();
const page = await (await browser.newContext({ ...phone })).newPage();
const overflows = [];
for (const url of urls) {
  await page.goto(base + url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const shots = [];
  shots.push(["top", await page.evaluate(measureFit)]);
  await page.evaluate(() => window.scrollTo(0, Math.min(900, document.documentElement.scrollHeight)));
  shots.push(["scrolled", await page.evaluate(measureFit)]);
  await page.evaluate(() => {
    const menu = document.querySelector("#site-menu");
    if (menu) menu.open = true;
  });
  shots.push(["menu", await page.evaluate(measureFit)]);
  await page.evaluate(() => {
    const menu = document.querySelector("#site-menu");
    if (menu) menu.open = false;
    for (const box of document.querySelectorAll(".allcols input")) box.checked = true;
  });
  if (await page.locator(".allcols input").count()) {
    shots.push(["all-columns", await page.evaluate(measureFit)]);
  }
  if (url === "/" || url === "/ja") {
    const sydney = await page.locator(".timetable [data-sydney]").first().innerText();
    assert.match(sydney, /AEDT/, `${url} Sydney clock`);
    assert.doesNotMatch(sydney, /AEST/, `${url} should be on daylight time`);
  }
  for (const [state, snap] of shots) {
    if (snap.inner !== 390 || snap.scroll > snap.inner || snap.sticky.length || snap.loose.length) {
      overflows.push(`${url} ${state} inner=${snap.inner} scroll=${snap.scroll} sticky=${snap.sticky.join("; ") || "-"} loose=${snap.loose.join("; ") || "-"}`);
    }
  }
}
await browser.close();
assert.deepEqual(overflows, [], `iPhone 14 WebKit page overflow:\n${overflows.join("\n")}`);

server.close();
console.log("check ok");
