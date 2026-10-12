export type SignalId = "opener" | "vocab" | "generic" | "triple" | "notonly" | "repeat" | "rhythm";

/** 0 = reads fine, 1 = worth a look, 2 = reads machine-like */
export type Level = 0 | 1 | 2;

export interface Sentence {
  /** position in the whole draft, starting at 0 */
  index: number;
  /** paragraph number, starting at 0 */
  para: number;
  /** position inside its paragraph, starting at 1 */
  pos: number;
  text: string;
  words: number;
  points: number;
  level: Level;
  signals: SignalId[];
  reasons: string[];
  /** 1-based number shown beside marked sentences, 0 when not marked */
  flagNo: number;
}

export interface Analysis {
  paragraphs: Sentence[][];
  sentences: Sentence[];
  totalWords: number;
  flaggedWords: number;
  flaggedPct: number;
  /** spread of sentence lengths: low means every sentence is about the same size */
  rhythmCv: number;
}

export interface DraftState {
  text: string;
  /** sentences the student tagged as AI-assisted, stored by their text so tags survive small edits */
  declared: string[];
  sample: boolean;
}

export interface DeclMeta {
  tool: string;
  purpose: string;
  course: string;
  mode: "used" | "none";
  style: "short" | "full";
}

export type Route = "home" | "check" | "declare" | "guide" | "about" | "dashboard" | "reviews" | "privacy" | "terms";

export type Sensitivity = "relaxed" | "balanced" | "strict";

export interface Settings {
  sens: Sensitivity;
  showMarks: boolean;
}
