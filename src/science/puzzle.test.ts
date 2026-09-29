import { describe, expect, it } from 'vitest';
import { lanesForMap, sitesOf, digest } from './digest';
import { workedSolution } from './explain';
import { CLASSICS, generatePuzzle, type Difficulty } from './puzzle';
import { createRng, dailySeed, randomSeed } from './rng';
import { checkMap, isUnique, sameMap, solve, type DigestProblem } from './solver';

const SEEDS = Array.from({ length: 25 }, (_, i) => `test-${i}`);

describe('seeded RNG', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = createRng('abc');
    const b = createRng('abc');
    const c = createRng('abd');
    const xs = [a.next(), a.next(), a.next()];
    expect([b.next(), b.next(), b.next()]).toEqual(xs);
    expect(c.next()).not.toBe(xs[0]);
  });

  it('int is inclusive and stays in range', () => {
    const r = createRng('range');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(1, 3);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('daily seeds depend only on the date', () => {
    expect(dailySeed(new Date(2026, 8, 27, 9))).toBe('daily-2026-09-27');
    expect(dailySeed(new Date(2026, 8, 27, 23))).toBe('daily-2026-09-27');
  });

  it('random seeds are short and readable', () => {
    expect(randomSeed()).toMatch(/^[a-z2-9]{7}$/);
  });
});

describe('puzzle generation', () => {
  it('is reproducible from its seed', () => {
    const a = generatePuzzle('share-me', 'medium');
    const b = generatePuzzle('share-me', 'medium');
    expect(a).toEqual(b);
    expect(generatePuzzle('share-me-2', 'medium')).not.toEqual(a);
  });

  it.each(['easy', 'medium', 'hard'] as Difficulty[])('%s puzzles always have exactly one answer', (difficulty) => {
    for (const seed of SEEDS) {
      const p = generatePuzzle(seed, difficulty);
      expect(isUnique(p.problem)).toBe(true);
      const { solutions } = solve(p.problem);
      expect(solutions).toHaveLength(1);
      expect(sameMap(p.problem.topology, p.length, solutions[0], p.truth, p.problem.enzymes)).toBe(true);
      expect(checkMap(p.problem, p.length, p.truth).ok).toBe(true);
    }
  });

  it('easy: linear, 2 enzymes cutting once each, 0.5 kb grid, length given', () => {
    for (const seed of SEEDS) {
      const p = generatePuzzle(seed, 'easy');
      expect(p.problem.topology).toBe('linear');
      expect(p.problem.enzymes).toHaveLength(2);
      expect(Object.values(p.truth).map((s) => s.length)).toEqual([1, 1]);
      expect(p.grid).toBe(500);
      expect(p.lengthGiven).toBe(true);
      expect(p.problem.lanes.some((l) => l.kind === 'partial')).toBe(false);
      for (const sites of Object.values(p.truth)) for (const s of sites) expect(s % 500).toBe(0);
    }
  });

  it('medium: 2–3 enzymes, exactly one of them cutting twice', () => {
    for (const seed of SEEDS) {
      const p = generatePuzzle(seed, 'medium');
      const counts = Object.values(p.truth).map((s) => s.length).sort();
      expect(counts.length).toBeGreaterThanOrEqual(2);
      expect(counts.length).toBeLessThanOrEqual(3);
      expect(counts.filter((c) => c === 2)).toHaveLength(1);
      expect(counts.filter((c) => c !== 1 && c !== 2)).toHaveLength(0);
    }
  });

  it('hard: plasmids, or linear molecules that genuinely need the partial digest', () => {
    let circular = 0;
    for (const seed of SEEDS) {
      const p = generatePuzzle(seed, 'hard');
      expect(p.grid).toBe(100);
      if (p.problem.topology === 'circular') {
        circular++;
        expect(p.length).toBeGreaterThanOrEqual(3000);
        expect(p.length).toBeLessThanOrEqual(12000);
      } else {
        const withoutPartial: DigestProblem = {
          ...p.problem,
          lanes: p.problem.lanes.filter((l) => l.kind !== 'partial'),
        };
        expect(p.problem.lanes.some((l) => l.kind === 'partial')).toBe(true);
        expect(isUnique(withoutPartial)).toBe(false);
      }
    }
    expect(circular).toBeGreaterThan(3);
    expect(circular).toBeLessThan(SEEDS.length - 3);
  });

  it('lanes are consistent with the hidden map', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const p = generatePuzzle(seed, 'hard');
      const mol = { topology: p.problem.topology, length: p.length };
      const expected = lanesForMap(mol, p.problem.enzymes, p.truth);
      for (const lane of expected) {
        const actual = p.problem.lanes.find((l) => l.id === lane.id)!;
        expect(actual.fragments).toEqual(digest(mol, sitesOf(p.truth, lane.enzymes)));
      }
    }
  });

  it('every fragment respects the minimum size', () => {
    for (const seed of SEEDS) {
      for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
        const p = generatePuzzle(seed, d);
        const min = Math.min(...p.problem.lanes.flatMap((l) => l.fragments));
        expect(min).toBeGreaterThanOrEqual(d === 'hard' ? 300 : 500);
      }
    }
  });
});

describe('worked solutions', () => {
  it('Classic A places E1 at 4 kb, then E2 at 1 kb', () => {
    const w = workedSolution(CLASSICS[0]);
    expect(w.steps.map((s) => s.title)).toEqual(['Total length', 'Number of sites', 'Place E1', 'Add E2', 'Answer']);
    expect(w.steps[2].paragraphs.join(' ')).toContain('put E1 at 4 kb');
    expect(w.steps[3].conclusion).toBe('Only one placement fits: E2 at 1 kb.');
    expect(w.verification.every((v) => v.ok)).toBe(true);
  });

  it('Classic B ends with KpnI 2 · EcoRI 3 · KpnI 5.5 · HindIII 8 kb', () => {
    const w = workedSolution(CLASSICS[1]);
    expect(w.steps[0].conclusion).toBe('The molecule is 9.5 kb long.');
    expect(w.steps.at(-1)!.paragraphs[0]).toContain('KpnI 2 · EcoRI 3 · KpnI 5.5 · HindIII 8 kb');
  });

  it('Classic C explains the partial digest bands as neighbouring fragments', () => {
    const w = workedSolution(CLASSICS[2]);
    const text = w.steps.flatMap((s) => s.paragraphs).join(' ');
    expect(text).toContain('18.5 = 1.5 + 17');
    expect(text).toContain('48.5 = the uncut molecule');
  });

  it('never fails on random puzzles, and always verifies', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
        const w = workedSolution(generatePuzzle(seed, d));
        expect(w.solutions).toHaveLength(1);
        expect(w.verification.every((v) => v.ok)).toBe(true);
      }
    }
  });
});
