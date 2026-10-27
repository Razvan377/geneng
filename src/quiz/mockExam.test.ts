import { describe, expect, it } from 'vitest';
import { grade } from './grade';
import { KIND_LABELS } from './kinds';
import { generateMockExam, gradeBand, partCount, partKey, partsOf, scoreExam } from './mockExam';
import type { Answer } from './grade';
import type { Grade, SimpleQuestion } from './types';

const SEEDS = Array.from({ length: 25 }, (_, i) => `exam${i}`);

/** The right answer to any part, as the player would enter it. */
function perfectAnswer(q: SimpleQuestion): Answer {
  switch (q.format) {
    case 'choice':
      return { format: 'choice', selected: q.correct };
    case 'numeric':
      return { format: 'numeric', value: q.answer };
    case 'order':
      return { format: 'order', order: q.correct };
    case 'lanes':
      return { format: 'lanes', lanes: q.expected };
    case 'match':
      return { format: 'match', choice: Object.fromEntries(q.rows.map((r) => [r.id, q.correct[r.id][0]])) };
  }
}

describe('mock exams', () => {
  it('have the seven problems of the course collection, in order', () => {
    const exam = generateMockExam('x');
    expect(exam.problems.map((p) => p.title)).toEqual([
      'Cloning strategy',
      'Cloning with PCR primers',
      'Lab calculations',
      'Gene expression analysis',
      'Expression vectors',
      'Yeast two-hybrid',
      'Techniques',
    ]);
  });

  it('are reproducible from the seed and different between seeds', () => {
    expect(generateMockExam('same')).toEqual(generateMockExam('same'));
    expect(JSON.stringify(generateMockExam('a'))).not.toEqual(JSON.stringify(generateMockExam('b')));
  });

  it('contain only known question kinds and a sensible number of parts', () => {
    for (const seed of SEEDS) {
      const exam = generateMockExam(seed);
      const n = partCount(exam);
      expect(n).toBeGreaterThanOrEqual(18);
      expect(n).toBeLessThanOrEqual(32);
      for (const p of exam.problems) for (const b of p.blocks) for (const part of partsOf(b)) expect(KIND_LABELS[part.kind]).toBeDefined();
    }
  });

  it('score 10 when every answer is right, 0 when nothing is answered', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const exam = generateMockExam(seed);
      const grades: Record<string, Grade> = {};
      exam.problems.forEach((p, pi) =>
        p.blocks.forEach((b, bi) => partsOf(b).forEach((part, i) => (grades[partKey(pi, bi, i)] = grade(part, perfectAnswer(part))))),
      );
      const full = scoreExam(exam, grades);
      expect(full.grade).toBe(10);
      expect(full.answered).toBe(full.total);
      expect(scoreExam(exam, {}).grade).toBe(0);
    }
  });

  it('weights every problem equally', () => {
    const exam = generateMockExam('weights');
    const grades: Record<string, Grade> = {};
    // Answer only problem 1, perfectly.
    exam.problems[0].blocks.forEach((b, bi) => partsOf(b).forEach((part, i) => (grades[partKey(0, bi, i)] = grade(part, perfectAnswer(part)))));
    expect(scoreExam(exam, grades).grade).toBeCloseTo(10 / 7, 1);
  });

  it('names the grade band', () => {
    expect(gradeBand(4.9)).toBe('Suspès');
    expect(gradeBand(5)).toBe('Aprovat');
    expect(gradeBand(7.2)).toBe('Notable');
    expect(gradeBand(9.5)).toBe('Excel·lent');
  });
});
