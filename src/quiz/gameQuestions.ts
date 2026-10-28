/**
 * Game theory (static games of complete information): question generators in the style of the
 * midterm and problem set 1 (Tejada, UB). Every game is generated from the seed and solved by
 * src/science/games.ts, so answers and worked explanations always match the numbers shown.
 */

import {
  asFraction,
  bestResponses,
  bimatrix,
  cournot,
  cournotBestResponse,
  dominatedStrategies,
  dominatingMixInterval,
  formatProb,
  formatValue,
  fullyMixed2x2,
  isBestResponseToSomeBelief,
  isGeneric,
  iesds,
  jointProfitMax,
  paretoDominates,
  paretoEfficientCells,
  pay,
  pureNash,
  pureNash3,
  rationalizable,
  riskThreshold,
  strictlyDominantStrategy,
  subgame,
  weaklyOnlyDominated,
  type Bimatrix,
  type Cell,
  type Game3,
  type Mixed2x2,
  type Player,
} from '../science/games';
import { createRng, type Rng } from '../science/rng';
import type { BimatrixMarks, CaseQuestion, ChoiceOption, ChoiceQuestion, MatchQuestion, NumericQuestion, Question, QuestionBase, SimpleQuestion, Visual } from './types';

export type GameKind = 'params' | 'transfer' | 'dominance' | 'iesds' | 'pure' | 'mixed' | 'story' | 'selection' | 'rational' | 'cournot' | 'continuous' | 'theory';
export const GAME_KINDS: GameKind[] = ['params', 'dominance', 'iesds', 'pure', 'mixed', 'story', 'transfer', 'selection', 'rational', 'cournot', 'continuous', 'theory'];

export function generateGameQuestion(seed: string, kind?: GameKind): Question {
  const rng = createRng(`gt/${seed}`);
  const k = kind ?? rng.pick(GAME_KINDS);
  switch (k) {
    case 'params':
      return paramsCase(rng, seed);
    case 'transfer':
      return transferCase(rng, seed);
    case 'dominance':
      return dominanceCase(rng, seed);
    case 'iesds':
      return iesdsCase(rng, seed);
    case 'pure':
      return rng.chance(0.25) ? threePlayerQuestion(rng, seed) : pureCase(rng, seed);
    case 'mixed':
      return mixedCase(rng, seed);
    case 'story':
      return storyCase(rng, seed);
    case 'selection':
      return selectionCase(rng, seed);
    case 'rational':
      return rationalCase(rng, seed);
    case 'cournot':
      return cournotCase(rng, seed);
    case 'continuous':
      return continuousCase(rng, seed);
    case 'theory':
      return theoryQuestion(rng, seed);
  }
}

// ---------------------------------------------------------------------------------------------
// Shared helpers

type Base = Pick<QuestionBase, 'kind' | 'seed' | 'prompt' | 'detail' | 'visual' | 'revealVisual' | 'explanation'>;
type Opt = ChoiceOption & { ok?: boolean };

const v = (x: number) => formatValue(x);

/** Plain decimals for quantities and prices ("22.5", "−3"). */
function dec(x: number, digits = 2): string {
  const r = Math.round(x * 10 ** digits) / 10 ** digits;
  return r < 0 ? `−${Math.abs(r)}` : String(r);
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

function frac(n: number, d: number): string {
  const g = gcd(n, d) || 1;
  const [a, b] = [n / g, d / g];
  return b === 1 ? `${a}` : `${a}/${b}`;
}

function choice(base: Base, options: Opt[], rng: Rng, opts: { multi?: boolean; exclusive?: string[]; keepOrder?: boolean } = {}): ChoiceQuestion {
  const list = opts.keepOrder ? options : rng.shuffle(options);
  const correct = options.filter((o) => o.ok).map((o) => o.id);
  if (correct.length === 0) throw new Error(`choice without a correct option: ${base.prompt}`);
  return {
    ...base,
    format: 'choice',
    options: list.map(({ ok: _ok, ...o }) => o),
    correct,
    ...(opts.multi ? { multi: true } : {}),
    ...(opts.exclusive ? { exclusive: opts.exclusive } : {}),
  };
}

function numeric(base: Base, answer: number, opts: { label?: string; unit?: string; abs?: number; rel?: number; placeholder?: string } = {}): NumericQuestion {
  return {
    ...base,
    format: 'numeric',
    answer,
    unit: opts.unit ?? '',
    tolerance: opts.rel ?? 0.005,
    absTolerance: opts.abs ?? 0.01,
    answerLabel: opts.label ?? dec(answer),
    placeholder: opts.placeholder ?? 'e.g. 2/5 or 0.4',
  };
}

function caseOf(kind: string, seed: string, prompt: string, parts: SimpleQuestion[], visual?: Visual, detail?: string): CaseQuestion {
  return { kind, seed, format: 'case', prompt, visual, detail, parts, explanation: [] };
}

function cellsOf(g: Bimatrix): string[][][] {
  return g.u.map((row) => row.map(([a, b]) => [v(a), v(b)]));
}

function matrix(g: Bimatrix, extra: { marks?: BimatrixMarks; caption?: string; rowProbs?: string[]; colProbs?: string[] } = {}): Visual {
  return { type: 'bimatrix', players: g.players, rows: g.rows, cols: g.cols, cells: cellsOf(g), ...extra };
}

/** Best replies underlined, the way the slides find equilibria. */
function underlines(g: Bimatrix): boolean[][][] {
  return g.u.map((row, r) => row.map((_, c) => [bestResponses(g, 0, c).includes(r), bestResponses(g, 1, r).includes(c)]));
}

function solvedMatrix(g: Bimatrix, caption = 'Best replies underlined; pure equilibria ringed.'): Visual {
  return matrix(g, { marks: { underline: underlines(g), ring: pureNash(g) }, caption });
}

const profile = (g: Bimatrix, [r, c]: Cell) => `(${g.rows[r]}, ${g.cols[c]})`;
const cellId = ([r, c]: Cell) => `c${r}-${c}`;
const allCells = (g: Bimatrix): Cell[] => g.rows.flatMap((_, r) => g.cols.map((__, c) => [r, c] as Cell));
const nameOf = (g: Bimatrix, player: Player, s: number) => (player === 0 ? g.rows[s] : g.cols[s]);
const possessive = (name: string) => `${name}’s`;

function randomGame(rng: Rng, nr: number, nc: number, max: number, rows: string[], cols: string[], players: [string, string] = ['Player 1', 'Player 2']): Bimatrix {
  const u = Array.from({ length: nr }, () => Array.from({ length: nc }, () => [rng.int(0, max), rng.int(0, max)] as [number, number]));
  return bimatrix(rows.slice(0, nr), cols.slice(0, nc), u, players);
}

/** "9 > 7, 7 > 6, 5 > 2": t's payoffs against s's, opponent strategy by strategy. */
function comparison(g: Bimatrix, player: Player, t: number, s: number, opp: number[]): string {
  return opp
    .map((o) => {
      const a = pay(g, player, t, o);
      const b = pay(g, player, s, o);
      return `${v(a)} ${a > b ? '>' : a < b ? '<' : '='} ${v(b)}`;
    })
    .join(', ');
}

function brExplanation(g: Bimatrix): string[] {
  const p1 = g.cols.map((col, c) => {
    const br = bestResponses(g, 0, c);
    return `${col} → ${br.map((r) => g.rows[r]).join(' or ')} (${v(g.u[br[0]][c][0])})`;
  });
  const p2 = g.rows.map((row, r) => {
    const br = bestResponses(g, 1, r);
    return `${row} → ${br.map((c) => g.cols[c]).join(' or ')} (${v(g.u[r][br[0]][1])})`;
  });
  const ne = pureNash(g);
  return [
    `${possessive(g.players[0])} best replies to each column: ${p1.join('; ')}.`,
    `${possessive(g.players[1])} best replies to each row: ${p2.join('; ')}.`,
    ne.length
      ? `A cell where both payoffs are best replies (both underlined) is a Nash equilibrium: ${ne.map((c) => profile(g, c)).join(' and ')}.`
      : 'No cell has both payoffs underlined, so there is no equilibrium in pure strategies. By Nash’s theorem there is one in mixed strategies.',
  ];
}

/** "Which profiles are pure-strategy Nash equilibria?" over every cell of g. */
function nashQuestion(g: Bimatrix, base: Omit<Base, 'explanation'> & { explanation?: string[] }): ChoiceQuestion {
  const ne = pureNash(g);
  const options: Opt[] = [
    ...allCells(g).map((c) => ({ id: cellId(c), label: profile(g, c), ok: ne.some((n) => n[0] === c[0] && n[1] === c[1]) })),
    { id: 'none', label: 'No pure-strategy equilibrium', ok: ne.length === 0 },
  ];
  return choice({ ...base, explanation: base.explanation ?? brExplanation(g), revealVisual: base.revealVisual ?? solvedMatrix(g) }, options, createRng('unused'), {
    multi: true,
    exclusive: ['none'],
    keepOrder: true,
  });
}

function strategyOptions(g: Bimatrix, isOk: (player: Player, s: number) => boolean): Opt[] {
  return [
    ...g.rows.map((r, i) => ({ id: `p1-${i}`, label: `${r} (${g.players[0]})`, ok: isOk(0, i) })),
    ...g.cols.map((c, j) => ({ id: `p2-${j}`, label: `${c} (${g.players[1]})`, ok: isOk(1, j) })),
  ];
}

/** Best-response plot of a 2×2 game in the (x, y) square, x = P(first row), y = P(first column). */
function brPlot2x2(g: Bimatrix, m: Mixed2x2 | null): Visual {
  const [[A, B], [C, D]] = g.u;
  // Player 1: first row better when y·(A1 − C1) + (1 − y)·(B1 − D1) > 0.
  const d1 = (y: number) => y * (A[0] - C[0]) + (1 - y) * (B[0] - D[0]);
  const d2 = (x: number) => x * (A[1] - B[1]) + (1 - x) * (C[1] - D[1]);
  const p1: [number, number][] = [];
  const p2: [number, number][] = [];
  const x0 = d1(0) > 0 ? 1 : 0;
  const x1 = d1(1) > 0 ? 1 : 0;
  if (x0 === x1) p1.push([x0, 0], [x0, 1]);
  else {
    const ys = d1(0) / (d1(0) - d1(1));
    p1.push([x0, 0], [x0, ys], [x1, ys], [x1, 1]);
  }
  const y0 = d2(0) > 0 ? 1 : 0;
  const y1 = d2(1) > 0 ? 1 : 0;
  if (y0 === y1) p2.push([0, y0], [1, y0]);
  else {
    const xs = d2(0) / (d2(0) - d2(1));
    p2.push([0, y0], [xs, y0], [xs, y1], [1, y1]);
  }
  const dots = pureNash(g).map(([r, c]) => ({ x: r === 0 ? 1 : 0, y: c === 0 ? 1 : 0, label: profile(g, [r, c]) }));
  if (m) dots.push({ x: m.x, y: m.y, label: `x = ${formatValue(m.x)}, y = ${formatValue(m.y)}` });
  const ticks = (extra: number | undefined) => [
    { at: 0, label: '0' },
    ...(extra !== undefined && extra > 0.06 && extra < 0.94 ? [{ at: extra, label: formatValue(extra) }] : []),
    { at: 1, label: '1' },
  ];
  return {
    type: 'brPlot',
    xLabel: `x = P(${g.rows[0]})`,
    yLabel: `y = P(${g.cols[0]})`,
    xMax: 1,
    yMax: 1,
    xTicks: ticks(m?.x),
    yTicks: ticks(m?.y),
    series: [
      { label: `${possessive(g.players[0])} best response x(y)`, tone: 'coral', points: p1 },
      { label: `${possessive(g.players[1])} best response y(x)`, tone: 'teal', points: p2 },
    ],
    dots,
  };
}

// ---------------------------------------------------------------------------------------------
// Problem 1 of the midterm: a symmetric 2×2 game with parameters

const LETTER_SETS = [
  ['a', 'b', 'c', 'e'],
  ['x', 'y', 'z', 'k'],
  ['a', 'b', 'c', 'd'],
] as const;

const PROBS: [number, number][] = [
  [1, 3],
  [1, 4],
  [2, 3],
  [3, 4],
  [2, 5],
  [3, 5],
];

function paramsCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.params';
  const [a, b, c, e] = rng.pick(LETTER_SETS);
  const [S, T] = rng.pick([
    ['A', 'B'],
    ['X', 'Y'],
    ['H', 'L'],
  ]);
  const visual: Visual = {
    type: 'bimatrix',
    players: ['Player 1', 'Player 2'],
    rows: [S, T],
    cols: [S, T],
    cells: [
      [
        [a, a],
        [b, c],
      ],
      [
        [c, b],
        [e, e],
      ],
    ],
  };

  const dominance = choice(
    {
      kind,
      seed,
      prompt: `Suppose that for both players ${S} strictly dominates ${T}. What can you say about ${a} and ${c}, about ${b} and ${e}, and about ${a} and ${e}?`,
      explanation: [
        `Player 1 compares the rows column by column. Against ${S}: ${S} gives ${a}, ${T} gives ${c}. Against ${T}: ${S} gives ${b}, ${T} gives ${e}. Strict dominance needs both: ${a} > ${c} and ${b} > ${e}. The game is symmetric, so the same conditions make ${S} dominant for player 2.`,
        `${a} and ${e} are payoffs of two different outcomes, (${S}, ${S}) and (${T}, ${T}); dominance never compares them. If also ${e} > ${a}, the game is a prisoners’ dilemma.`,
      ],
    },
    [
      { id: 'ok', label: `${a} > ${c} and ${b} > ${e}; nothing can be said about ${a} vs ${e}`, ok: true },
      { id: 'ae', label: `${a} > ${c} and ${b} > ${e}, and therefore ${a} > ${e}`, note: `Dominance compares a player’s payoffs for a fixed choice of the opponent; ${a} and ${e} belong to different outcomes (in a prisoners’ dilemma ${e} > ${a}).` },
      { id: 'weak', label: `${a} ≥ ${c} and ${b} ≥ ${e}; nothing can be said about ${a} vs ${e}`, note: 'With ≥ the domination would only be weak.' },
      { id: 'wrong', label: `${a} > ${c} and ${e} > ${b}; nothing can be said about ${a} vs ${e}`, note: `If ${e} > ${b}, ${T} is the better reply to ${T}: ${S} does not dominate.` },
    ],
    rng,
  );

  const atS = rng.chance(0.5);
  const [P, own, dev, o1, o2] = atS ? [S, a, c, b, e] : [T, e, b, a, c];
  const equilibrium = choice(
    {
      kind,
      seed,
      prompt: `Suppose instead that (${P}, ${P}) is a Nash equilibrium in pure strategies. What can you say about ${a} and ${c}? And about ${b} and ${e}?`,
      explanation: [
        `At (${P}, ${P}) each player must be playing a best reply to ${P}. Deviating gives ${dev} instead of ${own}, so the only condition is ${own} ≥ ${dev} (weak: a tie is still an equilibrium). By symmetry the condition is the same for player 2.`,
        `${o1} and ${o2} are payoffs against the other strategy, which is not played at (${P}, ${P}): nothing can be said about them.`,
      ],
    },
    [
      { id: 'ok', label: `${own} ≥ ${dev}; nothing can be said about ${o1} vs ${o2}`, ok: true },
      { id: 'both', label: `${own} ≥ ${dev} and ${atS ? `${b} ≥ ${e}` : `${c} ≥ ${a}`}`, note: 'That comparison is about replies to the other strategy, which is never played at this profile.' },
      { id: 'strict', label: `${atS ? `${a} > ${c} and ${b} > ${e}` : `${e} > ${b} and ${c} > ${a}`}`, note: 'That is strict dominance: sufficient, but much more than an equilibrium needs.' },
      { id: 'rev', label: `${dev} ≥ ${own}; nothing can be said about ${o1} vs ${o2}`, note: `Then deviating to the other strategy would pay (strictly, unless ${dev} = ${own}).` },
    ],
    rng,
  );

  const [pn, pd] = rng.pick(PROBS);
  const p = frac(pn, pd);
  const q = frac(pd - pn, pd);
  const k = frac(pd - pn, pn);
  const inv = frac(pn, pd - pn);
  const times = (f: string, expr: string) => (f === '1' ? expr : f.includes('/') ? `(${f})(${expr})` : `${f}(${expr})`);
  const mixedRel = choice(
    {
      kind,
      seed,
      prompt: `Consider the profile where both players choose ${S} with probability ${p} and ${T} with probability ${q}, and assume it is a Nash equilibrium (in mixed strategies). What can you say about ${a} − ${c} and ${e} − ${b}?`,
      explanation: [
        `In a mixed equilibrium each player is indifferent between the strategies they mix. If the opponent plays ${S} with probability ${p}: U(${S}) = ${p}·${a} + ${q}·${b} and U(${T}) = ${p}·${c} + ${q}·${e}.`,
        `Setting them equal: ${p}(${a} − ${c}) = ${q}(${e} − ${b}), so ${a} − ${c} = ${times(k, `${e} − ${b}`)}. Both differences have the same sign (positive in a coordination game, negative in an anti-coordination game).`,
      ],
    },
    [
      { id: 'ok', label: `${a} − ${c} = ${times(k, `${e} − ${b}`)}`, ok: true },
      { id: 'inv', label: `${a} − ${c} = ${times(inv, `${e} − ${b}`)}`, note: `Weights swapped: that is the condition for probability ${q} on ${S}.` },
      { id: 'eq', label: `${a} − ${c} = ${e} − ${b}`, note: 'That only holds for a 1/2–1/2 mix.' },
      { id: 'sign', label: `${a} − ${c} = ${times(k, `${b} − ${e}`)}`, note: 'Sign error: indifference needs the two differences to have the same sign.' },
    ],
    rng,
  );

  const scenario = rng.pick(['pd', 'coord', 'anti', 'harmony'] as const);
  const conditions = {
    pd: `${a} > ${c}, ${b} > ${e} and ${e} > ${a}`,
    coord: `${a} > ${c}, ${e} > ${b} and ${a} > ${e}`,
    anti: `${c} > ${a} and ${b} > ${e}`,
    harmony: `${a} > ${c}, ${b} > ${e} and ${a} > ${e}`,
  };
  const why = {
    pd: `With ${a} > ${c} and ${b} > ${e}, ${S} strictly dominates ${T} for both players, so (${S}, ${S}) is the unique Nash equilibrium. But ${e} > ${a}: both would be better off at (${T}, ${T}). Dominant strategies lead to a Pareto-inefficient outcome — a prisoners’ dilemma.`,
    coord: `${a} > ${c} makes ${S} the best reply to ${S}, and ${e} > ${b} makes ${T} the best reply to ${T}: (${S}, ${S}) and (${T}, ${T}) are both equilibria, plus a mixed one — a coordination game like the terrorist hunt. As ${a} > ${e}, (${S}, ${S}) Pareto dominates (${T}, ${T}).`,
    anti: `${c} > ${a}: against ${S} it is better to play ${T}; ${b} > ${e}: against ${T} it is better to play ${S}. Each wants the opposite of the other: the pure equilibria are (${S}, ${T}) and (${T}, ${S}), plus a mixed one — an anti-coordination game (hawk–dove, chicken).`,
    harmony: `${S} strictly dominates ${T} (${a} > ${c}, ${b} > ${e}), so (${S}, ${S}) is the unique equilibrium; as ${a} > ${e} (and ${c} < ${a}), no outcome is better for both: it is Pareto efficient and there is no dilemma.`,
  };
  const kindOfGame = choice(
    { kind, seed, prompt: `Suppose that ${conditions[scenario]}. What kind of game is this, what are its pure-strategy equilibria, and is the outcome efficient?`, explanation: [why[scenario]] },
    [
      { id: 'pd', label: `A prisoners’ dilemma: (${S}, ${S}) is the unique NE and it is not Pareto efficient`, ok: scenario === 'pd' },
      { id: 'coord', label: `A coordination game: (${S}, ${S}) and (${T}, ${T}) are NE; (${S}, ${S}) Pareto dominates (${T}, ${T})`, ok: scenario === 'coord' },
      { id: 'anti', label: `An anti-coordination game (hawk–dove): (${S}, ${T}) and (${T}, ${S}) are the pure NE`, ok: scenario === 'anti' },
      { id: 'harmony', label: `${S} is strictly dominant and the unique NE (${S}, ${S}) is Pareto efficient`, ok: scenario === 'harmony' },
    ],
    rng,
  );

  const coordMix = rng.chance(0.6);
  const mixFormula = coordMix
    ? choice(
        {
          kind,
          seed,
          prompt: `Suppose ${a} > ${c} and ${b} < ${e}. Find an equilibrium in which both players use ${S} and ${T} with positive probability: with which probability is ${S} played?`,
          explanation: [
            `Both (${S}, ${S}) and (${T}, ${T}) are equilibria, and there is a symmetric mixed one. If the opponent plays ${S} with probability p, indifference gives p·${a} + (1 − p)·${b} = p·${c} + (1 − p)·${e}, i.e. p(${a} − ${c}) = (1 − p)(${e} − ${b}).`,
            `So p = (${e} − ${b}) / ((${a} − ${c}) + (${e} − ${b})), strictly between 0 and 1 because both differences are positive. By symmetry both players use the same p.`,
          ],
        },
        [
          { id: 'ok', label: `(${e} − ${b}) / ((${a} − ${c}) + (${e} − ${b}))`, ok: true },
          { id: 'swap', label: `(${a} − ${c}) / ((${a} − ${c}) + (${e} − ${b}))`, note: `That is the probability of ${T}.` },
          { id: 'ratio', label: `(${e} − ${b}) / (${a} − ${c})`, note: 'Not a probability in general (it can exceed 1).' },
          { id: 'half', label: '1/2, because the game is symmetric', note: 'Symmetry gives both players the same mix, not necessarily 1/2.' },
        ],
        rng,
      )
    : choice(
        {
          kind,
          seed,
          prompt: `Suppose ${c} > ${a} and ${b} > ${e}. Find an equilibrium in which both players use ${S} and ${T} with positive probability: with which probability is ${S} played?`,
          explanation: [
            `The pure equilibria are (${S}, ${T}) and (${T}, ${S}); the symmetric one is mixed. Indifference: p·${a} + (1 − p)·${b} = p·${c} + (1 − p)·${e}, i.e. (1 − p)(${b} − ${e}) = p(${c} − ${a}).`,
            `So p = (${b} − ${e}) / ((${c} − ${a}) + (${b} − ${e})), between 0 and 1 because both differences are positive.`,
          ],
        },
        [
          { id: 'ok', label: `(${b} − ${e}) / ((${c} − ${a}) + (${b} − ${e}))`, ok: true },
          { id: 'swap', label: `(${c} − ${a}) / ((${c} − ${a}) + (${b} − ${e}))`, note: `That is the probability of ${T}.` },
          { id: 'ratio', label: `(${b} − ${e}) / (${c} − ${a})`, note: 'Not a probability in general (it can exceed 1).' },
          { id: 'half', label: '1/2, because the game is symmetric', note: 'Symmetry gives both players the same mix, not necessarily 1/2.' },
        ],
        rng,
      );

  return caseOf(kind, seed, 'Consider the following game in normal form (the parts are independent):', [dominance, equilibrium, mixedRel, kindOfGame, mixFormula], visual);
}

