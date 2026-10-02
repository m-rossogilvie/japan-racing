import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSeason } from "./lib/prepare.js";
import {
  findCircuit,
  findRace,
  renderCircuit,
  renderCircuits,
  renderHome,
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
  const file = path.join(root, "data", "season.json");
  const mtime = fs.statSync(file).mtimeMs;
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

  if (pathname === "/health") {
    return send(res, 200, "text/plain; charset=utf-8", "ok");
  }

  if (pathname === "/") return sendHtml(res, renderHome(seasonData()));
  if (pathname === "/circuits") return sendHtml(res, renderCircuits(seasonData()));

  const race = pathname.match(/^\/races\/([^/]+)$/);
  if (race) {
    const item = findRace(seasonData(), race[1]);
    if (!item) return sendHtml(res, renderNotFound(), 404);
    return sendHtml(res, renderRace(seasonData(), item));
  }

  const circuit = pathname.match(/^\/circuits\/([^/]+)$/);
  if (circuit) {
    const item = findCircuit(seasonData(), circuit[1]);
    if (!item) return sendHtml(res, renderNotFound(), 404);
    return sendHtml(res, renderCircuit(seasonData(), item));
  }

  if (serveStatic(pathname, res)) return;
  return sendHtml(res, renderNotFound(), 404);
}

function sendHtml(res, html, status = 200) {
  send(res, status, "text/html; charset=utf-8", html, "no-cache");
}

function send(res, status, type, body, cacheControl = "no-cache") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": cacheControl,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "content-security-policy": "default-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'",
  });
  res.end(body);
}

function serveStatic(pathname, res) {
  if (pathname.includes("\0")) return false;
  const rel = pathname.replace(/^\/+/, "");
  const file = path.resolve(publicDir, rel);
  if (!file.startsWith(publicDir + path.sep) && file !== publicDir) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  const body = fs.readFileSync(file);
  res.writeHead(200, {
    "content-type": type,
    "cache-control": "public, max-age=86400",
    "x-content-type-options": "nosniff",
  });
  res.end(body);
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
