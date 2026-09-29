/** Mode 2 — gel reading: estimating sizes, choosing agarose %, deciding on PFGE. */

import { formatKb, trimNumber } from '../science/format';
import {
  AGAROSE_TABLE,
  agaroseModel,
  agaroseRow,
  agaroseRowsCovering,
  LADDERS,
  migrate,
  needsPfge,
  PFGE_THRESHOLD_BP,
  sizeFromCurve,
  standardCurve,
} from '../science/gel';
import { createRng, type Rng } from '../science/rng';
import type { ChoiceQuestion, NumericQuestion, Question } from './types';

export type GelKind = 'size' | 'agarose' | 'pfge';
export const GEL_KINDS: GelKind[] = ['size', 'agarose', 'pfge'];

export const RUN_MM = 80;

export function generateGelQuestion(seed: string, kind?: GelKind): Question {
  const rng = createRng(`gel/${seed}`);
  const k = kind ?? rng.pick<GelKind>(['size', 'size', 'agarose', 'pfge']);
  switch (k) {
    case 'size':
      return sizeQuestion(rng, seed);
    case 'agarose':
      return agaroseQuestion(rng, seed);
    case 'pfge':
      return pfgeQuestion(rng, seed);
  }
}

/** Human-friendly size: 350 bp, 1.5 kb, 150 kb, 2 Mb. */
export function formatSize(bp: number): string {
  if (bp >= 1e6) return `${trimNumber(bp / 1e6, 2)} Mb`;
  if (bp >= 1000) return `${formatKb(bp)} kb`;
  return `${Math.round(bp)} bp`;
}

/** Why some ladder bands are left out of the fit, naming what actually happens to them. */
function outOfRangeNote(outside: number[], minBp: number, maxBp: number, percent: number): string {
  const big = outside.filter((s) => s > maxBp);
  const small = outside.filter((s) => s < minBp);
  const parts: string[] = [];
  if (big.length) parts.push(`${big.map(formatSize).join(', ')} ${big.length > 1 ? 'are' : 'is'} too large and bunch${big.length > 1 ? '' : 'es'} up under the wells`);
  if (small.length) parts.push(`${small.map(formatSize).join(', ')} ${small.length > 1 ? 'are' : 'is'} too small and run${small.length > 1 ? '' : 's'} almost unresolved at the bottom`);
  return `A ${percent}% gel resolves ${formatSize(minBp)}–${formatSize(maxBp)}. Outside that range the bands leave the straight line (${parts.join('; ')}), so they are drawn hollow and left out of the fit.`;
}

const SIZE_SETUPS = [
  { percent: 0.7, ladderId: 'lambdaHindIII' },
  { percent: 0.9, ladderId: 'kb1' },
  { percent: 1.2, ladderId: 'kb1' },
  { percent: 1.5, ladderId: 'bp100' },
  { percent: 2.0, ladderId: 'bp100' },
];

function sizeQuestion(rng: Rng, seed: string): NumericQuestion {
  const { percent, ladderId } = rng.pick(SIZE_SETUPS);
  const ladder = LADDERS[ladderId];
  const row = agaroseRow(percent);
  const model = agaroseModel(percent);
  const inRange = ladder.sizes.map((s) => s >= row.minBp && s <= row.maxBp);
  const usable = ladder.sizes.filter((_, i) => inRange[i]);
  // Unknown: log-uniform between the 2nd-largest and 2nd-smallest usable ladder bands.
  const hi = Math.log10(usable[1] ?? usable[0]);
  const lo = Math.log10(usable[usable.length - 2] ?? usable[usable.length - 1]);
  const raw = 10 ** rng.float(lo, hi);
  const step = raw >= 1000 ? 50 : 10;
  const unknownBp = Math.round(raw / step) * step;
  const mm = (s: number) => Math.round(migrate(model, s) * RUN_MM * 10) / 10;
  const ladderMm = ladder.sizes.map(mm);
  const unknownMm = mm(unknownBp);

  const fit = standardCurve(
    ladder.sizes.filter((_, i) => inRange[i]),
    ladderMm.filter((_, i) => inRange[i]),
  );
  const estimate = sizeFromCurve(fit, unknownMm);
  const useKb = ladderId !== 'bp100';
  const above = ladder.sizes.filter((s) => s > unknownBp).at(-1)!;
  const below = ladder.sizes.find((s) => s < unknownBp)!;

  return {
    kind: 'gel.size',
    seed,
    format: 'numeric',
    grading: 'gel',
    prompt: `${percent}% agarose gel. Lane M: size marker (${ladder.name}). Lane 1: one unknown linear DNA fragment. Estimate its size.`,
    visual: { type: 'gelReading', percent, ladderId, ladderMm, unknownMm, unknownBp, runMm: RUN_MM },
    revealVisual: {
      type: 'standardCurve',
      ladderSizes: ladder.sizes,
      ladderMm,
      inRange,
      unknownMm,
      unknownBp,
    },
    answer: useKb ? unknownBp / 1000 : unknownBp,
    unit: useKb ? 'kb' : 'bp',
    tolerance: 0.1,
    answerLabel: formatSize(unknownBp),
    placeholder: useKb ? 'e.g. 2.3' : 'e.g. 450',
    explanation: [
      `The unknown runs between the ${formatSize(above)} and ${formatSize(below)} ladder bands, ${unknownMm} mm from the well.`,
      `Distance migrated falls linearly with log(size) (Brown: D = a − b log M), so plot log(size) against distance for the ladder bands: they lie on a straight line. The fit here is log₁₀(size) = ${fit.intercept.toFixed(3)} ${fit.slope < 0 ? '−' : '+'} ${Math.abs(fit.slope).toFixed(4)} × distance (r² = ${fit.r2.toFixed(4)}).`,
      `Reading ${unknownMm} mm off the line gives ≈ ${formatSize(Math.round(estimate))}; the band is ${formatSize(unknownBp)}.`,
      inRange.every(Boolean)
        ? 'Interpolate between bands on a log scale, not a linear one: halfway between 2 and 4 kb on the gel is about 2.8 kb, not 3 kb.'
        : outOfRangeNote(ladder.sizes.filter((_, i) => !inRange[i]), row.minBp, row.maxBp, percent),
    ],
  };
}

