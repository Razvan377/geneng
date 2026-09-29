import { describe, expect, it } from 'vitest';
import { reverseComplement } from '../science/dna';
import { analyzePrimerPair, pcrProduct } from '../science/pcr';
import { createRng } from '../science/rng';
import { ENDS_KINDS, generateEndsQuestion } from './endsQuestions';
import { GEL_KINDS, generateGelQuestion } from './gelQuestions';
import { gradeChoice, gradeNumeric, gradeOrder, pointsFor } from './grade';
import { KIND_LABELS } from './kinds';
import { generateNumbersQuestion, NUMBERS_KINDS } from './numbersQuestions';
import { BROWN_PRIMER, generatePcrQuestion, makeBadPair, PCR_KINDS } from './pcrQuestions';
import type { ChoiceQuestion, NumericQuestion, Question } from './types';

const SEEDS = Array.from({ length: 40 }, (_, i) => `q${i}`);

function checkWellFormed(q: Question) {
  expect(KIND_LABELS[q.kind]).toBeDefined();
  expect(q.prompt.length).toBeGreaterThan(10);
  expect(q.explanation.length).toBeGreaterThan(0);
  if (q.format === 'choice') {
    const ids = q.options.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(q.correct.length).toBeGreaterThan(0);
    for (const c of q.correct) expect(ids).toContain(c);
    if (!q.multi) expect(q.correct).toHaveLength(1);
    expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length);
  } else if (q.format === 'numeric') {
    expect(Number.isFinite(q.answer)).toBe(true);
    expect(gradeNumeric(q, q.answer).correct).toBe(true);
  } else {
    expect([...q.correct].sort()).toEqual(q.items.map((i) => i.id).sort());
  }
}

describe.each([
  ['ends', ENDS_KINDS, generateEndsQuestion],
  ['pcr', PCR_KINDS, generatePcrQuestion],
  ['gel', GEL_KINDS, generateGelQuestion],
  ['numbers', NUMBERS_KINDS, generateNumbersQuestion],
] as const)('%s generators', (_mode, kinds, generate) => {
  it.each([...kinds])('%s: well-formed and reproducible for many seeds', (kind) => {
    for (const seed of SEEDS) {
      const q = (generate as (s: string, k: string) => Question)(seed, kind);
      checkWellFormed(q);
      expect((generate as (s: string, k: string) => Question)(seed, kind)).toEqual(q);
    }
  });
});

