/** Grading of typed / tapped answers. Pure functions, unit tested. */

import { relativeError } from '../science/numbers';
import type { ChoiceQuestion, Grade, NumericQuestion, OrderQuestion, Question } from './types';

export function gradeChoice(q: ChoiceQuestion, selected: readonly string[]): Grade {
  const want = new Set(q.correct);
  const got = new Set(selected);
  const correct = want.size === got.size && [...want].every((id) => got.has(id));
  return { correct, score: correct ? 1 : 0, headline: correct ? 'Correct' : 'Not quite' };
}

/** Log-distance bands for size estimates from a gel. */
export const GEL_BANDS = [
  { maxError: 0.05, score: 1, headline: 'Excellent estimate' },
  { maxError: 0.1, score: 0.7, headline: 'Good estimate' },
  { maxError: 0.2, score: 0.4, headline: 'In the right region' },
] as const;

export function gradeNumeric(q: NumericQuestion, value: number | null): Grade {
  if (value === null || !Number.isFinite(value)) {
    return { correct: false, score: 0, headline: 'That is not a number I can read' };
  }
  if (q.grading === 'gel') {
    if (value <= 0) return { correct: false, score: 0, headline: 'Sizes are positive' };
    // Symmetric in log space: guessing double is as bad as guessing half.
    const err = Math.abs(Math.log10(value / q.answer));
    for (const band of GEL_BANDS) {
      if (err <= Math.log10(1 + band.maxError)) {
        return { correct: band.maxError <= 0.1, score: band.score, headline: band.headline };
      }
    }
    return { correct: false, score: 0, headline: 'Too far off' };
  }
  const withinRel = relativeError(value, q.answer) <= q.tolerance;
  const withinAbs = q.absTolerance !== undefined && Math.abs(value - q.answer) <= q.absTolerance + 1e-9;
  const correct = withinRel || withinAbs;
  return { correct, score: correct ? 1 : 0, headline: correct ? 'Correct' : 'Not quite' };
}

export function gradeOrder(q: OrderQuestion, order: readonly string[]): Grade {
  const correct = order.length === q.correct.length && order.every((id, i) => id === q.correct[i]);
  return { correct, score: correct ? 1 : 0, headline: correct ? 'Correct order' : 'Not quite' };
}

export type Answer = { format: 'choice'; selected: string[] } | { format: 'numeric'; value: number | null } | { format: 'order'; order: string[] };

export function grade(q: Question, a: Answer): Grade {
  if (q.format === 'choice' && a.format === 'choice') return gradeChoice(q, a.selected);
  if (q.format === 'numeric' && a.format === 'numeric') return gradeNumeric(q, a.value);
  if (q.format === 'order' && a.format === 'order') return gradeOrder(q, a.order);
  throw new Error('Answer format does not match question');
}

/** Points for an answer: 10 × score, plus a small streak bonus for correct answers. */
export function pointsFor(g: Grade, streakBefore: number, base = 10): number {
  if (g.score <= 0) return 0;
  return Math.round(base * g.score + (g.correct ? Math.min(streakBefore, 10) : 0));
}
