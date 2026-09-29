/**
 * Question model shared by the quiz modes (ends, PCR, gels, numbers).
 *
 * Generators are pure functions `(seed) => Question`: the question, its correct answer and its
 * explanation are all derived from the seed, so any question can be replayed or shared.
 * Visuals are plain data; the UI decides how to draw them.
 */

import type { CloningSetup, DsEnd } from '../science/ends';

export type Tone = 'teal' | 'coral' | 'amber' | 'muted';

export interface Highlight {
  from: number;
  to: number;
  tone: Tone;
  label?: string;
}

export interface SeqRow {
  label?: string;
  seq: string;
  /** Show 5′/3′ labels at the ends (row is 5′→3′ unless `reversed`). */
  primes?: boolean;
  /** Row is written 3′→5′ (e.g. a bottom strand). */
  reversed?: boolean;
  /** Leading columns of padding (to align strands). */
  offset?: number;
  highlights?: Highlight[];
}

export type Visual =
  | { type: 'ends'; ends: DsEnd[]; captions?: string[]; dephosphorylated?: boolean; gap?: boolean }
  | { type: 'sites'; enzymes: string[] }
  | { type: 'cloning'; setup: CloningSetup }
  | { type: 'sequence'; rows: SeqRow[]; wrap?: boolean }
  | { type: 'facts'; rows: [string, string][] }
  | {
      type: 'gelReading';
      percent: number;
      ladderId: string;
      ladderMm: number[];
      unknownMm: number;
      unknownBp: number;
      runMm: number;
    }
  | {
      type: 'standardCurve';
      ladderSizes: number[];
      ladderMm: number[];
      /** Which ladder points lie in the linear range (used for the fit). */
      inRange: boolean[];
      unknownMm: number;
      unknownBp: number;
    }
  | { type: 'agaroseTable'; highlight: number[]; target?: [number, number] };

export interface QuestionBase {
  /** Stats key, e.g. "ends.recut". */
  kind: string;
  seed: string;
  prompt: string;
  /** Optional sub-prompt shown under the visual. */
  detail?: string;
  visual?: Visual;
  /** Drawn only after answering (e.g. the standard curve). */
  revealVisual?: Visual;
  /** Teaching explanation, one paragraph per entry. `code` spans are rendered monospace. */
  explanation: string[];
}

export interface ChoiceOption {
  id: string;
  label: string;
  mono?: boolean;
  /** Why this option is right/wrong, shown after answering. */
  note?: string;
}

export interface ChoiceQuestion extends QuestionBase {
  format: 'choice';
  options: ChoiceOption[];
  correct: string[];
  /** Several options may be correct; `exclusive` options (e.g. "none") clear the others. */
  multi?: boolean;
  exclusive?: string[];
}

export interface NumericQuestion extends QuestionBase {
  format: 'numeric';
  answer: number;
  unit: string;
  /** Accepted relative error (0.02 = ±2%). */
  tolerance: number;
  /** Accepted absolute error, used instead of/in addition to the relative one. */
  absTolerance?: number;
  /** How the answer is shown, e.g. "4.6 × 10⁵ clones". */
  answerLabel: string;
  /** 'gel' = graded by closeness in log space (size estimates). */
  grading?: 'tolerance' | 'gel';
  placeholder?: string;
}

export interface OrderQuestion extends QuestionBase {
  format: 'order';
  items: { id: string; label: string; detail?: string }[];
  /** Item ids in the correct order. */
  correct: string[];
}

export type Question = ChoiceQuestion | NumericQuestion | OrderQuestion;

export interface Grade {
  correct: boolean;
  /** 0–1, for partial credit (gel estimates). */
  score: number;
  headline: string;
}
