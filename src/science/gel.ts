/**
 * Virtual agarose gel: migration, band merging, band intensity, ladders, agarose table,
 * uncut plasmid forms, and the semi-log standard curve.
 *
 * Migration model (Brown §4.2.7: D = a − b·log M): inside the gel's effective separation range
 * the distance migrated is a linear function of log10(size), so equal size RATIOS are equally
 * spaced and large fragments bunch together near the wells. Outside that range the model bends:
 * molecules larger than the range compress into a narrow zone under the wells (limiting
 * mobility), smaller ones run fast towards the bottom.
 */

export interface MigrationModel {
  /** Upper and lower size limit (bp) of the linear, well-resolved range. */
  maxBp: number;
  minBp: number;
  /** Fractions of the running length (0 = wells, 1 = bottom edge) where maxBp and minBp run. */
  top: number;
  bottom: number;
  /** Bend outside [minBp, maxBp] (true for agarose-% models; false for a plain fitted scale). */
  compress: boolean;
}

/** Distance migrated as a fraction of the gel's running length (0 at the wells). */
export function migrate(model: MigrationModel, sizeBp: number): number {
  const lmax = Math.log10(model.maxBp);
  const lmin = Math.log10(model.minBp);
  const u = (lmax - Math.log10(sizeBp)) / (lmax - lmin);
  let f = u;
  if (model.compress) {
    const k = 0.08;
    if (u < 0) f = -k * (1 - Math.exp(u / k)); // big molecules: asymptotic limiting mobility
    else if (u > 1) f = 1 + (u - 1) * 0.75; // small molecules: keep running
  }
  return model.top + f * (model.bottom - model.top);
}

/** A plain log-linear scale that fits every size given, with some headroom. */
export function fitModel(sizesBp: readonly number[], top = 0.08, bottom = 0.92): MigrationModel {
  const max = Math.max(...sizesBp);
  const min = Math.min(...sizesBp);
  const hi = max * 1.08;
  const lo = Math.min(min * 0.92, hi / 2);
  return { maxBp: hi, minBp: lo, top, bottom, compress: false };
}

// ---------------------------------------------------------------------------------------------
// Bands

export type DnaForm = 'linear' | 'supercoiled' | 'open-circular';

export interface Band {
  /** True length in bp. */
  size: number;
  /** Molecules per template molecule (co-migrating fragments of the same size add up). */
  copies: number;
  /** Relative mass = size × copies × abundance. Brightness is proportional to this. */
  mass: number;
  form: DnaForm;
  /** The linear size this band runs like (≠ size for supercoiled / open-circular DNA). */
  apparentSize: number;
}

/** Merge identical fragment sizes into single bands whose mass is size × copies × abundance. */
export function bandsFromFragments(fragmentsBp: readonly number[], abundance = 1): Band[] {
  const counts = new Map<number, number>();
  for (const f of fragmentsBp) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, copies]) => ({ size, copies, mass: size * copies * abundance, form: 'linear', apparentSize: size }));
}

/**
 * Bands of an uncut plasmid prep. Mobility relative to linear DNA of the same length depends on
 * agarose % and running conditions; these factors give the usual order
 * open-circular (slowest) > linear > supercoiled (fastest), with most DNA supercoiled.
 */
export const PLASMID_FORMS: readonly { form: DnaForm; runsLike: number; share: number; label: string }[] = [
  { form: 'open-circular', runsLike: 1.9, share: 0.25, label: 'open-circular (nicked)' },
  { form: 'linear', runsLike: 1.0, share: 0.08, label: 'linear' },
  { form: 'supercoiled', runsLike: 0.65, share: 0.67, label: 'supercoiled' },
];

export function uncutPlasmidBands(lengthBp: number): Band[] {
  return PLASMID_FORMS.map(({ form, runsLike, share }) => ({
    size: lengthBp,
    copies: 1,
    mass: lengthBp * share,
    form,
    apparentSize: Math.round(lengthBp * runsLike),
  }));
}

/**
 * Relative brightness (0–1) of a band. Proportional to mass, compressed a little (γ = 0.7) the
 * way a camera exposure does, with a visibility floor so faint bands stay on screen.
 */
export function bandIntensity(mass: number, maxMass: number): number {
  if (maxMass <= 0) return 0;
  const r = Math.max(0, Math.min(1, mass / maxMass));
  return 0.14 + 0.86 * r ** 0.7;
}

// ---------------------------------------------------------------------------------------------
// Ladders

