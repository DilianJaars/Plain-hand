import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = mkdtempSync(join(tmpdir(), "plainhand-test-"));

for (const name of ["analyzer", "declaration", "sample"]) {
  await build({
    entryPoints: [join(root, "src", name + ".ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: join(out, name + ".mjs"),
    logLevel: "silent",
  });
}
const { analyze } = await import(pathToFileURL(join(out, "analyzer.mjs")).href);
const { buildDeclaration, describeLocations } = await import(pathToFileURL(join(out, "declaration.mjs")).href);
const { SAMPLE_TEXT } = await import(pathToFileURL(join(out, "sample.mjs")).href);

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log("ok  " + name);
};

test("stock opener and buzzwords are marked", () => {
  const a = analyze("In today's rapidly evolving world, we must leverage a holistic and multifaceted approach.");
  const s = a.sentences[0];
  assert.ok(s.signals.includes("opener"));
  assert.ok(s.signals.includes("vocab"));
  assert.equal(s.level, 2);
});

test("a personal, specific sentence is left alone", () => {
  const a = analyze("On Tuesday my bus was 40 minutes late, so I read the chapter standing up.");
  assert.equal(a.sentences[0].level, 0);
  assert.equal(a.flaggedPct, 0);
});

test("repeated starts are marked on both neighbours", () => {
  const a = analyze("Additionally, trees give shade to the street. Additionally, roofs hold heat in the evening.");
  assert.ok(a.sentences[0].signals.includes("repeat"));
  assert.ok(a.sentences[1].signals.includes("repeat"));
});

test("even rhythm is detected across three sentences", () => {
  const a = analyze("The survey covered five different schools across the province. The results showed a very clear pattern in the funding. The pattern suggested a gap between rich and poor schools.");
  assert.ok(a.sentences.every((s) => s.signals.includes("rhythm")));
});

test("paragraph and position numbers are stable", () => {
  const a = analyze("One two three. Four five six.\n\nSeven eight nine.");
  assert.equal(a.paragraphs.length, 2);
  assert.deepEqual(a.sentences.map((s) => [s.para, s.pos]), [[0, 1], [0, 2], [1, 1]]);
});

test("sensitivity changes how much is marked", () => {
  const text = "In today's world, plenty of people use phones. I like my old radio and I keep it on the shelf above my desk.";
  const relaxed = analyze(text, "relaxed").sentences.filter((s) => s.level > 0).length;
  const strict = analyze(text, "strict").sentences.filter((s) => s.level > 0).length;
  assert.ok(strict >= relaxed);
  const t2 = "Moreover, a holistic approach is crucial. I walked home.";
  assert.ok(analyze(t2, "strict").sentences[0].level >= analyze(t2, "relaxed").sentences[0].level);
});

test("empty text gives an empty analysis", () => {
  const a = analyze("   \n\n  ");
  assert.equal(a.sentences.length, 0);
  assert.equal(a.flaggedPct, 0);
});

test("sample essay: machine paragraph marked, personal sentences not", () => {
  const a = analyze(SAMPLE_TEXT);
  assert.ok(a.flaggedPct > 20 && a.flaggedPct < 80, "flagged " + a.flaggedPct + "%");
  const personal = a.sentences.find((s) => s.text.startsWith("When I measured"));
  assert.equal(personal.level, 0);
});

test("locations are grouped into ranges", () => {
  const mk = (para, pos) => ({ para, pos });
  assert.equal(describeLocations([mk(1, 1), mk(1, 2), mk(1, 3), mk(2, 2)]), "paragraph 2, sentences 1–3; paragraph 3, sentence 2");
});

test("declaration: none, short and full", () => {
  const base = { tool: "ChatGPT", purpose: "outlining", course: "ENG 201", tagged: [], totalSentences: 10, date: new Date("2026-10-12T10:00:00Z") };
  assert.match(buildDeclaration({ ...base, used: false, style: "short" }), /did not use AI/);
  const tagged = [{ para: 0, pos: 2 }, { para: 0, pos: 3 }];
  const short = buildDeclaration({ ...base, used: true, style: "short", tagged });
  assert.match(short, /ENG 201/);
  assert.match(short, /2 of 10 sentences/);
  const full = buildDeclaration({ ...base, used: true, style: "full", tagged });
  assert.match(full, /Date: 2026-10-12/);
});

test("declaration with placeholders when fields are empty", () => {
  const d = buildDeclaration({ used: true, tool: "", purpose: "", course: "", style: "short", tagged: [{ para: 0, pos: 1 }], totalSentences: 3, date: new Date() });
  assert.match(d, /\[tool name\]/);
});

console.log("\n" + passed + " tests passed");
