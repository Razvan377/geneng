import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyProgress, modeAccuracy, recordAnswer, recordDaily, sanitizeProgress, weakSpots } from './progress';
import { loadJSON, saveJSON } from './storage';

describe('progress', () => {
  it('adds points, counts streaks and remembers the best streak', () => {
    let p = emptyProgress();
    p = recordAnswer(p, { kind: 'pcr.tm', correct: true, points: 10, now: 1 });
    p = recordAnswer(p, { kind: 'pcr.tm', correct: true, points: 11, now: 2 });
    p = recordAnswer(p, { kind: 'ends.recut', correct: false, points: 0, now: 3 });
    expect(p.points).toBe(21);
    expect(p.streak).toBe(0);
    expect(p.bestStreak).toBe(2);
    expect(p.kinds['pcr.tm']).toEqual({ attempts: 2, correct: 2, last: 2 });
  });

  it('aggregates accuracy per mode', () => {
    let p = emptyProgress();
    p = recordAnswer(p, { kind: 'pcr.tm', correct: true, points: 10 });
    p = recordAnswer(p, { kind: 'pcr.product', correct: false, points: 0 });
    const acc = modeAccuracy(p);
    expect(acc.pcr).toEqual({ attempts: 2, correct: 1, rate: 0.5 });
    expect(acc.gel.rate).toBeNull();
  });

  it('ranks weak spots, weakest first', () => {
    let p = emptyProgress();
    for (let i = 0; i < 4; i++) p = recordAnswer(p, { kind: 'ends.recut', correct: i === 0, points: 0 });
    for (let i = 0; i < 4; i++) p = recordAnswer(p, { kind: 'pcr.tm', correct: true, points: 0 });
    p = recordAnswer(p, { kind: 'gel.pfge', correct: false, points: 0 }); // too few attempts
    expect(weakSpots(p).map((w) => w.kind)).toEqual(['ends.recut', 'pcr.tm']);
  });

  it('records the first solve of a daily challenge only', () => {
    let p = recordDaily(emptyProgress(), '2026-09-27', { solved: true, points: 50 });
    p = recordDaily(p, '2026-09-27', { solved: true, points: 10 });
    expect(p.daily['2026-09-27'].points).toBe(50);
  });

  it('repairs malformed stored data', () => {
    const p = sanitizeProgress({ points: -5, streak: 'x', kinds: { a: { attempts: 2, correct: 9 } }, daily: null });
    expect(p.points).toBe(0);
    expect(p.kinds.a).toEqual({ attempts: 2, correct: 2, last: 0 });
    expect(sanitizeProgress(null)).toEqual(emptyProgress());
  });
});

describe('storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back gracefully when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(loadJSON('x', { a: 1 })).toEqual({ a: 1 });
    expect(saveJSON('x', { a: 2 })).toBe(false);
  });

  it('falls back when localStorage does not exist', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadJSON('x', 7)).toBe(7);
    expect(saveJSON('x', 1)).toBe(false);
  });

  it('round-trips JSON through a working store', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
    expect(saveJSON('p', { points: 3 })).toBe(true);
    expect(loadJSON('p', null)).toEqual({ points: 3 });
    data.set('digest-lab:broken', '{not json');
    expect(loadJSON('broken', 'fallback')).toBe('fallback');
  });
});
