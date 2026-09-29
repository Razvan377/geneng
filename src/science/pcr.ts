/**
 * PCR calculations (Brown ch. 9): Wallace-rule Tm, annealing temperature, primer quality checks,
 * amplification, product sequence and cloning-primer design.
 */

import { atCount, gcCount, gcFraction, reverseComplement } from './dna';
import { getEnzyme } from './enzymes';

/** Wallace rule: Tm = 4·(G+C) + 2·(A+T) °C, valid for short oligonucleotides. */
export function wallaceTm(primer: string): number {
  return 4 * gcCount(primer) + 2 * atCount(primer);
}

/** Brown: anneal 1–2 °C below the Tm; the course uses Tm − 2 °C. */
export const ANNEALING_OFFSET = 2;

export function annealingTemp(tm: number): number {
  return tm - ANNEALING_OFFSET;
}

/** Expected spacing of a given n-mer in random sequence: 4^n bp. */
export function expectedSpacing(n: number): number {
  return 4 ** n;
}

/** Expected number of chance matches for an n-mer in a genome of the given size (one strand). */
export function expectedOccurrences(n: number, genomeBp: number): number {
  return genomeBp / 4 ** n;
}

/** Copies of the target after n cycles, assuming perfect doubling. */
export function copiesAfterCycles(cycles: number, startCopies = 1): number {
  return startCopies * 2 ** cycles;
}

// ---------------------------------------------------------------------------------------------
// Primer quality

export const HUMAN_GENOME_BP = 3.2e9; // Brown §9.2.1: "3 200 000 kb"

export const PRIMER_RULES = {
  maxTmDifference: 5,
  minGc: 0.4,
  maxGc: 0.6,
  /** Complementary stretch (nt) at a 3′ end that counts as a hairpin / dimer risk. */
  maxComplementarity: 3,
} as const;

export type PrimerIssue = 'tm-mismatch' | 'gc-content' | 'no-gc-clamp' | 'self-complementary' | 'primer-dimer' | 'too-short';

export const PRIMER_ISSUE_LABEL: Record<PrimerIssue, string> = {
  'tm-mismatch': 'Tm values differ by more than 5 °C',
  'gc-content': 'GC content outside 40–60%',
  'no-gc-clamp': '3′ end is not G or C',
  'self-complementary': 'Self-complementary (hairpin / self-dimer)',
  'primer-dimer': 'The two primers anneal to each other (primer-dimer)',
  'too-short': 'Too short to be specific',
};

/**
 * Longest k such that the last k bases of `a` could base-pair with some stretch of `b`
 * (i.e. reverseComplement(3′ k-mer of a) occurs in b). That is what lets the 3′ end prime on
 * the wrong template: b = a gives self-priming / hairpins, b = the partner gives primer-dimers.
 */
export function threePrimeComplementarity(a: string, b: string): number {
  let best = 0;
  for (let k = 1; k <= a.length; k++) {
    if (b.includes(reverseComplement(a.slice(-k)))) best = k;
    else break;
  }
  return best;
}

export function selfComplementarity(primer: string): number {
  return threePrimeComplementarity(primer, primer);
}

export function dimerComplementarity(a: string, b: string): number {
  return Math.max(threePrimeComplementarity(a, b), threePrimeComplementarity(b, a));
}

/** Shortest primer expected to occur only once in the genome: 4^n > genome size. */
export function minSpecificLength(genomeBp: number): number {
  let n = 1;
  while (4 ** n <= genomeBp) n++;
  return n;
}

export interface PrimerStats {
  seq: string;
  length: number;
  gc: number;
  tm: number;
  clamp: boolean;
  self: number;
  /** Expected chance matches in the genome. */
  occurrences: number;
}

export interface PrimerPairAnalysis {
  forward: PrimerStats;
  reverse: PrimerStats;
  tmDifference: number;
  dimer: number;
  issues: PrimerIssue[];
  /** One explanatory sentence per issue (and per primer where relevant). */
  notes: string[];
}

function stats(seq: string, genomeBp: number): PrimerStats {
  return {
    seq,
    length: seq.length,
    gc: gcFraction(seq),
    tm: wallaceTm(seq),
    clamp: /[GC]$/.test(seq),
    self: selfComplementarity(seq),
    occurrences: expectedOccurrences(seq.length, genomeBp),
  };
}

