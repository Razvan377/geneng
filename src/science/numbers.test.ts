import { describe, expect, it } from 'vitest';
import { formatSci } from './format';
import {
  clarkeCarbon,
  concentrationFromA260,
  coverageProbability,
  enzymeAmount,
  expectedSites,
  parseNumber,
  purityVerdict,
  relativeError,
  siteSpacing,
  vectorsFor,
  VECTOR_CAPACITIES,
} from './numbers';

describe('restriction site frequency 4^n', () => {
  it('gives 256, 4096 and 65 536 for 4-, 6- and 8-bp sites', () => {
    expect(siteSpacing(4)).toBe(256);
    expect(siteSpacing(6)).toBe(4096);
    expect(siteSpacing(8)).toBe(65536);
  });

  it('expected sites in a genome', () => {
    expect(expectedSites(4096000, 6)).toBe(1000);
  });
});

describe('enzyme units', () => {
  it('2 µg of DNA needs 2 U, i.e. 0.5 µl of a 4 U/µl enzyme (Brown §4.2.6)', () => {
    expect(enzymeAmount(2, 4)).toEqual({ units: 2, volumeUl: 0.5 });
  });

  it('a longer incubation needs fewer units', () => {
    expect(enzymeAmount(10, 5, 2)).toEqual({ units: 5, volumeUl: 1 });
  });
});

describe('A260 quantification', () => {
  it('A260 = 1.0 is 50 µg/ml dsDNA, 40 µg/ml RNA, 33 µg/ml ssDNA', () => {
    expect(concentrationFromA260(1, 'dsDNA')).toBe(50);
    expect(concentrationFromA260(1, 'RNA')).toBe(40);
    expect(concentrationFromA260(1, 'ssDNA')).toBe(33);
  });

  it('corrects for dilution', () => {
    expect(concentrationFromA260(0.25, 'dsDNA', 20)).toBe(250);
  });

  it('A260/A280: 1.8 is pure DNA, lower is protein/phenol, ~2.0 suggests RNA', () => {
    expect(purityVerdict(1.8)).toBe('pure-dna');
    expect(purityVerdict(1.4)).toBe('contaminated');
    expect(purityVerdict(2.05)).toBe('rna');
  });
});

describe('Clarke–Carbon library size', () => {
  it('2 × 10^9 bp genome, 2 × 10^4 bp inserts: ≈ 4.6 × 10^5 clones for 99%', () => {
    const n = clarkeCarbon(0.99, 2e4, 2e9);
    expect(n).toBeGreaterThan(4.6e5);
    expect(n).toBeLessThan(4.61e5);
    expect(formatSci(n, 2)).toBe('4.6 × 10⁵');
  });

  it('10^5 clones give only ~63% coverage', () => {
    const p = coverageProbability(1e5, 2e4, 2e9);
    expect(p).toBeCloseTo(0.632, 3);
  });

  it('the two formulas are inverses', () => {
    const n = clarkeCarbon(0.95, 4e4, 3.2e9);
    expect(coverageProbability(n, 4e4, 3.2e9)).toBeCloseTo(0.95, 10);
  });
});

describe('vector capacities', () => {
  it('are listed in increasing order of maximum insert size', () => {
    const max = VECTOR_CAPACITIES.map((v) => v.maxBp);
    expect([...max].sort((a, b) => a - b)).toEqual(max);
  });

  it('pick the right vector for an insert size', () => {
    expect(vectorsFor(40000).map((v) => v.id)).toEqual(['cosmid']);
    expect(vectorsFor(150000).map((v) => v.id)).toEqual(['bac']);
    expect(vectorsFor(15000).map((v) => v.id)).toEqual(['lambda-replacement']);
    expect(vectorsFor(1e6).map((v) => v.id)).toEqual(['yac']);
  });
});

describe('parseNumber', () => {
  it.each([
    ['4096', 4096],
    ['4 096', 4096],
    ['65,536', 65536],
    ['0,5', 0.5],
    ['0.5', 0.5],
    ['1,5', 1.5],
    ['1.234,5', 1234.5],
    ['1,234.5', 1234.5],
    ['1.07e9', 1.07e9],
    ['1.07E+9', 1.07e9],
    ['1.07x10^9', 1.07e9],
    ['1.07 × 10^9', 1.07e9],
    ['1.07·10⁹', 1.07e9],
    ['4,6·10^5', 4.6e5],
    ['10^9', 1e9],
    ['2.5 x 10^-3', 2.5e-3],
    ['-3', -3],
  ])('"%s" → %d', (input, expected) => {
    expect(parseNumber(input)).toBeCloseTo(expected, 6);
  });

  it.each(['', 'abc', '2^30', '1..2', '10^'])('rejects "%s"', (input) => {
    expect(parseNumber(input)).toBeNull();
  });

  it('relative error', () => {
    expect(relativeError(110, 100)).toBeCloseTo(0.1);
  });
});

describe('formatSci', () => {
  it('uses Unicode exponents and keeps small numbers plain', () => {
    expect(formatSci(1073741824)).toBe('1.07 × 10⁹');
    expect(formatSci(17179869184, 2)).toBe('1.7 × 10¹⁰');
    expect(formatSci(4096)).toBe('4100');
    expect(formatSci(4096, 4)).toBe('4096');
    expect(formatSci(0.0025)).toBe('2.5 × 10⁻³');
  });
});
