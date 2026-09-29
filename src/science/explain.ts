/**
 * Hints and step-by-step worked solutions for restriction-mapping puzzles.
 *
 * The worked solution is produced from a traced run of the solver, so every claim in it is the
 * result of an actual check: each candidate placement is shown with the fragments it would give
 * in the relevant double/partial digests, and rejected at the first lane that disagrees.
 */

import { multisetDifference, predictLane, type Lane, type SiteMap } from './digest';
import { formatBands, formatFragments, formatKb } from './format';
import type { Puzzle } from './puzzle';
import { canonicalKey, inferLength, singleLane, siteCount, solve, type SolveStep, type Trial } from './solver';

export interface TrialCheck {
  lane: string;
  expected: string;
  predicted: string;
  ok: boolean;
}

export interface TrialLine {
  label: string;
  ok: boolean;
  checks: TrialCheck[];
  /** Set when this accepted line is just a mirror image / rotation of an earlier one. */
  duplicate?: boolean;
}

export interface WorkedStep {
  title: string;
  paragraphs: string[];
  items?: string[];
  trials?: TrialLine[];
  /** Rejected trials not listed individually. */
  hiddenTrials?: number;
  conclusion?: string;
}

export interface WorkedSolution {
  length: number;
  steps: WorkedStep[];
  solutions: SiteMap[];
  /** Table of every lane: observed vs predicted by the (first) solution. */
  verification: TrialCheck[];
}

export function laneLabel(lane: Lane): string {
  const names = lane.enzymes.join(' + ');
  if (lane.kind === 'partial') return `${names} (partial)`;
  return lane.kind === 'single' ? `${names} alone` : names;
}

function formatLaneFragments(lane: Lane, fragments: readonly number[]): string {
  return lane.kind === 'partial' ? formatBands(fragments) : formatFragments(fragments);
}

function laneData(lane: Lane): string {
  return formatLaneFragments(lane, lane.fragments);
}

