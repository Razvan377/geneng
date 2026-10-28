import { describe, expect, it } from 'vitest';
import { GAME_KINDS, generateGameQuestion } from './gameQuestions';
import { generateGameTheoryExam } from './gtExam';
import { partCount, partsOf, scoreExam } from './mockExam';
import type { Grade, SimpleQuestion } from './types';

function checkPart(q: SimpleQuestion): void {
  expect(q.kind).toMatch(/^gt\./);
  expect(q.prompt.length).toBeGreaterThan(5);
  expect(q.explanation.length).toBeGreaterThan(0);
  expect(q.explanation.every((e) => e.length > 0 && !e.includes('undefined') && !e.includes('NaN'))).toBe(true);
  expect(q.prompt).not.toMatch(/undefined|NaN/);
  if (q.format === 'choice') {
    const ids = q.options.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(q.options.map((o) => o.label)).size).toBe(ids.length);
    expect(q.correct.length).toBeGreaterThan(0);
    expect(q.correct.every((c) => ids.includes(c))).toBe(true);
    if (!q.multi) expect(q.correct).toHaveLength(1);
    if (q.exclusive) {
      // "None" is never correct together with something else.
      const ex = q.correct.filter((c) => q.exclusive!.includes(c));
      if (ex.length) expect(q.correct).toHaveLength(1);
    }
    expect(q.options.every((o) => !o.label.includes('undefined') && !o.label.includes('NaN'))).toBe(true);
  } else if (q.format === 'numeric') {
    expect(Number.isFinite(q.answer)).toBe(true);
    expect(q.answerLabel).not.toMatch(/undefined|NaN/);
  } else if (q.format === 'match') {
    const ids = q.options.map((o) => o.id);
    expect(new Set(q.options.map((o) => o.label)).size).toBe(ids.length);
    for (const r of q.rows) expect((q.correct[r.id] ?? []).every((c) => ids.includes(c)) && q.correct[r.id].length > 0).toBe(true);
  }
}

describe('game theory generators', () => {
  for (const kind of GAME_KINDS) {
    it(`${kind}: 150 seeds give well-formed questions`, () => {
      for (let i = 0; i < 150; i++) {
        const q = generateGameQuestion(`s${i}`, kind);
        expect(q.kind).toBe(`gt.${kind}`);
        for (const part of partsOf(q)) checkPart(part);
      }
    });
  }

  it('is reproducible from the seed', () => {
    expect(JSON.stringify(generateGameQuestion('abc', 'iesds'))).toBe(JSON.stringify(generateGameQuestion('abc', 'iesds')));
    expect(JSON.stringify(generateGameQuestion('abc', 'story'))).not.toBe(JSON.stringify(generateGameQuestion('abd', 'story')));
  });

  it('mixed-strategy answers are probabilities strictly between 0 and 1', () => {
    for (let i = 0; i < 150; i++) {
      for (const kind of ['mixed', 'selection', 'rational'] as const) {
        for (const part of partsOf(generateGameQuestion(`p${i}`, kind))) {
          if (part.format === 'numeric' && /probability|λ|p\*/.test(part.prompt)) {
            expect(part.answer).toBeGreaterThan(0);
            expect(part.answer).toBeLessThan(1);
          }
        }
      }
    }
  });

  it('IESDS problems end in one cell or a 2×2 game', () => {
    for (let i = 0; i < 100; i++) {
      const q = generateGameQuestion(`i${i}`, 'iesds');
      const parts = partsOf(q);
      expect(parts.length === 3 || parts.length === 4).toBe(true);
    }
  });
});

describe('game theory mock midterm', () => {
  it('has four problems worth 3, 2, 3 and 2 points', () => {
    const exam = generateGameTheoryExam('x1');
    expect(exam.problems.map((p) => p.points)).toEqual([3, 2, 3, 2]);
    expect(partCount(exam)).toBeGreaterThanOrEqual(12);
  });

  it('is reproducible and different for different seeds', () => {
    expect(JSON.stringify(generateGameTheoryExam('q'))).toBe(JSON.stringify(generateGameTheoryExam('q')));
    expect(JSON.stringify(generateGameTheoryExam('q'))).not.toBe(JSON.stringify(generateGameTheoryExam('r')));
  });

  it('weights problems by their points', () => {
    const exam = generateGameTheoryExam('w');
    const perfect: Grade = { correct: true, score: 1, headline: '' };
    const grades: Record<string, Grade> = {};
    // Only problem 1 (3 points) answered perfectly → 3/10.
    exam.problems[0].blocks.forEach((b, bi) => partsOf(b).forEach((_, i) => (grades[`0.${bi}.${i}`] = perfect)));
    expect(scoreExam(exam, grades).grade).toBe(3);
    // Everything → 10.
    exam.problems.forEach((p, pi) => p.blocks.forEach((b, bi) => partsOf(b).forEach((_, i) => (grades[`${pi}.${bi}.${i}`] = perfect))));
    expect(scoreExam(exam, grades).grade).toBe(10);
  });
});
