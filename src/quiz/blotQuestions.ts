/**
 * Blots & variants: predict Southern, Northern, RT-PCR and Western results for a gene and its
 * variants, isoform Northerns, Southern blots of a restriction map, and Western blots of mutants.
 */

import { randomSequence, reverseComplement } from '../science/dna';
import { formatKb } from '../science/format';
import {
  applyVariant,
  codingLengthOfExon,
  describeVariant,
  exonOfCodon,
  exonStarts,
  formatCoord,
  mrnaLength,
  mrnaPos,
  primerSequences,
  wtProteinLength,
  type GeneModel,
  type Variant,
  type VariantOutcome,
} from '../science/geneModel';
import { createRng, type Rng } from '../science/rng';
import { proteinKDa, randomOrf, randomSenseCodons } from '../science/translate';
import type { BlotUnit, CaseQuestion, ChoiceQuestion, GeneMarker, LanesQuestion, MatchQuestion, NumericQuestion, Question, Visual } from './types';

export type BlotKind = 'panel' | 'southern' | 'northern' | 'rtpcr' | 'western' | 'isoforms' | 'map' | 'mutants';
export const BLOT_KINDS: BlotKind[] = ['panel', 'southern', 'northern', 'rtpcr', 'western', 'isoforms', 'map', 'mutants'];

export function generateBlotQuestion(seed: string, kind?: BlotKind): Question {
  const rng = createRng(`blot/${seed}`);
  const k = kind ?? rng.pick<BlotKind>(['panel', 'southern', 'northern', 'rtpcr', 'western', 'isoforms', 'map', 'mutants']);
  switch (k) {
    case 'panel':
    case 'southern':
    case 'northern':
    case 'rtpcr':
    case 'western':
      return panelQuestion(rng, seed, k);
    case 'isoforms':
      return isoformQuestion(rng, seed);
    case 'map':
      return mapSouthernQuestion(rng, seed);
    case 'mutants':
      return mutantWesternQuestion(rng, seed);
  }
}

export const DNA_LADDER = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10];
export const PCR_LADDER = [0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1, 1.5, 2, 3];
export const PROTEIN_LADDER = [15, 20, 25, 30, 40, 50, 70, 100, 130, 170];

