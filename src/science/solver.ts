/**
 * Brute-force restriction-map solver.
 *
 * Idea: a single digest already fixes each enzyme's sites up to the ORDER of its fragments
 * (plus, on a circle, a rotation). So for each enzyme we enumerate every arrangement of its
 * single-digest fragments, and build maps enzyme by enzyme, discarding a partial map as soon as
 * a double (or partial) digest involving only placed enzymes disagrees with it.
 *
 * Maps that differ only by a mirror image (or a rotation, for circles) produce identical digests,
 * so they are the same answer: partial maps are de-duplicated on a canonical key at every step.
 * That keeps the search small and makes "number of solutions" mean "number of distinct answers".
 *
 * Completeness: in any consistent map every site sits at a sum of double-digest fragments from
 * another site, so every site lies on the grid g = gcd(all fragment sizes). On a circle we fix
 * one site of the first enzyme at 0 and try the other enzymes at every offset on that grid.
 */

import {
  digest,
  gcd,
  laneMatches,
  predictLane,
  type Lane,
  type Molecule,
  type SiteMap,
  type Topology,
} from './digest';

export interface DigestProblem {
  topology: Topology;
  /** Enzymes in display order. Each must have a single-digest lane. */
  enzymes: string[];
  lanes: Lane[];
}

export interface Trial {
  /** The partial map this placement was added to. */
  base: SiteMap;
  enzyme: string;
  placement: number[];
  /** First lane that rejected the placement, with what the placement predicts for it. */
  failed?: { lane: Lane; predicted: number[] };
  /** Lanes that were checked and matched. */
  passed: { lane: Lane; predicted: number[] }[];
}

export interface SolveStep {
  enzyme: string;
  /** Lanes that became checkable when this enzyme was added (excluding its single digest). */
  newLanes: Lane[];
  candidates: number[][];
  trials: Trial[];
  /** Distinct partial maps (up to symmetry) that survive this step. */
  survivors: SiteMap[];
}

export interface SolveResult {
  length: number;
  grid: number;
  order: string[];
  solutions: SiteMap[];
  steps?: SolveStep[];
}

export interface SolveOptions {
  /** Record every trial (used to write the worked solution). */
  trace?: boolean;
  /** Stop once this many distinct partial states exist at the final step (e.g. 2 for a uniqueness test). */
  limit?: number;
}

export function singleLane(problem: DigestProblem, enzyme: string): Lane {
  const lane = problem.lanes.find((l) => l.kind === 'single' && l.enzymes.length === 1 && l.enzymes[0] === enzyme);
  if (!lane) throw new Error(`No single digest for ${enzyme}`);
  return lane;
}

/** The molecule length implied by the data. Every single digest must add up to the same total. */
export function inferLength(problem: DigestProblem): number {
  const totals = problem.enzymes.map((e) => sum(singleLane(problem, e).fragments));
  if (totals.some((t) => t !== totals[0])) {
    throw new Error(`Single digests disagree on the total length: ${totals.join(', ')}`);
  }
  return totals[0];
}

/** Number of sites implied by a single digest: linear n + 1 fragments, circular n fragments. */
export function siteCount(topology: Topology, singleFragments: readonly number[]): number {
  return topology === 'linear' ? singleFragments.length - 1 : singleFragments.length;
}

/** gcd of every fragment in every lane: the finest grid any solution can live on. */
export function problemGrid(problem: DigestProblem): number {
  let g = 0;
  for (const lane of problem.lanes) for (const f of lane.fragments) g = gcd(g, f);
  return g || 1;
}

/** Distinct permutations of a multiset (lexicographic order). */
export function distinctPermutations(values: readonly number[]): number[][] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[][] = [];
  const used = new Array(sorted.length).fill(false);
  const cur: number[] = [];
  const rec = () => {
    if (cur.length === sorted.length) {
      out.push([...cur]);
      return;
    }
    for (let i = 0; i < sorted.length; i++) {
      if (used[i]) continue;
      if (i > 0 && sorted[i] === sorted[i - 1] && !used[i - 1]) continue;
      used[i] = true;
      cur.push(sorted[i]);
      rec();
      cur.pop();
      used[i] = false;
    }
  };
  rec();
  return out;
}

/**
 * Every way to place one enzyme's sites that reproduces its single digest.
 * Linear: prefix sums of each fragment order. Circular: each fragment order at every grid offset
 * (only offset 0 for the anchor enzyme, which fixes the rotation).
 */
