/**
 * Seeded pseudo-random number generation.
 *
 * Every puzzle and question in Digest Lab is generated from a short string seed, so
 * anything can be shared or replayed. The seed is hashed with cyrb128 and fed to the
 * sfc32 generator (small, fast, good statistical quality — plenty for a game).
 */

export interface Rng {
  readonly seed: string;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] (both inclusive). */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  /** n distinct items, in random order. */
  sample<T>(items: readonly T[], n: number): T[];
  chance(p: number): boolean;
  /** An independent generator derived from this seed and a label (stable across calls). */
  fork(label: string): Rng;
}

/** cyrb128 string hash → four 32-bit words. */
export function hashSeed(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const next = sfc32(...hashSeed(seed));
  // Discard the first outputs: sfc32 needs a few rounds to mix a fresh state.
  for (let i = 0; i < 12; i++) next();

  const rng: Rng = {
    seed,
    next,
    int(min, max) {
      if (max < min) throw new Error(`rng.int: empty range [${min}, ${max}]`);
      return min + Math.floor(next() * (max - min + 1));
    },
    float(min, max) {
      return min + next() * (max - min);
    },
    pick(items) {
      if (items.length === 0) throw new Error('rng.pick: empty list');
      return items[Math.floor(next() * items.length)];
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample(items, n) {
      if (n > items.length) throw new Error('rng.sample: n larger than list');
      return rng.shuffle(items).slice(0, n);
    },
    chance(p) {
      return next() < p;
    },
    fork(label) {
      return createRng(`${seed}/${label}`);
    },
  };
  return rng;
}

const SEED_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no l/1/o/0: easy to read aloud

/** A fresh, human-friendly seed. The only place that uses non-seeded randomness. */
export function randomSeed(length = 7): string {
  const bytes = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 2 ** 32);
  }
  let out = '';
  for (let i = 0; i < length; i++) out += SEED_ALPHABET[bytes[i] % SEED_ALPHABET.length];
  return out;
}

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Seed of the daily challenge: everyone gets the same puzzle on the same day. */
export function dailySeed(date: Date): string {
  return `daily-${isoDate(date)}`;
}