/** The smallest prefix of a ladder that reaches past the largest band. */
export function ladderFor(full: number[], bands: number[]): number[] {
  const max = Math.max(0, ...bands);
  const i = full.findIndex((s) => s >= max * 1.15);
  return full.slice(0, i === -1 ? full.length : Math.max(i + 1, 5));
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const kbOf = (bp: number) => r2(bp / 1000);
const kDaOf = (aa: number) => Math.round(proteinKDa(aa) * 10) / 10;

// ---------------------------------------------------------------------------------------------
// Gene panels

const GENE_NAMES = ['ZIP7', 'BLAH1', 'OMG2', 'CAVA3', 'TRK9', 'MUG1', 'FAB4', 'NEX2', 'KRL5', 'DOP3'];

export function makeGene(rng: Rng): GeneModel {
  for (let attempt = 0; attempt < 500; attempt++) {
    const n = rng.int(3, 4);
    const exons = Array.from({ length: n }, (_, i) =>
      i === 0 ? 50 * rng.int(6, 12) : i === n - 1 ? 50 * rng.int(8, 18) : 50 * rng.int(2, 12),
    );
    const introns = Array.from({ length: n - 1 }, () => 50 * rng.int(4, 26));
    const utr5 = 50 * rng.int(2, Math.floor((exons[0] - 150) / 50));
    const total = exons.reduce((a, b) => a + b, 0);
    let utr3 = 50 * rng.int(2, Math.max(2, Math.floor((exons[n - 1] - 150) / 50)));
    while ((total - utr5 - utr3) % 3 !== 0) utr3++;
    if (utr3 > exons[n - 1] - 60) continue;
    const codons = (total - utr5 - utr3) / 3;
    const mrna = randomSequence(rng, utr5) + randomOrf(rng, codons) + randomSequence(rng, utr3);

    const upstream = 50 * rng.int(16, 30);
    const promoter = 50 * rng.int(4, 8);
    const downstream = 50 * rng.int(12, 24);
    const starts = exonStarts({ exons, introns } as GeneModel);
    const end = starts[n - 1] + exons[n - 1];

    const sites: number[] = [-50 * rng.int(Math.ceil(promoter / 50) - 2, Math.floor(upstream / 50) - 2)];
    introns.forEach((len, i) => {
      if (len >= 400 && rng.chance(0.65)) sites.push(starts[i] + exons[i] + 50 * rng.int(2, len / 50 - 2));
    });
    sites.push(end + 50 * rng.int(3, downstream / 50 - 3));
    sites.sort((a, b) => a - b);
    if (sites.some((s, i) => i > 0 && s - sites[i - 1] < 300)) continue;

    const probeExon = rng.int(n > 3 ? 1 : 0, n - 1);
    if (exons[probeExon] < 200) continue;
    const pLen = 50 * rng.int(2, Math.min(5, Math.floor(exons[probeExon] / 50) - 1));
    const pFrom = 50 * rng.int(0, Math.floor((exons[probeExon] - pLen) / 50));
    const probe = { exon: probeExon, from: pFrom, to: pFrom + pLen };

    const fExon = rng.int(0, n - 2);
    const rExon = rng.int(fExon + 1, n - 1);
    const len = 20;
    const fwd = { exon: fExon, at: 10 * rng.int(fExon === 0 ? Math.ceil(utr5 / 10) : 3, Math.floor((exons[fExon] - len - 20) / 10)) };
    const rev = { exon: rExon, at: 10 * rng.int(Math.ceil((len + 20) / 10), Math.floor((exons[rExon] - 20) / 10)) };
    if (mrnaPos({ exons } as GeneModel, rExon, rev.at) - mrnaPos({ exons } as GeneModel, fExon, fwd.at) < 150) continue;

    const g: GeneModel = {
      name: rng.pick(GENE_NAMES),
      exons,
      introns,
      utr5,
      utr3,
      upstream,
      promoter,
      downstream,
      sites,
      probe,
      primers: { fwd, rev, length: len },
      epitope: rng.chance(0.7) ? 'C' : 'N',
      mrna,
    };
    const p = primerSequences(g);
    // Each primer must anneal at exactly one place: its binding site occurs once, on one strand.
    const bindsOnce = (site: string) => mrna.indexOf(site) === mrna.lastIndexOf(site) && !mrna.includes(reverseComplement(site));
    if (!bindsOnce(p.fwd) || !bindsOnce(reverseComplement(p.rev))) continue;
    return g;
  }
  throw new Error('Could not build a gene');
}

/** Variants that make a good exam problem for this gene. */
function variantPool(rng: Rng, g: GeneModel): Variant[] {
  const n = g.exons.length;
  const starts = exonStarts(g);
  const aa = wtProteinLength(g);
  const pool: Variant[] = [];
  const middle = Array.from({ length: n - 2 }, (_, i) => i + 1);
  const frameshiftOk = g.epitope === 'C';

  for (const e of rng.shuffle(middle)) {
    const inFrame = codingLengthOfExon(g, e) % 3 === 0 && codingLengthOfExon(g, e) === g.exons[e];
    if (inFrame || frameshiftOk) {
      pool.push({ kind: 'exonSkip', exon: e });
      break;
    }
  }
  // Intron loss: prefer the intron that holds an EcoRI site or lies in the probe's fragment.
  const intron = rng.pick(g.introns.map((_, i) => i));
  pool.push({ kind: 'intronLoss', intron });
  pool.push({ kind: 'nonsense', codon: rng.int(Math.round(aa * 0.2), Math.round(aa * 0.8)) });
  // Coding deletion or insertion in an exon with enough coding sequence, at a codon boundary
  // (so in-frame changes remove or add whole codons) and well clear of the C-terminal epitope.
  const codingExons = g.exons.map((_, i) => i).filter((i) => codingLengthOfExon(g, i) >= 330 && i > 0);
  if (codingExons.length) {
    const e = rng.pick(codingExons);
    const cdsStartInExon = Math.max(0, g.utr5 - mrnaPos(g, e, 0));
    const phase = (((g.utr5 - mrnaPos(g, e, 0)) % 3) + 3) % 3;
    const raw = cdsStartInExon + rng.int(15, codingLengthOfExon(g, e) - 300);
    const offset = raw - ((((raw - phase) % 3) + 3) % 3);
    const frameshift = frameshiftOk && rng.chance(0.5);
    const length = frameshift ? rng.pick([50, 100, 125, 200]) : 3 * 10 * rng.int(2, 5);
    pool.push({ kind: 'exonDeletion', exon: e, offset, length });
    pool.push({ kind: 'insertion', exon: e, offset, seq: randomSenseCodons(rng, 50 * rng.int(1, 3)) });
  }
  // Site loss: a site bounding the probe fragment, with another site beyond it.
  const probeAt = starts[g.probe.exon] + g.probe.from;
  const left = g.sites.filter((s) => s < probeAt);
  const right = g.sites.filter((s) => s > probeAt);
  if (left.length >= 2) pool.push({ kind: 'siteLoss', site: g.sites.indexOf(left[left.length - 1]) });
  else if (right.length >= 2) pool.push({ kind: 'siteLoss', site: g.sites.indexOf(right[0]) });
  pool.push({ kind: 'promoterDeletion' });
  if (rng.chance(0.3)) pool.push({ kind: 'missense', codon: rng.int(20, aa - 20) });
  return pool;
}

export interface GeneCase {
  gene: GeneModel;
  variants: Variant[];
  outcomes: VariantOutcome[];
}

export function makeGeneCase(rng: Rng): GeneCase {
  for (let attempt = 0; attempt < 400; attempt++) {
    const gene = makeGene(rng);
    const pool = rng.shuffle(variantPool(rng, gene));
    const kinds = new Set<string>();
    const picked: Variant[] = [];
    for (const v of pool) {
      if (kinds.has(v.kind) || picked.length === 3) continue;
      kinds.add(v.kind);
      picked.push(v);
    }
    if (picked.length < 3) continue;
    const variants: Variant[] = [{ kind: 'wt' }, ...picked];
    const outcomes = variants.map((v) => applyVariant(gene, v));
    // Every band must be readable on a normal blot.
    const ok = outcomes.every(
      (o) =>
        o.southern.every((b) => b >= 300 && b <= 10000) &&
        o.northern.every((b) => b >= 500 && b <= 6000) &&
        o.rtpcr.every((b) => b >= 100 && b <= 3000) &&
        o.western.every((aa) => proteinKDa(aa) >= 15 && proteinKDa(aa) <= 160) &&
        o.southern.length > 0,
    );
    if (!ok) continue;
    // Frameshifts must end in a stop codon inside the mRNA (they always lose a C-terminal epitope).
    return { gene, variants, outcomes };
  }
  throw new Error('Could not build a gene case');
}

const LANE_IDS = ['A', 'B', 'C', 'D'];

export function geneMarkers(g: GeneModel, variants: Variant[]): GeneMarker[] {
  const starts = exonStarts(g);
  const markers: GeneMarker[] = [];
  variants.forEach((v, i) => {
    const label = LANE_IDS[i];
    switch (v.kind) {
      case 'intronLoss':
        markers.push({ label, at: starts[v.intron] + g.exons[v.intron], to: starts[v.intron + 1] });
        break;
      case 'exonSkip':
        markers.push({ label, at: starts[v.exon], to: starts[v.exon] + g.exons[v.exon] });
        break;
      case 'nonsense':
      case 'missense': {
        const { exon, offset } = exonOfCodon(g, v.codon);
        markers.push({ label, at: starts[exon] + offset });
        break;
      }
      case 'exonDeletion':
        markers.push({ label, at: starts[v.exon] + v.offset, to: starts[v.exon] + v.offset + v.length });
        break;
      case 'insertion':
        markers.push({ label, at: starts[v.exon] + v.offset });
        break;
      case 'siteLoss':
        markers.push({ label, at: g.sites[v.site] });
        break;
      case 'promoterDeletion':
        markers.push({ label, at: -g.promoter, to: 0 });
        break;
    }
  });
  return markers;
}

type PanelBlot = 'southern' | 'northern' | 'rtpcr' | 'western';

const BLOT_META: Record<PanelBlot, { title: string; unit: BlotUnit; look: 'film' | 'agarose'; ladder: number[] }> = {
  southern: { title: 'Southern blot (genomic DNA digested with EcoRI, hybridised with the probe)', unit: 'kb', look: 'film', ladder: DNA_LADDER },
  northern: { title: 'Northern blot (total RNA, hybridised with the probe)', unit: 'kb', look: 'film', ladder: DNA_LADDER },
  rtpcr: { title: 'RT-PCR with primers F and R, run on an agarose gel', unit: 'kb', look: 'agarose', ladder: PCR_LADDER },
  western: { title: 'Western blot with the antibody', unit: 'kDa', look: 'film', ladder: PROTEIN_LADDER },
};

function expectedFor(c: GeneCase, blot: PanelBlot): number[][] {
  return c.outcomes.map((o) =>
    blot === 'western' ? o.western.map(kDaOf) : (blot === 'southern' ? o.southern : blot === 'northern' ? o.northern : o.rtpcr).map(kbOf),
  );
}

function geneDescription(c: GeneCase): string {
  const g = c.gene;
  const aaNote = `CDS ${mrnaLength(g) - g.utr5 - g.utr3} nt`;
  return (
    `Gene ${g.name}: ${g.exons.length} exons (${g.exons.join(', ')} nt) and ${g.introns.length} introns (${g.introns.join(', ')} bp). ` +
    `The 5′ UTR is ${g.utr5} nt (ATG in exon 1) and the 3′ UTR is ${g.utr3} nt (after the stop codon in exon ${g.exons.length}); ${aaNote}. ` +
    `EcoRI sites at ${g.sites.map(formatCoord).join(', ')} (transcription start = 0). ` +
    `The probe binds exon ${g.probe.exon + 1}; primers F (exon ${g.primers.fwd.exon + 1}) and R (exon ${g.primers.rev.exon + 1}); the antibody recognises the ${g.epitope === 'N' ? 'N-terminal region (encoded by exon 1)' : `C-terminal region (encoded by exon ${g.exons.length})`}.`
  );
}

function strainList(c: GeneCase): string {
  return c.variants.map((v, i) => `${LANE_IDS[i]}: ${describeVariant(c.gene, v)}`).join(' · ');
}

const ASSUMPTIONS =
  'Assume: no nonsense-mediated decay, poly(A) tail ignored, no EcoRI sites other than those shown, 110 Da per amino acid. Leave a lane empty with “No band”.';

function laneExplanation(c: GeneCase, blot: PanelBlot): string[] {
  const g = c.gene;
  const starts = exonStarts(g);
  const wt = c.outcomes[0];
  const lines: string[] = [];
  const kb = (bp: number) => `${formatKb(bp)} kb`;
  if (blot === 'southern') {
    const pFrom = starts[g.probe.exon] + g.probe.from;
    const pTo = starts[g.probe.exon] + g.probe.to;
    const l = Math.max(...g.sites.filter((s) => s < pTo));
    const r = Math.min(...g.sites.filter((s) => s > pFrom));
    lines.push(
      `A (WT): the probe binds ${formatCoord(pFrom)} to ${formatCoord(pTo)}. The nearest EcoRI sites are at ${formatCoord(l)} and ${formatCoord(r)}, so it detects one ${kb(r - l)} fragment. Southern blots look at the GENE: introns count, splicing does not.`,
    );
  } else if (blot === 'northern') {
    lines.push(
      `A (WT): the mRNA is all the exons joined, UTRs included: ${g.exons.join(' + ')} = ${mrnaLength(g)} nt ≈ ${kb(mrnaLength(g))}. The probe (exon ${g.probe.exon + 1}) detects it.`,
    );
  } else if (blot === 'rtpcr') {
    const p = mrnaPos(g, g.primers.rev.exon, g.primers.rev.at) - mrnaPos(g, g.primers.fwd.exon, g.primers.fwd.at);
    lines.push(
      `A (WT): RT-PCR copies the mRNA, so introns are absent. Product = from the 5′ end of F (nt ${mrnaPos(g, g.primers.fwd.exon, g.primers.fwd.at) + 1} of the mRNA) to the 5′ end of R (nt ${mrnaPos(g, g.primers.rev.exon, g.primers.rev.at)}) = ${p} bp.`,
    );
  } else {
    const aa = wtProteinLength(g);
    lines.push(
      `A (WT): CDS = ${mrnaLength(g)} − ${g.utr5} − ${g.utr3} = ${aa * 3 + 3} nt = ${aa + 1} codons including the stop → ${aa} aa × 110 Da ≈ ${kDaOf(aa)} kDa.`,
    );
  }

  c.variants.slice(1).forEach((v, idx) => {
    const i = idx + 1;
    const o = c.outcomes[i];
    const L = LANE_IDS[i];
    const list = blot === 'western' ? o.western : blot === 'southern' ? o.southern : blot === 'northern' ? o.northern : o.rtpcr;
    const base = blot === 'western' ? wt.western : blot === 'southern' ? wt.southern : blot === 'northern' ? wt.northern : wt.rtpcr;
    const shown = list.length ? list.map((x) => (blot === 'western' ? `${kDaOf(x)} kDa` : kb(x))).join(' + ') : 'no band';
    const same = list.length === base.length && list.every((x, j) => x === base[j]);
    let why = '';
    switch (v.kind) {
      case 'intronLoss':
        why =
          blot === 'southern'
            ? same
              ? `the missing intron is outside the probe's EcoRI fragment.`
              : `the genome is ${g.introns[v.intron]} bp shorter there${g.sites.some((s) => s > starts[v.intron] + g.exons[v.intron] && s < starts[v.intron + 1]) ? ', and the EcoRI site inside that intron is gone too' : ''}.`
            : 'introns are spliced out anyway, so mRNA, cDNA and protein are unchanged.';
        break;
      case 'exonSkip': {
        const len = g.exons[v.exon];
        if (blot === 'southern') why = 'the gene itself is unchanged; only splicing differs.';
        else if (blot === 'northern') why = list.length ? `the mRNA lacks exon ${v.exon + 1} (${len} nt).` : `the probe binds exon ${v.exon + 1}, which is no longer in the mRNA.`;
        else if (blot === 'rtpcr')
          why = list.length
            ? same
              ? `exon ${v.exon + 1} lies outside the amplified region.`
              : `the cDNA between the primers is ${len} bp shorter.`
            : `a primer anneals to exon ${v.exon + 1}, which is missing from the cDNA.`;
        else
          why =
            len % 3 === 0
              ? `exon ${v.exon + 1} is ${len} nt, a multiple of 3: the frame is kept and the protein loses ${len / 3} aa${list.length ? '' : ' — including the epitope'}.`
              : `exon ${v.exon + 1} is ${len} nt, NOT a multiple of 3 (${len} = 3 × ${Math.floor(len / 3)} + ${len % 3}): the next exon is read in another frame, a premature stop appears, and the ${g.epitope === 'C' ? 'C-terminal epitope is never made' : 'protein is truncated'}.`;
        break;
      }
      case 'nonsense':
        why =
          blot === 'western'
            ? g.epitope === 'C'
              ? `translation stops at codon ${v.codon}: the C-terminal epitope is never made.`
              : `translation stops at codon ${v.codon}: ${v.codon - 1} aa × 110 Da ≈ ${kDaOf(v.codon - 1)} kDa, and the N-terminal epitope is still there.`
            : 'a point mutation changes no lengths (and we assume no NMD).';
        break;
      case 'missense':
        why = 'one amino acid changes; no size changes on any blot.';
        break;
      case 'exonDeletion':
        if (blot === 'western')
          why =
            v.length % 3 === 0
              ? `${v.length} bp is a multiple of 3: in-frame, ${v.length / 3} aa shorter.`
              : `${v.length} bp is not a multiple of 3: frameshift → premature stop → the C-terminal epitope is lost.`;
        else if (blot === 'rtpcr' && same) why = 'the deletion lies outside the amplified region.';
        else if (blot === 'southern' && same) why = "the deletion is outside the probe's fragment.";
        else why = `${v.length} bp shorter.`;
        break;
      case 'insertion':
        if (blot === 'western') why = `${v.seq.length} bp = ${v.seq.length / 3} extra codons in frame → ${v.seq.length / 3} aa larger.`;
        else if (same) why = 'the insertion lies outside this region.';
        else why = `${v.seq.length} bp longer.`;
        break;
      case 'siteLoss':
        why =
          blot === 'southern'
            ? same
              ? "that site does not bound the probe's fragment."
              : `without the site at ${formatCoord(g.sites[v.site])} the fragment runs to the next EcoRI site.`
            : 'a silent change for RNA and protein (it only matters to EcoRI).';
        break;
      case 'promoterDeletion':
        why =
          blot === 'southern'
            ? same
              ? "the gene's coding part and the probe's fragment are untouched."
              : `the ${g.promoter} bp deletion lies in the probe's fragment.`
            : 'no promoter → no transcription → no mRNA, no cDNA, no protein.';
        break;
      case 'wt':
        break;
    }
    lines.push(`${L}: ${shown}${same ? ' (same as WT)' : ''} — ${why}`);
  });
  return lines;
}

function geneVisual(c: GeneCase): Visual {
  return {
    type: 'gene',
    gene: c.gene,
    markers: geneMarkers(c.gene, c.variants),
    show: { probe: true, primers: true, epitope: true, sites: true },
  };
}

function blotPart(c: GeneCase, seed: string, blot: PanelBlot, standalone: boolean): LanesQuestion {
  const meta = BLOT_META[blot];
  const expected = expectedFor(c, blot);
  const ladder = ladderFor(meta.ladder, expected.flat());
  return {
    kind: `blot.${blot}`,
    seed,
    format: 'lanes',
    prompt: standalone ? `${meta.title}: draw the expected result for strains A–D.` : `${meta.title}.`,
    detail: standalone ? `${strainList(c)}. ${ASSUMPTIONS}` : undefined,
    visual: standalone ? geneVisual(c) : undefined,
    look: meta.look,
    unit: meta.unit,
    ladder,
    lanes: c.variants.map((_, i) => ({ id: LANE_IDS[i], label: LANE_IDS[i] })),
    expected,
    tolerance: 0.03,
    explanation: laneExplanation(c, blot),
  };
}

function panelQuestion(rng: Rng, seed: string, kind: 'panel' | PanelBlot): Question {
  const c = makeGeneCase(rng);
  if (kind !== 'panel') {
    const q = blotPart(c, seed, kind, true);
    return { ...q, prompt: `${geneDescription(c)}\n\n${q.prompt}` };
  }
  const parts = (['southern', 'northern', 'rtpcr', 'western'] as PanelBlot[]).map((b) => blotPart(c, seed, b, false));
  const q: CaseQuestion = {
    kind: 'blot.panel',
    seed,
    format: 'case',
    prompt: `${geneDescription(c)} You analyse one sample from each strain — ${strainList(c)}. Draw the expected Southern, Northern, RT-PCR and Western results.`,
    detail: ASSUMPTIONS,
    visual: geneVisual(c),
    parts,
    explanation: [],
  };
  return q;
}

// ---------------------------------------------------------------------------------------------
// Isoforms (Problem 1 style)

const TISSUES = ['Muscle', 'Heart', 'Brain', 'Retina', 'Kidney', 'Liver', 'Lung', 'Testis'];

function isoformQuestion(rng: Rng, seed: string): CaseQuestion {
  const exons = [50 * rng.int(4, 12), 50 * rng.int(4, 10), 50 * rng.int(4, 12), 50 * rng.int(4, 10)];
  const introns = [50 * rng.int(4, 20), 50 * rng.int(4, 30), 50 * rng.int(4, 20)];
  // Isoform 1: all exons; isoforms 2 and 3 each skip one internal exon.
  const skips = rng.shuffle([1, 2]);
  const isoforms = [
    { name: 'Isoform 1', exons: [0, 1, 2, 3], note: 'all exons' },
    { name: 'Isoform 2', exons: [0, 1, 2, 3].filter((e) => e !== skips[0]), note: `exon ${skips[0] + 1} skipped` },
    { name: 'Isoform 3', exons: [0, 1, 2, 3].filter((e) => e !== skips[1]), note: `exon ${skips[1] + 1} skipped` },
  ];
  const len = (iso: (typeof isoforms)[number]) => iso.exons.reduce((a, e) => a + exons[e], 0);
  const tissues = rng.sample(TISSUES, 5);
  const patterns = rng.shuffle([[0], [0, 1], [], [0, 2], [2], [1], [1, 2]]).slice(0, 5);
  const expressed = tissues.map((t, i) => ({ t, iso: patterns[i] }));
  const probe2Exon = rng.pick([1, 2]);
  const probes = [
    { name: 'Probe 1', exon: 0 },
    { name: 'Probe 2', exon: probe2Exon },
  ];
  const askIso = rng.int(1, 2);
  const ladder = ladderFor(DNA_LADDER, isoforms.map((i) => len(i) / 1000));

  const northern = (p: (typeof probes)[number], idx: number): LanesQuestion => ({
    kind: 'blot.isoforms',
    seed,
    format: 'lanes',
    prompt: `Northern blot with ${p.name} (binds exon ${p.exon + 1}).`,
    look: 'film',
    unit: 'kb',
    ladder,
    lanes: expressed.map((e) => ({ id: e.t, label: e.t.slice(0, 3) })),
    expected: expressed.map((e) => e.iso.filter((k) => isoforms[k].exons.includes(p.exon)).map((k) => r2(len(isoforms[k]) / 1000))),
    tolerance: 0.03,
    explanation: [
      `${p.name} binds exon ${p.exon + 1}, so it detects only isoforms that contain exon ${p.exon + 1}: ${isoforms
        .filter((i) => i.exons.includes(p.exon))
        .map((i) => `${i.name} (${formatKb(len(i))} kb)`)
        .join(', ')}.`,
      ...expressed.map(
        (e) =>
          `${e.t}: ${e.iso.length === 0 ? 'no isoform expressed → no band' : e.iso.map((k) => isoforms[k].name + (isoforms[k].exons.includes(p.exon) ? ` → ${formatKb(len(isoforms[k]))} kb` : ' → not detected')).join('; ')}.`,
      ),
      idx === 1 ? 'Using two probes lets you tell isoforms apart even when their sizes are close.' : '',
    ].filter(Boolean),
  });

  const lengthPart: NumericQuestion = {
    kind: 'blot.isoforms',
    seed,
    format: 'numeric',
    prompt: `How long is the mRNA of ${isoforms[askIso].name} (${isoforms[askIso].note})?`,
    answer: len(isoforms[askIso]) / 1000,
    unit: 'kb',
    tolerance: 0.01,
    answerLabel: `${formatKb(len(isoforms[askIso]))} kb`,
    explanation: [
      `An mRNA contains only exons: ${isoforms[askIso].exons.map((e) => exons[e]).join(' + ')} = ${len(isoforms[askIso])} nt. Introns never count for Northern blots.`,
    ],
  };

  return {
    kind: 'blot.isoforms',
    seed,
    format: 'case',
    prompt:
      `A mouse gene has 4 exons (${exons.join(', ')} bp) and 3 introns (${introns.join(', ')} bp) with tissue-specific splicing. ` +
      `${isoforms.map((i) => `${i.name}: ${i.note}`).join('; ')}. Expected expression: ${expressed
        .map((e) => `${e.t} — ${e.iso.length ? e.iso.map((k) => isoforms[k].name).join(' + ') : 'none'}`)
        .join('; ')}.`,
    detail: 'Lanes are the tissues in the order listed (first three letters shown). Leave a lane empty with “No band”.',
    visual: {
      type: 'table',
      head: ['Isoform', 'Exons', 'mRNA'],
      rows: isoforms.map((i, k) => [i.name, i.exons.map((e) => e + 1).join('-'), k === askIso ? '?' : `${formatKb(len(i))} kb`]),
    },
    parts: [lengthPart, northern(probes[0], 0), northern(probes[1], 1)],
    explanation: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Southern blot of a restriction map

function mapSouthernQuestion(rng: Rng, seed: string): CaseQuestion {
  for (let attempt = 0; attempt < 500; attempt++) {
    const length = 100 * rng.int(40, 70);
    const nB = rng.int(3, 4);
    const nE = rng.int(2, 3);
    const positions = rng.sample(
      Array.from({ length: length / 100 - 1 }, (_, i) => (i + 1) * 100),
      nB + nE,
    );
    const sorted = [...positions].sort((a, b) => a - b);
    if (sorted.some((p, i) => i > 0 && p - sorted[i - 1] < 300)) continue;
    const sites = positions.map((pos, i) => ({ enzyme: i < nB ? 'BamHI' : 'EcoRI', pos }));
    const pLen = 100 * rng.int(3, 8);
    const pFrom = 100 * rng.int(3, length / 100 - 3 - pLen / 100);
    const probe: [number, number] = [pFrom, pFrom + pLen];
    // Keep sites clear of the probe's ends so it is obvious which fragments it overlaps.
    if (positions.some((p) => Math.abs(p - probe[0]) < 150 || Math.abs(p - probe[1]) < 150)) continue;
    const bands = (enzymes: string[]): number[] => {
      const s = sites.filter((x) => enzymes.includes(x.enzyme)).map((x) => x.pos).sort((a, b) => a - b);
      if (!s.some((p) => p <= probe[0]) || !s.some((p) => p >= probe[1])) return [-1];
      const out: number[] = [];
      for (let i = 0; i + 1 < s.length; i++) if (s[i] < probe[1] && s[i + 1] > probe[0]) out.push(s[i + 1] - s[i]);
      return out;
    };
    const digests = [['BamHI'], ['EcoRI'], ['BamHI', 'EcoRI']];
    const expected = digests.map(bands);
    if (expected.some((e) => e.includes(-1))) continue;
    if (expected.some((e) => e.some((b) => b < 300))) continue;
    const kbBands = expected.map((e) => e.map(kbOf));
    const ladder = ladderFor(DNA_LADDER, kbBands.flat());
    const choice: ChoiceQuestion = {
      kind: 'blot.map',
      seed,
      format: 'choice',
      prompt: 'Do you need to know the exact size of the probe to predict the bands?',
      options: [
        { id: 'no', label: 'No — only which fragments it overlaps' },
        { id: 'yes', label: 'Yes — the band size depends on the probe length' },
      ],
      correct: ['no'],
      explanation: [
        'A Southern band is the whole restriction fragment that the probe hybridises to. The probe only lights it up: its own length never changes the band size. What matters is which fragment(s) it overlaps — and if it spans a site, it detects both neighbouring fragments.',
      ],
    };
    const lanes: LanesQuestion = {
      kind: 'blot.map',
      seed,
      format: 'lanes',
      prompt: 'Draw the Southern blot: 1) BamHI, 2) EcoRI, 3) BamHI + EcoRI.',
      look: 'film',
      unit: 'kb',
      ladder,
      lanes: [
        { id: 'B', label: '1' },
        { id: 'E', label: '2' },
        { id: 'BE', label: '3' },
      ],
      expected: kbBands,
      tolerance: 0.03,
      explanation: digests.map((d, i) => {
        const s = sites.filter((x) => d.includes(x.enzyme)).map((x) => x.pos).sort((a, b) => a - b);
        return `${i + 1}) ${d.join(' + ')}: sites at ${s.map((p) => formatKb(p)).join(', ')} kb. The probe (${formatKb(probe[0])}–${formatKb(probe[1])} kb) overlaps ${expected[i].length === 1 ? 'one fragment' : `${expected[i].length} fragments`}: ${expected[i].map((b) => `${formatKb(b)} kb`).join(' + ')}.`;
      }),
    };
    return {
      kind: 'blot.map',
      seed,
      format: 'case',
      prompt: 'The restriction map below shows a region of genomic DNA and the probe (amber) used for a Southern blot.',
      visual: { type: 'probeMap', length, sites, probe },
      parts: [choice, lanes],
      explanation: [],
    };
  }
  throw new Error('Could not build a restriction-map Southern');
}

// ---------------------------------------------------------------------------------------------
// Western blot of mutants (match samples to lanes)

const PROTEINS = ['jumpsin', 'flexin', 'stretchin', 'kangarin', 'boingin', 'leapin'];

function mutantWesternQuestion(rng: Rng, seed: string): MatchQuestion {
  const name = rng.pick(PROTEINS);
  const aa = 10 * rng.int(28, 70);
  const wt = kDaOf(aa);
  const stopAt = Math.round(aa * rng.float(0.4, 0.75));
  const domain = 10 * rng.int(4, 12);
  const samples = [
    { id: 'missense', label: 'Missense mutation (one amino acid changed)', size: wt as number | null },
    { id: 'enhancer', label: 'Deletion of the muscle-specific enhancer', size: null },
    { id: 'stop', label: `1-nt deletion that creates a premature stop at codon ${stopAt}`, size: kDaOf(stopAt - 1) },
    { id: 'insert', label: `In-frame insertion encoding an extra ${domain}-aa domain`, size: kDaOf(aa + domain) },
    { id: 'wt', label: 'Normal (control)', size: wt },
  ];
  const order = rng.shuffle(samples.map((s) => s.id));
  const laneOf = Object.fromEntries(order.map((id, i) => [id, String(i + 1)]));
  const sizeOf = Object.fromEntries(samples.map((s) => [s.id, s.size]));
  const correct: Record<string, string[]> = {};
  for (const s of samples) {
    const same = samples.filter((x) => x.size === s.size).map((x) => laneOf[x.id]);
    correct[s.id] = same;
  }
  const ladder = ladderFor(PROTEIN_LADDER, [wt, kDaOf(aa + domain)]);
  return {
    kind: 'blot.mutants',
    seed,
    format: 'match',
    prompt: `Muscle extracts from five transgenic kangaroos were analysed by Western blot with a polyclonal antibody against ${name}, a ${aa}-aa (≈ ${wt} kDa) muscle protein. The samples were not labelled. Which lane is which?`,
    visual: {
      type: 'blot',
      look: 'film',
      unit: 'kDa',
      ladder,
      lanes: order.map((id, i) => ({ label: String(i + 1), bands: sizeOf[id] ? [{ size: sizeOf[id] as number }] : [] })),
    },
    rows: samples.map((s) => ({ id: s.id, label: s.label })),
    options: order.map((_, i) => ({ id: String(i + 1), label: `Lane ${i + 1}` })),
    correct,
    explanation: [
      `Normal: ${aa} aa × 110 Da ≈ ${wt} kDa.`,
      'Missense: one amino acid swapped — same size, so it is indistinguishable from the control on a Western (either of those two lanes is accepted).',
      'Enhancer deletion: the gene is no longer expressed in muscle → no protein, no band.',
      `Premature stop at codon ${stopAt}: ${stopAt - 1} aa ≈ ${kDaOf(stopAt - 1)} kDa (a polyclonal antibody still recognises the N-terminal part).`,
      `In-frame insertion: ${aa} + ${domain} = ${aa + domain} aa ≈ ${kDaOf(aa + domain)} kDa — larger.`,
    ],
  };
}
