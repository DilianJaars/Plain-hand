import type { Sentence } from "./types";

export interface DeclInput {
  used: boolean;
  tool: string;
  purpose: string;
  course: string;
  style: "short" | "full";
  /** the sentences the student tagged */
  tagged: Sentence[];
  totalSentences: number;
  date: Date;
}

/** "paragraph 2, sentences 1–3; paragraph 3, sentence 2" */
export function describeLocations(tagged: Sentence[]): string {
  const byPara = new Map<number, number[]>();
  tagged.forEach((s) => {
    const list = byPara.get(s.para) ?? [];
    list.push(s.pos);
    byPara.set(s.para, list);
  });

  const parts: string[] = [];
  [...byPara.keys()]
    .sort((a, b) => a - b)
    .forEach((para) => {
      const pos = [...new Set(byPara.get(para) ?? [])].sort((a, b) => a - b);
      const runs: string[] = [];
      let start = pos[0]!;
      let prev = pos[0]!;
      for (let i = 1; i <= pos.length; i++) {
        if (pos[i] === prev + 1) {
          prev = pos[i]!;
          continue;
        }
        runs.push(start === prev ? String(start) : start + "–" + prev);
        start = pos[i]!;
        prev = pos[i]!;
      }
      parts.push("paragraph " + (para + 1) + ", sentence" + (pos.length > 1 ? "s " : " ") + runs.join(", "));
    });
  return parts.join("; ");
}

export function buildDeclaration(i: DeclInput): string {
  const day = i.date.toISOString().slice(0, 10);
  const course = i.course.trim();
  const head = "AI use declaration" + (course ? " for " + course : "");

  if (!i.used) {
    return head + "\n\nI did not use AI tools to write or edit any part of this work. Date: " + day + ".";
  }

  const tool = i.tool.trim() || "[tool name]";
  const purpose = i.purpose.trim() || "[what you used it for]";

  if (!i.tagged.length) {
    return head + "\n\nTool: " + tool + "\nUsed for: " + purpose + "\n\nTag the AI-assisted sentences in Check so this statement can say exactly where they are.";
  }

  const where = describeLocations(i.tagged);
  const count = i.tagged.length + " of " + i.totalSentences + " sentences";

  if (i.style === "short") {
    return (
      head + "\n\nI used " + tool + " for this work: " + purpose + ". It affected " + count + " (" + where + "). " +
      "I reviewed those passages and the final wording is my responsibility."
    );
  }

  return [
    head,
    "",
    "Tool: " + tool,
    "Used for: " + purpose,
    "Passages affected: " + count,
    "Where: " + where,
    "Date: " + day,
    "",
    "I reviewed every affected passage, checked its claims, and take responsibility for the final work.",
  ].join("\n");
}
