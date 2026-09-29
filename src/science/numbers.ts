/**
 * Everyday lab numbers: site frequency, enzyme units, A260 quantification, library coverage
 * (Clarke–Carbon) and vector capacities. Plus a forgiving number parser for answers typed by
 * students (decimal commas, "1.07x10^9", "4,6·10⁵", …).
 */

/** Average spacing of an n-bp recognition site in random sequence (Brown §4.2.9): 4^n. */
export function siteSpacing(n: number): number {
  return 4 ** n;
}

export function expectedSites(genomeBp: number, n: number): number {
  return genomeBp / 4 ** n;
}

// ---------------------------------------------------------------------------------------------
// Restriction enzyme units (Brown §4.2.6: 1 unit cuts 1 µg of DNA in 1 hour)

export interface EnzymeAmount {
  units: number;
  volumeUl: number;
}

export function enzymeAmount(dnaUg: number, unitsPerUl: number, hours = 1): EnzymeAmount {
  const units = dnaUg / hours;
  return { units, volumeUl: units / unitsPerUl };
}

// ---------------------------------------------------------------------------------------------
// UV quantification (Brown §3.1.5)

export type NucleicAcid = 'dsDNA' | 'RNA' | 'ssDNA';

/** µg/ml giving A260 = 1.0 in a 1 cm cuvette. */
export const A260_FACTOR: Record<NucleicAcid, number> = { dsDNA: 50, RNA: 40, ssDNA: 33 };

export const NUCLEIC_ACID_LABEL: Record<NucleicAcid, string> = {
  dsDNA: 'double-stranded DNA',
  RNA: 'RNA',
  ssDNA: 'single-stranded DNA',
};

/** Concentration of the undiluted sample in µg/ml. `dilution` is the dilution factor (e.g. 20 for 1:20). */
export function concentrationFromA260(a260: number, type: NucleicAcid, dilution = 1): number {
  return a260 * A260_FACTOR[type] * dilution;
}

export type PurityVerdict = 'pure-dna' | 'contaminated' | 'rna';

/** Pure DNA: A260/A280 ≈ 1.8; lower means protein or phenol; ≈ 2.0 suggests RNA. */
export function purityVerdict(ratio: number): PurityVerdict {
  if (ratio < 1.7) return 'contaminated';
  if (ratio <= 1.9) return 'pure-dna';
  return 'rna';
}

export const PURITY_LABEL: Record<PurityVerdict, string> = {
  'pure-dna': 'Pure DNA (≈ 1.8)',
  contaminated: 'Contaminated with protein or phenol (< 1.8)',
  rna: 'RNA present (≈ 2.0)',
};

// ---------------------------------------------------------------------------------------------
// Genomic library size (Clarke & Carbon; Brown §6.2.6)

/**
 * Number of clones needed so that any given sequence is present with probability P:
 * N = ln(1 − P) / ln(1 − f), f = insert size / genome size.
 */
export function clarkeCarbon(probability: number, insertBp: number, genomeBp: number): number {
  const f = insertBp / genomeBp;
  return Math.log(1 - probability) / Math.log(1 - f);
}

/** The inverse: probability that a given sequence is in a library of N clones. */
export function coverageProbability(clones: number, insertBp: number, genomeBp: number): number {
  const f = insertBp / genomeBp;
  return 1 - (1 - f) ** clones;
}

// ---------------------------------------------------------------------------------------------
// Vector capacities (course slides)

export interface VectorCapacity {
  id: string;
  name: string;
  minBp: number;
  maxBp: number;
  range: string;
}

/** In increasing order of capacity. */
export const VECTOR_CAPACITIES: readonly VectorCapacity[] = [
  { id: 'lambda-insertion', name: 'λ insertion vector', minBp: 0, maxBp: 8000, range: 'up to ~8 kb' },
  { id: 'plasmid', name: 'Plasmid', minBp: 0, maxBp: 10000, range: 'up to ~10 kb' },
  { id: 'lambda-replacement', name: 'λ replacement vector', minBp: 9000, maxBp: 23000, range: '9–23 kb' },
  { id: 'cosmid', name: 'Cosmid', minBp: 35000, maxBp: 45000, range: '35–45 kb' },
  { id: 'bac', name: 'BAC', minBp: 100000, maxBp: 300000, range: '100–300 kb' },
  { id: 'yac', name: 'YAC', minBp: 200000, maxBp: 2000000, range: '0.2–2 Mb' },
];

/** Vectors whose usual insert range includes the given size. */
export function vectorsFor(insertBp: number): VectorCapacity[] {
  return VECTOR_CAPACITIES.filter((v) => insertBp >= v.minBp && insertBp <= v.maxBp);
}

// ---------------------------------------------------------------------------------------------
// Parsing and grading typed answers

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
  '⁺': '+',
};

function parseMantissa(raw: string): number | null {
  let s = raw.replace(/[\s  ']/g, '');
  if (!s) return null;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // "1,234.5" → comma is a thousands separator; "1.234,5" → European style.
    s = s.lastIndexOf('.') > s.lastIndexOf(',') ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    s = /^[+-]?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return Number(s);
}

/**
 * Accepts "4096", "4 096", "65,536", "0,5", "1.07e9", "1.07E+9", "1.07x10^9", "1.07 × 10⁹",
 * "4,6·10^5", "10^9", "2^30" is NOT accepted (answers are numbers, not expressions).
 */
export function parseNumber(input: string): number | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => '^' + [...m].map((c) => SUPERSCRIPT_DIGITS[c]).join(''));
  s = s.replace(/\s+/g, ' ');

  const sci = s.match(/^(.*?)\s*(?:[x×*·]\s*)?10\s*\^\s*\(?([+-]?\d+)\)?$/);
  if (sci) {
    const mantissaText = sci[1].replace(/[x×*·]\s*$/, '').trim();
    const mantissa = mantissaText === '' ? 1 : parseMantissa(mantissaText);
    if (mantissa === null) return null;
    return mantissa * 10 ** Number(sci[2]);
  }
  const e = s.match(/^(.*?)e([+-]?\d+)$/);
  if (e) {
    const mantissa = parseMantissa(e[1]);
    return mantissa === null ? null : mantissa * 10 ** Number(e[2]);
  }
  return parseMantissa(s);
}

/** |guess − truth| / |truth| */
export function relativeError(guess: number, truth: number): number {
  if (truth === 0) return Math.abs(guess);
  return Math.abs(guess - truth) / Math.abs(truth);
}
