import { describe, expect, it } from 'vitest';
import { lanesForMap, makeLane } from './digest';
import { CLASSIC_A, CLASSIC_B, CLASSIC_C } from './puzzle';
import {
  canonicalKey,
  candidatePlacements,
  checkMap,
  distinctPermutations,
  inferLength,
  isUnique,
  mirrorMap,
  problemGrid,
  sameMap,
  solve,
  type DigestProblem,
} from './solver';

describe('Classic A (lecture slides)', () => {
  const { problem } = CLASSIC_A;

  it('has a total length of 10 kb', () => {
    expect(inferLength(problem)).toBe(10000);
  });

  it('solves uniquely to E2 at 1 kb, E1 at 4 kb (or the mirror image)', () => {
    const { solutions } = solve(problem);
    expect(solutions).toHaveLength(1);
    expect(sameMap('linear', 10000, solutions[0], { E1: [4000], E2: [1000] }, problem.enzymes)).toBe(true);
    expect(sameMap('linear', 10000, solutions[0], { E1: [6000], E2: [9000] }, problem.enzymes)).toBe(true);
    expect(sameMap('linear', 10000, solutions[0], { E1: [4000], E2: [9000] }, problem.enzymes)).toBe(false);
  });
});

describe('Classic B (lecture slides)', () => {
  const { problem } = CLASSIC_B;

  it('has a total length of 9.5 kb', () => {
    expect(inferLength(problem)).toBe(9500);
  });

  it('solves uniquely to KpnI 2, EcoRI 3, KpnI 5.5, HindIII 8 (or the mirror image)', () => {
    const { solutions } = solve(problem);
    expect(solutions).toHaveLength(1);
    const answer = { KpnI: [2000, 5500], EcoRI: [3000], HindIII: [8000] };
    expect(sameMap('linear', 9500, solutions[0], answer, problem.enzymes)).toBe(true);
    expect(sameMap('linear', 9500, solutions[0], mirrorMap('linear', 9500, answer), problem.enzymes)).toBe(true);
  });

  it('accepts the answer and its mirror image when checking a player map', () => {
    const answer = { KpnI: [2000, 5500], EcoRI: [3000], HindIII: [8000] };
    expect(checkMap(problem, 9500, answer).ok).toBe(true);
    expect(checkMap(problem, 9500, mirrorMap('linear', 9500, answer)).ok).toBe(true);
  });

  it('reports which lanes a wrong map fails, with expected and obtained fragments', () => {
    // KpnI fragments swapped: single digests still fine, double digests are not.
    const wrong = { KpnI: [2000, 6000], EcoRI: [3000], HindIII: [8000] };
    const result = checkMap(problem, 9500, wrong);
    expect(result.ok).toBe(false);
    const failing = result.lanes.filter((l) => !l.ok).map((l) => l.lane.id);
    expect(failing).toEqual(['KpnI+HindIII', 'EcoRI+KpnI']);
    const ek = result.lanes.find((l) => l.lane.id === 'EcoRI+KpnI')!;
    expect(ek.expected).toEqual([1000, 2000, 2500, 4000]);
    expect(ek.obtained).toEqual([1000, 2000, 3000, 3500]);
  });

  it('flags a wrong total length and wrong site counts', () => {
    const result = checkMap(problem, 10000, { KpnI: [2000], EcoRI: [3000], HindIII: [8000] });
    expect(result.lengthOk).toBe(false);
    expect(result.wrongSiteCounts).toEqual([{ enzyme: 'KpnI', expected: 2, placed: 1 }]);
  });
});

describe('Classic C (Brown Fig. 4.16, λ DNA)', () => {
  it('is ambiguous without the partial digest', () => {
    const noPartial: DigestProblem = {
      ...CLASSIC_C.problem,
      lanes: CLASSIC_C.problem.lanes.filter((l) => l.kind !== 'partial'),
    };
    expect(solve(noPartial).solutions).toHaveLength(2);
    expect(isUnique(noPartial)).toBe(false);
  });

  it('is unique once the KpnI partial digest is added', () => {
    const { solutions } = solve(CLASSIC_C.problem);
    expect(solutions).toHaveLength(1);
    expect(sameMap('linear', 48500, solutions[0], CLASSIC_C.truth, CLASSIC_C.problem.enzymes)).toBe(true);
  });
});

