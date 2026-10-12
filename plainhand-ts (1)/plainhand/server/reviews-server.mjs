// A tiny review service for Plainhand. No dependencies. Run with: node server/reviews-server.mjs
//
// Environment:
//   PORT            port to listen on (default 8787)
//   ALLOWED_ORIGIN  the exact origin of your site, e.g. https://plainhand.example (required for browsers)
//   ADMIN_TOKEN     a long random secret that lets you approve or delete reviews (admin is off without it)
//   REVIEWS_FILE    where reviews are stored (default ./reviews.json)
//   TRUST_PROXY     set to 1 when running behind a proxy that sets X-Forwarded-For
//
// New reviews are held as pending. Nothing is shown publicly until you approve it.
// IP addresses are used only in memory for rate limiting and are never written to disk.

import http from "node:http";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID, timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT || 8787);
const FILE = process.env.REVIEWS_FILE || "./reviews.json";
const ORIGIN = process.env.ALLOWED_ORIGIN || "";
const ADMIN = process.env.ADMIN_TOKEN || "";
const TRUST_PROXY = process.env.TRUST_PROXY === "1";

const LIMITS = { nameMax: 40, textMin: 10, textMax: 600, perHour: 5, bodyMax: 4096, maxStored: 5000 };

let reviews = [];
if (existsSync(FILE)) {
  try {
    reviews = JSON.parse(readFileSync(FILE, "utf8"));
    if (!Array.isArray(reviews)) reviews = [];
  } catch {
    console.error("Could not read " + FILE + ". Starting empty and not overwriting until the next review arrives.");
  }
}

function save() {
  const tmp = FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(reviews));
  renameSync(tmp, FILE);
}

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3_600_000);
  if (recent.length >= LIMITS.perHour) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  return false;
}

function clean(s, max) {
  return String(s ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
}

function headers(extra = {}) {
  const h = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
  if (ORIGIN) {
    h["Access-Control-Allow-Origin"] = ORIGIN;
    h["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    h["Vary"] = "Origin";
  }
  return h;
}

function send(res, status, body) {
  res.writeHead(status, headers());
  res.end(body === undefined ? "" : JSON.stringify(body));
}

function isAdmin(req) {
  if (!ADMIN) return false;
  const given = Buffer.from(String(req.headers.authorization || "").replace(/^Bearer /, ""));
  const real = Buffer.from(ADMIN);
  return given.length === real.length && timingSafeEqual(given, real);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > LIMITS.bodyMax) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const publicView = (r) => ({ id: r.id, name: r.name, rating: r.rating, text: r.text, createdAt: r.createdAt });

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://x");
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "OPTIONS") {
      res.writeHead(204, headers());
      return res.end();
    }

    if (req.method === "GET" && path === "/reviews") {
      const list = reviews.filter((r) => r.approved).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100).map(publicView);
      return send(res, 200, { reviews: list });
    }

    if (req.method === "POST" && path === "/reviews") {
      if (ORIGIN && req.headers.origin && req.headers.origin !== ORIGIN) return send(res, 403, { error: "forbidden" });
      const ip = (TRUST_PROXY ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "") || req.socket.remoteAddress || "unknown";
      if (limited(ip)) return send(res, 429, { error: "too many" });
      let data;
      try {
        data = JSON.parse(await readBody(req));
      } catch {
        return send(res, 400, { error: "bad request" });
      }
      if (typeof data !== "object" || data === null) return send(res, 400, { error: "bad request" });
      if (clean(data.website, 100)) return send(res, 201, { ok: true, pending: true }); // honeypot: pretend it worked
      const rating = Number(data.rating);
      const text = clean(data.text, LIMITS.textMax + 1);
      const name = clean(data.name, LIMITS.nameMax + 1);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return send(res, 400, { error: "rating" });
      if (text.length < LIMITS.textMin || text.length > LIMITS.textMax) return send(res, 400, { error: "text" });
      if (name.length > LIMITS.nameMax) return send(res, 400, { error: "name" });
      if (reviews.length >= LIMITS.maxStored) return send(res, 503, { error: "full" });
      reviews.push({ id: randomUUID(), name: name || "Anonymous", rating, text, createdAt: Date.now(), approved: false });
      save();
      return send(res, 201, { ok: true, pending: true });
    }

    if (path.startsWith("/admin/")) {
      if (!isAdmin(req)) return send(res, 401, { error: "unauthorized" });
      if (req.method === "GET" && path === "/admin/pending") {
        return send(res, 200, { reviews: reviews.filter((r) => !r.approved).map(publicView) });
      }
      const m = path.match(/^\/admin\/(approve|reviews)\/([\w-]{1,64})$/);
      if (m) {
        const i = reviews.findIndex((r) => r.id === m[2]);
        if (i < 0) return send(res, 404, { error: "not found" });
        if (req.method === "POST" && m[1] === "approve") {
          reviews[i].approved = true;
          save();
          return send(res, 200, { ok: true });
        }
        if (req.method === "DELETE" && m[1] === "reviews") {
          reviews.splice(i, 1);
          save();
          return send(res, 200, { ok: true });
        }
      }
    }

    send(res, 404, { error: "not found" });
  } catch {
    send(res, 500, { error: "server error" });
  }
});

server.listen(PORT, () => {
  console.log("Plainhand review service on port " + PORT);
  if (!ORIGIN) console.log("Warning: ALLOWED_ORIGIN is not set, so browsers on other sites cannot use this service.");
  if (!ADMIN) console.log("Warning: ADMIN_TOKEN is not set, so reviews cannot be approved and none will be shown.");
});
