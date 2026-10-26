/**
 * Gene model for "draw the expected blot" problems: exons, introns, UTRs, EcoRI sites, a probe,
 * RT-PCR primers and an antibody epitope, plus genetic variants. For each variant we compute
 * exactly what Southern (genomic DNA + EcoRI + probe), Northern (probe), RT-PCR and Western
 * (antibody) would show.
 *
 * Coordinates: genomic positions in bp with the transcription start site (TSS) at 0. The WT
 * mRNA sequence is stored, so frameshifts and premature stops are found by real translation.
 *
 * Course conventions: no nonsense-mediated decay (a nonsense mutation does not change the
 * mRNA), 110 Da per amino acid, poly(A) tail ignored, transcript = exons from TSS to the end.
 */

import { reverseComplement } from './dna';
import { pcrProduct } from './pcr';
import { CODON_TABLE, SENSE_CODONS, translateFrom } from './translate';

export interface GeneModel {
  name: string;
  exons: number[];
  introns: number[];
  /** nt of exon 1 before the ATG. */
  utr5: number;
  /** nt of the last exon after the stop codon. */
  utr3: number;
  /** bp of genomic DNA drawn upstream of the TSS. */
  upstream: number;
  /** The promoter: the `promoter` bp immediately upstream of the TSS. */
  promoter: number;
  /** bp drawn after the end of transcription. */
  downstream: number;
  /** EcoRI sites, genomic coordinates. */
  sites: number[];
  /** Probe (DNA/RNA blots): exon index and offsets within that exon. */
  probe: { exon: number; from: number; to: number };
  /** RT-PCR primers: 5′ ends as exon offsets. The product runs from fwd.at to rev.at (exclusive). */
  primers: { fwd: { exon: number; at: number }; rev: { exon: number; at: number }; length: number };
  /** The antibody recognises the N-terminal (exon 1) or C-terminal (last exon) part of the protein. */
  epitope: 'N' | 'C';
  /** WT mRNA (exons joined). */
  mrna: string;
}

export type Variant =
  | { kind: 'wt' }
  | { kind: 'intronLoss'; intron: number }
  | { kind: 'exonSkip'; exon: number }
  | { kind: 'nonsense'; codon: number }
  | { kind: 'missense'; codon: number }
  | { kind: 'exonDeletion'; exon: number; offset: number; length: number }
  | { kind: 'insertion'; exon: number; offset: number; seq: string }
  | { kind: 'siteLoss'; site: number }
  | { kind: 'promoterDeletion' };

// ---------------------------------------------------------------------------------------------
// Geometry helpers

export function exonStarts(g: GeneModel): number[] {
  const starts: number[] = [];
  let pos = 0;
  g.exons.forEach((len, i) => {
    starts.push(pos);
    pos += len + (g.introns[i] ?? 0);
  });
  return starts;
}

/** Genomic end of transcription. */
export function geneEnd(g: GeneModel): number {
  return g.exons.reduce((a, b) => a + b, 0) + g.introns.reduce((a, b) => a + b, 0);
}

export function mrnaLength(g: GeneModel): number {
  return g.exons.reduce((a, b) => a + b, 0);
}

export function cdsLength(g: GeneModel): number {
  return mrnaLength(g) - g.utr5 - g.utr3;
}

/** Amino acids of the WT protein (stop codon not counted). */
export function wtProteinLength(g: GeneModel): number {
  return cdsLength(g) / 3 - 1;
}

/** mRNA coordinate of an exon offset. */
export function mrnaPos(g: GeneModel, exon: number, offset: number): number {
  return g.exons.slice(0, exon).reduce((a, b) => a + b, 0) + offset;
}

/** Which exon (and offset) holds an mRNA coordinate. */
export function exonOfMrnaPos(g: GeneModel, pos: number): { exon: number; offset: number } {
  let acc = 0;
  for (let i = 0; i < g.exons.length; i++) {
    if (pos < acc + g.exons[i]) return { exon: i, offset: pos - acc };
    acc += g.exons[i];
  }
  return { exon: g.exons.length - 1, offset: g.exons[g.exons.length - 1] };
}

