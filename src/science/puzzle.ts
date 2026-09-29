/**
 * Restriction-mapping puzzles: random generation (seeded) and the fixed Classic levels.
 */

import {
  circularDistance,
  lanesForMap,
  makeLane,
  type Lane,
  type Molecule,
  type SiteMap,
  type Topology,
} from './digest';
import { MAPPING_ENZYMES } from './enzymes';
import { createRng, type Rng } from './rng';
import { isUnique, siteCount, type DigestProblem } from './solver';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Puzzle {
  /** Seed for random/daily puzzles, "classic-A" etc. for fixed levels. */
  id: string;
  source: 'random' | 'daily' | 'classic';
  difficulty: Difficulty;
  title: string;
  /** Short description of the experiment shown above the data. */
  intro: string;
  problem: DigestProblem;
  length: number;
  /** Whether the total length is stated (otherwise the player derives it from the data). */
  lengthGiven: boolean;
  /** Snap grid for the map builder, bp. */
  grid: number;
  /** One correct map (any mirror/rotation of it is equally correct). */
  truth: SiteMap;
  /** Name of the molecule, e.g. "λ DNA". */
  molecule?: string;
}

interface Config {
  topology: Topology;
  lengthBp: [number, number];
  grid: number;
  enzymeCount: number;
  cuts: number[];
  minFragment: number;
  lengthGiven: boolean;
  /** 'never' | 'fallback' (only if regeneration keeps failing) | 'required' (must be needed). */
  partial: 'never' | 'fallback' | 'allowed' | 'required';
}

function configFor(difficulty: Difficulty, rng: Rng): Config {
  switch (difficulty) {
    case 'easy':
      return {
        topology: 'linear',
        lengthBp: [5000, 15000],
        grid: 500,
        enzymeCount: 2,
        cuts: [1, 1],
        minFragment: 1000,
        lengthGiven: true,
        partial: 'never',
      };
    case 'medium': {
      const enzymeCount = rng.int(2, 3);
      const cuts = rng.shuffle([2, ...Array(enzymeCount - 1).fill(1)]);
      return {
        topology: 'linear',
        lengthBp: [6000, 20000],
        grid: 500,
        enzymeCount,
        cuts,
        minFragment: 500,
        lengthGiven: false,
        partial: 'fallback',
      };
    }
    case 'hard': {
      if (rng.chance(0.5)) {
        const enzymeCount = rng.int(2, 3);
        let cuts: number[];
        do {
          cuts = Array.from({ length: enzymeCount }, () => rng.int(1, 3));
        } while (sumOf(cuts) < 3 || sumOf(cuts) > 6);
        return {
          topology: 'circular',
          lengthBp: [3000, 12000],
          grid: 100,
          enzymeCount,
          cuts,
          minFragment: 300,
          lengthGiven: false,
          partial: 'allowed',
        };
      }
      const enzymeCount = rng.int(2, 3);
      const cuts = rng.shuffle([3, ...Array.from({ length: enzymeCount - 1 }, () => rng.int(1, 2))]);
      return {
        topology: 'linear',
        lengthBp: [8000, 50000],
        grid: 100,
        enzymeCount,
        cuts,
        minFragment: 500,
        lengthGiven: false,
        partial: 'required',
      };
    }
  }
}

/** Random grid positions with a minimum spacing (and distance from the ends of a linear molecule). */
export function placeSites(rng: Rng, mol: Molecule, grid: number, count: number, minGap: number): number[] | null {
  const L = mol.length;
  const lo = mol.topology === 'linear' ? minGap : 0;
  const hi = mol.topology === 'linear' ? L - minGap : L - grid;
  if (hi < lo) return null;
  const sites: number[] = [];
  for (let attempt = 0; attempt < 400 && sites.length < count; attempt++) {
    const p = rng.int(Math.ceil(lo / grid), Math.floor(hi / grid)) * grid;
    const ok = sites.every((s) =>
      mol.topology === 'linear' ? Math.abs(s - p) >= minGap : circularDistance(s, p, L) >= minGap,
    );
    if (ok) sites.push(p);
  }
  return sites.length === count ? sites : null;
}

