# Shinkō1 · Ross Ogilvie, Japan 2026

The season sheet for Ross Ogilvie's 2026 Japan motor-racing year. Car **213**, West Racing v.Granz, entered by Circuit Orange Racing. Sprint rounds in the v.Granz Champion Cup meetings, and MEC120 endurance races with Kyle Wynne where he is named.

The site is a small Node server. It reads one file, `data/season.json`, and renders the season, each weekend, and the circuit guide. No build step.

## Run

```bash
npm start
```

The process listens on `0.0.0.0` and `$PORT` (8080 if `PORT` is unset). Open [http://localhost:8080](http://localhost:8080).

```bash
npm run check
```

## Railway

Railway can deploy this repo with no dashboard setup.

- The repo contains a `Dockerfile`. Railway's Railpack / Docker builder uses it.
- `railway.toml` points at that Dockerfile, sets the start command to `node server.js`, and health-checks `GET /health`.
- The server binds to `process.env.PORT`. Railway injects `PORT`; do not hard-code a port in the service settings.
- There are no environment variables to set. The image has no dependencies to install.

If a service is created without the Dockerfile (Nixpacks on `package.json` alone), the start command is still `npm start`, which runs `node server.js`.

## Update the sheet

Edit `data/season.json` and redeploy (or restart locally). The server re-reads the file when it changes. Templates do not need to change when a result, session or note is added.

Shape that matters:

- `races[]` — one object per weekend. `id` is the URL (`/races/<id>`). `circuit_id` must match a `circuits[]` entry. `order` is the calendar order. `status` should start with `completed`, `in progress`, or `upcoming`.
- `dates` — `weekend`, `practice`, `qualifying`, `race`. Use real clock times as `YYYY-MM-DD HH:MM` in JST when they are known. The homepage countdown reads those times. Put JST first. AEST in brackets is ignored for the clock.
- `results` — any object. The race page prints every field. Use `position`, `best_lap`, `best_lap_ross`, `best_lap_kyle`, `car_best_lap` and the page will also lift those into Best laps.
- `circuits[]` — facts and `images[]`. Map files live in `public/images/`. CC BY-SA credits are printed from `images[]` plus `data/LICENSES.json`.
- `series[]`, `car`, `licence` — shown on the season page.

Anything uncertain must contain the word **unconfirmed**. The site turns that word into a visible flag and will not treat the line as settled fact. Do not invent a result, a time or a circuit fact to fill a gap. Leave the field empty; the page says "Not published".

### Leave this out

The repo and the site are public. Do not put hotels, bookings, flights or other travel logistics in `season.json`. The server drops `accommodation`, `travel` and notes that name hotels, and it refuses to boot if a private marker still gets through. A practice-only entry whose `status` contains "not a race" is not listed.

## Brand

Shinkō1, 2026 toolkit: Figtree Light, Medium and Bold; `#030000`, `#3D3C3C`, `#F9F7F7`, `#FE0043`. The kanji 新興 is set in a two-glyph Noto Serif JP subset because Figtree has no CJK. Both faces are SIL Open Font License; see `public/fonts/`.

## Maps

Track maps are from Wikimedia Commons. Credits (author, licence, link) are under each map and in the footer.

- Motegi, Suzuka, SUGO, Fuji: CC BY-SA 3.0. Adaptations stay under the same licence.
- Okayama: public domain.
