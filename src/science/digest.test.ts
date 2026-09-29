import { describe, expect, it } from 'vitest';
import {
  digest,
  lanesForMap,
  laneMatches,
  makeLane,
  multisetDifference,
  normalizeSites,
  partialDigest,
  predictLane,
  sameMultiset,
  sameSet,
} from './digest';

const linear10 = { topology: 'linear' as const, length: 10000 };
const plasmid = { topology: 'circular' as const, length: 5000 };

describe('complete digest', () => {
  it('linear: n cuts give n + 1 fragments', () => {
    expect(digest(linear10, [])).toEqual([10000]);
    expect(digest(linear10, [4000])).toEqual([4000, 6000]);
    expect(digest(linear10, [1000, 4000])).toEqual([1000, 3000, 6000]);
    expect(digest(linear10, [1000, 4000, 9000])).toHaveLength(4);
  });

  it('circular: n cuts give n fragments; one cut gives one full-length linear molecule', () => {
    expect(digest(plasmid, [])).toEqual([]);
    expect(digest(plasmid, [1200])).toEqual([5000]);
    expect(digest(plasmid, [1000, 4000])).toEqual([2000, 3000]);
    expect(digest(plasmid, [0, 1000, 2500])).toEqual([1000, 1500, 2500]);
  });

  it('circular fragments wrap around the origin', () => {
    expect(digest(plasmid, [4500, 500])).toEqual([1000, 4000]);
  });

  it('fragments always add up to the molecule length', () => {
    expect(digest(linear10, [300, 3300, 7700]).reduce((a, b) => a + b)).toBe(10000);
    expect(digest(plasmid, [300, 3300, 4700]).reduce((a, b) => a + b)).toBe(5000);
  });

  it('two enzymes cutting at the same position count as one cut', () => {
    expect(digest(linear10, [4000, 4000])).toEqual([4000, 6000]);
  });

  it('ignores sites at or beyond the ends of a linear molecule', () => {
    expect(normalizeSites(linear10, [0, 10000, 12000, 5000])).toEqual([5000]);
    expect(normalizeSites(plasmid, [5000, 6200, -500])).toEqual([0, 1200, 4500]);
  });
});

describe('partial digest', () => {
  it('adds the products that span one uncut site (linear)', () => {
    // sites at 2, 5 → complete 2, 3, 5; one uncut: 0–5 = 5, 2–10 = 8
    expect(partialDigest(linear10, [2000, 5000], 1)).toEqual([2000, 3000, 5000, 8000]);
  });

  it("reproduces Brown Fig. 4.16's KpnI partial of λ DNA, uncut molecule included", () => {
    const lambda = { topology: 'linear' as const, length: 48500 };
    expect(partialDigest(lambda, [17000, 18500], 2)).toEqual([1500, 17000, 18500, 30000, 31500, 48500]);
  });

  it('circular: joining neighbours, and one cut of a two-site plasmid gives full length', () => {
    expect(partialDigest(plasmid, [0, 1000, 2500], 1)).toEqual([1000, 1500, 2500, 3500, 4000]);
    expect(partialDigest(plasmid, [0, 2000], 1)).toEqual([2000, 3000, 5000]);
  });
});

describe('lanes', () => {
  it('builds single and pairwise double digests', () => {
    const lanes = lanesForMap(linear10, ['E1', 'E2'], { E1: [4000], E2: [1000] });
    expect(lanes.map((l) => l.id)).toEqual(['E1', 'E2', 'E1+E2']);
    expect(lanes[2].fragments).toEqual([1000, 3000, 6000]);
  });

  it('complete lanes compare as multisets, partial lanes as sets of bands', () => {
    const complete = makeLane('double', ['A', 'B'], [1000, 1000, 3000]);
    expect(laneMatches(complete, [1000, 3000])).toBe(false);
    expect(laneMatches(complete, [3000, 1000, 1000])).toBe(true);
    const partial = makeLane('partial', ['A'], [1000, 2000, 3000], 1);
    expect(laneMatches(partial, [3000, 2000, 1000, 1000])).toBe(true);
  });

  it('predicts a lane from a map', () => {
    const lane = makeLane('double', ['E1', 'E2'], [1000, 3000, 6000]);
    expect(predictLane(linear10, { E1: [4000], E2: [1000] }, lane)).toEqual([1000, 3000, 6000]);
  });
});

describe('multiset helpers', () => {
  it('compare and subtract', () => {
    expect(sameMultiset([1, 2, 2], [2, 1, 2])).toBe(true);
    expect(sameMultiset([1, 2], [1, 2, 2])).toBe(false);
    expect(sameSet([1, 2], [1, 2, 2])).toBe(true);
    expect(multisetDifference([3000, 6500], [1500, 3000, 5000])).toEqual([6500]);
  });
});
