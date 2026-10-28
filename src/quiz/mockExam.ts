/**
 * Mock exams: seven problems laid out like the course's solved problem collection —
 * cloning strategy, cloning with PCR, lab calculations (lessons 1–2), Northern/Southern/RT-PCR/
 * Western of gene variants, expression vectors, yeast two-hybrid and techniques.
 *
 * Every exam is generated from one seed (each question gets a derived seed), so there is an
 * endless supply of exams and any exam can be replayed or shared.
 */

import { createRng } from '../science/rng';
import { generateBlotQuestion } from './blotQuestions';
import { generateCloningQuestion } from './cloningQuestions';
import { generateExpressionQuestion, type ExpressionKind } from './expressionQuestions';
import { generateFunctionalQuestion } from './functionalQuestions';
import { generateGelQuestion } from './gelQuestions';
import { generateNumbersQuestion } from './numbersQuestions';
import { generatePcrQuestion } from './pcrQuestions';
import type { Grade, Question, SimpleQuestion } from './types';

export interface ExamProblem {
  number: number;
  title: string;
  /** Where this kind of problem comes from in the course material. */
  source: string;
  /** Points on the exam paper; when every problem has them, problems are weighted by points. */
  points?: number;
  blocks: Question[];
}

export interface MockExam {
  seed: string;
  problems: ExamProblem[];
}

export function generateMockExam(seed: string): MockExam {
  const rng = createRng(`mock/${seed}`);
  const sub = (label: string) => `${seed}-${label}`;

  const cloning2 = rng.pick([
    () => [generateCloningQuestion(sub('primers'), 'primers'), generateCloningQuestion(sub('rescue'), 'rescue')],
    () => [generatePcrQuestion(sub('design'), 'design'), generateCloningQuestion(sub('rbs'), 'rbs')],
    () => [generateCloningQuestion(sub('rbs'), 'rbs'), generateCloningQuestion(sub('blunt'), 'blunt')],
    () => [generateCloningQuestion(sub('primers'), 'primers'), generatePcrQuestion(sub('design'), 'design')],
  ])();

  const expressionKinds: ExpressionKind[] = [
    'host',
    rng.pick<ExpressionKind>(['inducer', 'cellfree']),
    'tag',
    rng.pick<ExpressionKind>(['frame', 'sds', 'western', 'trouble']),
  ];

  const techniques = rng
    .sample(
      [
        () => generateFunctionalQuestion(sub('reporter'), 'reporter'),
        () => generateBlotQuestion(sub('mutants'), 'mutants'),
        () => generateBlotQuestion(sub('map'), 'map'),
      ],
      2,
    )
    .map((f) => f());

  const problems: Omit<ExamProblem, 'number'>[] = [
    {
      title: 'Cloning strategy',
      source: 'Cloning problems I (1–2, 5)',
      blocks: [generateCloningQuestion(sub('plac'), 'plac')],
    },
    {
      title: 'Cloning with PCR primers',
      source: 'Cloning problems I (3, 4, 6–8) and II',
      blocks: cloning2,
    },
    {
      title: 'Lab calculations',
      source: 'Lesson 1 and Lesson 2 problems',
      blocks: [generateGelQuestion(sub('quant'), 'quant'), generateNumbersQuestion(sub('units'), 'unitsites')],
    },
    {
      title: 'Gene expression analysis',
      source: 'Problems lessons 7–8: Southern, Northern, RT-PCR, Western',
      blocks: [rng.chance(0.75) ? generateBlotQuestion(sub('panel'), 'panel') : generateBlotQuestion(sub('isoforms'), 'isoforms')],
    },
    {
      title: 'Expression vectors',
      source: 'Expression vectors, problems 1–4',
      blocks: expressionKinds.map((k) => generateExpressionQuestion(sub(`expr-${k}`), k)),
    },
    {
      title: 'Yeast two-hybrid',
      source: 'Yeast two-hybrid problem',
      blocks: [generateFunctionalQuestion(sub('y2h'), 'y2h')],
    },
    {
      title: 'Techniques',
      source: 'Techniques, problems 1–5',
      blocks: [generateFunctionalQuestion(sub('technique'), 'technique'), ...techniques],
    },
  ];

  return { seed, problems: problems.map((p, i) => ({ ...p, number: i + 1 })) };
}

/** Every answerable part of a block (a case contributes its parts). */
export function partsOf(q: Question): SimpleQuestion[] {
  return q.format === 'case' ? q.parts : [q];
}

export function partCount(exam: MockExam): number {
  return exam.problems.reduce((n, p) => n + p.blocks.reduce((m, b) => m + partsOf(b).length, 0), 0);
}

/** Key of one part: problem index, block index, part index. */
export function partKey(problem: number, block: number, part: number): string {
  return `${problem}.${block}.${part}`;
}

export interface ExamScore {
  /** 0–10, one decimal; problems weighted by their points, or equally when they have none. */
  grade: number;
  /** Per problem: fraction 0–1 (average score of its parts; unanswered parts count 0). */
  problems: number[];
  answered: number;
  total: number;
}

export function scoreExam(exam: MockExam, grades: Readonly<Record<string, Grade>>): ExamScore {
  let answered = 0;
  let total = 0;
  const problems = exam.problems.map((p, pi) => {
    let sum = 0;
    let n = 0;
    p.blocks.forEach((b, bi) =>
      partsOf(b).forEach((_, i) => {
        const g = grades[partKey(pi, bi, i)];
        n++;
        total++;
        if (g) {
          answered++;
          sum += g.score;
        }
      }),
    );
    return n ? sum / n : 0;
  });
  // Weighted by points when the paper gives them (e.g. 3 + 2 + 3 + 2), otherwise equally.
  const weights = exam.problems.every((p) => p.points) ? exam.problems.map((p) => p.points!) : exam.problems.map(() => 1);
  const total10 = (problems.reduce((sum, f, i) => sum + f * weights[i], 0) / weights.reduce((a, b) => a + b, 0)) * 10;
  const grade = Math.round(total10 * 10) / 10;
  return { grade, problems, answered, total };
}

/** Spanish university grading bands. */
export function gradeBand(grade: number): string {
  if (grade >= 9) return 'Excel·lent';
  if (grade >= 7) return 'Notable';
  if (grade >= 5) return 'Aprovat';
  return 'Suspès';
}
