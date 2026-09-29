/** Points for a restriction-mapping puzzle. */

import type { Difficulty } from '../science/puzzle';

export const MAP_BASE_POINTS: Record<Difficulty, number> = { easy: 30, medium: 50, hard: 80 };

/** Exam-mode time limits (minutes). */
export const EXAM_MINUTES: Record<Difficulty, number> = { easy: 5, medium: 8, hard: 12 };

export interface MapScoreInput {
  difficulty: Difficulty;
  exam: boolean;
  /** Hints revealed before solving (the worked solution counts as giving up). */
  hints: number;
  wrongChecks: number;
  /** Exam mode: seconds left on the clock when solved. */
  secondsLeft?: number;
}

/**
 * Base points by difficulty; each hint costs 20% and each wrong check 10% (never below 20% of
 * the base). Exam mode pays 1.5× plus 1 point per 10 s left on the clock.
 */
export function mapPoints({ difficulty, exam, hints, wrongChecks, secondsLeft = 0 }: MapScoreInput): number {
  const base = MAP_BASE_POINTS[difficulty] * (exam ? 1.5 : 1);
  const factor = Math.max(0.2, 1 - 0.2 * hints - 0.1 * wrongChecks);
  const timeBonus = exam ? Math.floor(Math.max(0, secondsLeft) / 10) : 0;
  return Math.round(base * factor) + timeBonus;
}
