/**
 * Restriction endonuclease data.
 *
 * `site` is the recognition sequence 5′→3′ on the top strand, `cut` is the number of site
 * bases 5′ of the top-strand cut (EcoRI G^AATTC → cut = 1). Every site here is a palindrome,
 * so the bottom strand is cut at the mirror position (site.length − cut, in top-strand
 * coordinates) and the overhang type follows directly from `cut`:
 *
 *   cut < length/2  → 5′ overhang of (length − 2·cut) nt
 *   cut > length/2  → 3′ overhang of (2·cut − length) nt
 *   cut = length/2  → blunt
 *
 * To add an enzyme, append an entry; the unit tests check that every site is palindromic and
 * every cut position is valid. Set `mapping: true` to make it available in mapping puzzles.
 */

import { isPalindrome } from './dna';

export interface Enzyme {
  name: string;
  site: string;
  cut: number;
  /** Organism of origin, as in Brown Table 4.1. */
  source: string;
  /** Short label for gel lanes, e.g. "E" for EcoRI. Only needed for mapping enzymes. */
  short?: string;
  /** Available in the random restriction-mapping puzzles. */
  mapping?: boolean;
}

export const ENZYMES: readonly Enzyme[] = [
  { name: 'EcoRI', site: 'GAATTC', cut: 1, source: 'Escherichia coli', short: 'E', mapping: true },
  { name: 'HindIII', site: 'AAGCTT', cut: 1, source: 'Haemophilus influenzae Rd', short: 'H', mapping: true },
  { name: 'BamHI', site: 'GGATCC', cut: 1, source: 'Bacillus amyloliquefaciens', short: 'B', mapping: true },
  { name: 'KpnI', site: 'GGTACC', cut: 5, source: 'Klebsiella pneumoniae', short: 'K', mapping: true },
  { name: 'PstI', site: 'CTGCAG', cut: 5, source: 'Providencia stuartii', short: 'P', mapping: true },
  { name: 'SalI', site: 'GTCGAC', cut: 1, source: 'Streptomyces albus', short: 'S', mapping: true },
  { name: 'XbaI', site: 'TCTAGA', cut: 1, source: 'Xanthomonas badrii', short: 'Xb', mapping: true },
  { name: 'XhoI', site: 'CTCGAG', cut: 1, source: 'Xanthomonas holcicola', short: 'Xh', mapping: true },
  { name: 'SmaI', site: 'CCCGGG', cut: 3, source: 'Serratia marcescens', short: 'Sm', mapping: true },
  { name: 'NotI', site: 'GCGGCCGC', cut: 2, source: 'Nocardia otitidis-caviarum', short: 'N', mapping: true },
  { name: 'BglII', site: 'AGATCT', cut: 1, source: 'Bacillus globigii', short: 'Bg', mapping: true },

  { name: 'EcoRV', site: 'GATATC', cut: 3, source: 'Escherichia coli' },
  { name: 'SacI', site: 'GAGCTC', cut: 5, source: 'Streptomyces achromogenes' },
  { name: 'Ecl136II', site: 'GAGCTC', cut: 3, source: 'Enterobacter cloacae' },
  { name: 'Sau3AI', site: 'GATC', cut: 0, source: 'Staphylococcus aureus 3A' },
  { name: 'MboI', site: 'GATC', cut: 0, source: 'Moraxella bovis' },
  { name: 'DpnII', site: 'GATC', cut: 0, source: 'Diplococcus pneumoniae' },
  { name: 'XmaI', site: 'CCCGGG', cut: 1, source: 'Xanthomonas malvacearum' },
  { name: 'Acc65I', site: 'GGTACC', cut: 1, source: 'Acinetobacter calcoaceticus' },
  { name: 'SpeI', site: 'ACTAGT', cut: 1, source: 'Sphaerotilus species' },
  { name: 'NheI', site: 'GCTAGC', cut: 1, source: 'Neisseria mucosa heidelbergensis' },
  { name: 'AvrII', site: 'CCTAGG', cut: 1, source: 'Anabaena variabilis' },
  { name: 'PvuII', site: 'CAGCTG', cut: 3, source: 'Proteus vulgaris' },
  { name: 'HaeIII', site: 'GGCC', cut: 2, source: 'Haemophilus aegyptius' },
  { name: 'AluI', site: 'AGCT', cut: 2, source: 'Arthrobacter luteus' },
  { name: 'HpaII', site: 'CCGG', cut: 1, source: 'Haemophilus parainfluenzae' },
  { name: 'MspI', site: 'CCGG', cut: 1, source: 'Moraxella species' },
  { name: 'SphI', site: 'GCATGC', cut: 5, source: 'Streptomyces phaeochromogenes' },
  { name: 'NcoI', site: 'CCATGG', cut: 1, source: 'Nocardia corallina' },
  { name: 'NdeI', site: 'CATATG', cut: 2, source: 'Neisseria denitrificans' },
  { name: 'ApaI', site: 'GGGCCC', cut: 5, source: 'Acetobacter pasteurianus' },
  { name: 'PspOMI', site: 'GGGCCC', cut: 1, source: 'Pseudomonas species' },
  { name: 'ScaI', site: 'AGTACT', cut: 3, source: 'Streptomyces caespitosus' },
  { name: 'TaqI', site: 'TCGA', cut: 1, source: 'Thermus aquaticus' },
  { name: 'NarI', site: 'GGCGCC', cut: 2, source: 'Nocardia argentinensis' },
  { name: 'KasI', site: 'GGCGCC', cut: 1, source: 'Kluyvera species' },
  { name: 'SfoI', site: 'GGCGCC', cut: 3, source: 'Serratia fonticola' },
];

