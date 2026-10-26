import { describe, expect, it } from 'vitest';
import {
  applyVariant,
  cdsLength,
  codingLengthOfExon,
  exonStarts,
  mrnaLength,
  wtProteinLength,
  type GeneModel,
} from './geneModel';
import { createRng } from './rng';
import { proteinKDa, randomOrf } from './translate';
import { randomSequence } from './dna';

/** Problem 2 (OMG1): exons 500/600/900, introns 400/800, CDS 300 + 600 + 501 = 1401 nt. */
function omg1(epitope: 'N' | 'C' = 'C'): GeneModel {
  const rng = createRng('omg1');
  const utr5 = 200;
  const cds = 1401;
  const utr3 = 2000 - utr5 - cds;
  const mrna = randomSequence(rng, utr5) + randomOrf(rng, cds / 3) + randomSequence(rng, utr3);
  return {
    name: 'OMG1',
    exons: [500, 600, 900],
    introns: [400, 800],
    utr5,
    utr3,
    upstream: 1500,
    promoter: 500,
    downstream: 1000,
    // EcoRI: upstream, in intron 1, in intron 2, downstream
    sites: [-1000, 700, 1800, 3700],
    probe: { exon: 1, from: 100, to: 300 },
    primers: { fwd: { exon: 0, at: 250 }, rev: { exon: 2, at: 300 }, length: 20 },
    epitope,
    mrna,
  };
}

describe('gene model geometry', () => {
  const g = omg1();

  it('reproduces the OMG1 numbers: 1401-nt CDS, 466 aa, ~51.3 kDa', () => {
    expect(cdsLength(g)).toBe(1401);
    expect(wtProteinLength(g)).toBe(466);
    expect(proteinKDa(466)).toBeCloseTo(51.26, 2);
    expect(mrnaLength(g)).toBe(2000);
    expect(exonStarts(g)).toEqual([0, 900, 2300]);
    expect(codingLengthOfExon(g, 0)).toBe(300);
    expect(codingLengthOfExon(g, 1)).toBe(600);
    expect(codingLengthOfExon(g, 2)).toBe(501);
  });
});

describe('blot predictions', () => {
  const g = omg1('C');
  const wt = applyVariant(g, { kind: 'wt' });

  it('wild type', () => {
    expect(wt.southern).toEqual([1100]); // probe in exon 2 (900–1500), EcoRI at 700 and 1800
    expect(wt.northern).toEqual([2000]);
    expect(wt.rtpcr).toEqual([2000 - 250 - (900 - 300)]); // from exon-1 offset 250 to exon-3 offset 300
    expect(wt.western).toEqual([466]);
  });

  it('intron loss only changes the Southern fragment that contains that intron', () => {
    const r = applyVariant(g, { kind: 'intronLoss', intron: 1 }); // intron 2 (800 bp) spans 1500–2300
    expect(r.southern).toEqual([2200]); // the EcoRI site at +1.8 kb sat inside intron 2: 700 → 2900
    expect(r.northern).toEqual(wt.northern);
    expect(r.western).toEqual(wt.western);
  });

  it('in-frame exon skipping shortens mRNA, RT-PCR and protein', () => {
    const r = applyVariant(g, { kind: 'exonSkip', exon: 1 });
    expect(r.northern).toEqual([]); // the probe sits in the skipped exon
    expect(r.rtpcr).toEqual([wt.rtpcr[0] - 600]);
    expect(r.western).toEqual([466 - 200]);
    expect(r.southern).toEqual(wt.southern); // the genome is unchanged
  });

  it('a nonsense codon truncates the protein: C-terminal antibody sees nothing, N-terminal sees a short band', () => {
    const c = applyVariant(g, { kind: 'nonsense', codon: 150 });
    expect(c.northern).toEqual(wt.northern); // no NMD in these problems
    expect(c.proteinLength).toBe(149);
    expect(c.western).toEqual([]);
    const n = applyVariant(omg1('N'), { kind: 'nonsense', codon: 150 });
    expect(n.western).toEqual([149]);
  });

  it('a frameshift deletion loses the C-terminal epitope', () => {
    const r = applyVariant(g, { kind: 'exonDeletion', exon: 1, offset: 300, length: 100 });
    expect(r.northern).toEqual([1900]);
    expect(r.truncated).toBe(true);
    expect(r.western).toEqual([]);
    expect(r.southern).toEqual([1000]);
  });

  it('an in-frame deletion keeps the epitope and shortens the protein', () => {
    const r = applyVariant(g, { kind: 'exonDeletion', exon: 1, offset: 300, length: 99 });
    expect(r.western).toEqual([466 - 33]);
  });

  it('an in-frame insertion makes a bigger protein', () => {
    const r = applyVariant(g, { kind: 'insertion', exon: 2, offset: 150, seq: 'GCT'.repeat(100) });
    expect(r.western).toEqual([566]);
    expect(r.northern).toEqual([2300]);
  });

  it('losing an EcoRI site merges two fragments', () => {
    const r = applyVariant(g, { kind: 'siteLoss', site: 2 }); // the site at +1.8 kb
    expect(r.southern).toEqual([3000]); // 700 → 3700
  });

  it('deleting the promoter abolishes transcript and protein but not the gene', () => {
    const r = applyVariant(g, { kind: 'promoterDeletion' });
    expect(r.northern).toEqual([]);
    expect(r.rtpcr).toEqual([]);
    expect(r.western).toEqual([]);
    expect(r.southern).toEqual(wt.southern);
  });

  it('skipping the exon of a primer gives no RT-PCR product', () => {
    const g2 = { ...g, primers: { ...g.primers, rev: { exon: 1, at: 500 } } };
    expect(applyVariant(g2, { kind: 'exonSkip', exon: 1 }).rtpcr).toEqual([]);
  });

  it('missense mutations change nothing on any blot', () => {
    const r = applyVariant(g, { kind: 'missense', codon: 200 });
    expect([r.southern, r.northern, r.rtpcr, r.western]).toEqual([wt.southern, wt.northern, wt.rtpcr, wt.western]);
  });
});