export function analyzePrimerPair(forward: string, reverse: string, genomeBp = HUMAN_GENOME_BP): PrimerPairAnalysis {
  const f = stats(forward, genomeBp);
  const r = stats(reverse, genomeBp);
  const both: [string, PrimerStats][] = [
    ['forward', f],
    ['reverse', r],
  ];
  const issues = new Set<PrimerIssue>();
  const notes: string[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  const tmDifference = Math.abs(f.tm - r.tm);
  if (tmDifference > PRIMER_RULES.maxTmDifference) {
    issues.add('tm-mismatch');
    notes.push(
      `Tm forward = ${f.tm} °C, reverse = ${r.tm} °C: they differ by ${tmDifference} °C. No single annealing temperature suits both primers.`,
    );
  }
  for (const [name, p] of both) {
    if (p.gc < PRIMER_RULES.minGc || p.gc > PRIMER_RULES.maxGc) {
      issues.add('gc-content');
      notes.push(`The ${name} primer is ${pct(p.gc)} GC (${gcCount(p.seq)}/${p.length}); aim for 40–60%.`);
    }
  }
  for (const [name, p] of both) {
    if (!p.clamp) {
      issues.add('no-gc-clamp');
      notes.push(
        `The ${name} primer ends in ${p.seq.slice(-1)} at its 3′ end. A G or C there (a "GC clamp") pairs with three hydrogen bonds and helps the polymerase start extension.`,
      );
    }
  }
  for (const [name, p] of both) {
    if (p.self > PRIMER_RULES.maxComplementarity) {
      issues.add('self-complementary');
      notes.push(
        `The last ${p.self} bases of the ${name} primer (${p.seq.slice(-p.self)}) are complementary to part of the same primer, so it can fold into a hairpin or pair with another copy of itself.`,
      );
    }
  }
  const dimer = dimerComplementarity(forward, reverse);
  if (dimer > PRIMER_RULES.maxComplementarity) {
    issues.add('primer-dimer');
    notes.push(
      `The last ${dimer} nt at the 3′ end of one primer are complementary to the other primer: they can anneal to each other and be extended into primer-dimers.`,
    );
  }
  for (const [name, p] of both) {
    if (p.occurrences >= 1) {
      issues.add('too-short');
      notes.push(
        `The ${name} primer has only ${p.length} nt: expected once every 4^${p.length} = ${fmtBig(4 ** p.length)} bp, i.e. about ${fmtBig(p.occurrences)} chance sites in ${fmtBig(genomeBp)} bp. It needs at least ${minSpecificLength(genomeBp)} nt to be unique.`,
      );
    }
  }
  return { forward: f, reverse: r, tmDifference, dimer, issues: [...issues], notes };
}

function fmtBig(n: number): string {
  if (n < 1e5) return String(Math.round(n));
  const exp = Math.floor(Math.log10(n));
  return `${(n / 10 ** exp).toFixed(2)}×10^${exp}`;
}

// ---------------------------------------------------------------------------------------------
// Product and primer design

export interface PcrProduct {
  /** 0-based start (inclusive) and end (exclusive) on the template top strand. */
  start: number;
  end: number;
  sequence: string;
  length: number;
}

/**
 * Product amplified from a double-stranded template (given as its top strand, 5′→3′).
 * The forward primer matches the top strand; the reverse primer matches the bottom strand, so its
 * reverse complement is what appears in the top strand at the right-hand end of the product.
 */
export function pcrProduct(template: string, forward: string, reverse: string): PcrProduct | null {
  const start = template.indexOf(forward);
  const rcReverse = reverseComplement(reverse);
  const rcPos = template.indexOf(rcReverse, Math.max(0, start));
  if (start < 0 || rcPos < 0) return null;
  const end = rcPos + rcReverse.length;
  if (end <= start + forward.length) return null;
  return { start, end, sequence: template.slice(start, end), length: end - start };
}

export interface CloningPrimers {
  forward: string;
  reverse: string;
  /** Parts, 5′→3′, for highlighting. */
  forwardParts: { extra: string; site: string; anneal: string };
  reverseParts: { extra: string; site: string; anneal: string };
}

/**
 * Primers that add restriction sites to the ends of a target region: 5′-extra-site-annealing-3′.
 * The extra bases give the enzyme something to hold on to (sites right at a DNA end cut poorly).
 */
export function designCloningPrimers(
  template: string,
  targetStart: number,
  targetEnd: number,
  forwardEnzyme: string,
  reverseEnzyme: string,
  annealLength = 18,
  extra = 'GCGC',
): CloningPrimers {
  const fAnneal = template.slice(targetStart, targetStart + annealLength);
  const rAnneal = reverseComplement(template.slice(targetEnd - annealLength, targetEnd));
  const fSite = getEnzyme(forwardEnzyme).site;
  const rSite = getEnzyme(reverseEnzyme).site;
  return {
    forward: extra + fSite + fAnneal,
    reverse: extra + rSite + rAnneal,
    forwardParts: { extra, site: fSite, anneal: fAnneal },
    reverseParts: { extra, site: rSite, anneal: rAnneal },
  };
}