const BY_NAME = new Map(ENZYMES.map((e) => [e.name, e]));

export function getEnzyme(name: string): Enzyme {
  const e = BY_NAME.get(name);
  if (!e) throw new Error(`Unknown enzyme: ${name}`);
  return e;
}

export function hasEnzyme(name: string): boolean {
  return BY_NAME.has(name);
}

export const MAPPING_ENZYMES: readonly string[] = ENZYMES.filter((e) => e.mapping).map((e) => e.name);

/** "G^AATTC" */
export function formatSite(e: Enzyme): string {
  return `${e.site.slice(0, e.cut)}^${e.site.slice(e.cut)}`;
}

export type EndKind = '5prime' | '3prime' | 'blunt';

export function endKind(e: Enzyme): EndKind {
  const n = e.site.length;
  if (2 * e.cut < n) return '5prime';
  if (2 * e.cut > n) return '3prime';
  return 'blunt';
}

export const END_KIND_LABEL: Record<EndKind, string> = {
  '5prime': '5′ overhang',
  '3prime': '3′ overhang',
  blunt: 'blunt',
};

/**
 * The single-stranded overhang, read 5′→3′ ("" for blunt ends).
 * EcoRI → AATT (5′), PstI → TGCA (3′), NotI → GGCC (5′).
 */
export function overhang(e: Enzyme): string {
  const n = e.site.length;
  const a = Math.min(e.cut, n - e.cut);
  const b = Math.max(e.cut, n - e.cut);
  return e.site.slice(a, b);
}

/** Bottom-strand cut position in top-strand coordinates (valid for palindromic sites). */
export function bottomCut(e: Enzyme): number {
  return e.site.length - e.cut;
}

/** Expected spacing of a site of this length in random sequence: 4^n bp. */
export function siteFrequency(e: Enzyme): number {
  return 4 ** e.site.length;
}

export function validateEnzyme(e: Enzyme): string[] {
  const errors: string[] = [];
  if (!/^[ACGT]+$/.test(e.site)) errors.push(`${e.name}: site must be A/C/G/T only`);
  if (!isPalindrome(e.site)) errors.push(`${e.name}: site ${e.site} is not palindromic`);
  if (e.cut < 0 || e.cut > e.site.length) errors.push(`${e.name}: cut ${e.cut} outside the site`);
  if (e.mapping && !e.short) errors.push(`${e.name}: mapping enzymes need a short label`);
  return errors;
}
