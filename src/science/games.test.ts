import { describe, expect, it } from 'vitest';
import {
  asFraction,
  bimatrix,
  cournot,
  cournotBestResponse,
  dominatedStrategies,
  dominatingMixInterval,
  expectedPayoffs,
  formatProb,
  formatValue,
  fullyMixed2x2,
  isBestResponseToSomeBelief,
  isGeneric,
  iesds,
  jointProfitMax,
  paretoEfficientCells,
  pureNash,
  pureNash3,
  rationalizable,
  riskThreshold,
  strictlyDominantStrategy,
  weaklyOnlyDominated,
  type Game3,
} from './games';

// Examples from the lecture slides (Tejada, Days 2–3 and "Applications, selection, rationalizability").
const PD = bimatrix(['Hold out', 'Confess'], ['Hold out', 'Confess'], [
  [[-4, -4], [-25, -1]],
  [[-1, -25], [-8, -8]],
]);
const HUNT = bimatrix(['Kingpin', 'Operative'], ['Kingpin', 'Operative'], [
  [[2, 2], [0, 1]],
  [[1, 0], [1, 1]],
]);
const BLOTTO = bimatrix(['Mountains', 'Plains'], ['Mountains', 'Plains'], [
  [[1, -1], [-1, 1]],
  [[-1, 1], [1, -1]],
]);
const UP_DOWN = bimatrix(['Up', 'Down'], ['Left', 'Middle', 'Right'], [
  [[1, 0], [1, 2], [0, 1]],
  [[0, 3], [0, 1], [2, 0]],
]);
// Problem set 1.2 and midterm 2023, problem 2.
const PS12 = bimatrix(['A', 'B', 'C'], ['a', 'b', 'c', 'd'], [
  [[9, 6], [7, 7], [5, 6], [12, 6]],
  [[7, 13], [6, 9], [2, 6], [10, 10]],
  [[9, 1], [9, 6], [2, 1], [6, 0]],
]);
// Problem set 1.16.
const PS116 = bimatrix(['A', 'B', 'C', 'D'], ['E', 'F', 'G'], [
  [[2, 3], [1, 1], [3, 4]],
  [[4, 2], [2, 1], [1, 4]],
  [[1, 2], [2, 2], [4, 3]],
  [[0, 1], [3, 2], [2, 2]],
]);
const RATIONAL = bimatrix(['U', 'M', 'D'], ['L', 'R'], [
  [[3, 2], [0, 0]],
  [[0, 2], [3, 0]],
  [[1, 0], [1, 3]],
]);

describe('pure Nash equilibria', () => {
  it('prisoners’ dilemma: only (Confess, Confess)', () => {
    expect(pureNash(PD)).toEqual([[1, 1]]);
  });
  it('terrorist hunt: two equilibria', () => {
    expect(pureNash(HUNT)).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });
  it('Colonel Blotto: none', () => {
    expect(pureNash(BLOTTO)).toEqual([]);
  });
  it('weak best responses count (problem set 1.16 reduced game)', () => {
    const g = bimatrix(['C', 'D'], ['F', 'G'], [
      [[2, 2], [4, 3]],
      [[3, 2], [2, 2]],
    ]);
    expect(pureNash(g)).toEqual([
      [0, 1],
      [1, 0],
    ]);
    expect(isGeneric(g)).toBe(false);
  });
});

describe('dominance', () => {
  it('Hold out is strictly dominated for both players', () => {
    expect(dominatedStrategies(PD, 0, true)).toEqual([{ player: 0, dominated: 0, by: 1 }]);
    expect(dominatedStrategies(PD, 1, true)).toEqual([{ player: 1, dominated: 0, by: 1 }]);
    expect(strictlyDominantStrategy(PD, 0)).toBe(1);
  });
  it('slide example: Right is strictly dominated by Middle', () => {
    expect(dominatedStrategies(UP_DOWN, 1, true)).toEqual([{ player: 1, dominated: 2, by: 1 }]);
    expect(dominatedStrategies(UP_DOWN, 0, true)).toEqual([]);
  });
  it('problem set 1.2: B (by A) and c (by b) are strictly dominated', () => {
    expect(dominatedStrategies(PS12, 0, true).map((d) => [d.dominated, d.by])).toEqual([[1, 0]]);
    expect(dominatedStrategies(PS12, 1, true).map((d) => [d.dominated, d.by])).toEqual([[2, 1]]);
    // d is weakly (not strictly) dominated by a: 6 = 6, 13 > 10, 1 > 0.
    expect(weaklyOnlyDominated(PS12, 1)).toEqual([{ player: 1, dominated: 3, by: 0 }]);
    expect(strictlyDominantStrategy(PS12, 0)).toBeNull();
  });
  it('slides: D is weakly dominated by U, L strictly by R (elimination order matters for weak dominance)', () => {
    const g = bimatrix(['U', 'D'], ['L', 'R'], [
      [[1, 0], [0, 1]],
      [[0, 0], [0, 2]],
    ]);
    expect(weaklyOnlyDominated(g, 0)).toEqual([{ player: 0, dominated: 1, by: 0 }]);
    expect(dominatedStrategies(g, 1, true)).toEqual([{ player: 1, dominated: 0, by: 1 }]);
  });
});