// ---------------------------------------------------------------------------------------------
// Problem set 1.1 (d), 1.9: a prisoners' dilemma with a side payment α

function transferCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.transfer';
  const z = rng.int(0, 3);
  const x = z + rng.int(1, 3);
  const k = x + rng.int(1, 4);
  const y = k + rng.int(1, 4);
  const g = bimatrix(['A', 'B'], ['A', 'B'], [
    [[x, x], [y, z]],
    [[z, y], [k, k]],
  ]);
  const alpha = y - k;
  const withAlpha = bimatrix(['A', 'B'], ['A', 'B'], [
    [[x, x], [y - alpha, z + alpha]],
    [[z + alpha, y - alpha], [k, k]],
  ]);
  const symbolic: Visual = {
    type: 'bimatrix',
    players: ['Player 1', 'Player 2'],
    rows: ['A', 'B'],
    cols: ['A', 'B'],
    cells: [
      [[v(x), v(x)], [`${y} − α`, `${z} + α`]],
      [[`${z} + α`, `${y} − α`], [v(k), v(k)]],
    ],
    caption: 'If the actions differ, the player who chose A pays α to the other.',
  };
  const ne = pureNash(withAlpha);

  const parts: SimpleQuestion[] = [
    choice(
      {
        kind,
        seed,
        prompt: 'What kind of game is this?',
        explanation: [
          `Against A, A gives ${x} and B gives ${z}; against B, A gives ${y} and B gives ${k}. Since ${x} > ${z} and ${y} > ${k}, A strictly dominates B for both players, and (A, A) is the unique equilibrium with payoffs (${x}, ${x}).`,
          `But (B, B) gives (${k}, ${k}), better for both: a prisoners’ dilemma.`,
        ],
      },
      [
        { id: 'pd', label: 'A prisoners’ dilemma', ok: true },
        { id: 'coord', label: 'A coordination game (like the terrorist hunt)', note: 'A coordination game has two pure equilibria; here A is dominant.' },
        { id: 'anti', label: 'An anti-coordination game (hawk–dove)', note: 'Here the best reply to A is A, not B.' },
        { id: 'zero', label: 'A zero-sum game (like Colonel Blotto)', note: 'Payoffs do not add up to a constant, and there is a pure equilibrium.' },
      ],
      rng,
    ),
    choice(
      { kind, seed, prompt: 'Is the Nash equilibrium of this game Pareto efficient?', explanation: [`No. (B, B) gives each player ${k} > ${x}: both are better off, so (A, A) is Pareto dominated. Being an equilibrium (nobody gains by deviating alone) is a different property from efficiency.`] },
      [
        { id: 'no', label: `No: at (B, B) both players get ${k} > ${x}`, ok: true },
        { id: 'yes-dev', label: 'Yes: no player can gain by deviating', note: 'That is the definition of a Nash equilibrium, not of efficiency.' },
        { id: 'yes-sum', label: 'Yes: it maximises the sum of payoffs', note: `The sum is ${2 * x} at (A, A) but ${2 * k} at (B, B).` },
        { id: 'no-ab', label: `No: (A, B) Pareto dominates it`, note: `Player 2 gets ${z} < ${x} at (A, B).` },
      ],
      rng,
    ),
    choice(
      {
        kind,
        seed,
        prompt: 'Now introduce the variation: if the players choose different actions, the player who chose A has to pay α ≥ 0 to the other. What are the payoffs at (A, B) in the new game?',
        explanation: [`Player 1 chose A and pays α: ${y} − α. Player 2 receives it: ${z} + α. At (A, A) and (B, B) the actions agree and nothing changes.`],
        revealVisual: symbolic,
      },
      [
        { id: 'ok', label: `(${y} − α, ${z} + α)`, ok: true },
        { id: 'rev', label: `(${y} + α, ${z} − α)`, note: 'The transfer goes from the player who chose A to the other.' },
        { id: 'half', label: `(${y} − α, ${z})`, note: 'What one player pays, the other receives.' },
        { id: 'other', label: `(${y}, ${z} + α)`, note: 'Player 1, who chose A, pays α.' },
      ],
      rng,
    ),
    numeric(
      {
        kind,
        seed,
        prompt: 'What is the minimum α ≥ 0 such that (B, B) is a Nash equilibrium of the new game?',
        visual: symbolic,
        explanation: [
          `At (B, B) a player who deviates to A gets ${y} − α instead of ${k}. (B, B) is an equilibrium when ${k} ≥ ${y} − α, i.e. α ≥ ${y} − ${k} = ${alpha}.`,
        ],
      },
      alpha,
      { label: `α = ${alpha}`, placeholder: 'α' },
    ),
    {
      ...nashQuestion(withAlpha, {
        kind,
        seed,
        prompt: `Let α = ${alpha}. Which profiles are pure-strategy Nash equilibria? Is (B, B) the unique one?`,
        explanation: [
          ...brExplanation(withAlpha),
          ne.length === 1
            ? '(B, B) is the unique pure equilibrium.'
            : `(B, B) is not the unique equilibrium: at the minimum α the deviation payoff only ties with ${k}, so other profiles survive as (weak) equilibria. Any α > ${alpha} makes B strictly dominant.`,
        ],
      }),
    },
  ];
  return caseOf(kind, seed, 'Consider the following game in normal form (payoffs in EUR):', parts, matrix(g));
}

// ---------------------------------------------------------------------------------------------
// Dominated strategies (problem set 1.2)

/** Make one strategy weakly (not strictly) dominated by another, for variety. */
function plantWeak(rng: Rng, g: Bimatrix): void {
  const player = rng.pick([0, 1] as const);
  const n = player === 0 ? g.rows.length : g.cols.length;
  const m = player === 0 ? g.cols.length : g.rows.length;
  const [t, s] = rng.sample([...Array(n).keys()], 2);
  const opps = rng.shuffle([...Array(m).keys()]);
  opps.forEach((o, i) => {
    const top = pay(g, player, t, o);
    const drop = i === 0 ? 0 : i === 1 ? Math.min(top, rng.int(1, 3)) : Math.min(top, rng.int(0, 3));
    const r = player === 0 ? s : o;
    const c = player === 0 ? o : s;
    const cell = [...g.u[r][c]] as [number, number];
    cell[player] = top - drop;
    g.u[r][c] = cell;
  });
}

