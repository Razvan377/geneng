/**
 * Points, streaks and per-question-type accuracy. Pure functions over a plain object, so the
 * rules are unit-testable and the React layer only has to persist the result.
 */

import { MODE_ORDER, modeOf, type ModeId } from '../quiz/kinds';

export interface KindStat {
  attempts: number;
  correct: number;
  /** Timestamp (ms) of the last attempt. */
  last: number;
}

export interface DailyRecord {
  solved: boolean;
  points: number;
}

export interface Progress {
  version: 1;
  points: number;
  streak: number;
  bestStreak: number;
  kinds: Record<string, KindStat>;
  daily: Record<string, DailyRecord>;
}

export function emptyProgress(): Progress {
  return { version: 1, points: 0, streak: 0, bestStreak: 0, kinds: {}, daily: {} };
}

/** Accept whatever came out of storage, repairing anything malformed. */
export function sanitizeProgress(value: unknown): Progress {
  const p = emptyProgress();
  if (typeof value !== 'object' || value === null) return p;
  const v = value as Partial<Progress>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
  p.points = num(v.points);
  p.streak = num(v.streak);
  p.bestStreak = Math.max(num(v.bestStreak), p.streak);
  if (v.kinds && typeof v.kinds === 'object') {
    for (const [k, s] of Object.entries(v.kinds)) {
      if (s && typeof s === 'object') {
        const attempts = num((s as KindStat).attempts);
        p.kinds[k] = { attempts, correct: Math.min(num((s as KindStat).correct), attempts), last: num((s as KindStat).last) };
      }
    }
  }
  if (v.daily && typeof v.daily === 'object') {
    for (const [d, r] of Object.entries(v.daily)) {
      if (r && typeof r === 'object') p.daily[d] = { solved: Boolean((r as DailyRecord).solved), points: num((r as DailyRecord).points) };
    }
  }
  return p;
}

export interface AnswerEvent {
  kind: string;
  correct: boolean;
  points: number;
  now?: number;
}

export function recordAnswer(p: Progress, e: AnswerEvent): Progress {
  const prev = p.kinds[e.kind] ?? { attempts: 0, correct: 0, last: 0 };
  const streak = e.correct ? p.streak + 1 : 0;
  return {
    ...p,
    points: p.points + Math.max(0, Math.round(e.points)),
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    kinds: {
      ...p.kinds,
      [e.kind]: { attempts: prev.attempts + 1, correct: prev.correct + (e.correct ? 1 : 0), last: e.now ?? Date.now() },
    },
  };
}

export function recordDaily(p: Progress, date: string, rec: DailyRecord): Progress {
  const existing = p.daily[date];
  if (existing?.solved) return p; // first solve counts
  return { ...p, daily: { ...p.daily, [date]: rec } };
}

export interface Accuracy {
  attempts: number;
  correct: number;
  /** 0–1, or null with no attempts. */
  rate: number | null;
}

function accuracy(stats: KindStat[]): Accuracy {
  const attempts = stats.reduce((a, s) => a + s.attempts, 0);
  const correct = stats.reduce((a, s) => a + s.correct, 0);
  return { attempts, correct, rate: attempts ? correct / attempts : null };
}

export function modeAccuracy(p: Progress): Record<ModeId, Accuracy> {
  const out = {} as Record<ModeId, Accuracy>;
  for (const mode of MODE_ORDER) {
    out[mode] = accuracy(Object.entries(p.kinds).filter(([k]) => modeOf(k) === mode).map(([, s]) => s));
  }
  return out;
}

export interface WeakSpot {
  kind: string;
  attempts: number;
  correct: number;
  rate: number;
}

/**
 * Question types sorted from weakest to strongest. Uses a smoothed accuracy
 * ((correct + 1) / (attempts + 2)) so one lucky or unlucky answer does not dominate.
 */
export function weakSpots(p: Progress, minAttempts = 2): WeakSpot[] {
  return Object.entries(p.kinds)
    .filter(([, s]) => s.attempts >= minAttempts)
    .map(([kind, s]) => ({ kind, attempts: s.attempts, correct: s.correct, rate: s.correct / s.attempts }))
    .sort((a, b) => (a.correct + 1) / (a.attempts + 2) - (b.correct + 1) / (b.attempts + 2) || b.attempts - a.attempts);
}
