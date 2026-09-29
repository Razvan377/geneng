import { describe, expect, it } from 'vitest';
import {
  AGAROSE_TABLE,
  agaroseModel,
  agaroseRowsCovering,
  bandIntensity,
  bandsFromFragments,
  chooseLadder,
  fitModel,
  LADDERS,
  migrate,
  needsPfge,
  sizeFromCurve,
  standardCurve,
  uncutPlasmidBands,
} from './gel';

describe('migration model', () => {
  const model = fitModel([500, 10000]);

  it('distance is a linear function of log10(size) inside the range', () => {
    // Equal size ratios → equal distances.
    const d = (s: number) => migrate(model, s);
    expect(d(1000) - d(2000)).toBeCloseTo(d(4000) - d(8000), 10);
    // Collinearity: slope between any two points is the same.
    const slope = (a: number, b: number) => (d(a) - d(b)) / (Math.log10(a) - Math.log10(b));
    expect(slope(600, 900)).toBeCloseTo(slope(3000, 9000), 10);
    expect(slope(600, 900)).toBeLessThan(0);
  });

  it('smaller fragments travel further; large ones bunch together near the wells', () => {
    expect(migrate(model, 500)).toBeGreaterThan(migrate(model, 1000));
    const gapLarge = migrate(model, 9000) - migrate(model, 10000);
    const gapSmall = migrate(model, 1000) - migrate(model, 2000);
    expect(gapLarge).toBeLessThan(gapSmall / 5);
  });

  it('agarose models compress molecules above the range into a narrow zone', () => {
    const m = agaroseModel(1.2); // 0.4–6 kb
    const top = migrate(m, 6000);
    expect(migrate(m, 20000)).toBeLessThan(top);
    expect(migrate(m, 20000)).toBeGreaterThan(top - 0.08 * (m.bottom - m.top));
    expect(migrate(m, 20000) - migrate(m, 50000)).toBeLessThan(0.01);
    // Monotonic everywhere.
    const sizes = [100, 200, 400, 1000, 3000, 6000, 10000, 40000];
    const ds = sizes.map((s) => migrate(m, s));
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeLessThan(ds[i - 1]);
  });
});

describe('bands', () => {
  it('merges co-migrating fragments into one brighter band', () => {
    const bands = bandsFromFragments([1500, 1500, 3000, 5000]);
    expect(bands).toHaveLength(3);
    const b15 = bands.find((b) => b.size === 1500)!;
    expect(b15.copies).toBe(2);
    expect(b15.mass).toBe(3000);
  });

  it('intensity scales with mass, so small fragments are fainter', () => {
    const [big, small] = bandsFromFragments([6000, 500]);
    const max = Math.max(big.mass, small.mass);
    expect(bandIntensity(small.mass, max)).toBeLessThan(bandIntensity(big.mass, max));
    expect(bandIntensity(max, max)).toBeCloseTo(1);
    expect(bandIntensity(0, max)).toBeGreaterThan(0); // still visible
  });

  it('a doublet (2 × 1.5 kb) is as bright as a single 3 kb band', () => {
    const doublet = bandsFromFragments([1500, 1500])[0];
    const single = bandsFromFragments([3000])[0];
    expect(bandIntensity(doublet.mass, 3000)).toBeCloseTo(bandIntensity(single.mass, 3000));
  });

  it('uncut plasmid: open-circular above linear above supercoiled; supercoiled brightest', () => {
    const bands = uncutPlasmidBands(4000);
    const byForm = Object.fromEntries(bands.map((b) => [b.form, b]));
    const m = fitModel([1000, 10000]);
    const d = (form: string) => migrate(m, byForm[form].apparentSize);
    expect(d('open-circular')).toBeLessThan(d('linear'));
    expect(d('linear')).toBeLessThan(d('supercoiled'));
    expect(byForm['supercoiled'].mass).toBeGreaterThan(byForm['open-circular'].mass);
  });
});

describe('ladders and agarose', () => {
  it('the 1 kb ladder has the bands from the course', () => {
    expect(LADDERS.kb1.sizes).toEqual([10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 500]);
  });

  it('chooses a ladder that covers the largest fragment', () => {
    expect(chooseLadder(9500).id).toBe('kb1');
    expect(chooseLadder(20000).id).toBe('lambdaHindIII');
    expect(chooseLadder(45000).id).toBe('extended');
  });

  it("contains the course's agarose rows", () => {
    const row = (p: number) => AGAROSE_TABLE.find((r) => r.percent === p)!;
    expect(row(0.7)).toMatchObject({ maxBp: 20000, minBp: 800 });
    expect(row(1.2)).toMatchObject({ maxBp: 6000, minBp: 400 });
    expect(row(2.0)).toMatchObject({ maxBp: 3000, minBp: 100 });
  });

  it('finds the gels that resolve a size range', () => {
    expect(agaroseRowsCovering(100, 1000).map((r) => r.percent)).toEqual([2.0]);
    expect(agaroseRowsCovering(1000, 15000).map((r) => r.percent)).toEqual([0.5, 0.7]);
  });

  it('flags molecules above ~50 kb for PFGE', () => {
    expect(needsPfge(20000)).toBe(false);
    expect(needsPfge(150000)).toBe(true);
  });
});

describe('standard curve', () => {
  it('recovers the size of an unknown band from the ladder', () => {
    const m = agaroseModel(1.2);
    const ladder = [6000, 5000, 4000, 3000, 2000, 1500, 1000, 500];
    const runLength = 80; // mm
    const dist = ladder.map((s) => migrate(m, s) * runLength);
    const fit = standardCurve(ladder, dist);
    expect(fit.r2).toBeGreaterThan(0.999);
    expect(fit.slope).toBeLessThan(0);
    const unknown = 2300;
    expect(sizeFromCurve(fit, migrate(m, unknown) * runLength)).toBeCloseTo(unknown, -1);
  });
});
