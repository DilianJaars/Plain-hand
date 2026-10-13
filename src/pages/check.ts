import type { Mount } from "../router";
import type { Analysis, Sensitivity, Sentence, SignalId } from "../types";
import { SIGNALS, analyze, levelLabel, rhythmLabel, tipsFor } from "../analyzer";
import { copyText, esc } from "../format";
import { MAX_TEXT_CHARS, loadDraft, loadSettings, saveDraft, saveSettings } from "../storage";
import { ACCEPT, FileProblem, SUPPORTED_LABEL, readFileText } from "../files";
import { SAMPLE_TEXT } from "../sample";

type PanelId = "overview" | "flags" | "signals" | "declare" | "report" | "settings";

const SHELL = `
<section class="page">
  <div class="wrap">
    <header class="page-head">
      <h1>Check a draft</h1>
      <p class="lead">Drop in a file or paste your writing, then press Read it. Anything that reads like machine writing is marked in red, and the menu on the right shows why.</p>
    </header>

    <div class="toolbar">
      <button class="btn" id="read" type="button">Read it</button>
      <button class="btn ghost" id="edit" type="button">Edit text</button>
      <button class="btn ghost" id="open" type="button">Open file</button>
      <button class="btn ghost" id="sample" type="button">Load sample</button>
      <button class="btn ghost" id="clear" type="button">Clear</button>
      <input id="file" type="file" accept="${ACCEPT}" hidden>
      <span class="chip" id="sample-chip">Sample essay. Replace it with yours.</span>
    </div>

    <div class="drop" id="drop" tabindex="0" role="button" aria-label="Drop a file here, or tap or press Enter to choose one">
      <span class="drop-icon" aria-hidden="true">+</span>
      <span class="drop-text"><b>Drop your file here</b> or tap to browse. Word, PDF, PowerPoint, OpenDocument, RTF, HTML or any text file. It is read in your browser and never uploaded.</span>
    </div>
    <p class="drop-msg" id="drop-msg" role="status"></p>

    <div class="overview" id="overview" aria-live="polite"></div>

    <div class="workspace">
      <article class="paper big" id="paper" aria-label="Your draft"></article>
      <aside class="side" aria-label="Review menu">
        <div class="menu" id="menu" role="tablist" aria-label="Review menu"></div>
        <div class="panel" id="panel" role="tabpanel" tabindex="-1"></div>
      </aside>
    </div>
  </div>
</section>
`;

const MENU: { id: PanelId; label: string; hint: string }[] = [
  { id: "overview", label: "Overview", hint: "The verdict and a way to step through flags" },
  { id: "flags", label: "Flags", hint: "Every red passage, with reasons and tips" },
  { id: "signals", label: "Signals", hint: "Filter by the kind of pattern" },
  { id: "declare", label: "Declare", hint: "Sentences you tagged as AI-assisted" },
  { id: "report", label: "Report", hint: "A plain-text summary to copy" },
  { id: "settings", label: "Settings", hint: "How strict the reading is" },
];

interface State {
  text: string;
  sample: boolean;
  fileName: string;
  editing: boolean;
  declared: Set<string>;
  analysis: Analysis;
  sens: Sensitivity;
  showMarks: boolean;
  filter: SignalId | null;
  panel: PanelId;
  cursor: number;
}

