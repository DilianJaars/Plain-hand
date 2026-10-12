import { readUsedSeconds, writeUsedSeconds } from "./storage";

/** 4 hours of free use per day. */
export const ALLOWANCE_SECONDS = 4 * 3600;

/** A single tick never adds more than this, so a laptop waking from sleep does not burn the day in one go. */
const MAX_TICK_MS = 5_000;

export interface AllowanceState {
  used: number;
  left: number;
  fraction: number;
  locked: boolean;
}

type Listener = (s: AllowanceState) => void;

const listeners = new Set<Listener>();
let usedMs = 0;
let key = "";
let last = Date.now();
let unsavedMs = 0;

function dayKey(): string {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

export function snapshot(): AllowanceState {
  const used = Math.min(ALLOWANCE_SECONDS, Math.floor(usedMs / 1000));
  const left = Math.max(0, ALLOWANCE_SECONDS - used);
  return { used, left, fraction: left / ALLOWANCE_SECONDS, locked: left <= 0 };
}

export function secondsUntilMidnight(): number {
  const n = new Date();
  const mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  return Math.max(60, Math.round((mid.getTime() - n.getTime()) / 1000));
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(snapshot());
  return () => {
    listeners.delete(l);
  };
}

function emit(): void {
  const s = snapshot();
  listeners.forEach((l) => l(s));
}

function save(): void {
  writeUsedSeconds(key, Math.floor(usedMs / 1000));
  unsavedMs = 0;
}

/** Another tab or window may have counted time too. Take whichever total is higher so time is never lost or doubled. */
function syncFromStorage(): void {
  const stored = readUsedSeconds(key) * 1000;
  if (stored > usedMs) usedMs = stored;
}

/**
 * The clock runs whenever Plainhand is open and in front of the person, and stops when they leave
 * or switch to another tab. It uses real elapsed time, so it is accurate even if the browser slows timers.
 */
export function startAllowance(): void {
  key = dayKey();
  usedMs = readUsedSeconds(key) * 1000;
  last = Date.now();

  window.setInterval(() => {
    const now = Date.now();
    const elapsed = Math.min(MAX_TICK_MS, Math.max(0, now - last));
    last = now;

    const k = dayKey();
    if (k !== key) {
      key = k;
      usedMs = readUsedSeconds(key) * 1000;
    } else {
      syncFromStorage();
    }

    if (!document.hidden && usedMs < ALLOWANCE_SECONDS * 1000) {
      usedMs = Math.min(ALLOWANCE_SECONDS * 1000, usedMs + elapsed);
      unsavedMs += elapsed;
      if (unsavedMs >= 3000) save();
    }
    emit();
  }, 1000);

  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => {
    last = Date.now();
    if (document.hidden) save();
  });
  emit();
}
