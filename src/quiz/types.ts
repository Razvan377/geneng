/**
 * Question model shared by the quiz modes.
 *
 * Generators are pure functions `(seed) => Question`: the question, its correct answer and its
 * explanation are all derived from the seed, so any question can be replayed or shared.
 * Visuals are plain data; the UI decides how to draw them.
 */

import type { CloningSetup, DsEnd } from '../science/ends';
import type { GeneModel } from '../science/geneModel';

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
  | { type: 'agaroseTable'; highlight: number[]; target?: [number, number] }
  | { type: 'gene'; gene: GeneModel; markers: GeneMarker[]; show: { probe?: boolean; primers?: boolean; epitope?: boolean; sites?: boolean } }
  | {
      type: 'probeMap';
      length: number;
      sites: { enzyme: string; pos: number }[];
      /** Highlighted region: a probe, or a gene when `arrow` gives its direction of transcription. */
      probe: [number, number];
      regionLabel?: string;
      arrow?: 1 | -1;
    }
  | { type: 'vector'; name: string; size?: string; features: VectorFeature[]; mcs?: string }
  | { type: 'bars'; unit: string; bars: { label: string; value: number; error?: number }[]; reference?: number; caption?: string }
  | { type: 'blot'; look: BlotLook; unit: BlotUnit; ladder: number[]; lanes: BlotLaneData[]; caption?: string }
  | { type: 'table'; head: string[]; rows: string[][]; caption?: string }
  | {
      type: 'bimatrix';
      /** [row player, column player]. */
      players: [string, string];
      rows: string[];
      cols: string[];
      /** cells[r][c] = payoffs as text, one per player (strings so parameters like "a" or "y − α" work). */
      cells: string[][][];
      marks?: BimatrixMarks;
      /** Probability labels shown next to the strategy names, e.g. "x", "1 − x". */
      rowProbs?: string[];
      colProbs?: string[];
      caption?: string;
    }
  | {
      type: 'brPlot';
      xLabel: string;
      yLabel: string;
      xMax: number;
      yMax: number;
      xTicks: { at: number; label: string }[];
      yTicks: { at: number; label: string }[];
      /** Best-response curves as polylines in data coordinates. */
      series: { label: string; tone: 'teal' | 'coral'; points: [number, number][] }[];
      dots?: { x: number; y: number; label?: string }[];
      caption?: string;
    }
  | { type: 'stack'; items: Visual[] };

export interface BimatrixMarks {
  /** underline[r][c][i]: payoff i in cell (r, c) is a best response (the slides' underlining). */
  underline?: boolean[][][];
  struckRows?: number[];
  struckCols?: number[];
  /** Cells to ring (equilibria). */
  ring?: [number, number][];
}

export type BlotLook = 'film' | 'coomassie' | 'agarose';
export type BlotUnit = 'kb' | 'kDa';

export interface BlotLaneData {
  label: string;
  bands: { size: number; intensity?: number }[];
}

/** A labelled position (or span) on a gene drawing, e.g. where a variant hits. */
export interface GeneMarker {
  label: string;
  at: number;
  to?: number;
}

export interface VectorFeature {
  label: string;
  kind: 'promoter' | 'tag' | 'mcs' | 'marker' | 'ori' | 'terminator' | 'protease' | 'other';
}

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

/** "Draw the expected blot": the player enters the band sizes of every lane. */
export interface LanesQuestion extends QuestionBase {
  format: 'lanes';
  look: BlotLook;
  unit: BlotUnit;
  ladder: number[];
  lanes: { id: string; label: string }[];
  /** Expected band sizes per lane (in `unit`); [] = no band. */
  expected: number[][];
  /** Accepted relative error per band. */
  tolerance: number;
}

/** Assign each row (sample, aliquot…) to one of the options (lane, interpretation…). */
export interface MatchQuestion extends QuestionBase {
  format: 'match';
  rows: { id: string; label: string }[];
  options: { id: string; label: string }[];
  /** Accepted option ids for each row (more than one when two samples look identical). */
  correct: Record<string, string[]>;
}

export type SimpleQuestion = ChoiceQuestion | NumericQuestion | OrderQuestion | LanesQuestion | MatchQuestion;

/** A multi-part problem sharing one scenario: parts are answered one after another. */
export interface CaseQuestion extends QuestionBase {
  format: 'case';
  parts: SimpleQuestion[];
}

export type Question = SimpleQuestion | CaseQuestion;

export interface Grade {
  correct: boolean;
  /** 0–1, for partial credit (gel estimates, lanes, matches). */
  score: number;
  headline: string;
  /** Per-lane / per-row verdicts for lanes and match questions. */
  details?: boolean[];
}
