import type { DeclMeta, DraftState, Settings } from "./types";
import { SAMPLE_TEXT } from "./sample";

const NS = "plainhand:";
const USED_PREFIX = NS + "used:";

/** Hard limits so a corrupted or tampered store can never freeze the page. */
export const MAX_TEXT_CHARS = 60_000;
const MAX_DECLARED = 2_000;
const MAX_FIELD_CHARS = 200;

export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(NS + key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(NS + key, value);
  } catch {
    /* storage can be blocked or full, the app still works without it */
  }
}

function parse(key: string): unknown {
  const raw = getItem(key);
  if (!raw || raw.length > MAX_TEXT_CHARS * 4) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max: number, fallback = ""): string {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}

/** Everything read back from storage is checked, because storage is user-editable. */
export function loadDraft(): DraftState {
  const v = parse("draft");
  if (!isObject(v)) return { text: SAMPLE_TEXT, declared: [], sample: true };
  const declared = Array.isArray(v["declared"])
    ? v["declared"].filter((x): x is string => typeof x === "string").slice(0, MAX_DECLARED)
    : [];
  return {
    text: str(v["text"], MAX_TEXT_CHARS),
    declared,
    sample: v["sample"] === true,
  };
}

export function saveDraft(d: DraftState): void {
  setItem("draft", JSON.stringify(d));
}

export function loadMeta(): DeclMeta {
  const v = parse("meta");
  const base: DeclMeta = { tool: "", purpose: "", course: "", mode: "used", style: "short" };
  if (!isObject(v)) return base;
  return {
    tool: str(v["tool"], MAX_FIELD_CHARS),
    purpose: str(v["purpose"], MAX_FIELD_CHARS),
    course: str(v["course"], MAX_FIELD_CHARS),
    mode: v["mode"] === "none" ? "none" : "used",
    style: v["style"] === "full" ? "full" : "short",
  };
}

export function loadSettings(): Settings {
  const v = parse("settings");
  const base: Settings = { sens: "balanced", showMarks: true };
  if (!isObject(v)) return base;
  const sens = v["sens"] === "relaxed" || v["sens"] === "strict" ? v["sens"] : "balanced";
  return { sens, showMarks: v["showMarks"] !== false };
}

export function saveSettings(s: Settings): void {
  setItem("settings", JSON.stringify(s));
}

export function saveMeta(m: DeclMeta): void {
  setItem("meta", JSON.stringify(m));
}

/** Removes the saved draft and declaration details. The daily time record is kept on purpose. */
export function clearDraftData(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(NS) && !k.startsWith(USED_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function readUsedSeconds(dayKey: string): number {
  const n = parseInt(getItem("used:" + dayKey) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 3600) : 0;
}

export function writeUsedSeconds(dayKey: string, seconds: number): void {
  setItem("used:" + dayKey, String(seconds));
}