function dominanceLines(g: Bimatrix, strict: boolean): string[] {
  const out: string[] = [];
  for (const player of [0, 1] as const) {
    const opp = [...Array(player === 0 ? g.cols.length : g.rows.length).keys()];
    const list = strict ? dominatedStrategies(g, player, true) : weaklyOnlyDominated(g, player);
    for (const d of list) {
      out.push(
        `${g.players[player]}: ${nameOf(g, player, d.dominated)} is ${strict ? 'strictly' : 'weakly (not strictly)'} dominated by ${nameOf(g, player, d.by)} — ${comparison(g, player, d.by, d.dominated, opp)}.`,
      );
    }
  }
  return out;
}

function dominanceCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.dominance';
  let g = randomGame(rng, 3, 3, 9, ['A', 'B', 'C', 'D'], ['a', 'b', 'c', 'd']);
  for (let attempt = 0; attempt < 600; attempt++) {
    const [nr, nc] = rng.pick([
      [3, 3],
      [3, 4],
      [4, 3],
    ]);
    g = randomGame(rng, nr, nc, 9, ['A', 'B', 'C', 'D'], ['a', 'b', 'c', 'd']);
    if (rng.chance(0.7)) plantWeak(rng, g);
    const strict = dominatedStrategies(g, 0, true).length + dominatedStrategies(g, 1, true).length;
    const weak = weaklyOnlyDominated(g, 0).length + weaklyOnlyDominated(g, 1).length;
    if (strict >= 1 && strict <= 3 && (weak >= 1 || attempt > 300)) break;
  }
  const strictSet = (player: Player, s: number) => dominatedStrategies(g, player, true).some((d) => d.dominated === s);
  const weakSet = (player: Player, s: number) => weaklyOnlyDominated(g, player).some((d) => d.dominated === s);
  const anyStrict = dominatedStrategies(g, 0, true).length + dominatedStrategies(g, 1, true).length > 0;
  const anyWeak = weaklyOnlyDominated(g, 0).length + weaklyOnlyDominated(g, 1).length > 0;
  const d1 = strictlyDominantStrategy(g, 0);
  const d2 = strictlyDominantStrategy(g, 1);

  const parts: SimpleQuestion[] = [
    choice(
      {
        kind,
        seed,
        prompt: 'Which strategies are strictly dominated (by another pure strategy)?',
        explanation: anyStrict
          ? [...dominanceLines(g, true), 'Every other strategy does strictly better than each alternative against at least one opponent strategy, or ties somewhere, so it is not strictly dominated.']
          : ['None: for every pair of strategies, each one does at least as well as the other against some opponent strategy.'],
      },
      [...strategyOptions(g, strictSet), { id: 'none', label: 'None', ok: !anyStrict }],
      rng,
      { multi: true, exclusive: ['none'], keepOrder: true },
    ),
    choice(
      {
        kind,
        seed,
        prompt: 'Which strategies are weakly, but not strictly, dominated?',
        explanation: [
          'Weak dominance: never worse, and strictly better against at least one opponent strategy.',
          ...(anyWeak ? dominanceLines(g, false) : ['None: every strategy that is weakly dominated here is also strictly dominated, or no domination holds.']),
        ],
      },
      [...strategyOptions(g, weakSet), { id: 'none', label: 'None', ok: !anyWeak }],
      rng,
      { multi: true, exclusive: ['none'], keepOrder: true },
    ),
    choice(
      {
        kind,
        seed,
        prompt: 'Does the game have a strictly dominant strategy equilibrium?',
        explanation: [
          d1 !== null && d2 !== null
            ? `Yes: ${g.rows[d1]} strictly dominates every other row and ${g.cols[d2]} every other column, so (${g.rows[d1]}, ${g.cols[d2]}) is a dominant strategy equilibrium.`
            : `No. A dominant strategy equilibrium needs a strategy that beats all others for each player. ${d1 === null ? `${g.players[0]} has none` : `${g.players[0]} has ${g.rows[d1]}`}; ${d2 === null ? `${g.players[1]} has none` : `${g.players[1]} has ${g.cols[d2]}`}.`,
        ],
      },
      [
        { id: 'yes', label: d1 !== null && d2 !== null ? `Yes: (${g.rows[d1]}, ${g.cols[d2]})` : 'Yes', ok: d1 !== null && d2 !== null },
        { id: 'no', label: 'No: at least one player has no strictly dominant strategy', ok: !(d1 !== null && d2 !== null) },
      ],
      rng,
      { keepOrder: true },
    ),
  ];
  return caseOf(kind, seed, 'Consider the following game in normal form:', parts, matrix(g));
}

// ---------------------------------------------------------------------------------------------
// Iterated elimination (midterm problem 2, problem set 1.2 and 1.16)

const PS12 = bimatrix(['A', 'B', 'C'], ['a', 'b', 'c', 'd'], [
  [[9, 6], [7, 7], [5, 6], [12, 6]],
  [[7, 13], [6, 9], [2, 6], [10, 10]],
  [[9, 1], [9, 6], [2, 1], [6, 0]],
]);

function setLabel(g: Bimatrix, rows: number[], cols: number[]): string {
  if (rows.length === 1 && cols.length === 1) return `Only ${profile(g, [rows[0], cols[0]])} survives`;
  return `${g.players[0]}: {${rows.map((r) => g.rows[r]).join(', ')}} · ${g.players[1]}: {${cols.map((c) => g.cols[c]).join(', ')}}`;
}

function iesdsCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.iesds';
  const wantSingle = rng.chance(0.7);
  let g = PS12;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const [nr, nc] = rng.pick([
      [3, 4],
      [3, 3],
      [4, 3],
      [4, 4],
    ]);
    const cand = randomGame(rng, nr, nc, 12, ['A', 'B', 'C', 'D'], ['a', 'b', 'c', 'd']);
    const r = iesds(cand);
    const removed = nr + nc - r.rows.length - r.cols.length;
    const rounds = Math.max(0, ...r.steps.map((s) => s.round));
    if (wantSingle) {
      if (r.rows.length === 1 && r.cols.length === 1 && removed >= 3 && rounds >= 2) {
        g = cand;
        break;
      }
    } else if (r.rows.length === 2 && r.cols.length === 2 && removed >= 2) {
      const sg = subgame(cand, r.rows, r.cols);
      const m = isGeneric(sg) ? fullyMixed2x2(sg) : null;
      if (m && asFraction(m.x, 8) && asFraction(m.y, 8)) {
        g = cand;
        break;
      }
    }
  }
  const res = iesds(g);
  const firstStrict = (player: Player, s: number) => dominatedStrategies(g, player, true).some((d) => d.dominated === s);
  const anyFirst = dominatedStrategies(g, 0, true).length + dominatedStrategies(g, 1, true).length > 0;
  const stepLines = res.steps.map(
    (s) =>
      `Round ${s.round} — ${g.players[s.player]}: ${nameOf(g, s.player, s.dominated)} is strictly dominated by ${nameOf(g, s.player, s.by)} (${comparison(g, s.player, s.by, s.dominated, s.against)} against ${s.against.map((o) => nameOf(g, s.player === 0 ? 1 : 0, o)).join(', ')}).`,
  );
  const eliminated: Visual = matrix(g, {
    marks: {
      struckRows: g.rows.map((_, i) => i).filter((i) => !res.rows.includes(i)),
      struckCols: g.cols.map((_, j) => j).filter((j) => !res.cols.includes(j)),
      underline: underlines(g),
      ring: pureNash(g),
    },
    caption: 'Eliminated strategies struck out; best replies underlined; pure equilibria ringed.',
  });

  // Distractor outcomes.
  const round1 = res.steps.filter((s) => s.round === 1);
  const r1Rows = g.rows.map((_, i) => i).filter((i) => !round1.some((s) => s.player === 0 && s.dominated === i));
  const r1Cols = g.cols.map((_, j) => j).filter((j) => !round1.some((s) => s.player === 1 && s.dominated === j));
  const candidates = new Map<string, boolean>([[setLabel(g, res.rows, res.cols), true]]);
  const add = (label: string) => {
    if (!candidates.has(label)) candidates.set(label, false);
  };
  add(setLabel(g, r1Rows, r1Cols));
  for (const cell of rng.shuffle(allCells(g))) {
    if (candidates.size >= 4) break;
    add(setLabel(g, [cell[0]], [cell[1]]));
  }
  const outcomeOptions: Opt[] = [...candidates.entries()].slice(0, 4).map(([label, ok], i) => ({ id: `o${i}`, label, ok }));

  const parts: SimpleQuestion[] = [
    choice(
      {
        kind,
        seed,
        prompt: 'Are there any strictly dominated strategies (in the original game)? Select all of them.',
        explanation: anyFirst ? dominanceLines(g, true) : ['None in the original game.'],
      },
      [...strategyOptions(g, firstStrict), { id: 'none', label: 'None', ok: !anyFirst }],
      rng,
      { multi: true, exclusive: ['none'], keepOrder: true },
    ),
    choice(
      {
        kind,
        seed,
        prompt: 'Apply iterated elimination of strictly dominated strategies. What is the outcome?',
        explanation: [
          ...stepLines,
          `Nothing else can be eliminated: ${setLabel(g, res.rows, res.cols).replace(/^Only /, '')}. For strict dominance the order of elimination does not matter, and each step needs common knowledge of rationality.`,
        ],
        revealVisual: eliminated,
      },
      outcomeOptions,
      rng,
    ),
  ];

  if (res.rows.length === 1 && res.cols.length === 1) {
    const cell: Cell = [res.rows[0], res.cols[0]];
    parts.push(
      choice(
        {
          kind,
          seed,
          prompt: `Is ${profile(g, cell)} a Nash equilibrium?`,
          explanation: [
            `Yes. Theorem (Day 2): if a profile is the unique survivor of iterated elimination of strictly dominated strategies, it is the unique Nash equilibrium in pure strategies.`,
            `Check: against ${g.cols[cell[1]]}, ${g.rows[cell[0]]} gives ${possessive(g.players[0])} best payoff (${v(g.u[cell[0]][cell[1]][0])}); against ${g.rows[cell[0]]}, ${g.cols[cell[1]]} gives ${possessive(g.players[1])} best payoff (${v(g.u[cell[0]][cell[1]][1])}).`,
          ],
          revealVisual: solvedMatrix(g),
        },
        [
          { id: 'ok', label: 'Yes, and it is the unique pure-strategy Nash equilibrium', ok: true },
          { id: 'others', label: 'Yes, but the game has other pure Nash equilibria too', note: 'Equilibrium strategies are never eliminated, so any other equilibrium would have survived too.' },
          { id: 'p1', label: `No: ${g.players[0]} would rather deviate`, note: `Against ${g.cols[cell[1]]}, no row beats ${g.rows[cell[0]]}.` },
          { id: 'never', label: 'No: IESDS outcomes need not be Nash equilibria', note: 'A unique survivor always is one.' },
        ],
        rng,
      ),
    );
  } else {
    const sg = subgame(g, res.rows, res.cols);
    parts.push(
      nashQuestion(sg, {
        kind,
        seed,
        prompt: 'Find the pure-strategy Nash equilibria of the reduced game.',
        explanation: [...brExplanation(sg), 'Eliminated strategies are never part of an equilibrium, so these are also the pure equilibria of the original game.'],
      }),
    );
    const m = fullyMixed2x2(sg);
    if (m) {
      parts.push(
        numeric(
          {
            kind,
            seed,
            prompt: `In the mixed-strategy equilibrium of the reduced game, with what probability does ${g.players[0]} play ${sg.rows[0]}?`,
            explanation: mixedXExplanation(sg, m),
            revealVisual: brPlot2x2(sg, m),
          },
          m.x,
          { label: formatProb(m.x) },
        ),
      );
    }
  }
  return caseOf(kind, seed, 'Consider the following game in normal form:', parts, matrix(g));
}

// ---------------------------------------------------------------------------------------------
// Pure-strategy equilibria and Pareto efficiency

function pureCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.pure';
  const target = rng.pick([1, 2, 2, 3, 0]);
  let g = randomGame(rng, 3, 3, 9, ['T', 'M', 'B', 'D'], ['L', 'C', 'R', 'S']);
  for (let attempt = 0; attempt < 3000; attempt++) {
    const [nr, nc] = rng.pick([
      [3, 3],
      [3, 4],
      [4, 3],
    ]);
    const cand = randomGame(rng, nr, nc, 9, ['T', 'M', 'B', 'D'], ['L', 'C', 'R', 'S']);
    if (isGeneric(cand) && pureNash(cand).length === target) {
      g = cand;
      break;
    }
  }
  const ne = pureNash(g);
  const efficient = paretoEfficientCells(g);
  const isEff = (c: Cell) => efficient.some((e) => e[0] === c[0] && e[1] === c[1]);
  const parts: SimpleQuestion[] = [nashQuestion(g, { kind, seed, prompt: 'Find all Nash equilibria in pure strategies.' })];
  if (ne.length > 0) {
    parts.push(
      choice(
        {
          kind,
          seed,
          prompt: 'Which of these equilibria are Pareto efficient (no other outcome is at least as good for both players and better for one)?',
          explanation: ne.map((c) => {
            if (isEff(c)) return `${profile(g, c)} gives (${g.u[c[0]][c[1]].map(v).join(', ')}); no outcome Pareto dominates it.`;
            const better = allCells(g).find((d) => paretoDominates(g.u[d[0]][d[1]], g.u[c[0]][c[1]]))!;
            return `${profile(g, c)} gives (${g.u[c[0]][c[1]].map(v).join(', ')}) but ${profile(g, better)} gives (${g.u[better[0]][better[1]].map(v).join(', ')}): both weakly better, one strictly, so it is not efficient.`;
          }),
        },
        [...ne.map((c) => ({ id: cellId(c), label: profile(g, c), ok: isEff(c) })), { id: 'none', label: 'None of them', ok: !ne.some(isEff) }],
        rng,
        { multi: true, exclusive: ['none'], keepOrder: true },
      ),
    );
  }
  return caseOf(kind, seed, 'Consider the following game in normal form:', parts, matrix(g));
}

