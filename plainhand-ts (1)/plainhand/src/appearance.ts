import { getItem, setItem } from "./storage";

export type Mode = "auto" | "light" | "dark";

export interface Appearance {
  palette: string;
  mode: Mode;
}

interface Base {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  /** the highlighter colour used for the wordmark, stickers and accents */
  accent: string;
  /** the dark band on the Home page */
  band: string;
}

export interface Palette {
  id: string;
  name: string;
  note: string;
  light: Base;
  dark: Base;
}

/** Flag red is deliberately not part of a palette. Marks stay red whatever colour the site is. */
export const PALETTES: Palette[] = [
  {
    id: "vanilla",
    name: "Vanilla",
    note: "Cream paper, navy ink",
    light: { bg: "#f6eeda", surface: "#fffbef", surface2: "#efe4c6", ink: "#0e1a3a", ink2: "#4b5877", accent: "#f3d878", band: "#0e1a3a" },
    dark: { bg: "#0a1330", surface: "#111c40", surface2: "#18254f", ink: "#f4ead0", ink2: "#aeb7d1", accent: "#e8c95f", band: "#16224a" },
  },
  {
    id: "sage",
    name: "Sage",
    note: "Soft green, deep forest",
    light: { bg: "#e8eedc", surface: "#f6faee", surface2: "#d9e3c7", ink: "#16301f", ink2: "#4f6556", accent: "#c9de86", band: "#16301f" },
    dark: { bg: "#0c1a12", surface: "#13261b", surface2: "#1b3526", ink: "#e5efd6", ink2: "#a5b8a8", accent: "#b9d46c", band: "#1b3526" },
  },
  {
    id: "lagoon",
    name: "Lagoon",
    note: "Sea glass and teal",
    light: { bg: "#dcefec", surface: "#f1fbf8", surface2: "#c6e4df", ink: "#073a3d", ink2: "#40696b", accent: "#86ddc9", band: "#073a3d" },
    dark: { bg: "#06191b", surface: "#0d2a2c", surface2: "#143b3e", ink: "#d8f2ee", ink2: "#9cbfbc", accent: "#6fd1bb", band: "#143b3e" },
  },
  {
    id: "sky",
    name: "Sky",
    note: "Pale blue, ink blue",
    light: { bg: "#e1edf7", surface: "#f3f9fd", surface2: "#cfe0ee", ink: "#0b2a4a", ink2: "#46647f", accent: "#a3d3f3", band: "#0b2a4a" },
    dark: { bg: "#08121f", surface: "#0f2036", surface2: "#17304d", ink: "#e2eefa", ink2: "#a3b8cd", accent: "#7fc0ee", band: "#17304d" },
  },
  {
    id: "lavender",
    name: "Lavender",
    note: "Lilac with indigo",
    light: { bg: "#e9e5f6", surface: "#f7f4fd", surface2: "#d9d3ee", ink: "#221a52", ink2: "#5b5788", accent: "#c6b8f6", band: "#221a52" },
    dark: { bg: "#0e0b24", surface: "#18143a", surface2: "#241f52", ink: "#ece8fb", ink2: "#b0abd3", accent: "#b3a2f0", band: "#241f52" },
  },
  {
    id: "graphite",
    name: "Graphite",
    note: "Neutral grey, bright yellow",
    light: { bg: "#ebebe8", surface: "#fafaf8", surface2: "#dbdbd6", ink: "#1b1e25", ink2: "#595e6a", accent: "#ffd54a", band: "#1b1e25" },
    dark: { bg: "#101216", surface: "#1a1d23", surface2: "#252931", ink: "#f0f0ec", ink2: "#a9adb7", accent: "#f2c53a", band: "#252931" },
  },
];

const DEFAULT: Appearance = { palette: "vanilla", mode: "auto" };

export function loadAppearance(): Appearance {
  const raw = getItem("appearance");
  if (!raw || raw.length > 500) return { ...DEFAULT };
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const palette = PALETTES.some((p) => p.id === v["palette"]) ? String(v["palette"]) : DEFAULT.palette;
    const mode: Mode = v["mode"] === "light" || v["mode"] === "dark" ? v["mode"] : "auto";
    return { palette, mode };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveAppearance(a: Appearance): void {
  setItem("appearance", JSON.stringify(a));
}

/* ---- colour helpers ---- */

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const rgba = (hex: string, a: number): string => "rgba(" + rgb(hex).join(", ") + ", " + a + ")";
function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return "#" + x.map((c, i) => Math.round(c * (1 - t) + y[i]! * t).toString(16).padStart(2, "0")).join("");
}

function tokens(b: Base, dark: boolean): Record<string, string> {
  return {
    "--bg": b.bg,
    "--surface": b.surface,
    "--surface-2": b.surface2,
    "--ink": b.ink,
    "--ink-2": b.ink2,
    "--line": rgba(b.ink, dark ? 0.17 : 0.15),
    "--butter": b.accent,
    "--butter-soft": rgba(b.accent, dark ? 0.3 : 0.55),
    "--on-butter": "#14171f",
    "--blue-wash": rgba(b.ink, dark ? 0.2 : 0.14),
    "--band-bg": b.band,
    "--band-fg": dark ? b.ink : b.bg,
    "--band-fg-2": dark ? b.ink2 : mix(b.band, b.bg, 0.72),
    "--btn-bg": b.ink,
    "--btn-fg": b.bg,
    "--focus": dark ? b.accent : b.ink,
    "--shadow": dark
      ? "0 1px 0 rgba(0, 0, 0, 0.3), 0 24px 44px -26px rgba(0, 0, 0, 0.7)"
      : "0 1px 0 " + rgba(b.ink, 0.1) + ", 0 24px 44px -26px " + rgba(b.ink, 0.45),
  };
}

const TOKEN_NAMES = Object.keys(tokens(PALETTES[0]!.light, false));

/* ---- applying ---- */

const root = document.documentElement;
let hostTheme: string | null = null;
let current: Appearance = { ...DEFAULT };
let started = false;

function resolvedDark(): boolean {
  const t = root.getAttribute("data-theme");
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function paint(): void {
  const p = PALETTES.find((x) => x.id === current.palette) ?? PALETTES[0]!;
  if (p.id === "vanilla") {
    TOKEN_NAMES.forEach((n) => root.style.removeProperty(n));
    return;
  }
  const dark = resolvedDark();
  const set = tokens(dark ? p.dark : p.light, dark);
  TOKEN_NAMES.forEach((n) => root.style.setProperty(n, set[n]!));
}

export function applyAppearance(a: Appearance): void {
  current = { ...a };
  if (a.mode === "auto") {
    if (hostTheme) root.setAttribute("data-theme", hostTheme);
    else root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", a.mode);
  }
  paint();
}

/** Call once at start. Repaints when the device theme or a host page's own theme switch changes. */
export function initAppearance(): Appearance {
  if (!started) {
    started = true;
    hostTheme = root.getAttribute("data-theme");
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (current.mode === "auto") paint();
    });
    new MutationObserver(() => {
      if (current.mode !== "auto") return;
      hostTheme = root.getAttribute("data-theme");
      paint();
    }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }
  const a = loadAppearance();
  applyAppearance(a);
  return a;
}

export function currentAppearance(): Appearance {
  return { ...current };
}
