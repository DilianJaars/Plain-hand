import type { Analysis, Level, Sensitivity, Sentence, SignalId } from "./types";

/** One place that describes every signal, used by the checker and by the About page. */
export const SIGNALS: Record<SignalId, { name: string; looksFor: string; tip: string }> = {
  opener: {
    name: "Stock openers",
    looksFor: "Sentences that start with filler like “Moreover”, “In conclusion” or “In today’s world”.",
    tip: "Cut the opener and begin with your actual point.",
  },
  vocab: {
    name: "Buzzwords",
    looksFor: "Words such as leverage, multifaceted, holistic, pivotal or foster, which people rarely say out loud.",
    tip: "Swap the buzzword for the plain word you would say to a friend.",
  },
  generic: {
    name: "Claims with no detail",
    looksFor: "Long sentences with no number, no name and nothing from your own experience.",
    tip: "Add one example from your own reading, lab or life.",
  },
  triple: {
    name: "Lists of three",
    looksFor: "Neat runs like “fast, flexible and reliable”, which generated text loves.",
    tip: "Do you need all three? Keep the one you can back up.",
  },
  notonly: {
    name: "Not only, but also",
    looksFor: "The “not only X but also Y” construction used to sound balanced.",
    tip: "Say the point once, directly.",
  },
  repeat: {
    name: "Same start, again",
    looksFor: "Neighbouring sentences that begin with the same word.",
    tip: "Start this one a different way.",
  },
  rhythm: {
    name: "Even rhythm",
    looksFor: "Three or more sentences in a row of almost exactly the same length.",
    tip: "Vary the length. Join two short sentences or split a long one.",
  },
  contrast: {
    name: "“It’s not X, it’s Y”",
    looksFor: "Reframes like “this isn’t just about cost, it’s about trust”, a favourite of chat assistants.",
    tip: "Skip the reframe and state what it is.",
  },
  tackon: {
    name: "Tacked-on “-ing” endings",
    looksFor: "A comma and then “highlighting”, “ensuring”, “fostering” or “underscoring” to add a grand ending.",
    tip: "End the sentence at the fact. Say the effect in its own sentence, only if it matters.",
  },
  hedge: {
    name: "Vague sources",
    looksFor: "“Experts say”, “studies show” or “many believe” with nobody named.",
    tip: "Name the source, or cut the claim.",
  },
  cliche: {
    name: "Ready-made phrases",
    looksFor: "Stock lines such as “plays a vital role”, “a testament to”, “paves the way” or “stands as”.",
    tip: "Replace it with the specific thing that happened.",
  },
  dashes: {
    name: "Dash-heavy sentences",
    looksFor: "Two or more long dashes in one sentence, used to bolt on extra thoughts.",
    tip: "Use a full stop or a comma. One dash is fine.",
  },
};

const TIP_ORDER: SignalId[] = ["opener", "vocab", "cliche", "contrast", "tackon", "hedge", "generic", "triple", "notonly", "dashes", "repeat", "rhythm"];