export const mount: Mount = (root) => {
  root.innerHTML = SHELL;
  const $ = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const paper = $<HTMLElement>("#paper");
  const overview = $<HTMLElement>("#overview");
  const menu = $<HTMLElement>("#menu");
  const panel = $<HTMLElement>("#panel");
  const chip = $<HTMLElement>("#sample-chip");
  const fileInput = $<HTMLInputElement>("#file");
  const drop = $<HTMLElement>("#drop");
  const dropMsg = $<HTMLElement>("#drop-msg");

  const saved = loadDraft();
  const settings = loadSettings();
  const state: State = {
    text: saved.text,
    sample: saved.sample,
    fileName: "",
    editing: false,
    declared: new Set(saved.declared),
    analysis: analyze(saved.text, settings.sens),
    sens: settings.sens,
    showMarks: settings.showMarks,
    filter: null,
    panel: "overview",
    cursor: -1,
  };

  const persist = (): void => saveDraft({ text: state.text, declared: [...state.declared], sample: state.sample });
  const isTagged = (s: Sentence): boolean => state.declared.has(s.text);
  const flagged = (): Sentence[] =>
    state.analysis.sentences.filter((s) => s.level > 0 && (!state.filter || s.signals.includes(state.filter)));

  /** What shows as red on the page right now: respects the Show marks switch and the Signals filter. */
  const visible = (s: Sentence): 0 | 1 | 2 => {
    if (!state.showMarks || s.level === 0) return 0;
    if (state.filter && !s.signals.includes(state.filter)) return 0;
    return s.level;
  };

  /* ---------- top strip ---------- */
  function renderOverview(): void {
    const a = state.analysis;
    if (!a.sentences.length) {
      overview.innerHTML = '<p class="muted">Nothing to read yet. Drop in a file, paste some writing or load the sample.</p>';
      return;
    }
    const n = a.sentences.filter((s) => s.level > 0).length;
    let strip = '<div class="strip" role="list" aria-label="Every sentence, sized by length">';
    a.paragraphs.forEach((para, pi) => {
      para.forEach((s, si) => {
        const lv = visible(s);
        const cls = "seg l" + lv + (isTagged(s) ? " tagged" : "") + (si === 0 && pi > 0 ? " gap" : "");
        strip +=
          '<button type="button" role="listitem" class="' + cls + '" style="flex-grow:' + s.words + '" data-i="' + s.index +
          '" aria-label="Sentence ' + (s.index + 1) + ", " + levelLabel(s.level).toLowerCase() + '"></button>';
      });
    });
    strip += "</div>";
    overview.innerHTML =
      strip +
      '<p class="overview-line"><b class="red">' + n + " of " + a.sentences.length + "</b> sentences flagged in red, <b>" + a.flaggedPct +
      "%</b> of your words. A reading aid, not a detector score.</p>";
  }

  /* ---------- the page ---------- */
  function renderPaper(): void {
    chip.hidden = !state.sample;
    if (state.editing) {
      paper.innerHTML = '<textarea id="draft" class="draft" aria-label="Paste or type your draft" spellcheck="true"></textarea>';
      const ta = paper.querySelector<HTMLTextAreaElement>("#draft")!;
      ta.value = state.text;
      ta.addEventListener("input", () => {
        state.text = ta.value.slice(0, MAX_TEXT_CHARS);
        state.sample = false;
        chip.hidden = true;
        persist();
      });
      ta.focus();
      return;
    }
    if (!state.analysis.sentences.length) {
      paper.innerHTML = '<p class="muted">Your draft will show up here, with the red marks.</p>';
      return;
    }
    let html =
      '<div class="legend"><span><i class="sw a"></i>Worth a look</span><span><i class="sw b"></i>Reads machine-like</span><span><i class="sw c"></i>You tagged it as AI-assisted</span></div>';
    state.analysis.paragraphs.forEach((para) => {
      html += '<p class="read">';
      para.forEach((s) => {
        const lv = visible(s);
        const tagged = isTagged(s);
        html +=
          '<span class="s s-' + lv + (tagged ? " ai" : "") + '" data-i="' + s.index + '" tabindex="0" role="button" aria-pressed="' + tagged + '">' +
          esc(s.text) + (lv && s.flagNo ? '<sup class="mk">' + s.flagNo + "</sup>" : "") + "</span> ";
      });
      html += "</p>";
    });
    paper.innerHTML = html;
  }

  /* ---------- side menu ---------- */
  function counts(): Record<PanelId, number | null> {
    const flaggedAll = state.analysis.sentences.filter((s) => s.level > 0).length;
    return { overview: null, flags: flaggedAll, signals: null, declare: state.declared.size, report: null, settings: null };
  }

  function renderMenu(): void {
    const c = counts();
    menu.innerHTML = MENU.map((m) => {
      const on = m.id === state.panel;
      const n = c[m.id];
      return (
        '<button type="button" role="tab" class="menu-item" id="tab-' + m.id + '" data-panel="' + m.id + '" aria-selected="' + on +
        '" aria-controls="panel" tabindex="' + (on ? 0 : -1) + '" title="' + esc(m.hint) + '"><span>' + m.label + "</span>" +
        (n !== null ? '<span class="count' + (m.id === "flags" && n ? " red" : "") + '">' + n + "</span>" : "") + "</button>"
      );
    }).join("");
    panel.setAttribute("aria-labelledby", "tab-" + state.panel);
  }

  function noteHtml(s: Sentence): string {
    const snip = s.text.split(/\s+/).slice(0, 8).join(" ") + (s.words > 8 ? "…" : "");
    const tagged = isTagged(s);
    return (
      '<li class="note l' + s.level + '">' +
      '<button class="nh" type="button" data-jump="' + s.index + '"><span class="num">' + s.flagNo + '</span>' +
      '<span><span class="snip">' + esc(snip) + '</span><span class="lvl">' + levelLabel(s.level) + "</span></span></button>" +
      '<ul class="why">' + s.reasons.map((r) => "<li>" + esc(r) + "</li>").join("") + "</ul>" +
      '<p class="try hand">' + esc(tipsFor(s).join(" ")) + "</p>" +
      '<button class="tag-btn' + (tagged ? " on" : "") + '" type="button" data-tag="' + s.index + '" aria-pressed="' + tagged + '">' +
      (tagged ? "Tagged as AI-assisted" : "I used AI here") + "</button></li>"
    );
  }

  function reportText(): string {
    const a = state.analysis;
    const all = a.sentences.filter((s) => s.level > 0);
    const lines: string[] = [
      "Plainhand report",
      state.fileName ? "File: " + state.fileName : "Draft: pasted text",
      "Flagged: " + all.length + " of " + a.sentences.length + " sentences (" + a.flaggedPct + "% of " + a.totalWords + " words)",
      "Reading: " + state.sens,
      "This is a reading aid, not a detector score. It cannot say who wrote a sentence.",
      "",
    ];
    all.forEach((s) => {
      lines.push(s.flagNo + ". “" + s.text + "”");
      lines.push("   Paragraph " + (s.para + 1) + ", sentence " + s.pos + " (" + levelLabel(s.level) + ")");
      lines.push("   Why: " + s.reasons.join("; "));
      lines.push("   Try: " + tipsFor(s).join(" "));
      if (isTagged(s)) lines.push("   Tagged by the writer as AI-assisted.");
      lines.push("");
    });
    if (!all.length) lines.push("Nothing was flagged.");
    return lines.join("\n").trim();
  }

  function renderPanel(): void {
    const a = state.analysis;
    if (state.editing) {
      panel.innerHTML = '<p class="empty hand">Press Read it when you are ready.</p>';
      return;
    }
    if (!a.sentences.length) {
      panel.innerHTML = '<p class="empty hand">The menu fills in once there is a draft to read.</p>';
      return;
    }

    if (state.panel === "overview") {
      const n = a.sentences.filter((s) => s.level > 0).length;
      const r = rhythmLabel(a.rhythmCv);
      const verdict =
        a.flaggedPct < 10
          ? "Mostly reads like you. Look at the few red sentences."
          : a.flaggedPct < 35
            ? "A few passages read like machine writing. Rework the red ones first."
            : "Large parts read like machine writing. Rewrite the red passages in your own words before you hand in.";
      panel.innerHTML =
        "<h2>Overview</h2>" +
        (state.fileName ? '<p class="file-name">' + esc(state.fileName) + "</p>" : "") +
        '<dl class="facts">' +
        '<div><dt>Flagged</dt><dd class="red">' + n + " of " + a.sentences.length + "</dd></div>" +
        "<div><dt>Words in red</dt><dd>" + a.flaggedPct + "%</dd></div>" +
        "<div><dt>Rhythm</dt><dd>" + r.word + "</dd></div>" +
        "<div><dt>Words</dt><dd>" + a.totalWords + "</dd></div></dl>" +
        '<p class="verdict-text">' + verdict + "</p>" +
        '<p class="muted small">' + r.detail + "</p>" +
        (n
          ? '<div class="step-btns"><button class="btn ghost" type="button" data-step="-1">Previous flag</button><button class="btn" type="button" data-step="1">Next flag</button></div>'
          : '<p class="empty hand">Nothing flagged. Read it aloud once to be sure.</p>');
      return;
    }

    if (state.panel === "flags") {
      const list = flagged();
      panel.innerHTML =
        "<h2>Flags</h2>" +
        (state.filter ? '<p class="filter-note">Showing only: <b>' + esc(SIGNALS[state.filter].name) + '</b> <button class="link-btn" type="button" data-filter="">Show all</button></p>' : "") +
        (list.length
          ? '<ol class="notes">' + list.map(noteHtml).join("") + "</ol>"
          : '<p class="empty hand">' + (state.filter ? "No flags of that kind." : "Nothing stands out. Read it aloud once to be sure.") + "</p>");
      return;
    }

    if (state.panel === "signals") {
      const all = a.sentences.filter((s) => s.level > 0);
      const ids = Object.keys(SIGNALS) as SignalId[];
      panel.innerHTML =
        "<h2>Signals</h2><p class=\"muted small\">The patterns behind the red marks. Select one to show only those passages.</p>" +
        '<ul class="sig-list">' +
        ids
          .map((id) => {
            const n = all.filter((s) => s.signals.includes(id)).length;
            const on = state.filter === id;
            return (
              '<li><button type="button" class="sig' + (on ? " on" : "") + '" data-filter="' + id + '" aria-pressed="' + on + '"' + (n ? "" : " disabled") + ">" +
              '<span class="sig-top"><b>' + esc(SIGNALS[id].name) + '</b><span class="count' + (n ? " red" : "") + '">' + n + "</span></span>" +
              '<span class="sig-d">' + esc(SIGNALS[id].looksFor) + "</span></button></li>"
            );
          })
          .join("") +
        "</ul>" +
        (state.filter ? '<button class="btn ghost" type="button" data-filter="">Show all flags</button>' : "");
      return;
    }

    if (state.panel === "declare") {
      const tagged = a.sentences.filter(isTagged);
      panel.innerHTML =
        "<h2>Declare</h2>" +
        '<p class="muted small">Select any sentence on the page, or use "I used AI here" in Flags, to tag it. Tagged sentences go into your declaration.</p>' +
        (tagged.length
          ? '<ul class="tagged-list">' +
            tagged
              .map(
                (s) =>
                  '<li><span class="where">Paragraph ' + (s.para + 1) + ", sentence " + s.pos + '</span><p class="read">' + esc(s.text) +
                  '</p><button class="link-btn" type="button" data-tag="' + s.index + '">Remove tag</button></li>',
              )
              .join("") +
            "</ul>"
          : '<p class="empty hand">No sentences tagged yet.</p>') +
        '<a class="btn" href="#declare">Write my declaration</a>';
      return;
    }

    if (state.panel === "report") {
      panel.innerHTML =
        "<h2>Report</h2>" +
        '<p class="muted small">A plain-text summary of every red passage, with reasons. Paste it into your notes or send it to a tutor.</p>' +
        '<textarea id="report" class="out" readonly aria-label="Report text"></textarea>' +
        '<div class="out-actions"><button class="btn" type="button" data-copy="report">Copy report</button><span class="copied" id="report-msg" role="status"></span></div>';
      panel.querySelector<HTMLTextAreaElement>("#report")!.value = reportText();
      return;
    }

    const opt = (v: Sensitivity, name: string, d: string): string =>
      '<label class="choice"><input type="radio" name="sens" value="' + v + '"' + (state.sens === v ? " checked" : "") + '> <span><b>' + name + "</b><br><small>" + d + "</small></span></label>";
    panel.innerHTML =
      "<h2>Settings</h2>" +
      '<fieldset class="set"><legend>How strict should the reading be?</legend>' +
      opt("relaxed", "Relaxed", "Only clear cases are marked.") +
      opt("balanced", "Balanced", "The default.") +
      opt("strict", "Strict", "Marks anything with even one signal. Expect false alarms.") +
      "</fieldset>" +
      '<label class="choice"><input type="checkbox" id="show-marks"' + (state.showMarks ? " checked" : "") + '> <span><b>Show red marks</b><br><small>Turn off to read your draft clean.</small></span></label>' +
      '<p class="muted small">Supported files: ' + esc(SUPPORTED_LABEL) + ". Scans and photos of pages cannot be read.</p>";
  }

  function renderAll(): void {
    renderOverview();
    renderPaper();
    renderMenu();
    renderPanel();
  }

  /* ---------- actions ---------- */
  function read(): void {
    state.analysis = analyze(state.text, state.sens);
    const alive = new Set(state.analysis.sentences.map((s) => s.text));
    state.declared = new Set([...state.declared].filter((t) => alive.has(t)));
    state.editing = false;
    state.filter = null;
    state.cursor = -1;
    persist();
    renderAll();
  }

  function toggleTag(index: number, keep?: string): void {
    const s = state.analysis.sentences[index];
    if (!s) return;
    if (state.declared.has(s.text)) state.declared.delete(s.text);
    else state.declared.add(s.text);
    persist();
    renderAll();
    const sel = keep ?? '#paper .s[data-i="' + index + '"]';
    root.querySelector<HTMLElement>(sel)?.focus({ preventScroll: true });
  }

  function jump(index: number): void {
    const el = paper.querySelector<HTMLElement>('.s[data-i="' + index + '"]');
    if (!el) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    el.classList.remove("pulse");
    void el.offsetWidth;
    el.classList.add("pulse");
    el.focus({ preventScroll: true });
  }

  function setPanel(id: PanelId): void {
    state.panel = id;
    renderMenu();
    renderPanel();
  }

  async function loadFile(f: File): Promise<void> {
    dropMsg.textContent = "Reading " + f.name + "…";
    try {
      const text = await readFileText(f);
      state.text = text;
      state.sample = false;
      state.fileName = f.name;
      state.declared.clear();
      state.panel = "overview";
      read();
      const clipped = text.length >= MAX_TEXT_CHARS ? " Only the first " + MAX_TEXT_CHARS.toLocaleString("en") + " characters were used." : "";
      const n = state.analysis.sentences.filter((s) => s.level > 0).length;
      dropMsg.textContent = "Read " + f.name + ". " + n + " " + (n === 1 ? "sentence" : "sentences") + " flagged in red." + clipped;
    } catch (err) {
      dropMsg.textContent = err instanceof FileProblem ? err.message : "That file could not be opened. Paste the text in instead.";
    }
  }

  /* ---------- events ---------- */
  $<HTMLElement>("#read").addEventListener("click", () => {
    if (state.editing) {
      const ta = paper.querySelector<HTMLTextAreaElement>("#draft");
      if (ta) state.text = ta.value.slice(0, MAX_TEXT_CHARS);
    }
    read();
  });
  $<HTMLElement>("#edit").addEventListener("click", () => {
    if (state.editing) return;
    state.editing = true;
    renderAll();
  });
  $<HTMLElement>("#sample").addEventListener("click", () => {
    state.text = SAMPLE_TEXT;
    state.sample = true;
    state.fileName = "";
    state.declared.clear();
    dropMsg.textContent = "";
    read();
  });
  $<HTMLElement>("#clear").addEventListener("click", () => {
    state.text = "";
    state.sample = false;
    state.fileName = "";
    state.declared.clear();
    state.editing = true;
    state.analysis = analyze("", state.sens);
    dropMsg.textContent = "";
    persist();
    renderAll();
  });

  $<HTMLElement>("#open").addEventListener("click", () => fileInput.click());
  drop.addEventListener("click", () => fileInput.click());
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    fileInput.value = "";
    if (f) void loadFile(f);
  });

  // Drops anywhere on the page, so a missed target never makes the browser open the file instead.
  const hasFiles = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  let depth = 0;
  const onEnter = (e: DragEvent): void => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    drop.classList.add("over");
  };
  const onOver = (e: DragEvent): void => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const onLeave = (e: DragEvent): void => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) drop.classList.remove("over");
  };
  const onDrop = (e: DragEvent): void => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    drop.classList.remove("over");
    const files = e.dataTransfer?.files;
    if (!files || !files.length) return;
    void loadFile(files[0]!);
    if (files.length > 1) window.setTimeout(() => (dropMsg.textContent += " Only the first file was opened."), 0);
  };
  window.addEventListener("dragenter", onEnter);
  window.addEventListener("dragover", onOver);
  window.addEventListener("dragleave", onLeave);
  window.addEventListener("drop", onDrop);

  paper.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".s");
    if (el) toggleTag(Number(el.dataset["i"]));
  });
  paper.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if ((e.key === "Enter" || e.key === " ") && t.classList.contains("s")) {
      e.preventDefault();
      toggleTag(Number(t.dataset["i"]));
    }
  });
  overview.addEventListener("click", (e) => {
    const seg = (e.target as HTMLElement).closest<HTMLElement>(".seg");
    if (seg) jump(Number(seg.dataset["i"]));
  });

  menu.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-panel]");
    if (b) setPanel(b.dataset["panel"] as PanelId);
  });
  menu.addEventListener("keydown", (e) => {
    const keys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const ids = MENU.map((m) => m.id);
    let i = ids.indexOf(state.panel);
    if (e.key === "Home") i = 0;
    else if (e.key === "End") i = ids.length - 1;
    else i = (i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length;
    setPanel(ids[i]!);
    menu.querySelector<HTMLElement>("#tab-" + ids[i])?.focus();
  });

  panel.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const jumpBtn = t.closest<HTMLElement>("[data-jump]");
    const tagBtn = t.closest<HTMLElement>("[data-tag]");
    const filterBtn = t.closest<HTMLElement>("[data-filter]");
    const stepBtn = t.closest<HTMLElement>("[data-step]");
    const copyBtn = t.closest<HTMLElement>("[data-copy]");

    if (tagBtn) {
      toggleTag(Number(tagBtn.dataset["tag"]), '#panel [data-tag="' + tagBtn.dataset["tag"] + '"]');
    } else if (jumpBtn) {
      jump(Number(jumpBtn.dataset["jump"]));
    } else if (filterBtn) {
      const v = filterBtn.dataset["filter"] ?? "";
      state.filter = v && state.filter !== v ? (v as SignalId) : null;
      renderOverview();
      renderPaper();
      renderPanel();
      panel.querySelector<HTMLElement>(v ? '[data-filter="' + v + '"]' : "[data-filter]")?.focus({ preventScroll: true });
    } else if (stepBtn) {
      const list = flagged();
      if (!list.length) return;
      const dir = Number(stepBtn.dataset["step"]);
      state.cursor = (state.cursor + dir + list.length) % list.length;
      jump(list[state.cursor]!.index);
    } else if (copyBtn) {
      const ta = panel.querySelector<HTMLTextAreaElement>("#report")!;
      const msg = panel.querySelector<HTMLElement>("#report-msg")!;
      void copyText(ta.value, ta).then((ok) => {
        msg.textContent = ok ? "Copied" : "Selected. Use your keyboard to copy.";
      });
    }
  });
  panel.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === "sens") {
      state.sens = t.value as Sensitivity;
      saveSettings({ sens: state.sens, showMarks: state.showMarks });
      const keepTags = state.declared;
      state.analysis = analyze(state.text, state.sens);
      state.declared = keepTags;
      state.filter = null;
      state.cursor = -1;
      renderAll();
      panel.querySelector<HTMLElement>('input[name="sens"]:checked')?.focus({ preventScroll: true });
    } else if (t.id === "show-marks") {
      state.showMarks = t.checked;
      saveSettings({ sens: state.sens, showMarks: state.showMarks });
      renderOverview();
      renderPaper();
    }
  });

  renderAll();

  return () => {
    window.removeEventListener("dragenter", onEnter);
    window.removeEventListener("dragover", onOver);
    window.removeEventListener("dragleave", onLeave);
    window.removeEventListener("drop", onDrop);
  };
};
