/**
 * Restriction digests of linear and circular molecules.
 *
 * All lengths and positions are integers in base pairs. A position p means "the enzyme cuts
 * p bp from the left end" (linear) or "p bp clockwise from 0" (circular, 0 ≤ p < L).
 *
 *   linear:   n distinct sites → n + 1 fragments
 *   circular: n distinct sites → n fragments (1 site → one linear molecule of full length)
 */

export type Topology = 'linear' | 'circular';

export interface Molecule {
  topology: Topology;
  length: number;
}

/** Enzyme name → cut positions (bp). */
export type SiteMap = Record<string, number[]>;

/** Sorted, de-duplicated, in-range positions. Circular positions are taken modulo L. */
export function normalizeSites(mol: Molecule, sites: readonly number[]): number[] {
  const L = mol.length;
  const set = new Set<number>();
  for (const raw of sites) {
    if (mol.topology === 'circular') {
      set.add(((raw % L) + L) % L);
    } else if (raw > 0 && raw < L) {
      set.add(raw);
    }
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Complete digest. Returns fragment sizes in ascending order.
 * An uncut circle (no sites) returns [] — it is not a linear fragment.
 */
export function digest(mol: Molecule, sites: readonly number[]): number[] {
  const s = normalizeSites(mol, sites);
  const L = mol.length;
  const out: number[] = [];
  if (mol.topology === 'linear') {
    let prev = 0;
    for (const p of s) {
      out.push(p - prev);
      prev = p;
    }
    out.push(L - prev);
  } else {
    if (s.length === 0) return [];
    for (let i = 0; i < s.length; i++) {
      const a = s[i];
      const b = i + 1 < s.length ? s[i + 1] : s[0] + L;
      out.push(b - a);
    }
  }
  return out.sort((a, b) => a - b);
}

/**
 * Partial digest: every fragment that spans at most `maxUncut` uncut sites, i.e. the complete
 * fragments plus the products in which one (or more) adjacent sites were not cleaved.
 * Returns the distinct sizes in ascending order (a gel shows bands, not molecule counts).
 *
 * With maxUncut ≥ number of sites a linear molecule's partial digest also contains the uncut
 * molecule (as in Brown's Figure 4.16); an uncut circle is never included.
 */
export function partialDigest(mol: Molecule, sites: readonly number[], maxUncut = 1): number[] {
  const s = normalizeSites(mol, sites);
  const L = mol.length;
  const sizes = new Set<number>();
  if (mol.topology === 'linear') {
    const bounds = [0, ...s, L];
    for (let i = 0; i < bounds.length - 1; i++) {
      for (let j = i + 1; j < bounds.length && j - i - 1 <= maxUncut; j++) {
        sizes.add(bounds[j] - bounds[i]);
      }
    }
  } else {
    const k = s.length;
    if (k === 0) return [];
    for (let i = 0; i < k; i++) {
      // Arc from site i clockwise to site i+span; span = k is the full circle cut once.
      for (let span = 1; span <= k && span - 1 <= maxUncut; span++) {
        const j = i + span;
        const end = j < k ? s[j] : s[j - k] + L;
        sizes.add(end - s[i]);
      }
    }
  }
  return [...sizes].sort((a, b) => a - b);
}

/** Union of the sites of the given enzymes. */
export function sitesOf(map: SiteMap, enzymes: readonly string[]): number[] {
  return enzymes.flatMap((e) => map[e] ?? []);
}

export function sameMultiset(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort((p, q) => p - q);
  const y = [...b].sort((p, q) => p - q);
  return x.every((v, i) => v === y[i]);
}

export function sameSet(a: readonly number[], b: readonly number[]): boolean {
  const x = [...new Set(a)].sort((p, q) => p - q);
  const y = [...new Set(b)].sort((p, q) => p - q);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/** Multiset difference a − b (each element of b removes one copy from a). */
export function multisetDifference(a: readonly number[], b: readonly number[]): number[] {
  const rest = [...b];
  const out: number[] = [];
  for (const v of a) {
    const i = rest.indexOf(v);
    if (i >= 0) rest.splice(i, 1);
    else out.push(v);
  }
  return out;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Circular distance between two positions on a molecule of length L. */
export function circularDistance(a: number, b: number, L: number): number {
  const d = Math.abs(a - b) % L;
  return Math.min(d, L - d);
}

// ---------------------------------------------------------------------------------------------
// Lanes: one digest experiment, as shown on a gel or in a data table.

export type LaneKind = 'single' | 'double' | 'partial';

export interface Lane {
  /** Unique within a puzzle, e.g. "EcoRI", "EcoRI+HindIII", "KpnI partial". */
  id: string;
  kind: LaneKind;
  enzymes: string[];
  /** Fragment sizes (bp, ascending). For partial lanes: the distinct band sizes. */
  fragments: number[];
  /** Partial lanes only: how many adjacent uncut sites a partial product may span. */
  maxUncut?: number;
}

export function makeLane(kind: LaneKind, enzymes: string[], fragments: number[], maxUncut?: number): Lane {
  const base = enzymes.join('+');
  return {
    id: kind === 'partial' ? `${base} partial` : base,
    kind,
    enzymes,
    fragments: [...fragments].sort((a, b) => a - b),
    ...(kind === 'partial' ? { maxUncut: maxUncut ?? 1 } : {}),
  };
}

/** What a given map predicts for this lane. */
export function predictLane(mol: Molecule, map: SiteMap, lane: Lane): number[] {
  const sites = sitesOf(map, lane.enzymes);
  return lane.kind === 'partial' ? partialDigest(mol, sites, lane.maxUncut ?? 1) : digest(mol, sites);
}

/** Complete digests compare as multisets; partial digests compare as sets of band sizes. */
export function laneMatches(lane: Lane, predicted: readonly number[]): boolean {
  return lane.kind === 'partial' ? sameSet(lane.fragments, predicted) : sameMultiset(lane.fragments, predicted);
}

/** Build every single, pairwise-double (and optional partial) lane for a known map. */
export function lanesForMap(
  mol: Molecule,
  enzymes: readonly string[],
  map: SiteMap,
  partialFor: readonly string[] = [],
): Lane[] {
  const lanes: Lane[] = [];
  for (const e of enzymes) lanes.push(makeLane('single', [e], digest(mol, map[e])));
  for (let i = 0; i < enzymes.length; i++) {
    for (let j = i + 1; j < enzymes.length; j++) {
      const pair = [enzymes[i], enzymes[j]];
      lanes.push(makeLane('double', pair, digest(mol, sitesOf(map, pair))));
    }
  }
  for (const e of partialFor) lanes.push(makeLane('partial', [e], partialDigest(mol, map[e], 1), 1));
  return lanes;
}
