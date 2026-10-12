import { esc } from "./format";
import { getItem, setItem } from "./storage";

export interface Review {
  id: string;
  name: string;
  rating: number;
  text: string;
  createdAt: number;
  /** true for reviews that only exist on this device */
  mine?: boolean;
}

export interface ReviewList {
  reviews: Review[];
  /** true when a shared review store is connected, false when reviews live only in this browser */
  shared: boolean;
  failed: boolean;
}

export type SubmitResult = { ok: true; pending: boolean } | { ok: false; message: string };

/** Set at build time with the REVIEWS_URL environment variable. Empty means reviews stay on this device. */
const REMOTE: string = typeof __REVIEWS_URL__ === "string" ? __REVIEWS_URL__.replace(/\/+$/, "") : "";
export const SHARED = REMOTE !== "";

export const LIMITS = { nameMax: 40, textMin: 10, textMax: 600 };

function clean(s: string, max: number): string {
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, max);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Anything coming from storage or a network call is checked before it is used. */
function toReview(v: unknown, mine = false): Review | null {
  if (!isObject(v)) return null;
  const rating = Number(v["rating"]);
  const text = typeof v["text"] === "string" ? clean(v["text"], LIMITS.textMax) : "";
  const id = typeof v["id"] === "string" ? v["id"].slice(0, 64) : "";
  if (!id || !text || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  const name = typeof v["name"] === "string" ? clean(v["name"], LIMITS.nameMax) : "";
  const createdAt = Number(v["createdAt"]);
  return { id, name: name || "Anonymous", rating, text, createdAt: Number.isFinite(createdAt) ? createdAt : 0, mine };
}

function readLocal(): Review[] {
  const raw = getItem("reviews");
  if (!raw || raw.length > 100_000) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => toReview(x, true)).filter((r): r is Review => r !== null).slice(0, 20);
  } catch {
    return [];
  }
}

export async function listReviews(): Promise<ReviewList> {
  if (!SHARED) return { reviews: readLocal().sort((a, b) => b.createdAt - a.createdAt), shared: false, failed: false };
  try {
    const res = await fetch(REMOTE + "/reviews", { credentials: "omit", headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("bad status");
    const data = (await res.json()) as unknown;
    const arr = isObject(data) && Array.isArray(data["reviews"]) ? data["reviews"] : [];
    const reviews = arr.map((x) => toReview(x)).filter((r): r is Review => r !== null).sort((a, b) => b.createdAt - a.createdAt);
    return { reviews, shared: true, failed: false };
  } catch {
    return { reviews: [], shared: true, failed: true };
  }
}

export function validate(name: string, rating: number, text: string): string | null {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Choose a rating from 1 to 5.";
  const t = clean(text, LIMITS.textMax + 1);
  if (t.length < LIMITS.textMin) return "Write at least " + LIMITS.textMin + " characters so the review says something.";
  if (t.length > LIMITS.textMax) return "Keep the review under " + LIMITS.textMax + " characters.";
  if (clean(name, LIMITS.nameMax + 1).length > LIMITS.nameMax) return "Keep the name under " + LIMITS.nameMax + " characters.";
  return null;
}

let lastSubmit = 0;

export async function submitReview(name: string, rating: number, text: string, honeypot: string): Promise<SubmitResult> {
  const problem = validate(name, rating, text);
  if (problem) return { ok: false, message: problem };
  if (Date.now() - lastSubmit < 20_000) return { ok: false, message: "Give it a few seconds before sending another." };
  lastSubmit = Date.now();

  const body = { name: clean(name, LIMITS.nameMax), rating, text: clean(text, LIMITS.textMax), website: honeypot };

  if (!SHARED) {
    const id = "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const mine = readLocal();
    mine.unshift({ id, name: body.name || "Anonymous", rating, text: body.text, createdAt: Date.now() });
    setItem("reviews", JSON.stringify(mine.slice(0, 20)));
    return { ok: true, pending: false };
  }

  try {
    const res = await fetch(REMOTE + "/reviews", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429) return { ok: false, message: "That is a lot of reviews from one place. Please try again later." };
    if (!res.ok) return { ok: false, message: "The review could not be sent. Please try again in a moment." };
    return { ok: true, pending: true };
  } catch {
    return { ok: false, message: "Could not reach the review service. Check your connection and try again." };
  }
}

export function removeLocalReview(id: string): void {
  setItem("reviews", JSON.stringify(readLocal().filter((r) => r.id !== id)));
}

/* ---- shared view helpers ---- */

export function stars(n: number): string {
  return (
    '<span class="stars" role="img" aria-label="' + n + ' out of 5">' +
    [1, 2, 3, 4, 5].map((i) => '<span class="' + (i <= n ? "on" : "") + '" aria-hidden="true">★</span>').join("") +
    "</span>"
  );
}

export function summary(reviews: Review[]): string {
  if (!reviews.length) return "";
  const avg = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
  return '<p class="rv-sum">' + stars(Math.round(avg)) + " <b>" + avg.toFixed(1) + "</b> out of 5 from " + reviews.length + (reviews.length === 1 ? " review" : " reviews") + "</p>";
}

export function cards(reviews: Review[]): string {
  const fmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" });
  return (
    '<ul class="rv-list">' +
    reviews
      .map(
        (r) =>
          '<li class="rv-card">' + stars(r.rating) + '<p class="rv-text">' + esc(r.text) + "</p>" +
          '<p class="rv-by"><b>' + esc(r.name) + "</b>" + (r.createdAt ? " · " + fmt.format(new Date(r.createdAt)) : "") +
          (r.mine ? ' · <span class="rv-mine">only on this device</span>' : "") + "</p></li>",
      )
      .join("") +
    "</ul>"
  );
}

export const EMPTY_HTML =
  '<div class="rv-empty"><p class="hand">No reviews yet.</p><p>Used Plainhand on a draft? Tell the next student what it was like.</p></div>';
