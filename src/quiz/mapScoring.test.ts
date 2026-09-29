import { describe, expect, it } from 'vitest';
import { mapPoints } from './mapScoring';

describe('mapping points', () => {
  it('pays more for harder puzzles', () => {
    expect(mapPoints({ difficulty: 'easy', exam: false, hints: 0, wrongChecks: 0 })).toBe(30);
    expect(mapPoints({ difficulty: 'hard', exam: false, hints: 0, wrongChecks: 0 })).toBe(80);
  });

  it('deducts for hints and wrong checks, with a floor', () => {
    expect(mapPoints({ difficulty: 'medium', exam: false, hints: 1, wrongChecks: 1 })).toBe(35);
    expect(mapPoints({ difficulty: 'medium', exam: false, hints: 3, wrongChecks: 9 })).toBe(10);
  });

  it('exam mode pays 1.5× plus a time bonus', () => {
    expect(mapPoints({ difficulty: 'medium', exam: true, hints: 0, wrongChecks: 0, secondsLeft: 125 })).toBe(75 + 12);
  });
});