/** Problem set 1.13: three players with two strategies each. */
function threePlayerQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const kind = 'gt.pure';
  const S: [string[], string[], string[]] = [
    ['A', 'B'],
    ['X', 'Y'],
    ['R', 'S'],
  ];
  const make = (): Game3 => ({
    players: ['Player 1', 'Player 2', 'Player 3'],
    strategies: S,
    u: [0, 1].map(() => [0, 1].map(() => [0, 1].map(() => [rng.int(0, 5), rng.int(0, 5), rng.int(0, 5)] as [number, number, number]))),
  });
  const strict = (g: Game3) =>
    [0, 1].every((a) =>
      [0, 1].every((b) => [0, 1].every((c) => g.u[a][b][c][0] !== g.u[1 - a][b][c][0] && g.u[a][b][c][1] !== g.u[a][1 - b][c][1] && g.u[a][b][c][2] !== g.u[a][b][1 - c][2])),
    );
  let g = make();
  for (let attempt = 0; attempt < 2000; attempt++) {
    const cand = make();
    const n = pureNash3(cand).length;
    if (strict(cand) && n >= 1 && n <= 2) {
      g = cand;
      break;
    }
  }
  const ne = pureNash3(g);
  const label = (p: number[]) => `(${S[0][p[0]]}, ${S[1][p[1]]}, ${S[2][p[2]]})`;
  const profiles = [0, 1].flatMap((c) => [0, 1].flatMap((a) => [0, 1].map((b) => [a, b, c])));
  const panel = (c: number, marks: boolean): Visual => ({
    type: 'bimatrix',
    players: ['Player 1', 'Player 2'],
    rows: S[0],
    cols: S[1],
    cells: [0, 1].map((a) => [0, 1].map((b) => g.u[a][b][c].map(v))),
    caption: `Player 3 plays ${S[2][c]} (payoffs: player 1, player 2, player 3)`,
    ...(marks
      ? {
          marks: {
            underline: [0, 1].map((a) =>
              [0, 1].map((b) => [g.u[a][b][c][0] >= g.u[1 - a][b][c][0], g.u[a][b][c][1] >= g.u[a][1 - b][c][1], g.u[a][b][c][2] >= g.u[a][b][1 - c][2]]),
            ),
            ring: ne.filter((p) => p[2] === c).map((p) => [p[0], p[1]] as Cell),
          },
        }
      : {}),
  });
  const deviation = (p: number[]): string => {
    for (const i of [0, 1, 2]) {
      const d = [...p];
      d[i] = 1 - d[i];
      if (g.u[d[0]][d[1]][d[2]][i] > g.u[p[0]][p[1]][p[2]][i]) return `${label(p)}: player ${i + 1} gains by switching to ${S[i][d[i]]} (${g.u[d[0]][d[1]][d[2]][i]} > ${g.u[p[0]][p[1]][p[2]][i]}).`;
    }
    return '';
  };
  return choice(
    {
      kind,
      seed,
      prompt: 'Find the Nash equilibria in pure strategies (if there are any) of this three-player game.',
      visual: { type: 'stack', items: [panel(0, false), panel(1, false)] },
      revealVisual: { type: 'stack', items: [panel(0, true), panel(1, true)] },
      explanation: [
        'Check each of the 8 profiles: a profile is an equilibrium if none of the three players gains by changing only their own strategy (player 3 compares the same cell across the two tables).',
        ...(ne.length ? [`Equilibria: ${ne.map(label).join(' and ')}.`] : []),
        ...profiles.filter((p) => !ne.some((n) => n.every((x, i) => x === p[i]))).map(deviation),
      ],
    },
    [...profiles.map((p) => ({ id: p.join(''), label: label(p), ok: ne.some((n) => n.every((x, i) => x === p[i])) })), { id: 'none', label: 'No pure-strategy equilibrium', ok: ne.length === 0 }],
    rng,
    { multi: true, exclusive: ['none'], keepOrder: true },
  );
}

// ---------------------------------------------------------------------------------------------
// Mixed strategies (problem set 1.6, 1.12; slides: Colonel Blotto, terrorist hunt)

function mixedXExplanation(g: Bimatrix, m: Mixed2x2): string[] {
  const [[A, B], [C, D]] = g.u;
  return [
    `x makes **${g.players[1]}** indifferent between ${g.cols[0]} and ${g.cols[1]}: ${g.cols[0]} gives x·${v(A[1])} + (1 − x)·${v(C[1])}, ${g.cols[1]} gives x·${v(B[1])} + (1 − x)·${v(D[1])}.`,
    `Setting them equal gives x = ${formatProb(m.x)}. A player’s own mixing probabilities come from the other player’s payoffs.`,
  ];
}

function mixedYExplanation(g: Bimatrix, m: Mixed2x2): string[] {
  const [[A, B], [C, D]] = g.u;
  return [
    `y makes **${g.players[0]}** indifferent between ${g.rows[0]} and ${g.rows[1]}: ${g.rows[0]} gives y·${v(A[0])} + (1 − y)·${v(B[0])}, ${g.rows[1]} gives y·${v(C[0])} + (1 − y)·${v(D[0])}.`,
    `Setting them equal gives y = ${formatProb(m.y)}.`,
  ];
}

function nice2x2(rng: Rng, type: 'cycle' | 'coord', max = 6, rows = ['T', 'B'], cols = ['L', 'R']): { g: Bimatrix; m: Mixed2x2 } {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const g = randomGame(rng, 2, 2, max, rows, cols);
    if (!isGeneric(g)) continue;
    const ne = pureNash(g).length;
    if ((type === 'cycle' && ne !== 0) || (type === 'coord' && ne !== 2)) continue;
    const m = fullyMixed2x2(g);
    if (m && asFraction(m.x, 8) && asFraction(m.y, 8)) return { g, m };
  }
  const g = bimatrix(rows, cols, [
    [[2, 1], [0, 2]],
    [[1, 3], [3, 0]],
  ]);
  return { g, m: fullyMixed2x2(g)! };
}

function mixedCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.mixed';
  const variant = rng.pick(['cycle', 'coord', 'dominated'] as const);
  if (variant === 'dominated') return dominatedRowCase(rng, seed);
  const { g, m } = nice2x2(rng, variant);
  const [u1] = [m.y * g.u[0][0][0] + (1 - m.y) * g.u[0][1][0]];
  const u2 = m.x * g.u[0][0][1] + (1 - m.x) * g.u[1][0][1];
  const plot = brPlot2x2(g, m);
  const parts: SimpleQuestion[] = [
    nashQuestion(g, { kind, seed, prompt: 'Find all Nash equilibria in pure strategies.' }),
    numeric({ kind, seed, prompt: `In the completely mixed equilibrium, with what probability y does ${g.players[1]} play ${g.cols[0]}?`, explanation: mixedYExplanation(g, m), revealVisual: plot }, m.y, {
      label: formatProb(m.y),
    }),
    numeric({ kind, seed, prompt: `And with what probability x does ${g.players[0]} play ${g.rows[0]}?`, explanation: mixedXExplanation(g, m), revealVisual: plot }, m.x, { label: formatProb(m.x) }),
    numeric(
      {
        kind,
        seed,
        prompt: `What is ${possessive(g.players[0])} expected payoff in the mixed equilibrium?`,
        explanation: [
          `${g.players[0]} is indifferent, so any of their strategies gives the equilibrium payoff: E[${g.rows[0]}] = ${formatValue(m.y)}·${v(g.u[0][0][0])} + ${formatValue(1 - m.y)}·${v(g.u[0][1][0])} = ${formatProb(u1)}.`,
          `(${possessive(g.players[1])} expected payoff is ${formatProb(u2)}.)`,
        ],
      },
      u1,
      { label: formatProb(u1) },
    ),
  ];
  return caseOf(kind, seed, 'Find the Nash equilibria of the following game (x and y are the mixing probabilities):', parts, matrix(g, { rowProbs: ['x', '1 − x'], colProbs: ['y', '1 − y'] }));
}

/** Problem set 1.12: a 3×2 game where one row is strictly dominated; then mix in the 2×2 that is left. */
function dominatedRowCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.mixed';
  const base = nice2x2(rng, rng.chance(0.5) ? 'cycle' : 'coord', 6, ['_0', '_1'], ['L', 'R']);
  const by = rng.int(0, 1);
  const pos = rng.int(0, 2);
  const names = ['T', 'M', 'B'];
  const dominatedRow: [number, number][] = base.g.u[by].map(([a]) => [a - rng.int(1, 3), rng.int(0, 6)] as [number, number]);
  const rowsU = [...base.g.u];
  rowsU.splice(pos, 0, dominatedRow);
  const g = bimatrix(names, ['L', 'R'], rowsU);
  const keep = [0, 1, 2].filter((r) => r !== pos);
  const sg = subgame(g, keep, [0, 1]);
  const m = fullyMixed2x2(sg)!;
  const dominator = keep[by];
  const parts: SimpleQuestion[] = [
    choice(
      {
        kind,
        seed,
        prompt: 'Which strategies are strictly dominated?',
        explanation: [
          `${g.players[0]}: ${names[pos]} is strictly dominated by ${names[dominator]} — ${comparison(g, 0, dominator, pos, [0, 1])}. Eliminate it.`,
          `No other strategy is dominated: ${g.cols[0]} and ${g.cols[1]} are each better against some row, and the two remaining rows are each better against some column.`,
        ],
      },
      [...strategyOptions(g, (p, s) => p === 0 && s === pos), { id: 'none', label: 'None', ok: false }],
      rng,
      { multi: true, exclusive: ['none'], keepOrder: true },
    ),
    nashQuestion(sg, { kind, seed, prompt: `After eliminating it, find all pure-strategy Nash equilibria.` }),
    numeric(
      {
        kind,
        seed,
        prompt: `In the completely mixed equilibrium, with what probability does ${g.players[0]} play ${sg.rows[0]}?`,
        explanation: [...mixedXExplanation(sg, m), `${names[pos]} is played with probability 0: a strictly dominated strategy is never used in an equilibrium.`],
        revealVisual: brPlot2x2(sg, m),
      },
      m.x,
      { label: formatProb(m.x) },
    ),
    numeric({ kind, seed, prompt: `With what probability does ${g.players[1]} play ${g.cols[0]}?`, explanation: mixedYExplanation(sg, m) }, m.y, { label: formatProb(m.y) }),
  ];
  return caseOf(kind, seed, 'Consider the following game in normal form:', parts, matrix(g));
}

// ---------------------------------------------------------------------------------------------
// From a story to a bimatrix (midterm problem 3, problem set 1.8, 1.9; slides: penalty kicks)

function payoffMatch(g: Bimatrix, cells: Cell[], distractors: [number, number][], base: Base): MatchQuestion {
  const pairLabel = (p: readonly number[]) => `${v(p[0])}, ${v(p[1])}`;
  const labels = [...new Set([...cells.map(([r, c]) => pairLabel(g.u[r][c])), ...distractors.map(pairLabel)])];
  const options = labels.map((l, i) => ({ id: `p${i}`, label: l }));
  const idOf = (l: string) => options.find((o) => o.label === l)!.id;
  return {
    ...base,
    format: 'match',
    rows: cells.map(([r, c]) => ({ id: cellId([r, c]), label: `${g.players[0]}: ${g.rows[r]} · ${g.players[1]}: ${g.cols[c]}` })),
    options: [...options].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    correct: Object.fromEntries(cells.map(([r, c]) => [cellId([r, c]), [idOf(pairLabel(g.u[r][c]))]])),
  };
}

function storyCase(rng: Rng, seed: string): CaseQuestion {
  const r = rng.next();
  if (r < 0.35) return ticketCase(rng, seed);
  if (r < 0.6) return hawkDoveCase(rng, seed);
  if (r < 0.8) return penaltyCase(rng, seed);
  return creditCase(rng, seed);
}

function ticketCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.story';
  let V = 40;
  let t1 = 25;
  let t2 = 35;
  let g!: Bimatrix;
  const build = (V: number, t1: number, t2: number) => {
    const price = [0, t1, t2];
    const u = (mine: number, theirs: number) => {
      if (mine === 0) return 0;
      if (mine > theirs) return V - mine;
      if (mine === theirs) return V / 2 - mine;
      return -mine;
    };
    const names = ['None', `$${t1}`, `$${t2}`];
    return bimatrix(names, names, price.map((a) => price.map((b) => [u(a, b), u(b, a)] as [number, number])), ['C1', 'C2']);
  };
  const anti = rng.chance(0.7);
  for (let attempt = 0; attempt < 400; attempt++) {
    const cV = rng.pick([30, 40, 50, 60, 80]);
    const steps = cV / 5;
    const c1 = anti ? 5 * rng.int(Math.floor(steps / 2) + 1, steps - 2) : 5 * rng.int(1, Math.ceil(steps / 2) - 1);
    if (c1 <= 0 || c1 >= cV) continue;
    const c2 = 5 * rng.int(c1 / 5 + 1, steps - 1);
    if (c2 <= c1 || c2 >= cV) continue;
    const cand = build(cV, c1, c2);
    if (!isGeneric(cand)) continue;
    [V, t1, t2, g] = [cV, c1, c2, cand];
    break;
  }
  if (!g) g = build(V, t1, t2);
  const reduced = subgame(g, [0, 1], [0, 1]);
  const m = fullyMixed2x2(reduced);
  const ne = pureNash(g);
  const t2Sold = ne.some(([a, b]) => a === 2 || b === 2);
  const cells = rng.sample(allCells(g), 4);
  const parts: SimpleQuestion[] = [
    payoffMatch(g, cells, [[V / 2, V / 2], [V - t1, 0], [-t2, V]], {
      kind,
      seed,
      prompt: 'Build the payoff bimatrix: what are the payoffs (C1, C2) in these profiles?',
      explanation: [
        `A contestant who buys nothing gets 0. A buyer pays the ticket price whatever happens; the highest ticket wins the $${V} prize (split in a tie). So the sole highest buyer gets ${V} − price, a tie at the top gives ${V / 2} − price each, and a lower ticket loses its price.`,
      ],
      revealVisual: matrix(g),
    }),
    nashQuestion(g, { kind, seed, prompt: 'Find all Nash equilibria in pure strategies.', visual: matrix(g, { caption: 'The full payoff bimatrix.' }) }),
    choice(
      {
        kind,
        seed,
        prompt: `Will $${t2} tickets ever be sold in a pure-strategy equilibrium?`,
        explanation: [
          ne.length
            ? `The pure equilibria are ${ne.map((c) => profile(g, c)).join(' and ')}: ${t2Sold ? `a $${t2} ticket is bought in ${ne.filter(([a, b]) => a === 2 || b === 2).map((c) => profile(g, c)).join(' and ')}` : `none involves a $${t2} ticket`}.`
            : 'There is no pure-strategy equilibrium, so no ticket of any kind is sold in one.',
          `Against a $${t1} ticket, $${t2} wins outright (${V} − ${t2} = ${V - t2}); against a $${t2} ticket it only ties (${V / 2} − ${t2} = ${V / 2 - t2}).`,
        ],
      },
      [
        { id: 'yes', label: `Yes: some pure equilibrium has a $${t2} ticket`, ok: t2Sold },
        { id: 'no', label: `No: no pure equilibrium has a $${t2} ticket`, ok: !t2Sold },
      ],
      rng,
      { keepOrder: true },
    ),
    nashQuestion(reduced, {
      kind,
      seed,
      prompt: `Now the $${t2} ticket is no longer available (each contestant can buy nothing or a $${t1} ticket). Find the pure-strategy equilibria.`,
      visual: matrix(reduced),
    }),
  ];
  if (m) {
    const buy = 1 - m.x;
    parts.push(
      numeric(
        {
          kind,
          seed,
          prompt: `In the symmetric mixed equilibrium of this reduced game, with what probability does each contestant buy the $${t1} ticket?`,
          explanation: [
            `If the other buys with probability p, buying gives p·(${V / 2} − ${t1}) + (1 − p)·(${V} − ${t1}) = ${V - t1} − ${V / 2}p, and not buying gives 0. Indifference: ${V - t1} = ${V / 2}p, so p = ${formatProb(buy)}.`,
            `Each contestant expects 0 in this equilibrium: the prize is competed away.`,
          ],
          revealVisual: brPlot2x2(reduced, m),
        },
        buy,
        { label: formatProb(buy) },
      ),
    );
  }
  return caseOf(
    kind,
    seed,
    `There is a prize worth $${V} and two contestants, C1 and C2. Each can buy a ticket worth $${t1} or $${t2}, or not buy a ticket, simultaneously and independently. If nobody buys, the prize is not awarded; otherwise it goes to the buyer of the highest-cost ticket, and is split equally if both bought the highest-cost ticket.`,
    parts,
  );
}

function hawkDoveCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.story';
  const V = rng.pick([4, 6, 8, 10, 12]);
  const costly = rng.chance(0.8);
  const c = costly ? V / 2 + rng.int(1, 8) : rng.int(1, Math.max(1, V / 2 - 1));
  const hh = V / 2 - c;
  const g = bimatrix(['Hawk', 'Dove'], ['Hawk', 'Dove'], [
    [[hh, hh], [V, 0]],
    [[0, V], [V / 2, V / 2]],
  ], ['Animal 1', 'Animal 2']);
  const m = fullyMixed2x2(g);
  const parts: SimpleQuestion[] = [
    numeric(
      {
        kind,
        seed,
        prompt: 'What does each animal expect to get when both behave aggressively (Hawk, Hawk)?',
        explanation: [`They fight: each is the stronger one with probability 1/2 and then keeps the object (worth ${V}), and both suffer the injury −${c}. Expected payoff: ${V}/2 − ${c} = ${v(hh)}.`],
        revealVisual: matrix(g),
      },
      hh,
      { label: v(hh), placeholder: 'payoff' },
    ),
    nashQuestion(g, { kind, seed, prompt: 'Find all Nash equilibria in pure strategies.', visual: matrix(g) }),
  ];
  if (m) {
    const eu = (1 - m.x) * (V / 2);
    parts.push(
      numeric(
        {
          kind,
          seed,
          prompt: 'In the symmetric mixed equilibrium, with what probability does each animal play Hawk?',
          explanation: [
            `If the other plays Hawk with probability p: Hawk gives p(${v(hh)}) + (1 − p)·${V}; Dove gives (1 − p)·${V / 2}. Indifference gives p = ${V}/(2·${c}) = ${formatProb(m.x)}.`,
            'Interpretation: in a large population a share p of hawks is stable — more hawks make fighting too costly, fewer make aggression pay. The costlier the fight, the fewer hawks.',
          ],
          revealVisual: brPlot2x2(g, m),
        },
        m.x,
        { label: formatProb(m.x) },
      ),
      numeric(
        {
          kind,
          seed,
          prompt: 'What is each animal’s expected payoff in that mixed equilibrium?',
          explanation: [`Dove gives (1 − p)·${V / 2} = ${formatValue(1 - m.x)}·${V / 2} = ${formatProb(eu)}, and Hawk gives the same (indifference). Less than ${V / 2}, what two doves would get: fights waste value.`],
        },
        eu,
        { label: formatProb(eu) },
      ),
    );
  } else {
    parts.push(
      choice(
        {
          kind,
          seed,
          prompt: 'Is there an equilibrium in which the animals randomise?',
          explanation: [`With c = ${c} < ${V / 2}, Hawk strictly dominates Dove (${v(hh)} > 0 and ${V} > ${V / 2}). A strictly dominated strategy is never played with positive probability, so the only equilibrium is (Hawk, Hawk) — even though (Dove, Dove) is better for both.`],
        },
        [
          { id: 'no', label: 'No: Hawk strictly dominates Dove, so (Hawk, Hawk) is the only equilibrium', ok: true },
          { id: 'half', label: 'Yes: each plays Hawk with probability 1/2', note: 'Dove is never a best reply here.' },
          { id: 'nash', label: 'Yes: by Nash’s theorem every 2×2 game has a completely mixed equilibrium', note: 'Nash guarantees an equilibrium, possibly in pure strategies.' },
        ],
        rng,
      ),
    );
  }
  return caseOf(
    kind,
    seed,
    `Two animals compete over an object worth ${V}. Each can be aggressive (Hawk) or passive (Dove). Two doves share the object; a hawk facing a dove keeps it. Two hawks fight: the stronger one (each with probability 1/2) keeps the object, and both suffer injuries worth −${c}.`,
    parts,
  );
}

function penaltyCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.story';
  let g!: Bimatrix;
  let m: Mixed2x2 | null = null;
  for (let attempt = 0; attempt < 400 && !m; attempt++) {
    const gL = 5 * rng.int(4, 10);
    const gR = 5 * rng.int(4, 10);
    const oL = 5 * rng.int(14, 19);
    const oR = 5 * rng.int(14, 19);
    g = bimatrix(['Left', 'Right'], ['Left', 'Right'], [
      [[gL, 100 - gL], [oL, 100 - oL]],
      [[oR, 100 - oR], [gR, 100 - gR]],
    ], ['Shooter', 'Goalkeeper']);
    m = fullyMixed2x2(g);
    if (m && (!asFraction(m.x, 20) || !asFraction(m.y, 20))) m = null;
  }
  m = m ?? fullyMixed2x2(g)!;
  const goal = m.y * g.u[0][0][0] + (1 - m.y) * g.u[0][1][0];
  const parts: SimpleQuestion[] = [
    nashQuestion(g, { kind, seed, prompt: 'Find all Nash equilibria in pure strategies.' }),
    numeric(
      { kind, seed, prompt: 'In the mixed equilibrium, with what probability does the goalkeeper dive Left?', explanation: mixedYExplanation(g, m), revealVisual: brPlot2x2(g, m) },
      m.y,
      { label: formatProb(m.y), abs: 0.01 },
    ),
    numeric({ kind, seed, prompt: 'With what probability does the shooter kick Left?', explanation: mixedXExplanation(g, m) }, m.x, { label: formatProb(m.x), abs: 0.01 }),
    numeric(
      {
        kind,
        seed,
        prompt: 'What is the probability of a goal in equilibrium (in %)?',
        explanation: [`The shooter is indifferent, so kicking Left gives the equilibrium value: ${formatValue(m.y)}·${g.u[0][0][0]} + ${formatValue(1 - m.y)}·${g.u[0][1][0]} = ${dec(goal, 1)} %.`],
      },
      goal,
      { label: `${dec(goal, 1)} %`, unit: '%', abs: 0.6, placeholder: 'e.g. 62.5' },
    ),
  ];
  return caseOf(
    kind,
    seed,
    'A shooter kicks Left or Right while the goalkeeper simultaneously dives Left or Right. The table gives the probability of a goal (%) as the shooter’s payoff; the goalkeeper’s payoff is 100 minus that.',
    parts,
    matrix(g, { rowProbs: ['x', '1 − x'], colProbs: ['y', '1 − y'] }),
  );
}

function creditCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.story';
  const R = rng.pick([700, 800, 900]);
  const P = R - 100 * rng.int(1, 3);
  const T = R + 100 * rng.int(1, 2);
  const S = Math.max(100, P - 100 * rng.int(1, 3));
  const g = bimatrix(['No credit', 'Credit'], ['No credit', 'Credit'], [
    [[R, R], [S, T]],
    [[T, S], [P, P]],
  ], ['Firm 1', 'Firm 2']);
  const parts: SimpleQuestion[] = [
    payoffMatch(g, allCells(g), [[T, T], [S, S]], {
      kind,
      seed,
      prompt: 'Represent the game in normal form: what are the payoffs (Firm 1, Firm 2) in each profile?',
      explanation: ['Read the payoffs off the story; the firm that offers credit alone attracts customers from the other.'],
      revealVisual: matrix(g),
    }),
    choice(
      {
        kind,
        seed,
        prompt: 'Which game seen in class is this similar to?',
        explanation: [`Credit strictly dominates No credit (${T} > ${R} and ${P} > ${S}), yet both firms prefer (No credit, No credit) to the equilibrium (Credit, Credit): ${R} > ${P}. That is the prisoners’ dilemma.`],
      },
      [
        { id: 'pd', label: 'The prisoners’ dilemma', ok: true },
        { id: 'hunt', label: 'The terrorist hunt (coordination)', note: 'In a coordination game the best reply to No credit would be No credit.' },
        { id: 'blotto', label: 'Colonel Blotto (no pure equilibrium)', note: 'Here there is a pure equilibrium in dominant strategies.' },
        { id: 'hawk', label: 'Hawk–dove', note: 'In hawk–dove the best reply to the aggressive action is the passive one.' },
      ],
      rng,
    ),
    nashQuestion(g, { kind, seed, prompt: 'Find the Nash equilibrium or equilibria in pure strategies.', visual: matrix(g) }),
    choice(
      {
        kind,
        seed,
        prompt: 'Are there equilibria in mixed (non-pure) strategies?',
        explanation: ['No. Offering credit is strictly better whatever the rival does, so No credit is never a best reply to any belief; a strategy played with positive probability in a mixed equilibrium must be a best reply (and must survive IESDS). Same argument as problem 1.7 for the prisoners’ dilemma.'],
      },
      [
        { id: 'no', label: 'No: No credit is strictly dominated, so it is never played with positive probability', ok: true },
        { id: 'half', label: 'Yes: each firm offers credit with probability 1/2', note: 'At 1/2, Credit still pays strictly more: no indifference.' },
        { id: 'nash', label: 'Yes: by Nash’s theorem every game has a completely mixed equilibrium', note: 'Nash guarantees some equilibrium, which can be pure.' },
        { id: 'zero', label: 'No: mixed equilibria only exist in zero-sum games', note: 'The terrorist hunt has one, and it is not zero-sum.' },
      ],
      rng,
    ),
    choice(
      {
        kind,
        seed,
        prompt: 'What is the role of communication in this game?',
        explanation: ['A promise not to offer credit is cheap talk: whatever the rival does, offering credit pays more, so the agreement is not a Nash equilibrium and nobody has an incentive to keep it. Communication helps in coordination games (it can select an equilibrium), not here; only a binding contract or repeated interaction could sustain cooperation.'],
      },
      [
        { id: 'ok', label: 'Limited: an agreement not to offer credit is not self-enforcing, since each firm gains by breaking it', ok: true },
        { id: 'solve', label: 'It solves the problem: (No credit, No credit) becomes an equilibrium once they talk', note: 'Talking does not change the payoffs, so it does not change the equilibrium.' },
        { id: 'coord', label: 'It is needed to coordinate on one of the two equilibria', note: 'There is only one equilibrium.' },
        { id: 'none', label: 'None, because the game has no equilibrium', note: '(Credit, Credit) is an equilibrium in dominant strategies.' },
      ],
      rng,
    ),
  ];
  return caseOf(
    kind,
    seed,
    `Two car companies launch a car at the same time and each decides whether to offer credit to buyers. If neither offers credit they earn $${R} million each; if both do, $${P} million each. If only one offers credit, it earns $${T} million and the other $${S} million.`,
    parts,
  );
}

// ---------------------------------------------------------------------------------------------
// Equilibrium selection: payoff and risk dominance

function selectionCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.selection';
  const [S, T] = rng.pick([
    ['A', 'B'],
    ['Stag', 'Hare'],
    ['Invest', 'Wait'],
  ]);
  const riskForT = rng.chance(0.6);
  let a = 4;
  let b = 0;
  let c = 3;
  let d = 3;
  for (let attempt = 0; attempt < 400; attempt++) {
    const cb = rng.int(0, 3);
    const cd = cb + rng.int(1, 6);
    const ca = cd + rng.int(1, 4);
    const lo = riskForT ? Math.max(0, ca - (cd - cb) + 1) : 0;
    const hi = riskForT ? ca - 1 : ca - (cd - cb) - 1;
    if (hi < lo) continue;
    const cc = rng.int(lo, hi);
    if (ca - cc === cd - cb) continue;
    [a, b, c, d] = [ca, cb, cc, cd];
    break;
  }
  const g = bimatrix([S, T], [S, T], [
    [[a, a], [b, c]],
    [[c, b], [d, d]],
  ]);
  const p = riskThreshold(a, b, c, d);
  const riskS = a - c > d - b;
  const parts: SimpleQuestion[] = [
    nashQuestion(g, { kind, seed, prompt: 'Find the pure-strategy Nash equilibria.' }),
    choice(
      { kind, seed, prompt: 'Which equilibrium is payoff dominant?', explanation: [`(${S}, ${S}) gives (${a}, ${a}) and (${T}, ${T}) gives (${d}, ${d}). Both players prefer (${S}, ${S}), which also beats the mixed equilibrium: it Pareto dominates every other equilibrium.`] },
      [
        { id: 's', label: `(${S}, ${S})`, ok: true },
        { id: 't', label: `(${T}, ${T})` },
        { id: 'none', label: 'Neither: the players disagree about which is better' },
        { id: 'mixed', label: 'The mixed equilibrium' },
      ],
      rng,
      { keepOrder: true },
    ),
    numeric(
      {
        kind,
        seed,
        prompt: `${S} is a best reply exactly when the opponent plays ${S} with probability at least p*. Find p*.`,
        explanation: [
          `U(${S} | p) = ${a}p + ${b}(1 − p) and U(${T} | p) = ${c}p + ${d}(1 − p). ${S} is at least as good when p ≥ p* = (${d} − ${b}) / ((${a} − ${c}) + (${d} − ${b})) = ${formatProb(p)}.`,
          `p* is also the probability of ${S} in the mixed equilibrium (where each player is exactly indifferent).`,
        ],
      },
      p,
      { label: formatProb(p) },
    ),
    choice(
      {
        kind,
        seed,
        prompt: 'Which equilibrium is risk dominant?',
        explanation: [
          `Deviation losses: from (${S}, ${S}) a player loses ${a} − ${c} = ${a - c}; from (${T}, ${T}) ${d} − ${b} = ${d - b}. The equilibrium with the larger deviation loss is risk dominant (equivalently p* ${riskS ? '<' : '>'} 1/2): ${riskS ? `(${S}, ${S})` : `(${T}, ${T})`}.`,
          riskS
            ? 'Here both criteria select the same equilibrium.'
            : `The criteria disagree: (${S}, ${S}) is better for both, but playing ${S} needs confidence (at least ${formatValue(p)}) that the other plays ${S} too.`,
        ],
      },
      [
        { id: 's', label: `(${S}, ${S})`, ok: riskS },
        { id: 't', label: `(${T}, ${T})`, ok: !riskS },
        { id: 'none', label: 'Neither (the deviation losses are equal)' },
      ],
      rng,
      { keepOrder: true },
    ),
    choice(
      {
        kind,
        seed,
        prompt: `Is (${S}, ${T}) rationalizable? Is it a Nash equilibrium?`,
        explanation: [
          `${S} is a best reply to the belief “the other plays ${S}”, and ${T} to “the other plays ${T}”: neither is ever deleted, so every profile — including (${S}, ${T}) — consists of rationalizable strategies.`,
          `It is not a Nash equilibrium: the player choosing ${S} would switch to ${T}. Rationalizability allows mistaken beliefs; Nash equilibrium requires beliefs to be correct.`,
        ],
      },
      [
        { id: 'ok', label: 'Rationalizable, but not a Nash equilibrium', ok: true },
        { id: 'both', label: 'Rationalizable and a Nash equilibrium' },
        { id: 'neither', label: 'Neither: only equilibrium profiles are rationalizable' },
        { id: 'weak', label: `Not rationalizable: ${S} is weakly dominated` },
      ],
      rng,
    ),
  ];
  return caseOf(kind, seed, 'Consider the symmetric coordination game:', parts, matrix(g));
}