function problemFor(mol: Molecule, enzymes: string[], truth: SiteMap, partialFor: string[]): DigestProblem {
  return { topology: mol.topology, enzymes, lanes: lanesForMap(mol, enzymes, truth, partialFor) };
}

/** Subsets of multi-cut enzymes to try as partial-digest lanes, smallest first. */
function partialOptions(enzymes: string[], truth: SiteMap): string[][] {
  const multi = enzymes.filter((e) => truth[e].length >= 2);
  const out: string[][] = multi.map((e) => [e]);
  if (multi.length > 1) out.push(multi);
  return out;
}

interface Attempt {
  mol: Molecule;
  enzymes: string[];
  truth: SiteMap;
  problem: DigestProblem;
}

function attempt(rng: Rng, cfg: Config, allowPartial: boolean, requirePartial: boolean): Attempt | null {
  const length = rng.int(cfg.lengthBp[0] / cfg.grid, cfg.lengthBp[1] / cfg.grid) * cfg.grid;
  const mol: Molecule = { topology: cfg.topology, length };
  const enzymes = rng.sample(MAPPING_ENZYMES, cfg.enzymeCount);
  const total = sumOf(cfg.cuts);
  // Keep plasmids from getting too crowded to read.
  if (total * cfg.minFragment > length * 0.7) return null;
  const sites = placeSites(rng, mol, cfg.grid, total, cfg.minFragment);
  if (!sites) return null;
  const shuffled = rng.shuffle(sites);
  const truth: SiteMap = {};
  let k = 0;
  enzymes.forEach((e, i) => {
    truth[e] = shuffled.slice(k, k + cfg.cuts[i]).sort((a, b) => a - b);
    k += cfg.cuts[i];
  });

  const plain = problemFor(mol, enzymes, truth, []);
  const plainUnique = isUnique(plain);
  if (plainUnique && !requirePartial) return { mol, enzymes, truth, problem: plain };
  if (!allowPartial || plainUnique) return null;
  for (const partialFor of partialOptions(enzymes, truth)) {
    const withPartial = problemFor(mol, enzymes, truth, partialFor);
    if (isUnique(withPartial)) return { mol, enzymes, truth, problem: withPartial };
  }
  return null;
}

const MAX_ATTEMPTS = 400;

/**
 * Generate a puzzle whose solution is unique (up to mirror image / rotation).
 * Deterministic: the same seed and difficulty always give the same puzzle.
 */
export function generatePuzzle(seed: string, difficulty: Difficulty, source: Puzzle['source'] = 'random'): Puzzle {
  const rng = createRng(`map/${difficulty}/${seed}`);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const cfg = configFor(difficulty, rng);
    const allowPartial =
      cfg.partial === 'allowed' || cfg.partial === 'required' || (cfg.partial === 'fallback' && i >= 40);
    const result = attempt(rng, cfg, allowPartial, cfg.partial === 'required');
    if (result) return toPuzzle(seed, difficulty, source, cfg, result);
  }
  throw new Error(`Could not generate a ${difficulty} puzzle for seed ${seed}`);
}

function toPuzzle(seed: string, difficulty: Difficulty, source: Puzzle['source'], cfg: Config, a: Attempt): Puzzle {
  const circular = a.mol.topology === 'circular';
  const names = joinNames(a.enzymes);
  const hasPartial = a.problem.lanes.some((l) => l.kind === 'partial');
  const what = circular ? 'A circular plasmid' : cfg.lengthGiven ? `A linear DNA molecule of ${kb(a.mol.length)} kb` : 'A linear DNA molecule';
  const intro =
    `${what} was digested with ${names}, each enzyme alone and every pair together` +
    (hasPartial ? ', plus a partial digest' : '') +
    '. Build a restriction map that explains every lane.';
  return {
    id: seed,
    source,
    difficulty,
    title: circular ? 'Plasmid map' : 'Linear map',
    intro,
    problem: a.problem,
    length: a.mol.length,
    lengthGiven: cfg.lengthGiven,
    grid: cfg.grid,
    truth: a.truth,
  };
}

// ---------------------------------------------------------------------------------------------
// Classic levels (fixed data from the lecture slides and from Brown Figure 4.16)

