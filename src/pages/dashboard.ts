import type { Mount } from "../router";
import { PALETTES, applyAppearance, currentAppearance, saveAppearance } from "../appearance";
import type { Mode } from "../appearance";
import { analyze } from "../analyzer";
import { fmtDuration, ring } from "../format";
import { clearDraftData, loadDraft, loadSettings } from "../storage";
import { ALLOWANCE_SECONDS, secondsUntilMidnight, subscribe } from "../timer";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "auto", label: "Match my device", hint: "Follows your phone or computer" },
  { id: "light", label: "Light", hint: "Paper colours" },
  { id: "dark", label: "Dark", hint: "Easy on the eyes at night" },
];

export const mount: Mount = (root) => {
  const draft = loadDraft();
  const analysis = analyze(draft.text, loadSettings().sens);
  const flagged = analysis.sentences.filter((s) => s.level > 0).length;
  const hasDraft = analysis.sentences.length > 0 && !draft.sample;

  root.innerHTML = `
  <section class="page">
    <div class="wrap">
      <header class="page-head">
        <h1>Your dashboard</h1>
        <p class="lead">Everything personal to you, kept on this device. No account needed.</p>
      </header>

      <div class="dash">
        <section class="card dash-time" aria-labelledby="d-time">
          <h2 id="d-time">Today's time</h2>
          <div class="time-row"><span id="d-ring"></span><div><p class="time-big" id="d-left">4h 00m</p><p class="muted small" id="d-sub"></p></div></div>
          <p class="muted small">The clock runs whenever Plainhand is open in front of you and stops when you leave or switch tabs. It starts again at midnight.</p>
        </section>

        <section class="card dash-look" aria-labelledby="d-look">
          <h2 id="d-look">Colours</h2>
          <p class="muted small">Pick a palette. It changes straight away and is remembered on this device. Flagged text stays red in every palette.</p>
          <div class="swatches" role="radiogroup" aria-label="Colour palette" id="swatches"></div>
          <h3 class="sub-h">Light or dark</h3>
          <div class="seg-row" role="radiogroup" aria-label="Light or dark" id="modes"></div>
        </section>

        <section class="card" aria-labelledby="d-draft">
          <h2 id="d-draft">Your draft</h2>
          <div id="d-draft-body"></div>
        </section>

        <section class="card" aria-labelledby="d-data">
          <h2 id="d-data">Your data</h2>
          <p class="muted small">Your draft, tags and settings live only in this browser. Deleting them cannot be undone.</p>
          <div class="out-actions">
            <button class="btn ghost" id="d-wipe" type="button">Delete my saved draft</button>
            <button class="btn ghost" id="d-reset" type="button">Reset colours</button>
            <span class="copied" id="d-msg" role="status"></span>
          </div>
        </section>
      </div>
    </div>
  </section>`;

  const $ = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const msg = $<HTMLElement>("#d-msg");

  /* time */
  const stopTime = subscribe((s) => {
    $<HTMLElement>("#d-ring").innerHTML = ring(s.fraction, 72, 8);
    $<HTMLElement>("#d-left").textContent = fmtDuration(s.left) + " left";
    const mins = Math.round(secondsUntilMidnight() / 60);
    $<HTMLElement>("#d-sub").textContent =
      "Used " + fmtDuration(Math.min(ALLOWANCE_SECONDS, s.used)) + " of 4h 00m. Resets in about " + Math.floor(mins / 60) + "h " + (mins % 60) + "m.";
  });

  /* draft */
  $<HTMLElement>("#d-draft-body").innerHTML = hasDraft
    ? '<dl class="facts"><div><dt>Words</dt><dd>' + analysis.totalWords + '</dd></div><div><dt>Flagged</dt><dd class="red">' + flagged +
      " of " + analysis.sentences.length + '</dd></div><div><dt>Tagged as AI</dt><dd>' + draft.declared.length + '</dd></div></dl>' +
      '<div class="out-actions"><a class="btn" href="#check">Open in Check</a><a class="btn ghost" href="#declare">Declaration</a></div>'
    : '<p class="muted">No draft saved yet.</p><div class="out-actions"><a class="btn" href="#check">Check a draft</a></div>';

  /* colours */
  const swatches = $<HTMLElement>("#swatches");
  const modes = $<HTMLElement>("#modes");

  function renderLook(): void {
    const a = currentAppearance();
    swatches.innerHTML = PALETTES.map((p) => {
      const on = p.id === a.palette;
      return (
        '<button type="button" class="swatch" role="radio" aria-checked="' + on + '" data-palette="' + p.id + '" title="' + p.note + '">' +
        '<span class="chips" aria-hidden="true" style="background:' + p.light.bg + '"><i style="background:' + p.light.ink + '"></i><i style="background:' + p.light.accent +
        '"></i><i style="background:' + p.light.surface2 + '"></i></span>' +
        '<span class="sw-name">' + p.name + '</span><span class="sw-note">' + p.note + "</span></button>"
      );
    }).join("");
    modes.innerHTML = MODES.map(
      (m) =>
        '<button type="button" class="seg-btn" role="radio" aria-checked="' + (m.id === a.mode) + '" data-mode="' + m.id + '" title="' + m.hint + '">' + m.label + "</button>",
    ).join("");
  }

  function choose(next: Partial<{ palette: string; mode: Mode }>, focusSel: string): void {
    const a = { ...currentAppearance(), ...next };
    applyAppearance(a);
    saveAppearance(a);
    renderLook();
    root.querySelector<HTMLElement>(focusSel)?.focus({ preventScroll: true });
  }

  swatches.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-palette]");
    if (b) choose({ palette: b.dataset["palette"]! }, '[data-palette="' + b.dataset["palette"] + '"]');
  });
  modes.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-mode]");
    if (b) choose({ mode: b.dataset["mode"] as Mode }, '[data-mode="' + b.dataset["mode"] + '"]');
  });
  renderLook();

  /* data */
  $<HTMLElement>("#d-wipe").addEventListener("click", () => {
    clearDraftData();
    msg.textContent = "Saved draft deleted. Your colours were kept.";
    $<HTMLElement>("#d-draft-body").innerHTML = '<p class="muted">No draft saved yet.</p><div class="out-actions"><a class="btn" href="#check">Check a draft</a></div>';
  });
  $<HTMLElement>("#d-reset").addEventListener("click", () => {
    choose({ palette: "vanilla", mode: "auto" }, "#d-reset");
    msg.textContent = "Colours reset.";
  });

  return stopTime;
};