// ---------------------------------------------------------------------------------------------
// Rationalizability (slides: domination by a mixed strategy)

function rationalCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.rational';
  let g = bimatrix(['U', 'M', 'D'], ['L', 'R'], [
    [[3, 2], [0, 0]],
    [[0, 2], [3, 0]],
    [[1, 0], [1, 3]],
  ]);
  let interval: [number, number] = [1 / 3, 2 / 3];
  for (let attempt = 0; attempt < 2000; attempt++) {
    const hi1 = rng.int(3, 6);
    const lo1 = rng.int(0, 1);
    const lo2 = rng.int(0, 1);
    const hi2 = rng.int(3, 6);
    const d1 = rng.int(lo2 + 1, hi1 - 1);
    const d2 = rng.int(lo1 + 1, hi2 - 1);
    const lU = rng.int(1, 4);
    const lM = rng.int(1, 4);
    const rD = rng.int(1, 4);
    const cand = bimatrix(['U', 'M', 'D'], ['L', 'R'], [
      [[hi1, lU], [lo1, rng.int(0, lU - 1)]],
      [[lo2, lM], [hi2, rng.int(0, lM - 1)]],
      [[d1, rng.int(0, rD - 1)], [d2, rD]],
    ]);
    if (dominatedStrategies(cand, 0, true).length > 0) continue;
    if (isBestResponseToSomeBelief(cand, 0, 2, [0, 1, 2], [0, 1])) continue;
    const iv = dominatingMixInterval(cand, 0, 2, 0, 1, [0, 1]);
    const rat = rationalizable(cand);
    if (!iv || rat.rows.length !== 1 || rat.cols.length !== 1 || rat.rows[0] !== 0 || rat.cols[0] !== 0) continue;
    if (!asFraction(iv[0], 12) || !asFraction(iv[1], 12) || iv[1] - iv[0] < 0.05) continue;
    g = cand;
    interval = iv;
    break;
  }
  const [[U_L], [M_L], [D_L]] = g.u.map((row) => [row[0][0]]);
  const [U_R, M_R, D_R] = g.u.map((row) => row[1][0]);
  const parts: SimpleQuestion[] = [
    choice(
      {
        kind,
        seed,
        prompt: 'Is D strictly dominated?',
        explanation: [
          `By a pure strategy, no: U beats D against L (${U_L} > ${D_L}) but not against R (${U_R} < ${D_R}); M beats D against R (${M_R} > ${D_R}) but not against L (${M_L} < ${D_L}).`,
          `By a mixture, yes: λU + (1 − λ)M gives ${U_L}λ + ${M_L}(1 − λ) against L and ${U_R}λ + ${M_R}(1 − λ) against R; for suitable λ both exceed D’s payoffs. Equivalently, D is never a best reply to any belief about player 2.`,
        ],
      },
      [
        { id: 'ok', label: 'Not by any pure strategy, but by a mixture of U and M', ok: true },
        { id: 'u', label: 'Yes, by U', note: `Against R, U gives ${U_R} < ${D_R}.` },
        { id: 'm', label: 'Yes, by M', note: `Against L, M gives ${M_L} < ${D_L}.` },
        { id: 'no', label: 'No: D is a best reply to some belief, so it is rationalizable' },
      ],
      rng,
    ),
    numeric(
      {
        kind,
        seed,
        prompt: 'λU + (1 − λ)M strictly dominates D exactly when λ is in an open interval (λ₁, λ₂). Find λ₁.',
        explanation: [`Against L: ${U_L}λ + ${M_L}(1 − λ) > ${D_L} ⇔ λ > ${formatProb(interval[0])}. Against R: ${U_R}λ + ${M_R}(1 − λ) > ${D_R} ⇔ λ < ${formatProb(interval[1])}.`],
      },
      interval[0],
      { label: formatProb(interval[0]) },
    ),
    numeric({ kind, seed, prompt: 'And λ₂?', explanation: [`From the condition against R: λ < ${formatProb(interval[1])}.`] }, interval[1], { label: formatProb(interval[1]) }),
    choice(
      {
        kind,
        seed,
        prompt: 'Which strategies are rationalizable?',
        explanation: [
          'Round 1: delete D (never a best reply). Round 2: against U and M only, L is strictly better than R for player 2, so delete R. Round 3: against L, U beats M, so delete M.',
          'Only U and L survive; (U, L) is the unique Nash equilibrium. This is iterated elimination of strictly dominated strategies, allowing domination by mixed strategies.',
        ],
        revealVisual: solvedMatrix(g),
      },
      [
        { id: 'ok', label: 'Only U for player 1 and only L for player 2', ok: true },
        { id: 'um', label: 'U and M for player 1; L for player 2', note: 'Once R is gone, M is worse than U.' },
        { id: 'all', label: 'All of them: no pure strategy dominates D, so nothing can be deleted', note: 'Domination by a mixture is enough.' },
        { id: 'ulr', label: 'U for player 1; L and R for player 2', note: 'Once D is gone, R is never a best reply.' },
      ],
      rng,
    ),
  ];
  return caseOf(kind, seed, 'Consider the following game:', parts, matrix(g));
}

// ---------------------------------------------------------------------------------------------
// Cournot and Bertrand duopoly (slides: applications)

function demandText(a: number, b: number): string {
  return `P(Q) = max{${a} − ${b === 1 ? '' : b}Q, 0}`;
}

function cournotPlot(a: number, b: number, c: number): Visual {
  const top = (a - c) / b;
  const br = (a - c) / (2 * b);
  const q = (a - c) / (3 * b);
  return {
    type: 'brPlot',
    xLabel: 'q₁',
    yLabel: 'q₂',
    xMax: top,
    yMax: top,
    xTicks: [0, q, br, top].map((t) => ({ at: t, label: dec(t, 1) })),
    yTicks: [0, q, br, top].map((t) => ({ at: t, label: dec(t, 1) })),
    series: [
      { label: 'BR₁(q₂)', tone: 'coral', points: [[br, 0], [0, top]] },
      { label: 'BR₂(q₁)', tone: 'teal', points: [[0, br], [top, 0]] },
    ],
    dots: [{ x: q, y: q, label: `q₁ = q₂ = ${dec(q)}` }],
  };
}

function cournotCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.cournot';
  const variant = rng.pick(['sym', 'collude', 'asym', 'bertrand'] as const);
  const b = rng.pick([1, 1, 2]);
  const m = rng.int(5, 20);
  const c = rng.pick([5, 10, 15, 20, 30]);
  const a = c + 3 * b * m;
  const intro = `Two firms sell the same good, choosing quantities simultaneously. Inverse demand is ${demandText(a, b)} and each firm has constant marginal cost c = ${c}.`;

  if (variant === 'asym') {
    const c1 = rng.pick([10, 15, 20]);
    const c2 = c1 + rng.pick([3, 6, 9, 12]);
    let A = c2 + rng.int(30, 90);
    while ((A - 2 * c1 + c2) % 3 !== 0) A++;
    const r = cournot(A, 1, c1, c2);
    return caseOf(
      kind,
      seed,
      `Two firms compete in quantities (Cournot). Inverse demand is ${demandText(A, 1)}; firm 1 has marginal cost ${c1} and firm 2 has marginal cost ${c2}.`,
      [
        numeric(
          {
            kind,
            seed,
            prompt: 'Find firm 1’s equilibrium quantity q₁*.',
            explanation: [
              `Best responses: q₁ = (${A} − ${c1} − q₂)/2 and q₂ = (${A} − ${c2} − q₁)/2. Solving the two equations: q₁* = (${A} − 2·${c1} + ${c2})/3 = ${dec(r.q1)}.`,
            ],
          },
          r.q1,
          { label: dec(r.q1), placeholder: 'quantity' },
        ),
        numeric({ kind, seed, prompt: 'Find firm 2’s equilibrium quantity q₂*.', explanation: [`q₂* = (${A} − 2·${c2} + ${c1})/3 = ${dec(r.q2)}.`] }, r.q2, { label: dec(r.q2), placeholder: 'quantity' }),
        numeric({ kind, seed, prompt: 'What is the market price?', explanation: [`P = ${A} − (${dec(r.q1)} + ${dec(r.q2)}) = ${dec(r.P)}.`] }, r.P, { label: dec(r.P), placeholder: 'price' }),
        choice(
          {
            kind,
            seed,
            prompt: 'Which firm earns more, and why?',
            explanation: [`Firm 1: (${dec(r.P)} − ${c1})·${dec(r.q1)} = ${dec(r.profit1)}; firm 2: (${dec(r.P)} − ${c2})·${dec(r.q2)} = ${dec(r.profit2)}. The cheaper firm has a larger margin and produces more.`],
          },
          [
            { id: 'ok', label: 'Firm 1: a larger margin and a larger quantity', ok: true },
            { id: 'eq', label: 'They earn the same: Cournot equilibria are symmetric', note: 'Only with equal costs.' },
            { id: 'f2', label: 'Firm 2: it faces a higher price', note: 'Both sell at the same market price.' },
          ],
          rng,
        ),
      ],
    );
  }

  const r = cournot(a, b, c);
  const br = (a - c) / (2 * b);
  const bTerm = b === 1 ? '' : `${b}`;
  const parts: SimpleQuestion[] = [];
  if (variant === 'sym') {
    parts.push(
      choice(
        {
          kind,
          seed,
          prompt: 'What is firm 1’s best response to q₂?',
          explanation: [
            `With a positive price, π₁ = (${a} − ${bTerm}(q₁ + q₂) − ${c})q₁. First-order condition: ${a - c} − ${bTerm}q₂ − ${2 * b}q₁ = 0 (second derivative −${2 * b} < 0), so q₁ = (${a - c} − ${bTerm}q₂)/${2 * b} = ${dec(br)} − q₂/2, and 0 if that is negative.`,
            'The slope −1/2 means a larger rival output reduces a firm’s optimal output (strategic substitutes).',
          ],
          revealVisual: cournotPlot(a, b, c),
        },
        [
          { id: 'ok', label: `q₁ = max{0, ${dec(br)} − q₂/2}`, ok: true },
          { id: 'nofactor', label: `q₁ = max{0, ${dec((a - c) / b)} − q₂}`, note: 'Forgot that q₁ appears twice in π₁ (the derivative of −bq₁² is −2bq₁).' },
          { id: 'slope', label: `q₁ = max{0, ${dec(br)} − q₂}`, note: 'The slope is −1/2.' },
          { id: 'const', label: `q₁ = ${dec(r.q1)} whatever q₂ is`, note: 'That is the equilibrium quantity, not a best-response function.' },
        ],
        rng,
      ),
      numeric({ kind, seed, prompt: 'Find the equilibrium quantity of each firm.', explanation: [`Symmetric equilibrium: q = ${dec(br)} − q/2 ⇒ q* = (a − c)/(3b) = ${dec(r.q1)}.`], revealVisual: cournotPlot(a, b, c) }, r.q1, {
        label: dec(r.q1),
        placeholder: 'quantity',
      }),
      numeric({ kind, seed, prompt: 'What is the equilibrium price?', explanation: [`Q* = ${dec(r.Q)}, P* = ${a} − ${bTerm}·${dec(r.Q)} = ${dec(r.P)} = (a + 2c)/3 > c.`] }, r.P, { label: dec(r.P), placeholder: 'price' }),
      numeric({ kind, seed, prompt: 'What is each firm’s profit?', explanation: [`π* = (${dec(r.P)} − ${c})·${dec(r.q1)} = ${dec(r.profit1)} = (a − c)²/(9b).`] }, r.profit1, { label: dec(r.profit1), placeholder: 'profit' }),
    );
  } else if (variant === 'collude') {
    const jm = jointProfitMax(a, b, c);
    const dev = cournotBestResponse(a, b, c, jm.Q / 2);
    parts.push(
      numeric(
        { kind, seed, prompt: 'If the firms maximised joint profits, what total quantity would they produce?', explanation: [`Π(Q) = (${a} − ${bTerm}Q − ${c})Q, Π′ = ${a - c} − ${2 * b}Q = 0 ⇒ Q^M = ${dec(jm.Q)} (price ${dec(jm.P)}).`] },
        jm.Q,
        { label: dec(jm.Q), placeholder: 'quantity' },
      ),
      numeric(
        { kind, seed, prompt: 'With an equal split, what profit does each firm make?', explanation: [`Each produces ${dec(jm.Q / 2)} and earns (${dec(jm.P)} − ${c})·${dec(jm.Q / 2)} = ${dec(jm.profit / 2)}, more than the Cournot profit ${dec(r.profit1)}.`] },
        jm.profit / 2,
        { label: dec(jm.profit / 2), placeholder: 'profit' },
      ),
      numeric(
        {
          kind,
          seed,
          prompt: `If firm 2 keeps its agreed quantity ${dec(jm.Q / 2)}, what is firm 1’s best response?`,
          explanation: [`BR₁(${dec(jm.Q / 2)}) = (${a - c} − ${bTerm}·${dec(jm.Q / 2)})/${2 * b} = ${dec(dev)} > ${dec(jm.Q / 2)}: firm 1 wants to expand.`],
          revealVisual: cournotPlot(a, b, c),
        },
        dev,
        { label: dec(dev), placeholder: 'quantity' },
      ),
      choice(
        { kind, seed, prompt: 'Is the equal split of the joint-profit output a Nash equilibrium?', explanation: ['No: each firm’s best reply to the other’s cartel quantity is larger, so the agreement is not self-enforcing. The Cournot equilibrium has more output, a lower price and lower profits.'] },
        [
          { id: 'no', label: 'No: each firm gains by producing more if the other sticks to the agreement', ok: true },
          { id: 'yes', label: 'Yes: it gives both firms higher profits', note: 'Higher joint profits do not make it an equilibrium (compare the prisoners’ dilemma).' },
          { id: 'less', label: 'No: each firm gains by producing less', note: 'The best reply is larger, not smaller.' },
        ],
        rng,
      ),
    );
  } else {
    parts.push(
      choice(
        {
          kind,
          seed,
          prompt: 'Now the firms choose prices simultaneously (Bertrand): consumers buy from the cheaper firm and split equally at equal prices. What is the Nash equilibrium?',
          explanation: [
            `p₁ = p₂ = c = ${c}. Any common price above c invites undercutting (a tiny cut turns half the market into the whole market); a price below c makes losses; and if only one firm charges c it can raise its price slightly and still sell.`,
          ],
        },
        [
          { id: 'ok', label: `p₁ = p₂ = ${c} (marginal cost)`, ok: true },
          { id: 'cournot', label: `p₁ = p₂ = ${dec(r.P)} (the Cournot price)`, note: 'At that price each firm gains by undercutting slightly.' },
          { id: 'mono', label: `p₁ = p₂ = ${dec(jointProfitMax(a, b, c).P)} (the monopoly price)`, note: 'Undercutting pays.' },
          { id: 'any', label: `Any p₁ = p₂ ≥ ${c}`, note: 'Only p = c resists undercutting.' },
        ],
        rng,
      ),
      numeric({ kind, seed, prompt: 'What profit does each firm make in the Bertrand equilibrium?', explanation: ['Zero: price equals marginal cost (the Bertrand paradox — two firms are enough for the competitive outcome).'] }, 0, { label: '0', placeholder: 'profit' }),
      numeric({ kind, seed, prompt: 'For comparison, what would the price be with Cournot (quantity) competition?', explanation: [`P* = (a + 2c)/3 = (${a} + 2·${c})/3 = ${dec(r.P)}: above marginal cost.`] }, r.P, { label: dec(r.P), placeholder: 'price' }),
      numeric(
        { kind, seed, prompt: 'And the total quantity sold in the Bertrand equilibrium?', explanation: [`At p = ${c}, demand is (${a} − ${c})/${b} = ${dec((a - c) / b)} — the competitive quantity, more than Cournot’s ${dec(r.Q)}.`] },
        (a - c) / b,
        { label: dec((a - c) / b), placeholder: 'quantity' },
      ),
    );
  }
  return caseOf(kind, seed, intro, parts);
}