/** Exon (and offset inside it) that contains codon `codon` (1 = the ATG). */
export function exonOfCodon(g: GeneModel, codon: number): { exon: number; offset: number } {
  return exonOfMrnaPos(g, g.utr5 + 3 * (codon - 1));
}

/** Coding nt inside an exon (excluding UTRs). */
export function codingLengthOfExon(g: GeneModel, exon: number): number {
  const start = mrnaPos(g, exon, 0);
  const end = start + g.exons[exon];
  const cdsStart = g.utr5;
  const cdsEnd = mrnaLength(g) - g.utr3;
  return Math.max(0, Math.min(end, cdsEnd) - Math.max(start, cdsStart));
}

export function primerSequences(g: GeneModel): { fwd: string; rev: string } {
  const f = mrnaPos(g, g.primers.fwd.exon, g.primers.fwd.at);
  const r = mrnaPos(g, g.primers.rev.exon, g.primers.rev.at);
  return {
    fwd: g.mrna.slice(f, f + g.primers.length),
    rev: reverseComplement(g.mrna.slice(r - g.primers.length, r)),
  };
}

export function epitopePeptide(g: GeneModel): string {
  const p = translateFrom(g.mrna, g.utr5).protein;
  return g.epitope === 'N' ? p.slice(0, 12) : p.slice(-12);
}

// ---------------------------------------------------------------------------------------------
// Applying a variant

type Edit = { at: number; delta: number }; // delta < 0: deletion of [at, at − delta); > 0: insertion at `at`

function mapPos(pos: number, e: Edit): number | null {
  if (e.delta < 0) {
    const end = e.at - e.delta;
    if (pos < e.at) return pos;
    if (pos >= end) return pos + e.delta;
    return null;
  }
  return pos >= e.at ? pos + e.delta : pos;
}

function mapInterval(from: number, to: number, e: Edit): [number, number] | null {
  if (e.delta < 0) {
    const end = e.at - e.delta;
    const a = from < e.at ? from : from >= end ? from + e.delta : e.at;
    const b = to <= e.at ? to : to >= end ? to + e.delta : e.at;
    return b > a ? [a, b] : null;
  }
  return [from >= e.at ? from + e.delta : from, to > e.at ? to + e.delta : to];
}

export interface VariantOutcome {
  /** Southern: EcoRI fragments (bp) that contain the probe. */
  southern: number[];
  /** Northern: transcript lengths (nt) detected by the probe. */
  northern: number[];
  /** RT-PCR product lengths (bp). */
  rtpcr: number[];
  /** Western: protein lengths (amino acids) detected by the antibody. */
  western: number[];
  /** Protein actually made (aa), or null when there is no transcript. */
  proteinLength: number | null;
  /** True if the protein ends at a different stop codon than the WT (frameshift/nonsense). */
  truncated: boolean;
  mrnaLength: number | null;
}

