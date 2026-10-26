/** The standard genetic code, translation, and random coding sequence. */

import type { Rng } from './rng';

const BASES = 'TCAG';
const AMINO = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';

/** Codon (DNA, upper case) → one-letter amino acid; '*' = stop. */
export const CODON_TABLE: Record<string, string> = (() => {
  const t: Record<string, string> = {};
  let i = 0;
  for (const a of BASES) for (const b of BASES) for (const c of BASES) t[a + b + c] = AMINO[i++];
  return t;
})();

export const STOP_CODONS = ['TAA', 'TAG', 'TGA'];
export const SENSE_CODONS = Object.keys(CODON_TABLE).filter((c) => CODON_TABLE[c] !== '*');

/** Average mass of an amino acid residue used in the course problems. */
export const DALTONS_PER_AA = 110;

export function proteinKDa(aminoAcids: number): number {
  return (aminoAcids * DALTONS_PER_AA) / 1000;
}

/**
 * Translate from `start` until the first in-frame stop codon. Returns the peptide (without the
 * stop) and whether a stop was found before the sequence ran out.
 */
export function translateFrom(seq: string, start: number): { protein: string; stopped: boolean; stopAt: number } {
  let protein = '';
  for (let i = start; i + 3 <= seq.length; i += 3) {
    const aa = CODON_TABLE[seq.slice(i, i + 3)] ?? 'X';
    if (aa === '*') return { protein, stopped: true, stopAt: i };
    protein += aa;
  }
  return { protein, stopped: false, stopAt: -1 };
}

/** ATG + (codons − 2) random sense codons + a stop codon: an ORF of exactly `codons` codons. */
export function randomOrf(rng: Rng, codons: number): string {
  let s = 'ATG';
  for (let i = 0; i < codons - 2; i++) s += rng.pick(SENSE_CODONS);
  return s + rng.pick(STOP_CODONS);
}

/** Random sense codons, no stops (for in-frame insertions). */
export function randomSenseCodons(rng: Rng, codons: number): string {
  let s = '';
  for (let i = 0; i < codons; i++) s += rng.pick(SENSE_CODONS);
  return s;
}