export function candidatePlacements(
  topology: Topology,
  length: number,
  grid: number,
  fragments: readonly number[],
  anchor: boolean,
): number[][] {
  const seen = new Map<string, number[]>();
  const add = (sites: number[]) => {
    const sorted = [...sites].sort((a, b) => a - b);
    const key = sorted.join(',');
    if (!seen.has(key)) seen.set(key, sorted);
  };
  const perms = distinctPermutations(fragments);
  if (topology === 'linear') {
    for (const p of perms) {
      const sites: number[] = [];
      let acc = 0;
      for (let i = 0; i < p.length - 1; i++) {
        acc += p[i];
        sites.push(acc);
      }
      add(sites);
    }
  } else {
    const offsets = anchor ? [0] : range(0, length, grid);
    for (const p of perms) {
      for (const o of offsets) {
        const sites: number[] = [];
        let acc = o;
        for (const f of p) {
          sites.push(acc % length);
          acc += f;
        }
        add(sites);
      }
    }
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------------------------
// Canonical form (mirror images and rotations are the same map)

type MapArrays = number[][];

function compareArrays(a: MapArrays, b: MapArrays): number {
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    for (let j = 0; j < Math.min(x.length, y.length); j++) {
      if (x[j] !== y[j]) return x[j] - y[j];
    }
    if (x.length !== y.length) return x.length - y.length;
  }
  return 0;
}

function transform(arrays: MapArrays, f: (p: number) => number): MapArrays {
  return arrays.map((sites) => sites.map(f).sort((a, b) => a - b));
}

/**
 * The lexicographically smallest equivalent of a (partial) map. Enzymes absent from the map are
 * ignored, so partial maps can be compared too.
 */
export function canonicalArrays(
  topology: Topology,
  length: number,
  map: SiteMap,
  enzymeOrder: readonly string[],
): { names: string[]; arrays: MapArrays } {
  const names = enzymeOrder.filter((n) => map[n] !== undefined);
  const base = names.map((n) => [...map[n]].sort((a, b) => a - b));
  const L = length;
  const variants: MapArrays[] = [];
  if (topology === 'linear') {
    variants.push(base, transform(base, (p) => L - p));
  } else {
    const mirrored = transform(base, (p) => (L - p) % L);
    for (const v of [base, mirrored]) {
      const all = new Set(v.flat());
      for (const s of all) variants.push(transform(v, (p) => (p - s + L) % L));
    }
    if (variants.length === 0) variants.push(base);
  }
  let best = variants[0];
  for (const v of variants) if (compareArrays(v, best) < 0) best = v;
  return { names, arrays: best };
}

export function canonicalKey(topology: Topology, length: number, map: SiteMap, enzymeOrder: readonly string[]): string {
  const { names, arrays } = canonicalArrays(topology, length, map, enzymeOrder);
  return names.map((n, i) => `${n}:${arrays[i].join(',')}`).join('|');
}

export function canonicalize(topology: Topology, length: number, map: SiteMap, enzymeOrder: readonly string[]): SiteMap {
  const { names, arrays } = canonicalArrays(topology, length, map, enzymeOrder);
  return Object.fromEntries(names.map((n, i) => [n, arrays[i]]));
}

export function mirrorMap(topology: Topology, length: number, map: SiteMap): SiteMap {
  const f = topology === 'linear' ? (p: number) => length - p : (p: number) => (length - p) % length;
  return Object.fromEntries(Object.entries(map).map(([n, s]) => [n, s.map(f).sort((a, b) => a - b)]));
}

export function sameMap(topology: Topology, length: number, a: SiteMap, b: SiteMap, enzymes: readonly string[]): boolean {
  return canonicalKey(topology, length, a, enzymes) === canonicalKey(topology, length, b, enzymes);
}

// ---------------------------------------------------------------------------------------------
// Search

/**
 * Placement order: start with the enzyme with fewest sites (the "anchor"), then repeatedly add
 * the enzyme that shares a double digest with an already placed enzyme and has fewest sites.
 */
export function placementOrder(problem: DigestProblem): string[] {
  const sites = new Map(problem.enzymes.map((e) => [e, siteCount(problem.topology, singleLane(problem, e).fragments)]));
  const remaining = [...problem.enzymes];
  const order: string[] = [];
  const linked = (e: string) =>
    problem.lanes.some((l) => l.enzymes.length > 1 && l.enzymes.includes(e) && l.enzymes.some((x) => order.includes(x)));
  while (remaining.length) {
    let best = remaining[0];
    let bestScore = Infinity;
    for (const e of remaining) {
      const score = (order.length && !linked(e) ? 1000 : 0) + (sites.get(e) ?? 0) * 10 + problem.enzymes.indexOf(e) / 100;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    order.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }
  return order;
}

export function solve(problem: DigestProblem, options: SolveOptions = {}): SolveResult {
  const { topology, enzymes } = problem;
  const length = inferLength(problem);
  const grid = problemGrid(problem);
  const mol: Molecule = { topology, length };
  const order = placementOrder(problem);
  const steps: SolveStep[] = [];

  let states: SiteMap[] = [{}];
  const placed: string[] = [];

  for (let idx = 0; idx < order.length; idx++) {
    const enzyme = order[idx];
    placed.push(enzyme);
    const single = singleLane(problem, enzyme);
    const candidates = candidatePlacements(topology, length, grid, single.fragments, idx === 0);
    // Lanes that become checkable now: all their enzymes placed, and this enzyme among them.
    const checkLanes = problem.lanes.filter(
      (l) => l !== single && l.enzymes.includes(enzyme) && l.enzymes.every((e) => placed.includes(e)),
    );
    const next = new Map<string, SiteMap>();
    const trials: Trial[] = [];

    for (const base of states) {
      for (const placement of candidates) {
        const map: SiteMap = { ...base, [enzyme]: placement };
        let failed: Trial['failed'];
        const passed: Trial['passed'] = [];
        for (const lane of checkLanes) {
          const predicted = predictLane(mol, map, lane);
          if (laneMatches(lane, predicted)) {
            passed.push({ lane, predicted });
          } else {
            failed = { lane, predicted };
            break;
          }
        }
        if (options.trace) trials.push({ base, enzyme, placement, failed, passed });
        if (failed) continue;
        const key = canonicalKey(topology, length, map, enzymes);
        if (!next.has(key)) next.set(key, map);
        if (options.limit && idx === order.length - 1 && next.size >= options.limit) break;
      }
      if (options.limit && idx === order.length - 1 && next.size >= options.limit) break;
    }

    states = [...next.values()];
    if (options.trace) {
      steps.push({ enzyme, newLanes: checkLanes, candidates, trials, survivors: states });
    }
    if (states.length === 0) break;
  }

  return {
    length,
    grid,
    order,
    solutions: states.map((s) => orderKeys(s, enzymes)),
    ...(options.trace ? { steps } : {}),
  };
}

export function countSolutions(problem: DigestProblem, limit?: number): number {
  return solve(problem, { limit }).solutions.length;
}

export function isUnique(problem: DigestProblem): boolean {
  return countSolutions(problem, 2) === 1;
}

// ---------------------------------------------------------------------------------------------
// Checking a player's map against the data

export interface LaneCheck {
  lane: Lane;
  expected: number[];
  obtained: number[];
  ok: boolean;
}

export interface MapCheck {
  ok: boolean;
  lengthOk: boolean;
  expectedLength: number;
  lanes: LaneCheck[];
  /** Enzymes whose number of sites differs from what their single digest implies. */
  wrongSiteCounts: { enzyme: string; expected: number; placed: number }[];
}

/**
 * Validate a map against EVERY lane of the problem (not against a stored answer), so any
 * consistent map — mirror image and rotations included — is accepted.
 */
export function checkMap(problem: DigestProblem, playerLength: number, map: SiteMap): MapCheck {
  const expectedLength = inferLength(problem);
  const mol: Molecule = { topology: problem.topology, length: playerLength };
  const lanes = problem.lanes.map((lane) => {
    const obtained = predictLane(mol, map, lane);
    return { lane, expected: lane.fragments, obtained, ok: laneMatches(lane, obtained) };
  });
  const wrongSiteCounts = problem.enzymes
    .map((enzyme) => ({
      enzyme,
      expected: siteCount(problem.topology, singleLane(problem, enzyme).fragments),
      placed: new Set(map[enzyme] ?? []).size,
    }))
    .filter((w) => w.expected !== w.placed);
  const lengthOk = playerLength === expectedLength;
  return { ok: lengthOk && lanes.every((l) => l.ok), lengthOk, expectedLength, lanes, wrongSiteCounts };
}

/** Convenience: fragments for a map's single digest of one enzyme. */
export function singleDigestOf(topology: Topology, length: number, map: SiteMap, enzyme: string): number[] {
  return digest({ topology, length }, map[enzyme] ?? []);
}

function orderKeys(map: SiteMap, enzymes: readonly string[]): SiteMap {
  return Object.fromEntries(enzymes.filter((e) => map[e]).map((e) => [e, [...map[e]].sort((a, b) => a - b)]));
}

function sum(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let v = start; v < end; v += step) out.push(v);
  return out;
}