export interface Ladder {
  id: string;
  name: string;
  sizes: number[];
  /** A band loaded at double mass as an orientation marker (e.g. 3 kb in 1 kb ladders). */
  reference?: number;
}

export const LADDERS: Record<string, Ladder> = {
  kb1: {
    id: 'kb1',
    name: '1 kb ladder',
    sizes: [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 500],
    reference: 3000,
  },
  lambdaHindIII: {
    id: 'lambdaHindIII',
    name: 'λ DNA / HindIII',
    sizes: [23130, 9416, 6557, 4361, 2322, 2027, 564],
  },
  bp100: {
    id: 'bp100',
    name: '100 bp ladder',
    sizes: [1500, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100],
    reference: 500,
  },
  extended: {
    id: 'extended',
    name: 'Extended range ladder',
    sizes: [48500, 40000, 30000, 20000, 15000, 10000, 7000, 5000, 3000, 2000, 1000, 500],
    reference: 10000,
  },
};

/** The ladder whose range best covers fragments up to `maxBp`. */
export function chooseLadder(maxBp: number): Ladder {
  if (maxBp <= 11000) return LADDERS.kb1;
  if (maxBp <= 24000) return LADDERS.lambdaHindIII;
  return LADDERS.extended;
}

export function ladderBands(ladder: Ladder): Band[] {
  return ladder.sizes.map((size) => {
    const copies = 1;
    // Ladders are loaded so bands look roughly even; the reference band is twice as bright.
    const mass = size === ladder.reference ? 2 : 1;
    return { size, copies, mass, form: 'linear', apparentSize: size };
  });
}

// ---------------------------------------------------------------------------------------------
// Agarose concentration → effective separation range

export interface AgaroseRow {
  percent: number;
  maxBp: number;
  minBp: number;
}

/**
 * Effective separation range of linear DNA by agarose concentration. 0.7, 1.2 and 2 % are the
 * values from the course slides (after Brown); 0.5 % matches Brown §4.2.6 ("0.5% agarose … 1–30 kb");
 * the remaining rows are standard lab-manual values. Edit here to match your own table.
 */
export const AGAROSE_TABLE: readonly AgaroseRow[] = [
  { percent: 0.3, maxBp: 60000, minBp: 5000 },
  { percent: 0.5, maxBp: 30000, minBp: 1000 },
  { percent: 0.7, maxBp: 20000, minBp: 800 },
  { percent: 0.9, maxBp: 7000, minBp: 500 },
  { percent: 1.2, maxBp: 6000, minBp: 400 },
  { percent: 1.5, maxBp: 4000, minBp: 200 },
  { percent: 2.0, maxBp: 3000, minBp: 100 },
];

export function agaroseRow(percent: number): AgaroseRow {
  const row = AGAROSE_TABLE.find((r) => r.percent === percent);
  if (!row) throw new Error(`No agarose row for ${percent}%`);
  return row;
}

export function agaroseModel(percent: number): MigrationModel {
  const row = agaroseRow(percent);
  return { maxBp: row.maxBp, minBp: row.minBp, top: 0.1, bottom: 0.82, compress: true };
}

/** Rows whose range contains the whole interval [loBp, hiBp]. */
export function agaroseRowsCovering(loBp: number, hiBp: number): AgaroseRow[] {
  return AGAROSE_TABLE.filter((r) => r.minBp <= loBp && r.maxBp >= hiBp);
}

/** Conventional gels stop resolving at about 50 kb (Brown §4.2.9); beyond that use PFGE. */
export const PFGE_THRESHOLD_BP = 50000;

export function needsPfge(sizeBp: number): boolean {
  return sizeBp > PFGE_THRESHOLD_BP;
}

// ---------------------------------------------------------------------------------------------
// Standard curve: log10(size) against distance migrated

export interface LinearFit {
  slope: number;
  intercept: number;
  r2: number;
}

export function linearRegression(xs: readonly number[], ys: readonly number[]): LinearFit {
  const n = xs.length;
  if (n < 2 || n !== ys.length) throw new Error('linearRegression needs ≥ 2 paired points');
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2 };
}

/** Fit log10(size) = intercept + slope · distance. */
export function standardCurve(sizesBp: readonly number[], distances: readonly number[]): LinearFit {
  return linearRegression(distances, sizesBp.map((s) => Math.log10(s)));
}

export function sizeFromCurve(fit: LinearFit, distance: number): number {
  return 10 ** (fit.intercept + fit.slope * distance);
}