const kbp = (kbValue: number) => Math.round(kbValue * 1000);
const lane = (kind: Lane['kind'], enzymes: string[], fragmentsKb: number[], maxUncut?: number): Lane =>
  makeLane(kind, enzymes, fragmentsKb.map(kbp), maxUncut);

export const CLASSIC_A: Puzzle = {
  id: 'classic-A',
  source: 'classic',
  difficulty: 'easy',
  title: 'Classic A',
  intro: 'A 10 kb linear DNA molecule was cut with E1, with E2, and with both. Where are the two sites?',
  problem: {
    topology: 'linear',
    enzymes: ['E1', 'E2'],
    lanes: [
      lane('single', ['E1'], [4, 6]),
      lane('single', ['E2'], [1, 9]),
      lane('double', ['E1', 'E2'], [6, 3, 1]),
    ],
  },
  length: 10000,
  lengthGiven: true,
  grid: 500,
  truth: { E1: [4000], E2: [1000] },
};

export const CLASSIC_B: Puzzle = {
  id: 'classic-B',
  source: 'classic',
  difficulty: 'medium',
  title: 'Classic B',
  intro:
    'A linear DNA molecule was digested with EcoRI, HindIII and KpnI, singly and in pairs. How long is it, and where are the sites?',
  problem: {
    topology: 'linear',
    enzymes: ['EcoRI', 'HindIII', 'KpnI'],
    lanes: [
      lane('single', ['EcoRI'], [3, 6.5]),
      lane('single', ['HindIII'], [1.5, 8]),
      lane('single', ['KpnI'], [2, 3.5, 4]),
      lane('double', ['EcoRI', 'HindIII'], [1.5, 3, 5]),
      lane('double', ['KpnI', 'HindIII'], [1.5, 2, 2.5, 3.5]),
      lane('double', ['EcoRI', 'KpnI'], [1, 2, 2.5, 4]),
    ],
  },
  length: 9500,
  lengthGiven: false,
  grid: 500,
  truth: { EcoRI: [3000], HindIII: [8000], KpnI: [2000, 5500] },
};

/** Brown, Figure 4.16: mapping XbaI, XhoI and KpnI on λ DNA (48.5 kb). Needs the partial digest. */
export const CLASSIC_C: Puzzle = {
  id: 'classic-C',
  source: 'classic',
  difficulty: 'hard',
  title: 'Classic C · Brown Fig. 4.16',
  molecule: 'λ DNA',
  intro:
    'λ DNA (linear, 48.5 kb) was digested with XbaI, XhoI and KpnI. The KpnI partial digest was done under limiting conditions. Map all the sites.',
  problem: {
    topology: 'linear',
    enzymes: ['XbaI', 'XhoI', 'KpnI'],
    lanes: [
      lane('single', ['XbaI'], [24.0, 24.5]),
      lane('single', ['XhoI'], [15.0, 33.5]),
      lane('single', ['KpnI'], [1.5, 17.0, 30.0]),
      lane('double', ['XbaI', 'XhoI'], [9.0, 15.0, 24.5]),
      lane('double', ['XbaI', 'KpnI'], [1.5, 6.0, 17.0, 24.0]),
      lane('partial', ['KpnI'], [1.5, 17.0, 18.5, 30.0, 31.5, 48.5], 2),
    ],
  },
  length: 48500,
  lengthGiven: true,
  grid: 500,
  truth: { XbaI: [24500], XhoI: [33500], KpnI: [17000, 18500] },
};

export const CLASSICS: readonly Puzzle[] = [CLASSIC_A, CLASSIC_B, CLASSIC_C];

export function classicById(id: string): Puzzle | undefined {
  return CLASSICS.find((p) => p.id === id || p.id === `classic-${id}`);
}

// ---------------------------------------------------------------------------------------------

/** Sites implied by each enzyme's single digest. */
export function expectedSiteCounts(p: Puzzle): Record<string, number> {
  return Object.fromEntries(
    p.problem.enzymes.map((e) => {
      const single = p.problem.lanes.find((l) => l.kind === 'single' && l.enzymes[0] === e)!;
      return [e, siteCount(p.problem.topology, single.fragments)];
    }),
  );
}

function sumOf(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function kb(bp: number): string {
  return String(bp / 1000);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