export function applyVariant(g: GeneModel, v: Variant): VariantOutcome {
  const starts = exonStarts(g);
  // Exons as genomic intervals + sequences.
  let pos = 0;
  const exonSeqs = g.exons.map((len) => {
    const s = g.mrna.slice(pos, pos + len);
    pos += len;
    return s;
  });
  let exonIv: ([number, number] | null)[] = g.exons.map((len, i) => [starts[i], starts[i] + len]);
  let sites = [...g.sites];
  const probeStart = starts[g.probe.exon] + g.probe.from;
  let probe: [number, number] | null = [probeStart, starts[g.probe.exon] + g.probe.to];
  let transcribed = true;
  const skipped = new Set<number>();

  const edit = (e: Edit) => {
    exonIv = exonIv.map((iv) => (iv ? mapInterval(iv[0], iv[1], e) : null));
    sites = sites.map((s) => mapPos(s, e)).filter((s): s is number => s !== null);
    probe = probe ? mapInterval(probe[0], probe[1], e) : null;
  };

  const setCodon = (codon: number, replacement: string) => {
    const at = g.utr5 + 3 * (codon - 1);
    for (let k = 0; k < 3; k++) {
      const { exon, offset } = exonOfMrnaPos(g, at + k);
      const s = exonSeqs[exon];
      exonSeqs[exon] = s.slice(0, offset) + replacement[k] + s.slice(offset + 1);
    }
  };

  switch (v.kind) {
    case 'wt':
      break;
    case 'intronLoss': {
      const a = starts[v.intron] + g.exons[v.intron];
      edit({ at: a, delta: -g.introns[v.intron] });
      break;
    }
    case 'exonSkip':
      skipped.add(v.exon);
      break;
    case 'nonsense':
      setCodon(v.codon, 'TAA');
      break;
    case 'missense': {
      const at = g.utr5 + 3 * (v.codon - 1);
      const old = g.mrna.slice(at, at + 3);
      const replacement = SENSE_CODONS.find((c) => CODON_TABLE[c] !== CODON_TABLE[old]) ?? 'GCT';
      setCodon(v.codon, replacement);
      break;
    }
    case 'exonDeletion': {
      const s = exonSeqs[v.exon];
      exonSeqs[v.exon] = s.slice(0, v.offset) + s.slice(v.offset + v.length);
      edit({ at: starts[v.exon] + v.offset, delta: -v.length });
      break;
    }
    case 'insertion': {
      const s = exonSeqs[v.exon];
      exonSeqs[v.exon] = s.slice(0, v.offset) + v.seq + s.slice(v.offset);
      edit({ at: starts[v.exon] + v.offset, delta: v.seq.length });
      break;
    }
    case 'siteLoss':
      sites = sites.filter((_, i) => i !== v.site);
      break;
    case 'promoterDeletion':
      edit({ at: -g.promoter, delta: -g.promoter });
      transcribed = false;
      break;
  }

  // Southern: EcoRI fragments overlapping the probe.
  const southern: number[] = [];
  if (probe) {
    const s = [...new Set(sites)].sort((a, b) => a - b);
    for (let i = 0; i + 1 < s.length; i++) {
      if (s[i] < probe[1] && s[i + 1] > probe[0]) southern.push(s[i + 1] - s[i]);
    }
  }

  if (!transcribed) {
    return { southern, northern: [], rtpcr: [], western: [], proteinLength: null, truncated: false, mrnaLength: null };
  }

  const mrna = exonSeqs.filter((_, i) => !skipped.has(i)).join('');
  const probeInTranscript = probe !== null && !skipped.has(g.probe.exon);
  const northern = probeInTranscript ? [mrna.length] : [];

  const primers = primerSequences(g);
  const product = pcrProduct(mrna, primers.fwd, primers.rev);
  const rtpcr = product ? [product.length] : [];

  const translation = translateFrom(mrna, g.utr5);
  const wtProtein = translateFrom(g.mrna, g.utr5).protein;
  const protein = translation.protein;
  const western = protein.includes(epitopePeptide(g)) ? [protein.length] : [];
  const truncated = !protein.endsWith(wtProtein.slice(-12));

  return { southern, northern, rtpcr, western, proteinLength: protein.length, truncated, mrnaLength: mrna.length };
}

/** A short description of a variant, as written in an exam problem. */
export function describeVariant(g: GeneModel, v: Variant): string {
  switch (v.kind) {
    case 'wt':
      return 'wild type';
    case 'intronLoss':
      return `lacks intron ${v.intron + 1} (the whole intron is deleted from the genome)`;
    case 'exonSkip':
      return `splice-site mutation: all its mRNAs skip exon ${v.exon + 1}`;
    case 'nonsense':
      return `point mutation that turns codon ${v.codon} (exon ${exonOfCodon(g, v.codon).exon + 1}) into a stop codon`;
    case 'missense':
      return `point mutation that changes the amino acid at codon ${v.codon} (missense)`;
    case 'exonDeletion':
      return `genomic deletion of ${v.length} bp inside the coding part of exon ${v.exon + 1}`;
    case 'insertion':
      return `in-frame insertion of ${v.seq.length} bp (an extra ${v.seq.length / 3}-aa domain) inside exon ${v.exon + 1}`;
    case 'siteLoss':
      return `point mutation that destroys the EcoRI site at ${formatCoord(g.sites[v.site])}`;
    case 'promoterDeletion':
      return `deletion of the promoter (the ${g.promoter} bp just upstream of the transcription start)`;
  }
}

export function formatCoord(bp: number): string {
  const kb = bp / 1000;
  const s = Math.abs(kb).toFixed(2).replace(/0$/, '');
  return `${bp < 0 ? '−' : '+'}${s} kb`;
}