// ---------------------------------------------------------------------------------------------
// Games with continuous strategies (midterm problem 4, problem set 1.5, 1.11, 1.14, 1.15)

function continuousCase(rng: Rng, seed: string): CaseQuestion {
  const r = rng.next();
  if (r < 0.32) return auctionCase(rng, seed);
  if (r < 0.54) return publicGoodCase(rng, seed);
  if (r < 0.74) return crimeCase(rng, seed);
  if (r < 0.88) return demandCase(rng, seed);
  return distanceCase(rng, seed);
}

function auctionCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.continuous';
  const [vs, vb] = rng.pick([
    [0, 1],
    [0, 1],
    [0.2, 0.8],
    [0.1, 0.9],
    [0.25, 0.75],
  ]);
  const zeroOne = vs === 0 && vb === 1;
  const b0 = rng.pick([0.6, 0.7, 0.8, 0.9]);
  const s0 = rng.pick([0.2, 0.3, 0.4, 0.5]);
  const sellerPay = (s0 + b0) / 2 - vs;
  const vbText = dec(vb);
  const vsText = dec(vs);
  const sellerTerm = vs === 0 ? '(s + b)/2' : `(s + b)/2 − ${vsText}`;
  return caseOf(
    kind,
    seed,
    `A seller (S) owns a good worth ${vsText} to them; a buyer (B) values it at ${vbText}. Simultaneously the buyer writes a bid b ∈ [0, 1] and the seller an asking price s ∈ [0, 1]. If b ≥ s they trade at p = (s + b)/2; if b < s there is no trade and both get 0. With trade, the seller gets p${vs === 0 ? '' : ` − ${vsText}`} and the buyer ${vbText} − p.`,
    [
      choice(
        { kind, seed, prompt: 'Which expression is the buyer’s utility?', explanation: [`Trade happens exactly when b ≥ s, at the average price; the buyer pays (s + b)/2, not their own bid. Without trade the payoff is 0.`] },
        [
          { id: 'ok', label: `u_B(b, s) = ${vbText} − (s + b)/2 if b ≥ s, and 0 if b < s`, ok: true },
          { id: 'bid', label: `u_B(b, s) = ${vbText} − b if b ≥ s, and 0 if b < s`, note: 'The buyer pays the average of the two prices.' },
          { id: 'always', label: `u_B(b, s) = ${vbText} − (s + b)/2 for all b, s`, note: 'With b < s there is no trade and the payoff is 0.' },
          { id: 'seller', label: `u_B(b, s) = ${sellerTerm} if b ≥ s, and 0 if b < s`, note: 'That is the seller’s utility.' },
        ],
        rng,
      ),
      numeric(
        { kind, seed, prompt: `If b = ${b0} and s = ${s0}, what is the seller’s payoff?`, explanation: [`b ≥ s, so they trade at (${s0} + ${b0})/2 = ${dec((s0 + b0) / 2, 3)}; the seller gets ${dec((s0 + b0) / 2, 3)}${vs ? ` − ${vsText}` : ''} = ${dec(sellerPay, 3)}.`] },
        sellerPay,
        { label: dec(sellerPay, 3), abs: 0.002, placeholder: 'e.g. 0.55' },
      ),
      choice(
        {
          kind,
          seed,
          prompt: 'What is the seller’s best response to a bid b?',
          explanation: [
            `Any s ≤ b trades at (s + b)/2, which rises with s: the best of these is s = b, giving b${vs ? ` − ${vsText}` : ''}. Any s > b means no trade (0).`,
            `So if b > ${vsText} the seller matches the bid exactly (s = b); if b < ${vsText} trading loses, so any s > b is optimal; at b = ${vsText} the seller is indifferent among all s ≥ b.`,
          ],
        },
        [
          { id: 'ok', label: `s = b if b > ${vsText}; any s ∈ [b, 1] if b = ${vsText}; any s ∈ (b, 1] if b < ${vsText}`, ok: true },
          { id: 'mid', label: 's = (1 + b)/2', note: 'Any s > b kills the trade.' },
          { id: 'one', label: 's = 1 whatever b is', note: 'Unless b = 1, asking 1 means no trade.' },
          { id: 'b', label: 's = b for every b', note: `Below ${vsText} the seller would rather not trade.` },
        ],
        rng,
      ),
      choice(
        {
          kind,
          seed,
          prompt: 'Find all Nash equilibria.',
          explanation: [
            `With trade: if b > s the seller can raise s towards b and get a higher price, so b = s = p. The seller needs p ≥ ${vsText} and the buyer p ≤ ${vbText}. Every such p is an equilibrium (a continuum).`,
            zeroOne
              ? 'Without trade (b < s): the seller could ask s = b and earn b, so b = 0; the buyer could bid b = s and earn 1 − s, so s = 1. Hence (b, s) = (0, 1) is also an equilibrium.'
              : `Without trade (b < s): the seller could ask s = b and earn b − ${vsText}, so b ≤ ${vsText}; the buyer could bid b = s and earn ${vbText} − s, so s ≥ ${vbText}.`,
          ],
        },
        [
          {
            id: 'ok',
            label: zeroOne ? 'Every (b, s) with b = s, plus (b, s) = (0, 1) with no trade' : `Every b = s = p with p ∈ [${vsText}, ${vbText}], plus every no-trade profile with b ≤ ${vsText} and s ≥ ${vbText}`,
            ok: true,
          },
          { id: 'split', label: `Only b = s = ${dec((vs + vb) / 2)}: they split the surplus`, note: 'Any price between the two valuations works.' },
          { id: 'geq', label: 'Every (b, s) with b ≥ s', note: 'If b > s, the seller gains by raising s.' },
          { id: 'notrade', label: zeroOne ? 'Every (b, s) with b = s; no-trade profiles are never equilibria' : `Every b = s = p with p ∈ [${vsText}, ${vbText}]; no-trade profiles are never equilibria`, note: 'If neither can profitably trigger a trade, no trade is stable too.' },
        ],
        rng,
      ),
    ],
  );
}

function publicGoodCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.continuous';
  const [k, mm] = rng.pick([
    [2, 2],
    [2, 3],
    [2, 4],
    [1.5, 2],
    [1.5, 3],
    [1.5, 4],
  ]);
  const star = (mm * (k - 1)) / (mm + 1);
  const kText = dec(k);
  const util = (i: 1 | 2) => `U${i === 1 ? '₁' : '₂'} = ${kText === '1' ? '' : kText} ln(1 + c${i === 1 ? '₁' : '₂'} + c${i === 1 ? '₂' : '₁'}/${mm}) + 1 − c${i === 1 ? '₁' : '₂'}`;
  const top = k - 1;
  const zeroAt = mm * top;
  const brPts = (swap: boolean): [number, number][] => {
    const pts: [number, number][] = [
      [top, 0],
      zeroAt < 1 ? [0, zeroAt] : [top - 1 / mm, 1],
    ];
    if (zeroAt < 1) pts.push([0, 1]);
    return swap ? pts.map(([a, b]) => [b, a]) : pts;
  };
  const plot: Visual = {
    type: 'brPlot',
    xLabel: 'c₁',
    yLabel: 'c₂',
    xMax: 1,
    yMax: 1,
    xTicks: [0, star, 1].map((t) => ({ at: t, label: formatValue(t) })),
    yTicks: [0, star, 1].map((t) => ({ at: t, label: formatValue(t) })),
    series: [
      { label: 'c₁(c₂)', tone: 'coral', points: brPts(false) },
      { label: 'c₂(c₁)', tone: 'teal', points: brPts(true) },
    ],
    dots: [{ x: star, y: star, label: `c₁ = c₂ = ${formatValue(star)}` }],
  };
  return caseOf(
    kind,
    seed,
    `Two neighbours each have one hour on Sunday to watch TV or clean the street; cᵢ is the share of the hour neighbour i spends cleaning. Utilities: ${util(1)} and ${util(2)}.`,
    [
      choice(
        {
          kind,
          seed,
          prompt: 'How should these utilities be read?',
          explanation: [`The log term is the value of a clean street, with diminishing returns; the other neighbour’s cleaning helps too, but counts 1/${mm} as much as one’s own. 1 − cᵢ is the time left for TV. Each neighbour bears their own cleaning cost: free-riding is tempting.`],
        },
        [
          { id: 'ok', label: `A clean street is valued with diminishing returns (the other’s cleaning counts 1/${mm}); 1 − cᵢ is TV time`, ok: true },
          { id: 'cost', label: '1 − cᵢ is the cost of cleaning, paid by both neighbours', note: 'It is neighbour i’s own TV time.' },
          { id: 'linear', label: 'Each extra minute of cleaning is worth the same, however clean the street is', note: 'The log gives diminishing returns.' },
        ],
        rng,
      ),
      choice(
        { kind, seed, prompt: 'What is each player’s strategy set?', explanation: ['A strategy is a share of the hour: any number between 0 and 1. A pair (c₁, c₂) is a strategy profile, not a strategy.'] },
        [
          { id: 'ok', label: 'Sᵢ = [0, 1]', ok: true },
          { id: 'binary', label: 'Sᵢ = {0, 1}: clean or watch TV', note: 'Any share of the hour is allowed.' },
          { id: 'inf', label: 'Sᵢ = [0, ∞)', note: 'There is only one hour.' },
          { id: 'profile', label: 'Sᵢ = [0, 1] × [0, 1]', note: 'That is the set of profiles.' },
        ],
        rng,
      ),
      choice(
        {
          kind,
          seed,
          prompt: 'What is neighbour 1’s best response to c₂?',
          explanation: [
            `∂U₁/∂c₁ = ${kText}/(1 + c₁ + c₂/${mm}) − 1 = 0 (chain rule: the inner derivative is 1) ⇒ 1 + c₁ + c₂/${mm} = ${kText} ⇒ c₁ = ${dec(top)} − c₂/${mm}, cut at 0. U₁ is concave in c₁, so this is a maximum.`,
          ],
          revealVisual: plot,
        },
        [
          { id: 'ok', label: `c₁ = max{0, ${dec(top)} − c₂/${mm}}`, ok: true },
          { id: 'noone', label: `c₁ = max{0, ${kText} − c₂/${mm}}`, note: 'The 1 inside the logarithm was forgotten.' },
          { id: 'times', label: `c₁ = max{0, ${dec(top)} − ${mm}c₂}`, note: `The other’s cleaning enters divided by ${mm}.` },
          { id: 'const', label: `c₁ = ${dec(top)} whatever c₂ is`, note: 'More cleaning by the neighbour reduces one’s own optimal cleaning.' },
        ],
        rng,
      ),
      numeric(
        { kind, seed, prompt: 'In the Nash equilibrium, what share of the hour does each neighbour spend cleaning?', explanation: [`Symmetric: c = ${dec(top)} − c/${mm} ⇒ c(1 + 1/${mm}) = ${dec(top)} ⇒ c* = ${formatProb(star)}.`], revealVisual: plot },
        star,
        { label: formatProb(star) },
      ),
    ],
  );
}

function crimeCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.continuous';
  const c = rng.pick([2, 3, 4, 5]);
  const x = 1 / c;
  const y = c;
  const pts = (f: (t: number) => number, max: number, n = 40): [number, number][] => Array.from({ length: n + 1 }, (_, i) => (i / n) * max).map((t) => [t, f(t)]);
  const xMax = 2 / c;
  const yMax = 2 * c;
  const plot: Visual = {
    type: 'brPlot',
    xLabel: 'x (enforcement)',
    yLabel: 'y (crime)',
    xMax,
    yMax,
    xTicks: [0, x, xMax].map((t) => ({ at: t, label: formatValue(t) })),
    yTicks: [0, y, yMax].map((t) => ({ at: t, label: formatValue(t) })),
    series: [
      { label: `Government: x = y/${c * c}`, tone: 'coral', points: [[0, 0], [xMax, Math.min(yMax, xMax * c * c)]] },
      { label: 'Criminal: y = 1/x', tone: 'teal', points: pts((t) => Math.min(yMax, 1 / Math.max(t, 1e-6)), xMax).filter(([t]) => t >= 1 / yMax) },
    ],
    dots: [{ x, y, label: `x* = ${formatValue(x)}, y* = ${y}` }],
  };
  return caseOf(
    kind,
    seed,
    `The government chooses law enforcement x > 0 and a criminal chooses crime y ≥ 0, simultaneously. Payoffs: u_G = −x·c⁴ − y²/x and u_C = y^½/(1 + xy), with c = ${c}.`,
    [
      choice(
        { kind, seed, prompt: 'What is the government’s best response to y?', explanation: [`∂u_G/∂x = −c⁴ + y²/x² = 0 ⇒ x = y/c² = y/${c * c} (the second derivative −2y²/x³ < 0).`], revealVisual: plot },
        [
          { id: 'ok', label: `x = y/c² = y/${c * c}`, ok: true },
          { id: 'c4', label: `x = y/c⁴ = y/${c ** 4}`, note: 'The first-order condition gives x² = y²/c⁴, so x = y/c².' },
          { id: 'inv', label: 'x = c²/y', note: 'More crime calls for more enforcement, not less.' },
          { id: 'sqrt', label: 'x = √y / c', note: 'Solve −c⁴ + y²/x² = 0 for x.' },
        ],
        rng,
      ),
      choice(
        {
          kind,
          seed,
          prompt: 'What is the criminal’s best response to x?',
          explanation: ['∂u_C/∂y = [½y^−½(1 + xy) − y^½·x]/(1 + xy)² = 0 ⇒ 1 + xy = 2xy ⇒ y = 1/x.'],
        },
        [
          { id: 'ok', label: 'y = 1/x', ok: true },
          { id: 'x', label: 'y = x', note: 'More enforcement deters crime.' },
          { id: 'half', label: 'y = 1/(2x)', note: 'Multiply out: (1 + xy) = 2xy, so xy = 1.' },
          { id: 'sq', label: 'y = 1/x²', note: 'The condition is xy = 1.' },
        ],
        rng,
      ),
      numeric({ kind, seed, prompt: 'Compute the equilibrium level of enforcement x*.', explanation: [`x = y/c² and y = 1/x ⇒ x² = 1/c² ⇒ x* = 1/c = ${formatProb(x)}.`], revealVisual: plot }, x, { label: formatProb(x) }),
      numeric({ kind, seed, prompt: 'And the equilibrium level of crime y*?', explanation: [`y* = 1/x* = c = ${y}.`] }, y, { label: String(y) }),
      choice(
        { kind, seed, prompt: 'How do equilibrium crime and enforcement change as c increases?', explanation: ['x* = 1/c falls and y* = c rises: enforcement is costlier, so the government enforces less and crime increases.'] },
        [
          { id: 'ok', label: 'Enforcement falls and crime rises', ok: true },
          { id: 'both-up', label: 'Both rise' },
          { id: 'rev', label: 'Enforcement rises and crime falls' },
          { id: 'same', label: 'Neither changes: c only scales the government’s payoff' },
        ],
        rng,
      ),
    ],
  );
}

function demandCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.continuous';
  const M = rng.pick([100, 500, 1000]);
  const sp = (M / 10) * rng.int(2, 8);
  return caseOf(
    kind,
    seed,
    `Carlos (C) and Pepe (P) want to divide ${M} euros. Simultaneously each announces the amount sᵢ ∈ [0, ${M}] they want to keep. If s_C + s_P ≤ ${M}, each gets what they asked for; otherwise both get 0.`,
    [
      numeric({ kind, seed, prompt: `If Pepe asks for s_P = ${sp}, what is Carlos’s best response?`, explanation: [`Carlos gets s_C as long as s_C ≤ ${M} − ${sp}; asking more gives 0. Best response: s_C = ${M - sp}.`] }, M - sp, {
        label: String(M - sp),
        placeholder: 'euros',
      }),
      choice(
        { kind, seed, prompt: `If Pepe asks for everything (s_P = ${M}), what are Carlos’s best responses?`, explanation: [`Any positive request breaks the ${M} limit, and s_C = 0 also yields 0: Carlos gets 0 whatever he does, so every s_C ∈ [0, ${M}] is a best response.`] },
        [
          { id: 'ok', label: `Every s_C ∈ [0, ${M}]`, ok: true },
          { id: 'zero', label: 's_C = 0 only', note: 'Asking 0 gives 0, but so does everything else.' },
          { id: 'max', label: `s_C = ${M} only` },
          { id: 'none', label: 'There is no best response' },
        ],
        rng,
      ),
      choice(
        {
          kind,
          seed,
          prompt: 'Which are the pure-strategy Nash equilibria?',
          explanation: [
            `If s_C + s_P < ${M}, either player can ask for more: not an equilibrium. If s_C + s_P = ${M}, asking more gives 0 and asking less gives less: equilibrium (including (0, ${M}) and (${M}, 0)).`,
            `If s_C + s_P > ${M}, both get 0; a player could ask ${M} − (the other’s request) and get something positive unless the other asked ${M}. So the only disagreement equilibrium is (${M}, ${M}).`,
          ],
        },
        [
          { id: 'ok', label: `Every (s_C, s_P) with s_C + s_P = ${M}, plus (${M}, ${M})`, ok: true },
          { id: 'half', label: `Only (${M / 2}, ${M / 2})`, note: 'Any split that uses up the money is an equilibrium.' },
          { id: 'le', label: `Every profile with s_C + s_P ≤ ${M}`, note: 'If money is left over, a player can ask for more.' },
          { id: 'eq', label: `Every (s_C, s_P) with s_C + s_P = ${M}, and nothing else`, note: `(${M}, ${M}) is also an equilibrium: nobody can get anything by deviating.` },
        ],
        rng,
      ),
    ],
  );
}

function distanceCase(rng: Rng, seed: string): CaseQuestion {
  const kind = 'gt.continuous';
  const match: MatchQuestion = {
    kind,
    seed,
    format: 'match',
    prompt: 'Find player 2’s best response to each strategy of player 1.',
    rows: [
      { id: 'one', label: 's₁ = 1' },
      { id: 'zero', label: 's₁ = 0' },
      { id: 'half', label: 's₁ = 1/2' },
    ],
    options: [
      { id: 'o0', label: 's₂ = 0' },
      { id: 'o1', label: 's₂ = 1' },
      { id: 'both', label: 's₂ ∈ {0, 1}' },
      { id: 'mid', label: 's₂ = 1/2' },
    ],
    correct: { one: ['o0'], zero: ['o1'], half: ['both'] },
    explanation: ['(s₁ − s₂)² is largest when s₂ is as far as possible from s₁: the farther end of [0, 1]. For s₁ < 1/2 that is 1, for s₁ > 1/2 it is 0, and at s₁ = 1/2 both ends are equally far.'],
  };
  return caseOf(
    kind,
    seed,
    'Two players simultaneously write a number sᵢ ∈ [0, 1]. Both get u₁ = u₂ = (s₁ − s₂)².',
    [
      match,
      choice(
        {
          kind,
          seed,
          prompt: 'Find the Nash equilibria in pure strategies.',
          explanation: ['Best responses always pick an end point, so an equilibrium needs s₁, s₂ ∈ {0, 1} with each the far end from the other: (0, 1) and (1, 0). At (1/2, 1/2) both would move away.'],
          revealVisual: {
            type: 'brPlot',
            xLabel: 's₁',
            yLabel: 's₂',
            xMax: 1,
            yMax: 1,
            xTicks: [0, 0.5, 1].map((t) => ({ at: t, label: formatValue(t) })),
            yTicks: [0, 0.5, 1].map((t) => ({ at: t, label: formatValue(t) })),
            series: [
              { label: 's₁(s₂)', tone: 'coral', points: [[1, 0], [1, 0.5], [0, 0.5], [0, 1]] },
              { label: 's₂(s₁)', tone: 'teal', points: [[0, 1], [0.5, 1], [0.5, 0], [1, 0]] },
            ],
            dots: [
              { x: 0, y: 1, label: '(0, 1)' },
              { x: 1, y: 0, label: '(1, 0)' },
            ],
          },
        },
        [
          { id: 'ok', label: '(0, 1) and (1, 0)', ok: true },
          { id: 'mid', label: '(1/2, 1/2)' },
          { id: 'diag', label: '(0, 0) and (1, 1)' },
          { id: 'none', label: 'There is none' },
        ],
        rng,
      ),
    ],
  );
}

// ---------------------------------------------------------------------------------------------
// Theorems and definitions

interface Statement {
  text: string;
  truth: boolean;
  why: string;
}

const STATEMENTS: Statement[] = [
  { text: 'If a profile is the unique survivor of iterated elimination of strictly dominated strategies, it is the unique pure-strategy Nash equilibrium.', truth: true, why: 'Theorem (Day 2).' },
  { text: 'A strategy used in a Nash equilibrium can be removed by iterated elimination of strictly dominated strategies.', truth: false, why: 'Equilibrium strategies always survive IESDS (and so do strategies played with positive probability in a mixed equilibrium).' },
  { text: 'When eliminating weakly dominated strategies, the order of elimination never matters.', truth: false, why: 'It can matter even in finite games (slides: U/D, L/R example). For strict dominance in finite games it does not.' },
  { text: 'For strictly dominated strategies in finite games, the order of elimination does not affect the result.', truth: true, why: 'Pros of dominance (Day 2).' },
  { text: 'Every finite game has a Nash equilibrium in pure strategies.', truth: false, why: 'Colonel Blotto / matching pennies has none.' },
  { text: 'Every game with finitely many pure strategies has a Nash equilibrium in mixed strategies.', truth: true, why: 'Nash’s theorem.' },
  { text: 'A player who mixes between two strategies in a Nash equilibrium gets the same expected payoff from each of them.', truth: true, why: 'Otherwise they would put all the probability on the better one: indifference is how mixed equilibria are computed.' },
  { text: 'A strictly dominated strategy can be played with positive probability in a mixed-strategy equilibrium.', truth: false, why: 'It is never a best reply, so shifting its probability to the dominating strategy would pay.' },
  { text: 'Every profile of rationalizable strategies is a Nash equilibrium.', truth: false, why: 'In a coordination game (A, B) is rationalizable but not an equilibrium: rationalizability allows mistaken beliefs.' },
  { text: 'Every strategy played with positive probability in a mixed Nash equilibrium is rationalizable.', truth: true, why: 'It is a best reply to the opponent’s equilibrium mixture, at every round of deletion.' },
  { text: 'A strategy that is not strictly dominated by any pure strategy is always rationalizable.', truth: false, why: 'It may be strictly dominated by a mixed strategy (never a best reply), and then it is deleted.' },
  { text: 'A weakly dominated strategy can still be a best response to some belief.', truth: true, why: 'Weak dominance is insufficient for deletion under rationalizability.' },
  { text: 'Payoff dominance and risk dominance always select the same equilibrium.', truth: false, why: 'In the slides’ game (4,4)/(0,3)/(3,0)/(3,3), (A, A) is payoff dominant but (B, B) is risk dominant.' },
  { text: 'In the Bertrand duopoly with identical constant marginal costs, the equilibrium price equals marginal cost.', truth: true, why: 'The Bertrand paradox.' },
  { text: 'In the Cournot duopoly, firms produce the joint-profit-maximising total quantity.', truth: false, why: 'They produce more (60 vs 45 in the slides’ example): each firm ignores the price fall it imposes on the other.' },
  { text: 'In the Cournot duopoly, a firm’s best response decreases when its rival produces more.', truth: true, why: 'BRᵢ(qⱼ) = max{0, (a − c − bqⱼ)/(2b)} has slope −1/2.' },
  { text: 'The Nash equilibrium of the prisoners’ dilemma is Pareto efficient.', truth: false, why: 'Both prefer (Hold out, Hold out).' },
  { text: 'A pure strategy is a special (degenerate) case of a mixed strategy.', truth: true, why: 'It puts probability 1 on one strategy; mixing enlarges the set of strategies and equilibria.' },
  { text: 'A Nash equilibrium always maximises the sum of the players’ payoffs.', truth: false, why: 'The prisoners’ dilemma is the counterexample.' },
  { text: 'A Nash equilibrium requires each player’s strategy to be optimal whatever the others do.', truth: false, why: 'Only against what the others actually play in the equilibrium; optimal against everything is dominance.' },
  { text: 'A Nash equilibrium exists if strategy sets are convex and compact, payoffs are continuous, and each payoff is quasi-concave in the player’s own strategy.', truth: true, why: 'Existence theorem (Day 3).' },
  { text: 'Rationalizability requires each player’s beliefs about the others to be correct.', truth: false, why: 'That is what Nash equilibrium adds; rationalizability only requires best replies to beliefs that put weight on rationalizable strategies.' },
  { text: 'Iterating the elimination of dominated strategies relies on common knowledge of rationality.', truth: true, why: 'Each extra round needs one more level of “I know that you know that…”.' },
  { text: 'If a game has a strictly dominant strategy equilibrium, it can still have other pure Nash equilibria.', truth: false, why: 'Every other strategy is strictly dominated, so it is eliminated: the dominant strategy equilibrium is the unique equilibrium.' },
  { text: 'In a completely mixed equilibrium of a 2×2 game, a player’s probabilities are pinned down by the opponent’s payoffs.', truth: true, why: 'They are chosen to make the opponent indifferent.' },
  { text: 'In a static game of complete information the only source of strategic uncertainty is the other players’ actions.', truth: true, why: 'Everything else (players, strategies, payoffs) is common knowledge.' },
];

function theoryQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const picked = rng.sample(STATEMENTS, 4);
  return choice(
    {
      kind: 'gt.theory',
      seed,
      prompt: 'Which of these statements are true? Select all that apply.',
      explanation: picked.map((s) => `${s.truth ? 'True' : 'False'} — ${s.text} ${s.why}`),
    },
    [...picked.map((s, i) => ({ id: `s${i}`, label: s.text, ok: s.truth, note: s.why })), { id: 'none', label: 'None of them', ok: !picked.some((s) => s.truth) }],
    rng,
    { multi: true, exclusive: ['none'], keepOrder: true },
  );
}
