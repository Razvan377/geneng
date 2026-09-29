/** Basic nucleotide-sequence utilities. Sequences are upper-case strings, written 5′→3′. */

import type { Rng } from './rng';

const COMPLEMENT: Record<string, string> = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
  N: 'N',
  R: 'Y', // puRine ↔ pYrimidine
  Y: 'R',
};

/** Base-by-base complement, same direction (use for drawing the bottom strand 3′→5′). */
export function complement(seq: string): string {
  let out = '';
  for (const b of seq.toUpperCase()) {
    const c = COMPLEMENT[b];
    if (!c) throw new Error(`Not a nucleotide: "${b}"`);
    out += c;
  }
  return out;
}

export function reverse(seq: string): string {
  return seq.split('').reverse().join('');
}

/** The other strand, read 5′→3′. */
export function reverseComplement(seq: string): string {
  return reverse(complement(seq));
}

/** A recognition site is palindromic when both strands read the same 5′→3′. */
export function isPalindrome(seq: string): boolean {
  return seq.toUpperCase() === reverseComplement(seq);
}

export function gcCount(seq: string): number {
  let n = 0;
  for (const b of seq.toUpperCase()) if (b === 'G' || b === 'C') n++;
  return n;
}

export function atCount(seq: string): number {
  let n = 0;
  for (const b of seq.toUpperCase()) if (b === 'A' || b === 'T') n++;
  return n;
}

/** G+C as a fraction of the length (0–1). */
export function gcFraction(seq: string): number {
  return seq.length === 0 ? 0 : gcCount(seq) / seq.length;
}

/** All (possibly overlapping) start indices of `needle` in `haystack`. */
export function findAll(haystack: string, needle: string): number[] {
  const hits: number[] = [];
  if (!needle) return hits;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    hits.push(i);
    i = haystack.indexOf(needle, i + 1);
  }
  return hits;
}

const BASES = ['A', 'C', 'G', 'T'] as const;

/** Random sequence; `gc` is the probability of each base being G or C. */
export function randomSequence(rng: Rng, length: number, gc = 0.5): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += rng.chance(gc) ? rng.pick(['G', 'C']) : rng.pick(['A', 'T']);
  }
  return out;
}

/** Random sequence that does not contain any of the forbidden motifs (on either strand). */
export function randomSequenceAvoiding(
  rng: Rng,
  length: number,
  forbidden: readonly string[],
  gc = 0.5,
  maxTries = 500,
): string {
  const motifs = forbidden.flatMap((m) => [m, reverseComplement(m)]);
  for (let t = 0; t < maxTries; t++) {
    const seq = randomSequence(rng, length, gc);
    if (motifs.every((m) => !seq.includes(m))) return seq;
  }
  throw new Error('randomSequenceAvoiding: could not avoid motifs');
}

export function randomBase(rng: Rng): string {
  return rng.pick(BASES);
}