describe('iterated elimination of strictly dominated strategies', () => {
  it('slide example ends at (Up, Middle)', () => {
    const r = iesds(UP_DOWN);
    expect(r.rows).toEqual([0]);
    expect(r.cols).toEqual([1]);
    expect(r.steps.map((s) => [s.round, s.player, s.dominated, s.by])).toEqual([
      [1, 1, 2, 1],
      [2, 0, 1, 0],
      [3, 1, 0, 1],
    ]);
  });
  it('problem set 1.2 ends at (C, b), which is the unique pure NE', () => {
    const r = iesds(PS12);
    expect(r.rows).toEqual([2]);
    expect(r.cols).toEqual([1]);
    expect(pureNash(PS12)).toEqual([[2, 1]]);
  });
  it('problem set 1.16 leaves {C, D} × {F, G}', () => {
    const r = iesds(PS116);
    expect(r.rows).toEqual([2, 3]);
    expect(r.cols).toEqual([1, 2]);
  });
});

describe('mixed strategies', () => {
  it('Colonel Blotto and the terrorist hunt mix 1/2–1/2', () => {
    expect(fullyMixed2x2(BLOTTO)).toEqual({ x: 0.5, y: 0.5 });
    expect(fullyMixed2x2(HUNT)).toEqual({ x: 0.5, y: 0.5 });
    expect(expectedPayoffs(BLOTTO, [0.5, 0.5], [0.5, 0.5])).toEqual([0, 0]);
    expect(expectedPayoffs(HUNT, [0.5, 0.5], [0.5, 0.5])).toEqual([1, 1]);
  });
  it('problem set 1.6: both play their first strategy with probability 3/4', () => {
    const g = bimatrix(['T', 'B'], ['L', 'R'], [
      [[2, 1], [0, 2]],
      [[1, 3], [3, 0]],
    ]);
    const m = fullyMixed2x2(g)!;
    expect(m.x).toBeCloseTo(0.75);
    expect(m.y).toBeCloseTo(0.75);
  });
  it('a game with a dominant strategy has no completely mixed equilibrium', () => {
    expect(fullyMixed2x2(PD)).toBeNull();
  });
  it('risk threshold of the slides’ coordination game is 3/4', () => {
    expect(riskThreshold(4, 0, 3, 3)).toBeCloseTo(0.75);
  });
});

describe('rationalizability', () => {
  it('D is never a best response, though no pure strategy dominates it', () => {
    expect(dominatedStrategies(RATIONAL, 0, true)).toEqual([]);
    expect(isBestResponseToSomeBelief(RATIONAL, 0, 2, [0, 1, 2], [0, 1])).toBe(false);
    expect(isBestResponseToSomeBelief(RATIONAL, 0, 0, [0, 1, 2], [0, 1])).toBe(true);
  });
  it('λU + (1−λ)M dominates D for λ in (1/3, 2/3)', () => {
    const [lo, hi] = dominatingMixInterval(RATIONAL, 0, 2, 0, 1, [0, 1])!;
    expect(lo).toBeCloseTo(1 / 3);
    expect(hi).toBeCloseTo(2 / 3);
  });
  it('only (U, L) is rationalizable', () => {
    const r = rationalizable(RATIONAL);
    expect(r.rows).toEqual([0]);
    expect(r.cols).toEqual([0]);
  });
  it('in a coordination game every strategy is rationalizable', () => {
    const r = rationalizable(HUNT);
    expect(r.rows).toEqual([0, 1]);
    expect(r.cols).toEqual([0, 1]);
  });
});

describe('Pareto efficiency', () => {
  it('the prisoners’ dilemma equilibrium is the one inefficient outcome', () => {
    expect(paretoEfficientCells(PD)).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
    ]);
  });
});

describe('three players (problem set 1.13)', () => {
  it('(A, X, R) and (B, Y, R) are the pure equilibria', () => {
    const g: Game3 = {
      players: ['1', '2', '3'],
      strategies: [
        ['A', 'B'],
        ['X', 'Y'],
        ['R', 'S'],
      ],
      u: [
        [
          [
            [3, 2, 4],
            [2, 1, 3],
          ],
          [
            [0, 0, 5],
            [0, 0, 0],
          ],
        ],
        [
          [
            [0, 0, 0],
            [0, 2, 2],
          ],
          [
            [1, 3, 2],
            [3, 2, 1],
          ],
        ],
      ],
    };
    expect(pureNash3(g)).toEqual([
      [0, 0, 0],
      [1, 1, 0],
    ]);
  });
});

describe('Cournot and joint profits (slides: P = 100 − Q, c = 10)', () => {
  it('Cournot: 30 each, price 40, profit 900', () => {
    const r = cournot(100, 1, 10);
    expect(r.q1).toBeCloseTo(30);
    expect(r.P).toBeCloseTo(40);
    expect(r.profit1).toBeCloseTo(900);
    expect(cournotBestResponse(100, 1, 10, 30)).toBeCloseTo(30);
  });
  it('joint-profit maximum: Q = 45, P = 55, total profit 2025; deviating to 33.75 pays', () => {
    const m = jointProfitMax(100, 1, 10);
    expect(m.Q).toBeCloseTo(45);
    expect(m.P).toBeCloseTo(55);
    expect(m.profit).toBeCloseTo(2025);
    expect(cournotBestResponse(100, 1, 10, 22.5)).toBeCloseTo(33.75);
  });
  it('asymmetric costs: the cheaper firm produces more', () => {
    const r = cournot(120, 1, 20, 30);
    expect(r.q1).toBeCloseTo((120 - 40 + 30) / 3);
    expect(r.q2).toBeCloseTo((120 - 60 + 20) / 3);
  });
});

describe('display helpers', () => {
  it('fractions and minus signs', () => {
    expect(asFraction(0.4)).toEqual([2, 5]);
    expect(formatValue(-3)).toBe('−3');
    expect(formatValue(2 / 3)).toBe('2/3');
    expect(formatProb(0.4)).toBe('2/5 = 0.4');
    expect(formatProb(1 / 3)).toBe('1/3 ≈ 0.333');
  });
});