const CONTRAST_RE: RegExp[] = [
  /\b(is|are|was|were|isn['’]t|aren['’]t|wasn['’]t|weren['’]t)(n['’]t)? (not )?(just|merely|simply|only) (about |a |an |the )?[^.;,—-]{2,60}[,;—-]\s*(it|they|this|that)['’]?(s| is| are)\b/i,
  /\bit['’]s not (just |only |merely )?(about )?[^.;,—-]{2,60}[,;—-]\s*it['’]s\b/i,
  /\bnot (just|merely|simply) [^.;,—-]{2,60}[,;—-]\s*(but|it|they)\b/i,
];
const TACKON_RE = /,\s*(highlighting|underscoring|emphasi[sz]ing|ensuring|fostering|showcasing|reflecting|demonstrating|paving the way|contributing to|enabling|allowing for|promoting|reinforcing)\b/i;
const HEDGE_RE = /\b(experts (say|agree|believe|suggest)|studies (show|suggest|indicate|have shown)|research (shows|suggests|indicates|has shown)|many (people )?(believe|argue|say|feel)|it (can|could|may) be argued|some (argue|believe|say)|it is widely (believed|known|accepted)|it is (often|generally) (said|believed))\b/i;
const CLICHES: string[] = [
  "plays a (vital|crucial|key|significant|pivotal|important) role", "a testament to", "paves the way", "stands as", "serves as a",
  "at the end of the day", "in today['’]s (fast-paced|digital|modern|ever)", "a double-edged sword",
  "it goes without saying", "needless to say", "a deeper understanding", "in the ever", "continues to (evolve|shape)",
  "sheds light on", "a rich tapestry", "the key takeaway", "first and foremost",
];
const CLICHE_RES: RegExp[] = CLICHES.map((c) => new RegExp("\\b" + c, "i"));

const STOCK_OPENERS: RegExp[] = [
  /^in today['’]s\b/i,
  /^moreover\b/i,
  /^furthermore\b/i,
  /^additionally\b/i,
  /^in conclusion\b/i,
  /^overall,/i,
  /^ultimately\b/i,
  /^in essence\b/i,
  /^in summary\b/i,
  /^it is (important|worth|crucial|essential) to (note|mention|remember|recognize)/i,
  /^when it comes to\b/i,
  /^in the realm of\b/i,
];

const BUZZ_TERMS: string[] = [
  "delve", "tapestry", "multifaceted", "landscape", "realm", "pivotal", "crucial", "underscore",
  "testament", "foster", "leverage", "holistic", "nuanced", "intricate", "robust", "seamless",
  "comprehensive", "navigate", "paradigm", "myriad", "plethora", "ever-evolving", "rapidly evolving",
  "game-changer", "synergy", "cutting-edge", "shed light on", "a wide range of",
  "it is important to note", "it is worth noting",
];

const BUZZ: { term: string; re: RegExp }[] = BUZZ_TERMS.map((term) => ({
  term,
  re: new RegExp("\\b" + term.replace(/-/g, "[- ]"), "i"),
}));

const COMMON_STARTS = new Set(["the", "a", "an", "i", "it", "this", "that", "in", "on", "he", "she", "they", "we", "my", "there"]);

const SENTENCE_RE = /[^.!?]+[.!?]+["')\]”]*\s*|[^.!?]+$/g;

export function countWords(s: string): number {
  const m = s.trim().match(/\S+/g);
  return m ? m.length : 0;
}

function firstWord(s: string): string {
  const m = s.match(/^[A-Za-z'’-]+/);
  return m ? m[0].toLowerCase() : "";
}

/** Points a sentence needs to be "worth a look" and to "read machine-like". */
const CUTS: Record<Sensitivity, [number, number]> = { relaxed: [3, 5], balanced: [2, 4], strict: [1, 3] };

export function analyze(text: string, sens: Sensitivity = "balanced"): Analysis {
  const [lo, hi] = CUTS[sens];
  const rawParas = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const paragraphs: Sentence[][] = [];
  let globalIndex = 0;

  rawParas.forEach((p, paraNo) => {
    const pieces = (p.match(SENTENCE_RE) ?? [p]).map((t) => t.trim()).filter(Boolean);
    const sents: Sentence[] = pieces.map((t, i) => ({
      index: globalIndex++,
      para: paraNo,
      pos: i + 1,
      text: t,
      words: countWords(t),
      points: 0,
      level: 0,
      signals: [],
      reasons: [],
      flagNo: 0,
    }));

    const add = (s: Sentence, id: SignalId, pts: number, reason: string): void => {
      if (s.signals.includes(id)) return;
      s.signals.push(id);
      s.points += pts;
      s.reasons.push(reason);
    };

    sents.forEach((s, i) => {
      const t = s.text;
      const w = t.split(/\s+/);

      for (const re of STOCK_OPENERS) {
        const m = t.match(re);
        if (m) {
          add(s, "opener", 2, "Stock opener (“" + m[0].replace(/,$/, "") + "”)");
          break;
        }
      }

      const hits = BUZZ.filter((b) => b.re.test(t)).map((b) => b.term);
      if (hits.length) {
        s.signals.push("vocab");
        s.points += Math.min(3, hits.length);
        s.reasons.push("Buzzwords: " + hits.slice(0, 4).join(", "));
      }

      const hasDigit = /\d/.test(t);
      const firstPerson = /\b(my|me|our|I)\b/.test(t) || /\bI['’](m|ve|d|ll)\b/.test(t);
      const proper = w.slice(1).some((x) => /^[A-Z][a-z]+/.test(x));
      if (s.words >= 14 && !hasDigit && !firstPerson && !proper) {
        add(s, "generic", 1, "A general claim with no detail of your own");
      }

      if (CONTRAST_RE.some((re) => re.test(t))) add(s, "contrast", 2, "A “not just X, it’s Y” reframe");
      if (TACKON_RE.test(t)) add(s, "tackon", 1, "Ends with a tacked-on “-ing” clause");
      if (HEDGE_RE.test(t)) add(s, "hedge", 1, "A vague source with nobody named");
      const stock = CLICHE_RES.find((re) => re.test(t));
      if (stock) add(s, "cliche", 1, "A ready-made phrase (“" + (t.match(stock)?.[0] ?? "").toLowerCase() + "”)");
      if ((t.match(/—|\s–\s|\s--\s/g) ?? []).length >= 2) add(s, "dashes", 1, "Several long dashes in one sentence");

      if (/\b[\w-]+, [\w-]+,? and [\w-]+\b/i.test(t)) add(s, "triple", 1, "A tidy list of three");
      if (/\bnot (only|just) .+\bbut\b/i.test(t)) add(s, "notonly", 1, "A “not only … but” construction");

      if (i > 0) {
        const a = firstWord(t);
        const b = firstWord(sents[i - 1]!.text);
        if (a && a === b && !COMMON_STARTS.has(a)) {
          add(s, "repeat", 1, "Starts the same way as the sentence before");
          add(sents[i - 1]!, "repeat", 1, "Starts the same way as the sentence after");
        }
      }
    });

    for (let i = 0; i + 2 < sents.length; i++) {
      const win = [sents[i]!, sents[i + 1]!, sents[i + 2]!];
      const lens = win.map((x) => x.words);
      if (Math.min(...lens) >= 8) {
        const mean = (lens[0]! + lens[1]! + lens[2]!) / 3;
        const spread = Math.max(...lens) - Math.min(...lens);
        if (spread <= Math.max(2, mean * 0.15)) {
          win.forEach((x) => add(x, "rhythm", 1, "Same length and rhythm as the sentences around it"));
        }
      }
    }

    sents.forEach((s) => {
      s.level = (s.points >= hi ? 2 : s.points >= lo ? 1 : 0) as Level;
    });
    paragraphs.push(sents);
  });

  const sentences = paragraphs.flat();
  let n = 0;
  sentences.forEach((s) => {
    s.flagNo = s.level > 0 ? ++n : 0;
  });

  const totalWords = sentences.reduce((a, s) => a + s.words, 0);
  const flaggedWords = sentences.reduce((a, s) => a + (s.level > 0 ? s.words : 0), 0);
  const mean = sentences.length ? totalWords / sentences.length : 0;
  const variance = sentences.length ? sentences.reduce((a, s) => a + (s.words - mean) ** 2, 0) / sentences.length : 0;

  return {
    paragraphs,
    sentences,
    totalWords,
    flaggedWords,
    flaggedPct: totalWords ? Math.round((flaggedWords / totalWords) * 100) : 0,
    rhythmCv: mean ? Math.sqrt(variance) / mean : 0,
  };
}

/** Up to two plain-language nudges for a sentence, in a sensible order. */
export function tipsFor(s: Sentence): string[] {
  return TIP_ORDER.filter((id) => s.signals.includes(id))
    .slice(0, 2)
    .map((id) => SIGNALS[id].tip);
}

export function levelLabel(level: Level): string {
  return level === 2 ? "Reads machine-like" : level === 1 ? "Worth a look" : "Reads fine";
}

export function rhythmLabel(cv: number): { word: string; detail: string } {
  if (cv < 0.35) return { word: "Even", detail: "Sentences are close to the same length." };
  if (cv < 0.55) return { word: "Mixed", detail: "Some short and some long sentences." };
  return { word: "Varied", detail: "A natural mix of short and long." };
}