describe('symmetry handling', () => {
  it('mirror images share a canonical key (linear)', () => {
    const a = { A: [1000, 7000], B: [3000] };
    expect(canonicalKey('linear', 10000, a, ['A', 'B'])).toBe(
      canonicalKey('linear', 10000, mirrorMap('linear', 10000, a), ['A', 'B']),
    );
  });

  it('rotations and mirror images share a canonical key (circular)', () => {
    const a = { A: [0, 1500], B: [3200] };
    const rotated = { A: [700, 2200], B: [3900] };
    const mirrored = mirrorMap('circular', 5000, a);
    const key = canonicalKey('circular', 5000, a, ['A', 'B']);
    expect(canonicalKey('circular', 5000, rotated, ['A', 'B'])).toBe(key);
    expect(canonicalKey('circular', 5000, mirrored, ['A', 'B'])).toBe(key);
    expect(canonicalKey('circular', 5000, { A: [0, 1500], B: [2000] }, ['A', 'B'])).not.toBe(key);
  });
});

describe('search building blocks', () => {
  it('enumerates distinct permutations of repeated fragments once', () => {
    expect(distinctPermutations([1, 1, 2])).toEqual([
      [1, 1, 2],
      [1, 2, 1],
      [2, 1, 1],
    ]);
  });

  it('places linear sites at prefix sums of every fragment order', () => {
    expect(candidatePlacements('linear', 10000, 500, [4000, 6000], false)).toEqual([[4000], [6000]]);
  });

  it('fixes the anchor enzyme at 0 on a circle, other enzymes at every grid offset', () => {
    expect(candidatePlacements('circular', 5000, 500, [5000], true)).toEqual([[0]]);
    expect(candidatePlacements('circular', 5000, 500, [5000], false)).toHaveLength(10);
  });

  it('works on the finest grid the data allows', () => {
    expect(problemGrid(CLASSIC_B.problem)).toBe(500);
  });
});

describe('circular maps', () => {
  it('recovers a plasmid map up to rotation and mirror image', () => {
    const mol = { topology: 'circular' as const, length: 6000 };
    const truth = { EcoRI: [0, 2100], BamHI: [3700], PstI: [900, 4800] };
    const enzymes = ['EcoRI', 'BamHI', 'PstI'];
    const problem = { topology: 'circular' as const, enzymes, lanes: lanesForMap(mol, enzymes, truth) };
    const { solutions } = solve(problem);
    expect(solutions.some((s) => sameMap('circular', 6000, s, truth, enzymes))).toBe(true);
    expect(checkMap(problem, 6000, { EcoRI: [1000, 3100], BamHI: [4700], PstI: [1900, 5800] }).ok).toBe(true);
  });

  it('a single-cut enzyme on a circle gives one full-length fragment', () => {
    const problem: DigestProblem = {
      topology: 'circular',
      enzymes: ['A', 'B'],
      lanes: [
        makeLane('single', ['A'], [4000]),
        makeLane('single', ['B'], [4000]),
        makeLane('double', ['A', 'B'], [1500, 2500]),
      ],
    };
    const { solutions } = solve(problem);
    expect(solutions).toHaveLength(1);
    expect(checkMap(problem, 4000, { A: [100], B: [1600] }).ok).toBe(true);
    expect(checkMap(problem, 4000, { A: [100], B: [2600] }).ok).toBe(true); // mirror image
  });
});

describe('uniqueness', () => {
  it('detects genuinely ambiguous data', () => {
    // A two-cut enzyme on its own: the order of its fragments cannot be deduced.
    const problem: DigestProblem = {
      topology: 'linear',
      enzymes: ['A'],
      lanes: [makeLane('single', ['A'], [1000, 2000, 3000])],
    };
    expect(isUnique(problem)).toBe(false);
    expect(solve(problem).solutions).toHaveLength(3);
  });
});