describe('ends questions', () => {
  it('BamHI/BglII recut questions expect Sau3AI only', () => {
    for (const seed of SEEDS) {
      const q = generateEndsQuestion(seed, 'recut') as ChoiceQuestion;
      if (q.prompt.includes('cut with BamHI was ligated to a fragment cut with BglII')) {
        expect(q.correct).toEqual(['Sau3AI']);
      }
    }
  });

  it('directional-cloning questions have exactly one valid pair', () => {
    for (const seed of SEEDS) {
      const q = generateEndsQuestion(seed, 'directional') as ChoiceQuestion;
      expect(q.correct).toHaveLength(1);
      expect(q.options.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('pcr questions', () => {
  it('bad-pair questions contain exactly the advertised defect', () => {
    for (const seed of SEEDS) {
      const q = generatePcrQuestion(seed, 'badpair') as ChoiceQuestion;
      const [f, r] = (q.visual as { rows: { seq: string }[] }).rows.map((x) => x.seq);
      const issues = analyzePrimerPair(f, r).issues;
      expect(issues).toEqual(q.correct[0] === 'none' ? [] : q.correct);
    }
  });

  it('can build every kind of defect', () => {
    const rng = createRng('defects');
    for (const d of ['none', 'tm-mismatch', 'gc-content', 'no-gc-clamp', 'self-complementary', 'primer-dimer', 'too-short'] as const) {
      const [f, r] = makeBadPair(rng, d);
      expect(analyzePrimerPair(f, r).issues).toEqual(d === 'none' ? [] : [d]);
    }
  });

  it('product-length answers match an actual PCR simulation', () => {
    for (const seed of SEEDS) {
      const q = generatePcrQuestion(seed, 'product') as NumericQuestion;
      const [template, fwd, rev] = (q.visual as { rows: { seq: string }[] }).rows.map((x) => x.seq);
      expect(pcrProduct(template, fwd, rev)!.length).toBe(q.answer);
    }
  });

  it('the correct reverse primer is the reverse complement of the template end', () => {
    for (const seed of SEEDS) {
      const q = generatePcrQuestion(seed, 'reverse') as ChoiceQuestion;
      const correct = q.options.find((o) => o.id === 'rc')!.label.replace(/^5′-|-3′$/g, '');
      const template = (q.visual as { rows: { seq: string }[] }).rows[0].seq;
      expect(template).toContain(reverseComplement(correct));
    }
  });

  it("Brown's primer shows up with Tm 52 °C", () => {
    const found = SEEDS.concat(Array.from({ length: 60 }, (_, i) => `b${i}`))
      .map((s) => generatePcrQuestion(s, 'tm') as NumericQuestion)
      .find((q) => (q.visual as { rows: { seq: string }[] }).rows[0].seq === BROWN_PRIMER && q.unit === '°C' && q.answer === 52);
    expect(found).toBeDefined();
  });
});

describe('grading', () => {
  const choice: ChoiceQuestion = {
    kind: 'ends.recut',
    seed: 's',
    format: 'choice',
    prompt: 'x',
    explanation: ['x'],
    options: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    correct: ['a', 'b'],
    multi: true,
  };

  it('multi-select needs exactly the right set', () => {
    expect(gradeChoice(choice, ['b', 'a']).correct).toBe(true);
    expect(gradeChoice(choice, ['a']).correct).toBe(false);
  });

  it('numeric tolerance: relative and absolute', () => {
    const q: NumericQuestion = {
      kind: 'num.units',
      seed: 's',
      format: 'numeric',
      prompt: 'x',
      explanation: ['x'],
      answer: 100,
      unit: '',
      tolerance: 0.02,
      answerLabel: '100',
    };
    expect(gradeNumeric(q, 101.9).correct).toBe(true);
    expect(gradeNumeric(q, 103).correct).toBe(false);
    expect(gradeNumeric({ ...q, tolerance: 0, absTolerance: 1 }, 99).correct).toBe(true);
    expect(gradeNumeric(q, null).correct).toBe(false);
  });

  it('gel estimates score by closeness on a log scale', () => {
    const q: NumericQuestion = {
      kind: 'gel.size',
      seed: 's',
      format: 'numeric',
      grading: 'gel',
      prompt: 'x',
      explanation: ['x'],
      answer: 2,
      unit: 'kb',
      tolerance: 0.1,
      answerLabel: '2 kb',
    };
    expect(gradeNumeric(q, 2.05).score).toBe(1);
    expect(gradeNumeric(q, 2.15)).toMatchObject({ score: 0.7, correct: true });
    expect(gradeNumeric(q, 1.75)).toMatchObject({ score: 0.4, correct: false });
    expect(gradeNumeric(q, 3).score).toBe(0);
  });

  it('order questions need the exact order', () => {
    const q = { correct: ['a', 'b', 'c'] } as Parameters<typeof gradeOrder>[0];
    expect(gradeOrder(q, ['a', 'b', 'c']).correct).toBe(true);
    expect(gradeOrder(q, ['a', 'c', 'b']).correct).toBe(false);
  });

  it('points include a capped streak bonus', () => {
    expect(pointsFor({ correct: true, score: 1, headline: '' }, 3)).toBe(13);
    expect(pointsFor({ correct: true, score: 1, headline: '' }, 50)).toBe(20);
    expect(pointsFor({ correct: false, score: 0, headline: '' }, 5)).toBe(0);
  });
});
