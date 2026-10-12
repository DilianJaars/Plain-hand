import type { Mount } from "../router";
import type { DeclMeta } from "../types";
import { analyze } from "../analyzer";
import { buildDeclaration } from "../declaration";
import { copyText, esc } from "../format";
import { loadDraft, loadMeta, saveDraft, saveMeta } from "../storage";

export const mount: Mount = (root) => {
  const draft = loadDraft();
  const meta: DeclMeta = loadMeta();
  const analysis = analyze(draft.text);
  let declared = new Set(draft.declared);
  let timer = 0;

  if (!analysis.sentences.length) {
    root.innerHTML =
      '<section class="page"><div class="wrap narrow"><header class="page-head"><h1>Declare AI use</h1>' +
      '<p class="lead">There is no draft to declare yet. Check one first, tag any sentences AI helped with, and come back here.</p></header>' +
      '<a class="btn" href="#check">Go to Check</a></div></section>';
    return;
  }

  root.innerHTML = `
  <section class="page">
    <div class="wrap">
      <header class="page-head">
        <h1>Declare AI use</h1>
        <p class="lead">A short statement for your marker, built from the sentences you tagged. Check your course's AI policy for the wording it wants and edit the result to match.</p>
      </header>

      <div class="decl-grid">
        <form class="decl-form" id="form" autocomplete="off">
          <fieldset>
            <legend>Did you use AI on this work?</legend>
            <label class="choice"><input type="radio" name="mode" value="used"> <span>Yes, for some of it</span></label>
            <label class="choice"><input type="radio" name="mode" value="none"> <span>No, all of it is mine</span></label>
          </fieldset>

          <div id="details">
            <div class="field"><label for="tool">Tool</label><input id="tool" type="text" placeholder="ChatGPT, Claude, Copilot"></div>
            <div class="field"><label for="purpose">What you used it for</label><input id="purpose" type="text" placeholder="suggested a structure for paragraph 2"></div>
            <fieldset>
              <legend>Length</legend>
              <label class="choice"><input type="radio" name="style" value="short"> <span>Short paragraph</span></label>
              <label class="choice"><input type="radio" name="style" value="full"> <span>Itemised</span></label>
            </fieldset>
          </div>
          <div class="field"><label for="course">Course or assignment <small>(optional)</small></label><input id="course" type="text" placeholder="ENG 201, essay 2"></div>
        </form>

        <div class="decl-out">
          <div class="card">
            <h2>Your statement</h2>
            <textarea id="out" class="out" readonly aria-label="Declaration text"></textarea>
            <div class="out-actions">
              <button class="btn" id="copy" type="button">Copy statement</button>
              <span class="copied" id="copied" role="status"></span>
            </div>
          </div>

          <div class="card" id="tagged-card">
            <h2>Sentences you tagged</h2>
            <ul class="tagged-list" id="tagged-list"></ul>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  const $ = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const out = $<HTMLTextAreaElement>("#out");
  const tool = $<HTMLInputElement>("#tool");
  const purpose = $<HTMLInputElement>("#purpose");
  const course = $<HTMLInputElement>("#course");
  const details = $<HTMLElement>("#details");
  const list = $<HTMLElement>("#tagged-list");
  const taggedCard = $<HTMLElement>("#tagged-card");
  const modeInputs = root.querySelectorAll<HTMLInputElement>('input[name="mode"]');
  const styleInputs = root.querySelectorAll<HTMLInputElement>('input[name="style"]');

  tool.value = meta.tool;
  purpose.value = meta.purpose;
  course.value = meta.course;
  if (declared.size && meta.mode === "none") meta.mode = "used";
  modeInputs.forEach((i) => (i.checked = i.value === meta.mode));
  styleInputs.forEach((i) => (i.checked = i.value === meta.style));

  const tagged = () => analysis.sentences.filter((s) => declared.has(s.text));

  function renderList(): void {
    const t = tagged();
    taggedCard.hidden = meta.mode === "none";
    list.innerHTML = t.length
      ? t
          .map(
            (s) =>
              '<li><span class="where">Paragraph ' + (s.para + 1) + ", sentence " + s.pos + '</span><p class="read">' + esc(s.text) +
              '</p><button class="link-btn" type="button" data-untag="' + s.index + '">Remove tag</button></li>',
          )
          .join("")
      : '<li class="muted">None yet. Go to <a href="#check">Check</a> and select the sentences AI helped with.</li>';
  }

  function render(): void {
    details.hidden = meta.mode === "none";
    out.value = buildDeclaration({
      used: meta.mode === "used",
      tool: meta.tool,
      purpose: meta.purpose,
      course: meta.course,
      style: meta.style,
      tagged: tagged(),
      totalSentences: analysis.sentences.length,
      date: new Date(),
    });
    renderList();
  }

  modeInputs.forEach((i) =>
    i.addEventListener("change", () => {
      if (i.checked) {
        meta.mode = i.value as DeclMeta["mode"];
        saveMeta(meta);
        render();
      }
    }),
  );
  styleInputs.forEach((i) =>
    i.addEventListener("change", () => {
      if (i.checked) {
        meta.style = i.value as DeclMeta["style"];
        saveMeta(meta);
        render();
      }
    }),
  );
  [
    [tool, "tool"],
    [purpose, "purpose"],
    [course, "course"],
  ].forEach(([el, key]) =>
    (el as HTMLInputElement).addEventListener("input", () => {
      meta[key as "tool" | "purpose" | "course"] = (el as HTMLInputElement).value;
      saveMeta(meta);
      render();
    }),
  );

  list.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-untag]");
    if (!b) return;
    const s = analysis.sentences[Number(b.dataset["untag"])];
    if (!s) return;
    declared = new Set([...declared].filter((t) => t !== s.text));
    saveDraft({ ...draft, declared: [...declared] });
    render();
  });

  $<HTMLElement>("#copy").addEventListener("click", () => {
    const msg = $<HTMLElement>("#copied");
    void copyText(out.value, out).then((ok) => {
      msg.textContent = ok ? "Copied" : "Selected. Use your keyboard to copy.";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (msg.textContent = ""), 2400);
    });
  });

  render();
  return () => window.clearTimeout(timer);
};
