// A tiny review service for Plainhand. No dependencies. Run with: node server/reviews-server.mjs
//
// Environment:
//   PORT            port to listen on (default 8787)
//   ALLOWED_ORIGIN  the exact origin of your site, e.g. https://plainhand.example (required for browsers)
//   ADMIN_TOKEN     a long random secret that lets you approve or delete reviews (admin is off without it)
//   DATABASE_URL    Postgres connection string. When set, reviews are stored in Postgres and survive restarts and redeploys.
//   REVIEWS_FILE    used only when DATABASE_URL is not set: where reviews are stored (default ./reviews.json)
//   AUTO_APPROVE    set to 1 to publish reviews immediately. Reviews with links or repeated text are still held for approval.
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
const AUTO_APPROVE = process.env.AUTO_APPROVE === "1";
const LINKISH = /(https?:|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ru|xyz|info|biz|shop|top|click|link)\b|@[a-z0-9_.-]+\.[a-z]{2,})/i;

const LIMITS = { nameMax: 40, textMin: 10, textMax: 600, perHour: 5, bodyMax: 4096, maxStored: 5000 };

// Storage: Postgres when DATABASE_URL is set, otherwise a local JSON file (fine for local testing only).
const DATABASE_URL = process.env.DATABASE_URL || "";

async function makeStore() {
  if (DATABASE_URL) {
    const { default: pg } = await import("pg");
    const local = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
    const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false }, max: 5 });
    await pool.query(`CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      approved BOOLEAN NOT NULL DEFAULT FALSE
    )`);
    const row = (r) => ({ id: r.id, name: r.name, rating: r.rating, text: r.text, createdAt: Number(r.created_at) });
    return {
      kind: "postgres",
      approved: async () => (await pool.query("SELECT * FROM reviews WHERE approved ORDER BY created_at DESC LIMIT 100")).rows.map(row),
      pending: async () => (await pool.query("SELECT * FROM reviews WHERE NOT approved ORDER BY created_at ASC LIMIT 200")).rows.map(row),
      count: async () => Number((await pool.query("SELECT COUNT(*) FROM reviews")).rows[0].count),
      hasText: async (t) => (await pool.query("SELECT 1 FROM reviews WHERE LOWER(text) = LOWER($1) LIMIT 1", [t])).rowCount > 0,
      add: async (r) => {
        await pool.query("INSERT INTO reviews (id, name, rating, text, created_at, approved) VALUES ($1,$2,$3,$4,$5,$6)", [r.id, r.name, r.rating, r.text, r.createdAt, !!r.approved]);
      },
      approve: async (id) => (await pool.query("UPDATE reviews SET approved = TRUE WHERE id = $1", [id])).rowCount > 0,
      remove: async (id) => (await pool.query("DELETE FROM reviews WHERE id = $1", [id])).rowCount > 0,
    };
  }

  let reviews = [];
  if (existsSync(FILE)) {
    try {
      reviews = JSON.parse(readFileSync(FILE, "utf8"));
      if (!Array.isArray(reviews)) reviews = [];
    } catch {
      console.error("Could not read " + FILE + ". Starting empty and not overwriting until the next review arrives.");
    }
  }
  const save = () => {
    const tmp = FILE + ".tmp";
    writeFileSync(tmp, JSON.stringify(reviews));
    renameSync(tmp, FILE);
  };
  return {
    kind: "file",
    approved: async () => reviews.filter((r) => r.approved).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100).map(publicView),
    pending: async () => reviews.filter((r) => !r.approved).map(publicView),
    count: async () => reviews.length,
    hasText: async (t) => reviews.some((r) => r.text.toLowerCase() === t.toLowerCase()),
    add: async (r) => {
      reviews.push({ ...r, approved: !!r.approved });
      save();
    },
    approve: async (id) => {
      const i = reviews.findIndex((r) => r.id === id);
      if (i < 0) return false;
      reviews[i].approved = true;
      save();
      return true;
    },
    remove: async (id) => {
      const i = reviews.findIndex((r) => r.id === id);
      if (i < 0) return false;
      reviews.splice(i, 1);
      save();
      return true;
    },
  };
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

function publicView(r) {
  return { id: r.id, name: r.name, rating: r.rating, text: r.text, createdAt: r.createdAt };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://x");
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "OPTIONS") {
      res.writeHead(204, headers());
      return res.end();
    }

    if (req.method === "GET" && path === "/reviews") {
      return send(res, 200, { reviews: await store.approved() });
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
      if ((await store.count()) >= LIMITS.maxStored) return send(res, 503, { error: "full" });
      const publish = AUTO_APPROVE && !LINKISH.test(text) && !LINKISH.test(name) && !(await store.hasText(text));
      await store.add({ id: randomUUID(), name: name || "Anonymous", rating, text, createdAt: Date.now(), approved: publish });
      return send(res, 201, { ok: true, pending: !publish });
    }

    if (path.startsWith("/admin/")) {
      if (!isAdmin(req)) return send(res, 401, { error: "unauthorized" });
      if (req.method === "GET" && path === "/admin/pending") {
        return send(res, 200, { reviews: await store.pending() });
      }
      const m = path.match(/^\/admin\/(approve|reviews)\/([\w-]{1,64})$/);
      if (m) {
        if (req.method === "POST" && m[1] === "approve") {
          return (await store.approve(m[2])) ? send(res, 200, { ok: true }) : send(res, 404, { error: "not found" });
        }
        if (req.method === "DELETE" && m[1] === "reviews") {
          return (await store.remove(m[2])) ? send(res, 200, { ok: true }) : send(res, 404, { error: "not found" });
        }
      }
    }

    send(res, 404, { error: "not found" });
  } catch {
    send(res, 500, { error: "server error" });
  }
});

let store;
try {
  store = await makeStore();
} catch (e) {
  console.error("Could not start storage:", e instanceof Error ? e.message : e);
  process.exit(1);
}

server.listen(PORT, () => {
  console.log("Plainhand review service on port " + PORT + " (storage: " + store.kind + ")");
  if (!ORIGIN) console.log("Warning: ALLOWED_ORIGIN is not set, so browsers on other sites cannot use this service.");
  if (AUTO_APPROVE) console.log("Auto-approve is on: reviews without links go live immediately.");
  if (!ADMIN) console.log("Warning: ADMIN_TOKEN is not set, so reviews cannot be approved and none will be shown.");
});