function agaroseQuestion(rng: Rng, seed: string): ChoiceQuestion {
  for (let i = 0; i < 500; i++) {
    const row = rng.pick(AGAROSE_TABLE);
    const lmin = Math.log10(row.minBp);
    const lmax = Math.log10(row.maxBp);
    const a = rng.float(lmin, lmin + (lmax - lmin) * 0.45);
    const b = rng.float(lmin + (lmax - lmin) * 0.55, lmax);
    const round = (x: number) => (x >= 1000 ? Math.round(x / 500) * 500 : Math.round(x / 50) * 50);
    const lo = round(10 ** a);
    const hi = round(10 ** b);
    if (lo >= hi || lo < row.minBp || hi > row.maxBp) continue;
    const covering = agaroseRowsCovering(lo, hi);
    const others = AGAROSE_TABLE.filter((r) => !covering.includes(r));
    if (others.length < 3) continue;
    const options = rng.shuffle([row, ...rng.sample(others, 3)]);
    return {
      kind: 'gel.agarose',
      seed,
      format: 'choice',
      prompt: `You need to separate linear DNA fragments between ${formatSize(lo)} and ${formatSize(hi)}. Which of these agarose gels would you pour?`,
      revealVisual: { type: 'agaroseTable', highlight: covering.map((r) => r.percent), target: [lo, hi] },
      options: options.map((r) => ({
        id: String(r.percent),
        label: `${r.percent}% agarose`,
        note: `separates ${formatSize(r.minBp)}–${formatSize(r.maxBp)}`,
      })),
      correct: [String(row.percent)],
      explanation: [
        `A ${row.percent}% gel resolves roughly ${formatSize(row.minBp)}–${formatSize(row.maxBp)}, which contains the whole ${formatSize(lo)}–${formatSize(hi)} range.`,
        'The more agarose, the smaller the pores: high percentages resolve small fragments (but large ones barely enter), low percentages resolve large fragments (but small ones run off or blur).',
      ],
    };
  }
  throw new Error('Could not build an agarose question');
}

const PFGE_SAMPLES: { text: string; bp: number }[] = [
  { text: 'a 4.4 kb plasmid such as pBR322', bp: 4361 },
  { text: 'λ DNA digested with HindIII (fragments 0.1–23 kb)', bp: 23130 },
  { text: 'E. coli genomic DNA digested with EcoRI (fragments mostly under 20 kb)', bp: 20000 },
  { text: 'a 12 kb long-range PCR product', bp: 12000 },
  { text: 'a 2 kb PCR product', bp: 2000 },
  { text: 'an insert of 150 kb excised from a BAC clone', bp: 150000 },
  { text: 'intact yeast chromosomes (about 0.2–2.2 Mb)', bp: 2.2e6 },
  { text: 'human genomic DNA digested with NotI (fragments of hundreds of kb)', bp: 500000 },
  { text: 'Plasmodium falciparum chromosomes (0.6–3.5 Mb)', bp: 3.5e6 },
  { text: 'a 300 kb YAC insert', bp: 300000 },
  { text: 'intact phage T4 DNA (about 170 kb)', bp: 170000 },
  { text: 'fragments of 5–25 kb from a genomic digest with a 6-bp cutter', bp: 25000 },
];

function pfgeQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const sample = rng.pick(PFGE_SAMPLES);
  const yes = needsPfge(sample.bp);
  return {
    kind: 'gel.pfge',
    seed,
    format: 'choice',
    prompt: `You want to separate ${sample.text}. Do you need pulsed-field gel electrophoresis (PFGE)?`,
    options: [
      { id: 'yes', label: 'Yes, PFGE is needed' },
      { id: 'no', label: 'No, a conventional agarose gel is enough' },
    ],
    correct: [yes ? 'yes' : 'no'],
    explanation: [
      `In a conventional gel, migration depends on log(size), so the differences between large molecules become tiny; above about ${PFGE_THRESHOLD_BP / 1000} kb everything runs together (Brown §4.2.9).`,
      yes
        ? `At ${formatSize(sample.bp)} this is beyond that limit, so use PFGE (OFAGE, CHEF, FIGE): the field keeps changing direction, and because short molecules re-orient faster than long ones, molecules up to several Mb are separated.`
        : `At ${formatSize(sample.bp)} or less this is well within the range of an ordinary agarose gel (choose the % to match the sizes).`,
    ],
  };
}