function kbList(positions: readonly number[]): string {
  const parts = [...positions].sort((a, b) => a - b).map((p) => formatKb(p));
  if (parts.length === 1) return `${parts[0]} kb`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]} kb`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** "KpnI 2 · EcoRI 3 · KpnI 5.5 · HindIII 8 kb" — sites in map order. */
export function describeMap(map: SiteMap, enzymes: readonly string[]): string {
  const sites = enzymes.flatMap((e) => (map[e] ?? []).map((p) => ({ e, p })));
  sites.sort((a, b) => a.p - b.p || enzymes.indexOf(a.e) - enzymes.indexOf(b.e));
  return sites.map(({ e, p }) => `${e} ${formatKb(p)}`).join(' · ') + ' kb';
}

// ---------------------------------------------------------------------------------------------
// Hints

export const HINT_TITLES = [
  'Sum the fragments to get the total length.',
  'How many times does each enzyme cut?',
  'Which single-digest fragment is split in the double digest?',
  'Worked solution',
] as const;

export function hintDetails(puzzle: Puzzle): string[] {
  const { problem } = puzzle;
  const circular = problem.topology === 'circular';
  const double = problem.lanes.find((l) => l.kind === 'double');
  let third = 'Compare each single digest with the double digests it takes part in.';
  if (double) {
    const [x, y] = double.enzymes;
    const single = singleLane(problem, x);
    third =
      `Compare ${x} alone (${formatFragments(single.fragments)}) with ${x} + ${y} (${formatFragments(double.fragments)}). ` +
      `Which ${x} fragment has disappeared, and which new fragments add up to it? That fragment contains a site for ${y}.`;
  }
  return [
    'Every single digest cuts the same molecule, so each one must add up to the same total.',
    circular
      ? 'In a circular molecule n cuts give n fragments (one cut just opens the circle into one full-length linear molecule).'
      : 'In a linear molecule n cuts give n + 1 fragments.',
    third,
  ];
}

// ---------------------------------------------------------------------------------------------
// Worked solution

const MAX_LISTED_TRIALS = 12;

export function workedSolution(puzzle: Pick<Puzzle, 'problem'>): WorkedSolution {
  const { problem } = puzzle;
  const { topology, enzymes } = problem;
  const length = inferLength(problem);
  const result = solve(problem, { trace: true });
  const steps: WorkedStep[] = [];
  const L = formatKb(length);

  // 1. Total length
  steps.push({
    title: 'Total length',
    paragraphs: ['Every single digest cuts the same molecule, so its fragments must add up to the full length:'],
    items: enzymes.map((e) => `${e}: ${formatFragments(singleLane(problem, e).fragments)} = ${L} kb`),
    conclusion: `The molecule is ${L} kb long.`,
  });

  // 2. Number of sites
  steps.push({
    title: 'Number of sites',
    paragraphs: [
      topology === 'linear'
        ? 'The molecule is linear, so n cuts give n + 1 fragments.'
        : 'The molecule is circular, so n cuts give n fragments (a single cut simply opens the circle into one full-length linear molecule).',
    ],
    items: enzymes.map((e) => {
      const frags = singleLane(problem, e).fragments.length;
      return `${e}: ${plural(frags, 'fragment')} → ${plural(siteCount(topology, singleLane(problem, e).fragments), 'site')}`;
    }),
  });

  // 3+. Place the enzymes one at a time
  const traced = result.steps ?? [];
  traced.forEach((step, idx) => {
    steps.push(idx === 0 ? anchorStep(step, problem, length) : placeStep(step, problem, length));
  });

  // Final answer
  const solution = result.solutions[0];
  const verification: TrialCheck[] = solution
    ? problem.lanes.map((lane) => {
        const predicted = formatLaneFragments(lane, predictLane({ topology, length }, solution, lane));
        return { lane: laneLabel(lane), expected: laneData(lane), predicted, ok: predicted === laneData(lane) };
      })
    : [];
  if (result.solutions.length === 1) {
    const reading =
      topology === 'linear'
        ? `Reading from the left end: ${describeMap(solution, enzymes)}. The mirror image (reading from the other end) is the same map, because it gives exactly the same digests.`
        : `Going clockwise from the site at 0: ${describeMap(solution, enzymes)} (${L} kb circle). Any rotation, or the mirror image, is the same map.`;
    steps.push({
      title: 'Answer',
      paragraphs: [reading, 'Finally, check the map against every lane — each predicted pattern matches the data:'],
    });
  } else {
    steps.push({
      title: 'Answer',
      paragraphs: [
        result.solutions.length === 0
          ? 'No map is consistent with all the data — check the fragment sizes.'
          : `${result.solutions.length} different maps fit all of these data; another digest (for example a partial digest) would be needed to decide between them.`,
      ],
    });
  }

  return { length, steps, solutions: result.solutions, verification };
}

function anchorStep(step: SolveStep, problem: Puzzle['problem'], length: number): WorkedStep {
  const { topology } = problem;
  const e = step.enzyme;
  const single = singleLane(problem, e);
  const n = siteCount(topology, single.fragments);
  const title = `Place ${e}`;
  const paragraphs: string[] = [];
  if (topology === 'linear') {
    if (n === 1) {
      const p = step.survivors[0]?.[e]?.[0] ?? single.fragments[0];
      paragraphs.push(
        `Start with ${e}, which cuts once: ${formatFragments(single.fragments)} kb means its site is ${formatKb(p)} kb from one end.`,
        `A map and its mirror image give identical digests, so we are free to choose which end is "left": put ${e} at ${formatKb(p)} kb.`,
      );
      return { title, paragraphs };
    }
    paragraphs.push(
      `Start with ${e} (${plural(n, 'site')}; fragments ${formatFragments(single.fragments)} kb). Its single digest alone does not tell us the order of the fragments.`,
    );
  } else {
    paragraphs.push(
      `A circle has no ends, so any site can serve as the origin: put ${n === 1 ? 'the' : 'one'} ${e} site at 0 (top of the map) and read clockwise.`,
    );
    if (n === 1 || (step.newLanes.length === 0 && step.survivors.length === 1)) {
      if (n > 1) paragraphs.push(`With ${n} fragments there is only one way (up to a mirror image) to arrange them: ${e} at ${kbList(step.survivors[0][e])}.`);
      return { title, paragraphs };
    }
  }
  return { title, ...trialSection(step, problem, length, paragraphs) };
}

function placeStep(step: SolveStep, problem: Puzzle['problem'], length: number): WorkedStep {
  const { topology } = problem;
  const y = step.enzyme;
  const single = singleLane(problem, y);
  const n = siteCount(topology, single.fragments);
  const paragraphs: string[] = [`${y} alone gives ${formatFragments(single.fragments)} kb, so it has ${plural(n, 'site')}.`];

  // Which fragments of already-placed enzymes does y split?
  for (const lane of step.newLanes) {
    if (lane.kind !== 'double' || lane.enzymes.length !== 2) continue;
    const x = lane.enzymes.find((e) => e !== y)!;
    const xSingle = singleLane(problem, x);
    const missing = multisetDifference(xSingle.fragments, lane.fragments);
    const added = multisetDifference(lane.fragments, xSingle.fragments);
    if (!missing.length) continue;
    paragraphs.push(
      `Compare ${x} alone (${formatFragments(xSingle.fragments)}) with ${x} + ${y} (${formatFragments(lane.fragments)}): ` +
        `the ${x} ${missing.length === 1 ? 'fragment' : 'fragments'} of ${kbList(missing)} ${missing.length === 1 ? 'is' : 'are'} replaced by ${formatFragments(added)} kb, ` +
        `so ${y} cuts inside ${missing.length === 1 ? 'that fragment' : 'those fragments'}.`,
    );
  }
  return { title: `Add ${y}`, ...trialSection(step, problem, length, paragraphs) };
}

/** Partial-digest reasoning, the list of tried placements and the step's conclusion. */
function trialSection(
  step: SolveStep,
  problem: Puzzle['problem'],
  length: number,
  paragraphs: string[],
): Pick<WorkedStep, 'paragraphs' | 'trials' | 'hiddenTrials' | 'conclusion'> {
  const { topology, enzymes } = problem;
  const y = step.enzyme;
  const single = singleLane(problem, y);
  for (const lane of step.newLanes) {
    if (lane.kind === 'partial') paragraphs.push(partialParagraph(lane, single.fragments, length));
  }

  const survivors = step.survivors;
  const survivorLines = (): TrialLine[] =>
    survivors.map((s) => ({ label: `${y} at ${kbList(s[y])}`, ok: true, checks: [] }));

  if (step.newLanes.length === 0) {
    paragraphs.push(
      `No digest links ${y} to what is already placed yet, so every arrangement is still possible (mirror images count once):`,
    );
    return {
      paragraphs,
      trials: survivorLines(),
      conclusion: `${survivors.length} arrangements are possible so far; the double digests will decide.`,
    };
  }

  paragraphs.push(
    `Try every placement allowed by the ${y} single digest and test it against ${joinList(step.newLanes.map(laneLabel))}:`,
  );

  const multipleBases = new Set(step.trials.map((t) => t.base)).size > 1;
  const baseIndex = new Map<SiteMap, number>();
  for (const t of step.trials) if (!baseIndex.has(t.base)) baseIndex.set(t.base, baseIndex.size + 1);

  const seenKeys = new Set<string>();
  const lines: TrialLine[] = step.trials.map((t) => {
    const prefix = multipleBases ? `Option ${baseIndex.get(t.base)} + ` : '';
    const line: TrialLine = { label: `${prefix}${y} at ${kbList(t.placement)}`, ok: !t.failed, checks: trialChecks(t) };
    if (!t.failed) {
      const key = canonicalKey(topology, length, { ...t.base, [y]: t.placement }, enzymes);
      if (seenKeys.has(key)) line.duplicate = true;
      seenKeys.add(key);
    }
    return line;
  });

  let listed = lines;
  let hidden = 0;
  if (lines.length > MAX_LISTED_TRIALS) {
    const accepted = lines.filter((l) => l.ok).slice(0, 8);
    const rejected = lines.filter((l) => !l.ok);
    const shownRejected = rejected.slice(0, Math.max(2, MAX_LISTED_TRIALS - accepted.length - 2));
    listed = lines.filter((l) => accepted.includes(l) || shownRejected.includes(l));
    hidden = lines.length - listed.length;
  }

  let conclusion: string;
  if (survivors.length === 1) {
    conclusion = `Only one placement fits: ${y} at ${kbList(survivors[0][y])}.`;
  } else if (survivors.length === 0) {
    conclusion = `No placement of ${y} fits — the data are inconsistent.`;
  } else {
    conclusion = `${survivors.length} arrangements still fit; the remaining data will decide.`;
  }
  if (lines.some((l) => l.duplicate)) {
    conclusion += ' Lines marked "mirror" are mirror images or rotations of an earlier line, i.e. the same map.';
  }
  return { paragraphs, trials: listed, hiddenTrials: hidden, conclusion };
}

function trialChecks(t: Trial): TrialCheck[] {
  const checks: TrialCheck[] = t.passed.map(({ lane, predicted }) => ({
    lane: laneLabel(lane),
    expected: laneData(lane),
    predicted: formatLaneFragments(lane, predicted),
    ok: true,
  }));
  if (t.failed) {
    const { lane, predicted } = t.failed;
    checks.push({
      lane: laneLabel(lane),
      expected: laneData(lane),
      predicted: formatLaneFragments(lane, predicted),
      ok: false,
    });
  }
  return checks;
}

/** Explain the extra bands of a partial digest as sums of neighbouring complete fragments. */
function partialParagraph(lane: Lane, complete: readonly number[], length: number): string {
  const e = lane.enzymes.join(' + ');
  const extras = lane.fragments.filter((f) => !complete.includes(f));
  const explained = extras.map((x) => {
    if (x === length) return `${formatKb(x)} = the uncut molecule`;
    const combo = findSum(complete, x);
    return combo ? `${formatKb(x)} = ${combo.map((c) => formatKb(c)).join(' + ')}` : `${formatKb(x)}`;
  });
  return (
    `The ${e} partial digest shows, besides the complete-digest fragments, extra bands of ${kbList(extras)}. ` +
    `A partial product is two (or more) neighbouring fragments still joined by an uncut site: ${explained.join('; ')}. ` +
    `So those fragments must be next to each other on the map.`
  );
}

/** Smallest combination (2 or 3 fragments) of a multiset that adds up to target. */
function findSum(values: readonly number[], target: number): number[] | null {
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++) if (values[i] + values[j] === target) return [values[i], values[j]];
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++)
      for (let k = j + 1; k < values.length; k++)
        if (values[i] + values[j] + values[k] === target) return [values[i], values[j], values[k]];
  return null;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
