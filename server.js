import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { loadSeason } from "./lib/prepare.js";
import {
  findCircuit,
  findRace,
  renderCircuit,
  renderCircuits,
  renderHome,
  renderKyle,
  renderNotFound,
  renderRace,
} from "./lib/render.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

let cache = { mtime: 0, data: null };

export function seasonData() {
  const files = ["season.json", "results.json", "ja.json"].map((name) => path.join(root, "data", name));
  const mtime = files.reduce((sum, file) => sum + (fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0), 0);
  if (!cache.data || cache.mtime !== mtime) {
    cache = { mtime, data: loadSeason(root) };
  }
  return cache.data;
}

export function createServer() {
  return http.createServer((req, res) => {
    try {
      handle(req, res);
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("The sheet failed to render.");
      console.error(error);
    }
  });
}

function handle(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";
  const proto = header(req, "x-forwarded-proto") || url.protocol.replace(":", "");
  const host = header(req, "x-forwarded-host") || header(req, "host") || url.host;
  const origin = `${proto}://${host}`;

  if (pathname === "/health") {
    return send(req, res, 200, "text/plain; charset=utf-8", "ok");
  }

  if (pathname === "/" && cookieLang(req) === "ja" && url.searchParams.get("hl") !== "en") {
    res.writeHead(302, { location: "/ja", "set-cookie": langCookie("ja"), "cache-control": "no-cache" });
    res.end();
    return;
  }

  const { lang, path: bare } = stripLang(pathname);
  const page = (html, status = 200) => sendHtml(req, res, html, status, lang);

  if (bare === "/") return page(renderHome(seasonData(), Date.now(), lang, origin, bare));
  if (bare === "/kyle-wynne") return page(renderKyle(seasonData(), lang, origin, bare));
  if (bare === "/circuits") return page(renderCircuits(seasonData(), lang, origin, bare));

  const race = bare.match(/^\/races\/([^/]+)$/);
  if (race) {
    const item = findRace(seasonData(), race[1]);
    if (!item) return page(renderNotFound(lang, origin, bare), 404);
    return page(renderRace(seasonData(), item, Date.now(), lang, origin, bare));
  }

  const circuit = bare.match(/^\/circuits\/([^/]+)$/);
  if (circuit) {
    const item = findCircuit(seasonData(), circuit[1]);
    if (!item) return page(renderNotFound(lang, origin, bare), 404);
    return page(renderCircuit(seasonData(), item, lang, origin, bare));
  }

  if (serveStatic(bare, req, res) || serveStatic(pathname, req, res)) return;
  return page(renderNotFound(lang, origin, bare), 404);
}

function stripLang(pathname) {
  if (pathname === "/ja" || pathname.startsWith("/ja/")) {
    const bare = pathname === "/ja" ? "/" : pathname.slice(3) || "/";
    return { lang: "ja", path: bare };
  }
  return { lang: "en", path: pathname };
}

function cookieLang(req) {
  const match = String(req.headers.cookie || "").match(/(?:^|;\s*)lang=(en|ja)(?:;|$)/);
  return match ? match[1] : "";
}

function langCookie(lang) {
  return `lang=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function header(req, name) {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value || "";
}

function sendHtml(req, res, html, status = 200, lang = "en") {
  write(req, res, status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "content-language": lang,
    "set-cookie": langCookie(lang),
    "content-security-policy": "default-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'",
  }, html);
}

function send(req, res, status, type, body, cacheControl = "no-cache") {
  write(req, res, status, {
    "content-type": type,
    "cache-control": cacheControl,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "content-security-policy": "default-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'",
  }, body);
}

function write(req, res, status, headers, body) {
  const payload = gzipBody(req, headers, body);
  res.writeHead(status, payload.headers);
  res.end(payload.body);
}

function gzipBody(req, headers, body) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const type = String(headers["content-type"] || "");
  const accept = String(header(req, "accept-encoding") || "");
  const compressible = /text\/|javascript|json|svg|\+xml/.test(type);
  if (buf.length < 256 || !compressible || !/\bgzip\b/.test(accept)) return { headers, body: buf };
  return {
    headers: { ...headers, "content-encoding": "gzip", vary: "Accept-Encoding" },
    body: zlib.gzipSync(buf, { level: 6 }),
  };
}

function serveStatic(pathname, req, res) {
  if (pathname.includes("\0")) return false;
  const rel = pathname.replace(/^\/+/, "");
  const file = path.resolve(publicDir, rel);
  if (!file.startsWith(publicDir + path.sep) && file !== publicDir) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] || "application/octet-stream";
  const body = fs.readFileSync(file);
  const cache = ext === ".woff2" ? "public, max-age=31536000, immutable" : "public, max-age=86400";
  write(req, res, 200, {
    "content-type": type,
    "cache-control": cache,
    "x-content-type-options": "nosniff",
  }, body);
  return true;
}

export function start(port = Number(process.env.PORT) || 8080) {
  const server = createServer();
  return new Promise((resolve) => {
    server.listen(port, "0.0.0.0", () => resolve(server));
  });
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const port = Number(process.env.PORT) || 8080;
  start(port).then((server) => {
    const address = server.address();
    console.log(`Shinkō1 season sheet listening on ${address.port}`);
  });
}
