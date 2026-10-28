/**
 * Static games of complete information (Game Theory, Tejada, UB): bimatrix games, dominance,
 * iterated elimination, pure and mixed Nash equilibria, Pareto efficiency, equilibrium
 * selection, rationalizability, and the Cournot / Bertrand duopoly.
 *
 * Player 1 picks a row, player 2 a column. Pure functions, unit-tested.
 */

export interface Bimatrix {
  players: [string, string];
  rows: string[];
  cols: string[];
  /** u[r][c] = [payoff of player 1, payoff of player 2]. */
  u: [number, number][][];
}

export type Player = 0 | 1;
export type Cell = [number, number];

const EPS = 1e-9;

export function bimatrix(rows: string[], cols: string[], u: [number, number][][], players: [string, string] = ['Player 1', 'Player 2']): Bimatrix {
  return { players, rows, cols, u };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Strategies of a player and of the opponent. */
export function strategyCount(g: Bimatrix, player: Player): number {
  return player === 0 ? g.rows.length : g.cols.length;
}

/** Payoff of `player` when they play `own` and the opponent plays `opp`. */
export function pay(g: Bimatrix, player: Player, own: number, opp: number): number {
  return player === 0 ? g.u[own][opp][0] : g.u[opp][own][1];
}

/** Best responses of `player` to the opponent's pure strategy `opp`, among `own` strategies. */
export function bestResponses(g: Bimatrix, player: Player, opp: number, own: number[] = range(strategyCount(g, player))): number[] {
  const best = Math.max(...own.map((s) => pay(g, player, s, opp)));
  return own.filter((s) => pay(g, player, s, opp) >= best - EPS);
}

/** Pure-strategy Nash equilibria as [row, col], in reading order. */
export function pureNash(g: Bimatrix): Cell[] {
  const out: Cell[] = [];
  for (const r of range(g.rows.length)) {
    for (const c of range(g.cols.length)) {
      if (bestResponses(g, 0, c).includes(r) && bestResponses(g, 1, r).includes(c)) out.push([r, c]);
    }
  }
  return out;
}

/** Every best response is unique, so pure equilibria are strict and 2×2 games have finitely many equilibria. */
export function isGeneric(g: Bimatrix): boolean {
  return range(g.cols.length).every((c) => bestResponses(g, 0, c).length === 1) && range(g.rows.length).every((r) => bestResponses(g, 1, r).length === 1);
}

// ---------------------------------------------------------------------------------------------
// Dominance and iterated elimination

/** Does `t` dominate `s` for `player`, comparing only against the opponent's strategies `opp`? */
export function dominates(g: Bimatrix, player: Player, t: number, s: number, opp: number[], strict: boolean): boolean {
  if (t === s) return false;
  let someStrict = false;
  for (const o of opp) {
    const d = pay(g, player, t, o) - pay(g, player, s, o);
    if (strict ? d <= EPS : d < -EPS) return false;
    if (d > EPS) someStrict = true;
  }
  return strict || someStrict;
}

export interface Domination {
  player: Player;
  dominated: number;
  by: number;
}

/** Strategies of `player` dominated by another pure strategy (each listed once, with its first dominator). */
export function dominatedStrategies(
  g: Bimatrix,
  player: Player,
  strict: boolean,
  own: number[] = range(strategyCount(g, player)),
  opp: number[] = range(strategyCount(g, player === 0 ? 1 : 0)),
): Domination[] {
  const out: Domination[] = [];
  for (const s of own) {
    // Prefer a strict dominator when listing weak dominance, so the explanation is the strongest one.
    const by = own.find((t) => dominates(g, player, t, s, opp, true)) ?? (strict ? undefined : own.find((t) => dominates(g, player, t, s, opp, false)));
    if (by !== undefined) out.push({ player, dominated: s, by });
  }
  return out;
}

/** Strategies weakly but not strictly dominated (by a pure strategy). */
export function weaklyOnlyDominated(g: Bimatrix, player: Player): Domination[] {
  const strict = new Set(dominatedStrategies(g, player, true).map((d) => d.dominated));
  return dominatedStrategies(g, player, false).filter((d) => !strict.has(d.dominated));
}

/** A strategy that strictly dominates every other strategy of the player, if any. */
export function strictlyDominantStrategy(g: Bimatrix, player: Player): number | null {
  const n = strategyCount(g, player);
  const opp = range(strategyCount(g, player === 0 ? 1 : 0));
  for (const t of range(n)) if (range(n).every((s) => s === t || dominates(g, player, t, s, opp, true))) return t;
  return null;
}

export interface IesdsStep extends Domination {
  round: number;
  /** The opponent's surviving strategies the comparison was made against. */
  against: number[];
}

export interface IesdsResult {
  rows: number[];
  cols: number[];
  steps: IesdsStep[];
}

/**
 * Iterated elimination of strictly dominated (pure) strategies. Each round removes every strategy
 * that is dominated given the strategies still alive at the start of the round. For strict
 * dominance the order of elimination does not change the result.
 */
export function iesds(g: Bimatrix): IesdsResult {
  let rows = range(g.rows.length);
  let cols = range(g.cols.length);
  const steps: IesdsStep[] = [];
  for (let round = 1; ; round++) {
    // Name a dominator that itself survives the round (one exists: strict dominance is transitive).
    const survivorDominator = (player: Player, own: number[], opp: number[]) => {
      const gone = dominatedStrategies(g, player, true, own, opp);
      const goneSet = new Set(gone.map((d) => d.dominated));
      return gone.map((d) => ({ ...d, by: own.find((t) => !goneSet.has(t) && dominates(g, player, t, d.dominated, opp, true)) ?? d.by, round, against: opp }));
    };
    const d1 = survivorDominator(0, rows, cols);
    const d2 = survivorDominator(1, cols, rows);
    if (d1.length === 0 && d2.length === 0) break;
    // Two strategies cannot dominate each other strictly, so a round never empties a player's set.
    steps.push(...d1, ...d2);
    const gone1 = new Set(d1.map((d) => d.dominated));
    const gone2 = new Set(d2.map((d) => d.dominated));
    rows = rows.filter((r) => !gone1.has(r));
    cols = cols.filter((c) => !gone2.has(c));
  }
  return { rows, cols, steps };
}

/** The sub-game on the given rows and columns. */
export function subgame(g: Bimatrix, rows: number[], cols: number[]): Bimatrix {
  return { players: g.players, rows: rows.map((r) => g.rows[r]), cols: cols.map((c) => g.cols[c]), u: rows.map((r) => cols.map((c) => g.u[r][c])) };
}

// ---------------------------------------------------------------------------------------------
// Beliefs, never-best responses and rationalizability

/** Expected payoff of `own` against a belief over the opponent's strategies (`belief[i]` on `opp[i]`). */
export function expectedAgainst(g: Bimatrix, player: Player, own: number, opp: number[], belief: number[]): number {
  return opp.reduce((sum, o, i) => sum + belief[i] * pay(g, player, own, o), 0);
}

/**
 * Is `s` a best response to some belief over `opp` (compared with all of `own`)? Exact when the
 * opponent has at most two strategies left (the belief is one number q); with more, the check
 * falls back to beliefs on the vertices and edges of the simplex, which is exact for the small
 * games generated here.
 */
export function isBestResponseToSomeBelief(g: Bimatrix, player: Player, s: number, own: number[], opp: number[]): boolean {
  const gap = (belief: number[]) => Math.max(...own.map((t) => expectedAgainst(g, player, t, opp, belief))) - expectedAgainst(g, player, s, opp, belief);
  const beliefs: number[][] = [];
  const unit = (i: number) => opp.map((_, j) => (j === i ? 1 : 0));
  opp.forEach((_, i) => beliefs.push(unit(i)));
  // On each edge q·o_i + (1−q)·o_j the gap is convex piecewise linear: its minimum is at a kink,
  // where two strategies' expected payoffs cross.
  for (let i = 0; i < opp.length; i++) {
    for (let j = i + 1; j < opp.length; j++) {
      const lines = own.map((t) => ({ a: pay(g, player, t, opp[i]), b: pay(g, player, t, opp[j]) }));
      for (let x = 0; x < lines.length; x++) {
        for (let y = x + 1; y < lines.length; y++) {
          // q·a + (1−q)·b equal for both lines.
          const denom = lines[x].a - lines[x].b - (lines[y].a - lines[y].b);
          if (Math.abs(denom) < EPS) continue;
          const q = (lines[y].b - lines[x].b) / denom;
          if (q > -EPS && q < 1 + EPS) beliefs.push(opp.map((_, k) => (k === i ? q : k === j ? 1 - q : 0)));
        }
      }
    }
  }
  return beliefs.some((b) => gap(b) <= EPS);
}

export interface RationalizableResult {
  rows: number[];
  cols: number[];
  /** Strategies deleted, in order, with the round they were deleted in. */
  deleted: { player: Player; strategy: number; round: number }[];
}

/** Iteratively delete strategies that are never a best response (= strictly dominated by a mixed strategy). */
export function rationalizable(g: Bimatrix): RationalizableResult {
  let rows = range(g.rows.length);
  let cols = range(g.cols.length);
  const deleted: RationalizableResult['deleted'] = [];
  for (let round = 1; ; round++) {
    const gone1 = rows.filter((r) => !isBestResponseToSomeBelief(g, 0, r, range(g.rows.length), cols));
    const gone2 = cols.filter((c) => !isBestResponseToSomeBelief(g, 1, c, range(g.cols.length), rows));
    if (gone1.length === 0 && gone2.length === 0) break;
    gone1.forEach((s) => deleted.push({ player: 0, strategy: s, round }));
    gone2.forEach((s) => deleted.push({ player: 1, strategy: s, round }));
    rows = rows.filter((r) => !gone1.includes(r));
    cols = cols.filter((c) => !gone2.includes(c));
  }
  return { rows, cols, deleted };
}

/**
 * Weights λ for which λ·t1 + (1−λ)·t2 strictly dominates s (against `opp`): an open interval
 * (lo, hi), or null when no mixture of the two does.
 */
export function dominatingMixInterval(g: Bimatrix, player: Player, s: number, t1: number, t2: number, opp: number[]): [number, number] | null {
  let lo = 0;
  let hi = 1;
  for (const o of opp) {
    // λ·(A − B) > S − B, with A = u(t1), B = u(t2), S = u(s).
    const a = pay(g, player, t1, o);
    const b = pay(g, player, t2, o);
    const k = a - b;
    const rhs = pay(g, player, s, o) - b;
    if (Math.abs(k) < EPS) {
      if (rhs >= -EPS) return null;
      continue;
    }
    if (k > 0) lo = Math.max(lo, rhs / k);
    else hi = Math.min(hi, rhs / k);
  }
  if (lo > hi - EPS) return null;
  return [Math.max(0, lo), Math.min(1, hi)];
}

// ---------------------------------------------------------------------------------------------
// Mixed strategies (2×2)

export interface Mixed2x2 {
  /** Probability player 1 plays the first row. */
  x: number;
  /** Probability player 2 plays the first column. */
  y: number;
}

/**
 * The completely mixed equilibrium of a 2×2 game, if there is one. Each player mixes so that the
 * *other* player is indifferent: x comes from player 2's payoffs, y from player 1's.
 */
export function fullyMixed2x2(g: Bimatrix): Mixed2x2 | null {
  if (g.rows.length !== 2 || g.cols.length !== 2) throw new Error('2×2 games only');
  const [[A, B], [C, D]] = g.u;
  // Player 2 indifferent between the columns: x·A2 + (1−x)·C2 = x·B2 + (1−x)·D2.
  const dx = A[1] - C[1] - B[1] + D[1];
  // Player 1 indifferent between the rows: y·A1 + (1−y)·B1 = y·C1 + (1−y)·D1.
  const dy = A[0] - B[0] - C[0] + D[0];
  if (Math.abs(dx) < EPS || Math.abs(dy) < EPS) return null;
  const x = (D[1] - C[1]) / dx;
  const y = (D[0] - B[0]) / dy;
  if (x <= EPS || x >= 1 - EPS || y <= EPS || y >= 1 - EPS) return null;
  return { x, y };
}

/** Expected payoffs when the players use mixed strategies (probabilities per row / column). */
export function expectedPayoffs(g: Bimatrix, rowMix: number[], colMix: number[]): [number, number] {
  let u1 = 0;
  let u2 = 0;
  rowMix.forEach((p, r) =>
    colMix.forEach((q, c) => {
      u1 += p * q * g.u[r][c][0];
      u2 += p * q * g.u[r][c][1];
    }),
  );
  return [u1, u2];
}

/** All equilibria of a generic 2×2 game: the pure ones and the completely mixed one, if any. */
export function nash2x2(g: Bimatrix): { pure: Cell[]; mixed: Mixed2x2 | null } {
  return { pure: pureNash(g), mixed: fullyMixed2x2(g) };
}

// ---------------------------------------------------------------------------------------------
// Three players

/** A game with three players; u[s1][s2][s3] = [u1, u2, u3]. */
export interface Game3 {
  players: [string, string, string];
  strategies: [string[], string[], string[]];
  u: [number, number, number][][][];
}

/** Pure-strategy Nash equilibria of a three-player game, as [s1, s2, s3]. */
export function pureNash3(g: Game3): [number, number, number][] {
  const at = (p: [number, number, number]) => g.u[p[0]][p[1]][p[2]];
  const out: [number, number, number][] = [];
  for (const a of range(g.strategies[0].length)) {
    for (const b of range(g.strategies[1].length)) {
      for (const c of range(g.strategies[2].length)) {
        const profile: [number, number, number] = [a, b, c];
        const stable = ([0, 1, 2] as const).every((i) =>
          range(g.strategies[i].length).every((alt) => {
            const dev = [...profile] as [number, number, number];
            dev[i] = alt;
            return at(dev)[i] <= at(profile)[i] + EPS;
          }),
        );
        if (stable) out.push(profile);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Efficiency and selection

/** a Pareto dominates b: nobody is worse off and somebody is better off. */
export function paretoDominates(a: readonly number[], b: readonly number[]): boolean {
  return a.every((v, i) => v >= b[i] - EPS) && a.some((v, i) => v > b[i] + EPS);
}

/** Outcomes that no other outcome Pareto dominates. */
export function paretoEfficientCells(g: Bimatrix): Cell[] {
  const cells = g.u.flatMap((row, r) => row.map((_, c) => [r, c] as Cell));
  return cells.filter(([r, c]) => !cells.some(([r2, c2]) => paretoDominates(g.u[r2][c2], g.u[r][c])));
}

/** Cells with the largest sum of payoffs (the utilitarian optimum). */
export function utilitarianCells(g: Bimatrix): Cell[] {
  const cells = g.u.flatMap((row, r) => row.map((_, c) => [r, c] as Cell));
  const best = Math.max(...cells.map(([r, c]) => g.u[r][c][0] + g.u[r][c][1]));
  return cells.filter(([r, c]) => g.u[r][c][0] + g.u[r][c][1] >= best - EPS);
}

/**
 * Symmetric coordination game  A: (a,a) (b,c) / B: (c,b) (d,d)  with a > c, d > b.
 * A is a best response when the opponent plays A with probability at least p*.
 */
export function riskThreshold(a: number, b: number, c: number, d: number): number {
  return (d - b) / (a - c + (d - b));
}

// ---------------------------------------------------------------------------------------------
// Cournot and Bertrand duopoly with P(Q) = max{a − bQ, 0} and constant marginal costs

export function cournotBestResponse(a: number, b: number, c: number, qOther: number): number {
  return Math.max(0, (a - c - b * qOther) / (2 * b));
}

export interface CournotOutcome {
  q1: number;
  q2: number;
  Q: number;
  P: number;
  profit1: number;
  profit2: number;
}

/** Cournot equilibrium (interior when both quantities are positive; otherwise one firm stays out). */
export function cournot(a: number, b: number, c1: number, c2: number = c1): CournotOutcome {
  let q1 = (a - 2 * c1 + c2) / (3 * b);
  let q2 = (a - 2 * c2 + c1) / (3 * b);
  if (q1 < 0) {
    q1 = 0;
    q2 = cournotBestResponse(a, b, c2, 0);
  } else if (q2 < 0) {
    q2 = 0;
    q1 = cournotBestResponse(a, b, c1, 0);
  }
  const Q = q1 + q2;
  const P = Math.max(0, a - b * Q);
  return { q1, q2, Q, P, profit1: (P - c1) * q1, profit2: (P - c2) * q2 };
}

/** Joint-profit maximum (monopoly) with a common marginal cost. */
export function jointProfitMax(a: number, b: number, c: number): { Q: number; P: number; profit: number } {
  const Q = (a - c) / (2 * b);
  const P = a - b * Q;
  return { Q, P, profit: (P - c) * Q };
}

// ---------------------------------------------------------------------------------------------
// Display helpers

/** n/d for numbers that are simple fractions (denominator ≤ maxDen), else null. */
export function asFraction(x: number, maxDen = 60): [number, number] | null {
  for (let d = 1; d <= maxDen; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-9) return [n, d];
  }
  return null;
}

/** "−3", "2/5", "1.25": typographic minus, fractions when they are simple. */
export function formatValue(x: number, maxDen = 12): string {
  const f = asFraction(x, maxDen);
  let s: string;
  if (f && f[1] === 1) s = String(Math.abs(f[0]));
  else if (f) s = `${Math.abs(f[0])}/${f[1]}`;
  else s = String(Math.abs(Math.round(x * 100) / 100));
  return x < -EPS ? `−${s}` : s;
}

/** Fraction plus decimal for probabilities, e.g. "2/5 = 0.4". */
export function formatProb(x: number): string {
  const f = asFraction(x, 12);
  const dec = String(Math.round(x * 1000) / 1000);
  if (!f || f[1] === 1) return formatValue(x);
  return `${f[0]}/${f[1]} ≈ ${dec}`.replace('≈', Math.abs(Number(dec) - x) < 1e-9 ? '=' : '≈');
}
