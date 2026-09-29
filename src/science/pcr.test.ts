import { describe, expect, it } from 'vitest';
import { reverseComplement } from './dna';
import {
  analyzePrimerPair,
  annealingTemp,
  copiesAfterCycles,
  designCloningPrimers,
  dimerComplementarity,
  expectedOccurrences,
  expectedSpacing,
  minSpecificLength,
  pcrProduct,
  selfComplementarity,
  wallaceTm,
} from './pcr';

describe('Wallace rule', () => {
  it("reproduces Brown's worked example: 5′-AGACTCAGAGAGAACCC-3′ → 52 °C", () => {
    expect(wallaceTm('AGACTCAGAGAGAACCC')).toBe(52); // 4 × 9 + 2 × 8
    expect(annealingTemp(52)).toBe(50);
  });

  it('counts G+C at 4 °C and A+T at 2 °C', () => {
    expect(wallaceTm('GGGG')).toBe(16);
    expect(wallaceTm('ATAT')).toBe(8);
  });
});

describe('specificity: 4^n', () => {
  it('a 17-mer is expected once every 4^17 ≈ 1.7 × 10^10 bp', () => {
    expect(expectedSpacing(17)).toBe(17179869184);
  });

  it('8-mers have ~49 000 sites in the human genome (Brown §9.2.1)', () => {
    expect(Math.round(expectedOccurrences(8, 3.2e9) / 1000)).toBe(49);
  });

  it('16 nt is the shortest length expected to be unique in 3.2 × 10^9 bp', () => {
    expect(minSpecificLength(3.2e9)).toBe(16);
  });
});

describe('amplification', () => {
  it('30 cycles give 2^30 ≈ 1.07 × 10^9 copies', () => {
    expect(copiesAfterCycles(30)).toBe(1073741824);
    expect(copiesAfterCycles(10, 100)).toBe(102400);
  });
});

describe('primer pair analysis', () => {
  const good = { f: 'AGCTGACCTGAAGTCCAGAC', r: 'TCAGGTCAAGCACTGGATCG' };

  it('passes a well-designed pair', () => {
    const a = analyzePrimerPair(good.f, good.r);
    expect(a.issues).toEqual([]);
  });

  it('flags a Tm mismatch > 5 °C', () => {
    const a = analyzePrimerPair('AGCTGACCTGAAGTCCAGAC', 'TCAGGTCAAGCACTGGATCGCTGAC');
    expect(a.issues).toContain('tm-mismatch');
  });

  it('flags GC content outside 40–60%', () => {
    const a = analyzePrimerPair('ATTAGATTACATTAAGTAAC', good.r);
    expect(a.issues).toContain('gc-content');
  });

  it('flags a 3′ end without G/C', () => {
    const a = analyzePrimerPair('AGCTGACCTGAAGTCCAGCA', good.r);
    expect(a.issues).toContain('no-gc-clamp');
  });

  it('flags self-complementarity at the 3′ end (hairpin / self-dimer)', () => {
    const hairpin = 'GAGCTCAGTTACCTGAGCTC'; // ends in a palindrome
    expect(selfComplementarity(hairpin)).toBeGreaterThanOrEqual(4);
    expect(analyzePrimerPair(hairpin, good.r).issues).toContain('self-complementary');
  });

  it('flags primers whose 3′ ends pair with each other (primer-dimer)', () => {
    const f = 'AGCTGACCTGAAGTCCTTGC';
    const r = 'CATGGTCAAGCACTGCAAGG'; // ends GCAAGG; revcomp CCTTGC = 3′ end of f
    expect(dimerComplementarity(f, r)).toBeGreaterThanOrEqual(4);
    expect(analyzePrimerPair(f, r).issues).toContain('primer-dimer');
  });

  it('flags primers too short to be specific in the human genome', () => {
    const a = analyzePrimerPair('GACCTGAAGTCC', 'CAAGCACTGGAC');
    expect(a.issues).toContain('too-short');
  });
});

describe('PCR product', () => {
  const template = 'TTGACCATGGCTAGCAAGGAGGAACTGTTCACTGGCGTGGTCCCAATTCTCGTGGAACTGGATGGCGATGTAAACGGCCACAAG';

  it('runs from the forward primer to the reverse complement of the reverse primer', () => {
    const fwd = template.slice(6, 24);
    const rev = reverseComplement(template.slice(60, 78));
    const p = pcrProduct(template, fwd, rev)!;
    expect(p.start).toBe(6);
    expect(p.end).toBe(78);
    expect(p.length).toBe(72);
    expect(p.sequence.startsWith(fwd)).toBe(true);
    expect(p.sequence.endsWith(reverseComplement(rev))).toBe(true);
  });

  it('finds nothing if the reverse primer is written as the top strand (classic mistake)', () => {
    const fwd = template.slice(6, 24);
    const wrongRev = template.slice(60, 78);
    expect(pcrProduct(template, fwd, wrongRev)).toBeNull();
  });
});

describe('cloning primers', () => {
  it('put the NotI and XhoI sites at the 5′ ends, after a few extra bases', () => {
    const template = 'CCCATGGCTAGCAAGGAGGAACTGTTCACTGGCGTGGTCCCAATTCTCGTGGAACTGGATGGCGATGTAAACGGCCACAAGTAAGG';
    const start = 3;
    const end = template.length - 2;
    const p = designCloningPrimers(template, start, end, 'NotI', 'XhoI', 18, 'GCGC');
    expect(p.forward).toBe('GCGC' + 'GCGGCCGC' + template.slice(start, start + 18));
    expect(p.reverse).toBe('GCGC' + 'CTCGAG' + reverseComplement(template.slice(end - 18, end)));
    const product = pcrProduct(p.forward.slice(12) + template.slice(start + 18), p.forward.slice(12), p.reverse.slice(10));
    expect(product).not.toBeNull();
  });
});
