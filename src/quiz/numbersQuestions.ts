/** Mode 5 — numbers drill. */

import { formatInt, formatSci, superscript, trimNumber } from '../science/format';
import {
  A260_FACTOR,
  clarkeCarbon,
  concentrationFromA260,
  coverageProbability,
  enzymeAmount,
  expectedSites,
  NUCLEIC_ACID_LABEL,
  PURITY_LABEL,
  purityVerdict,
  siteSpacing,
  VECTOR_CAPACITIES,
  vectorsFor,
  type NucleicAcid,
  type PurityVerdict,
} from '../science/numbers';
import { createRng, type Rng } from '../science/rng';
import { formatSize } from './gelQuestions';
import type { ChoiceQuestion, NumericQuestion, OrderQuestion, Question } from './types';

export type NumbersKind = 'freq' | 'units' | 'a260' | 'purity' | 'coverage' | 'vectors';
export const NUMBERS_KINDS: NumbersKind[] = ['freq', 'units', 'a260', 'purity', 'coverage', 'vectors'];

export function generateNumbersQuestion(seed: string, kind?: NumbersKind): Question {
  const rng = createRng(`num/${seed}`);
  const k = kind ?? rng.pick(NUMBERS_KINDS);
  switch (k) {
    case 'freq':
      return freqQuestion(rng, seed);
    case 'units':
      return unitsQuestion(rng, seed);
    case 'a260':
      return a260Question(rng, seed);
    case 'purity':
      return purityQuestion(rng, seed);
    case 'coverage':
      return coverageQuestion(rng, seed);
    case 'vectors':
      return rng.chance(0.5) ? vectorOrderQuestion(rng, seed) : vectorChoiceQuestion(rng, seed);
  }
}

const MOLECULES = [
  { name: 'λ DNA', bp: 48502 },
  { name: 'the E. coli genome', bp: 4.6e6 },
  { name: 'the yeast (S. cerevisiae) genome', bp: 1.2e7 },
  { name: 'the human genome', bp: 3.2e9 },
];

function freqQuestion(rng: Rng, seed: string): NumericQuestion {
  if (rng.chance(0.5)) {
    const n = rng.pick([4, 6, 8]);
    const example = { 4: 'Sau3AI (GATC)', 6: 'EcoRI (GAATTC)', 8: 'NotI (GCGGCCGC)' }[n];
    return {
      kind: 'num.freq',
      seed,
      format: 'numeric',
      prompt: `On average, how often (every how many bp) does a recognition site of ${n} bp, such as ${example}, occur in random DNA with 25% of each base?`,
      answer: siteSpacing(n),
      unit: 'bp',
      tolerance: 0.001,
      answerLabel: `${formatInt(siteSpacing(n))} bp`,
      explanation: [
        `Each position matches with probability 1/4, so a specific ${n}-bp sequence occurs with probability (1/4)${superscript(n)}: once every 4${superscript(n)} = ${formatInt(siteSpacing(n))} bp.`,
        'Worth memorising: 4⁴ = 256, 4⁶ = 4096, 4⁸ = 65 536. Real genomes deviate (base composition, CpG depletion), so these are averages.',
      ],
    };
  }
  const n = rng.pick([6, 6, 8]);
  const mol = rng.pick(MOLECULES.filter((m) => m.bp / 4 ** n >= 3));
  const sites = expectedSites(mol.bp, n);
  return {
    kind: 'num.freq',
    seed,
    format: 'numeric',
    prompt: `How many sites would you expect in ${mol.name} (${formatSize(mol.bp)}) for an enzyme whose recognition sequence is ${n} bp long, assuming random sequence?`,
    answer: sites,
    unit: 'sites',
    tolerance: 0.05,
    answerLabel: `≈ ${formatSci(sites)} sites`,
    explanation: [
      `Expected spacing 4${superscript(n)} = ${formatInt(4 ** n)} bp, so ${formatInt(mol.bp)} / ${formatInt(4 ** n)} ≈ ${formatSci(sites)} sites.`,
      mol.name === 'λ DNA' && n === 6
        ? 'Reality check: λ has only 5 EcoRI sites and 7 HindIII sites — real sequences are not random, which is why this is only an estimate.'
        : 'This is an average for random sequence; the real number depends on the base composition of the DNA.',
    ],
  };
}

function unitsQuestion(rng: Rng, seed: string): NumericQuestion {
  const brown = rng.chance(0.15);
  const ug = brown ? 2 : rng.pick([0.5, 1, 2, 3, 4, 5, 8, 10]);
  const conc = brown ? 4 : rng.pick([2, 4, 5, 10, 20]);
  const hours = brown ? 1 : rng.pick([1, 1, 1, 2]);
  const { units, volumeUl } = enzymeAmount(ug, conc, hours);
  const enzyme = brown ? 'BglII' : rng.pick(['EcoRI', 'BamHI', 'HindIII', 'PstI', 'SalI']);
  return {
    kind: 'num.units',
    seed,
    format: 'numeric',
    prompt: `You want to digest ${trimNumber(ug)} µg of DNA with ${enzyme} (supplied at ${conc} U/µl) in ${hours === 1 ? '1 hour' : `${hours} hours`}. How many µl of enzyme do you need, at minimum?`,
    answer: volumeUl,
    unit: 'µl',
    tolerance: 0.02,
    answerLabel: `${trimNumber(volumeUl, 3)} µl`,
    explanation: [
      '1 unit (U) of a restriction enzyme cuts 1 µg of DNA in 1 hour.',
      `${trimNumber(ug)} µg in ${hours} h needs ${trimNumber(ug)} / ${hours} = ${trimNumber(units, 3)} U. At ${conc} U/µl that is ${trimNumber(units, 3)} / ${conc} = ${trimNumber(volumeUl, 3)} µl.`,
      brown ? 'This is the example in Brown §4.2.6: 2 U of BglII for 2 µg of λ DNA = 0.5 µl.' : 'In practice people add an excess, but keep the enzyme below 10% of the reaction volume (it is stored in glycerol).',
    ],
  };
}

function a260Question(rng: Rng, seed: string): NumericQuestion {
  const type = rng.pick<NucleicAcid>(['dsDNA', 'dsDNA', 'RNA', 'ssDNA']);
  const a260 = Math.round(rng.float(0.1, 0.9) * 100) / 100;
  const dilution = rng.pick([1, 10, 20, 50, 100]);
  const conc = concentrationFromA260(a260, type, dilution);
  const total = rng.chance(0.3);
  const volumeUl = rng.pick([50, 100, 200, 500]);
  const amount = (conc * volumeUl) / 1000;
  const dilText = dilution === 1 ? 'undiluted' : `diluted 1:${dilution}`;
  const factorText = `A260 = 1.0 corresponds to ${A260_FACTOR[type]} µg/ml of ${NUCLEIC_ACID_LABEL[type]}`;
  return {
    kind: 'num.a260',
    seed,
    format: 'numeric',
    prompt: total
      ? `A sample of ${NUCLEIC_ACID_LABEL[type]}, ${dilText}, reads A260 = ${a260} (1 cm cuvette). How many µg are there in the whole ${volumeUl} µl of the original sample?`
      : `A sample of ${NUCLEIC_ACID_LABEL[type]}, ${dilText}, reads A260 = ${a260} (1 cm cuvette). What is the concentration of the original sample in µg/ml?`,
    answer: total ? amount : conc,
    unit: total ? 'µg' : 'µg/ml',
    tolerance: 0.02,
    answerLabel: total ? `${trimNumber(amount, 2)} µg` : `${trimNumber(conc, 1)} µg/ml`,
    explanation: [
      `${factorText} (dsDNA 50, RNA 40, ssDNA 33).`,
      `Concentration = ${a260} × ${A260_FACTOR[type]}${dilution === 1 ? '' : ` × ${dilution} (dilution factor)`} = ${trimNumber(conc, 1)} µg/ml.`,
      ...(total ? [`In ${volumeUl} µl (= ${volumeUl / 1000} ml): ${trimNumber(conc, 1)} × ${volumeUl / 1000} = ${trimNumber(amount, 2)} µg.`] : []),
    ],
  };
}

function purityQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const target = rng.pick<PurityVerdict>(['pure-dna', 'contaminated', 'contaminated', 'rna']);
  const ratio = { 'pure-dna': rng.float(1.78, 1.84), contaminated: rng.float(1.2, 1.55), rna: rng.float(1.98, 2.1) }[target];
  const a280 = Math.round(rng.float(0.15, 0.5) * 1000) / 1000;
  const a260 = Math.round(a280 * ratio * 1000) / 1000;
  const r = a260 / a280;
  const verdict = purityVerdict(r);
  return {
    kind: 'num.purity',
    seed,
    format: 'choice',
    prompt: `A DNA preparation gives A260 = ${a260} and A280 = ${a280}. What does this tell you about its purity?`,
    options: (Object.keys(PURITY_LABEL) as PurityVerdict[]).map((id) => ({ id, label: PURITY_LABEL[id] })),
    correct: [verdict],
    explanation: [
      `A260/A280 = ${a260} / ${a280} = ${r.toFixed(2)}.`,
      'Pure DNA gives a ratio of 1.8. Proteins (aromatic amino acids) and phenol absorb at 280 nm, lowering the ratio; pure RNA gives about 2.0, so a DNA prep reading near 2.0 probably still contains RNA (treat with RNase).',
    ],
  };
}

const GENOMES = [
  { name: 'E. coli', bp: 4.6e6 },
  { name: 'yeast (S. cerevisiae)', bp: 1.2e7 },
  { name: 'Drosophila', bp: 1.4e8 },
  { name: 'human', bp: 3.2e9 },
];
const INSERTS = [
  { vector: 'λ replacement vector', bp: 20000 },
  { vector: 'cosmid', bp: 40000 },
  { vector: 'BAC', bp: 150000 },
];

function coverageQuestion(rng: Rng, seed: string): NumericQuestion {
  const classic = rng.chance(0.2);
  const genome = classic ? { name: 'a', bp: 2e9 } : rng.pick(GENOMES);
  const insert = classic ? { vector: 'λ replacement vector', bp: 2e4 } : rng.pick(INSERTS);
  const f = insert.bp / genome.bp;
  const genomeText = classic ? 'a 2 × 10⁹ bp genome' : `the ${genome.name} genome (${formatSci(genome.bp, 2)} bp)`;
  const formula = 'N = ln(1 − P) / ln(1 − f), with f = insert size / genome size';
  if (rng.chance(0.6)) {
    const p = classic ? 0.99 : rng.pick([0.95, 0.99]);
    const n = clarkeCarbon(p, insert.bp, genome.bp);
    return {
      kind: 'num.coverage',
      seed,
      format: 'numeric',
      prompt: `How many clones must a genomic library of ${genomeText} contain, with ${formatSize(insert.bp)} inserts (${insert.vector}), to have a ${Math.round(p * 100)}% chance of containing any given gene?`,
      answer: n,
      unit: 'clones',
      tolerance: 0.03,
      placeholder: 'e.g. 4.6e5',
      answerLabel: `≈ ${formatSci(n, 2)} clones`,
      explanation: [
        `Clarke–Carbon: ${formula}.`,
        `f = ${formatSci(insert.bp, 2)} / ${formatSci(genome.bp, 2)} = ${formatSci(f, 3)}.`,
        `N = ln(${trimNumber(1 - p, 2)}) / ln(1 − ${formatSci(f, 3)}) = −${(-Math.log(1 - p)).toFixed(3)} / −${formatSci(-Math.log(1 - f), 4)} ≈ ${formatSci(n, 3)} clones.`,
        `Note it is not simply genome/insert (${formatSci(1 / f, 2)}): because clones are random, you need several genome-equivalents (here ${trimNumber(n * f, 1)}×) to reach ${Math.round(p * 100)}%.`,
      ],
    };
  }
  // 0.5–2 genome-equivalents, rounded to two significant figures.
  const clones = classic ? 1e5 : Number((rng.float(0.5, 2) / f).toPrecision(2));
  const pCov = coverageProbability(clones, insert.bp, genome.bp);
  return {
    kind: 'num.coverage',
    seed,
    format: 'numeric',
    prompt: `A library of ${genomeText} has ${formatSci(clones, 3)} clones with ${formatSize(insert.bp)} inserts. What is the probability (%) that it contains a given gene?`,
    answer: pCov * 100,
    unit: '%',
    tolerance: 0,
    absTolerance: 1,
    answerLabel: `≈ ${Math.round(pCov * 100)}%`,
    explanation: [
      `Rearranging Clarke–Carbon: P = 1 − (1 − f)ᴺ, with f = ${formatSci(f, 3)}.`,
      `P = 1 − (1 − ${formatSci(f, 3)})^${formatSci(clones, 3)} ≈ 1 − e^(−${trimNumber(clones * f, 2)}) = ${(pCov * 100).toFixed(1)}%.`,
      classic
        ? '10⁵ clones is exactly one genome-equivalent (10⁵ × 2 × 10⁴ = 2 × 10⁹ bp), yet it gives only ~63% (1 − 1/e): random clones overlap and leave gaps.'
        : `The library holds ${trimNumber(clones * f, 2)} genome-equivalents; ${trimNumber(clones * f, 2)} equivalents give 1 − e^(−${trimNumber(clones * f, 2)}).`,
    ],
  };
}

function vectorOrderQuestion(rng: Rng, seed: string): OrderQuestion {
  // Plasmids and λ insertion vectors overlap (~8–10 kb), so never ask to order both.
  const skip = rng.pick(['plasmid', 'lambda-insertion']);
  const pool = VECTOR_CAPACITIES.filter((v) => v.id !== skip);
  const chosen = rng.sample(pool, rng.int(4, 5));
  const correct = VECTOR_CAPACITIES.filter((v) => chosen.includes(v)).map((v) => v.id);
  return {
    kind: 'num.vectors',
    seed,
    format: 'order',
    prompt: 'Put these cloning vectors in order of increasing maximum insert size.',
    items: rng.shuffle(chosen).map((v) => ({ id: v.id, label: v.name })),
    correct,
    explanation: [
      VECTOR_CAPACITIES.filter((v) => chosen.includes(v))
        .map((v) => `${v.name}: ${v.range}`)
        .join(' < '),
      'Plasmids and λ insertion vectors carry up to ~8–10 kb; λ replacement vectors 9–23 kb (the stuffer is replaced); cosmids 35–45 kb (limited by λ packaging, 37–52 kb total); BACs (F-plasmid based) 100–300 kb; YACs 0.2–2 Mb.',
    ],
  };
}

function vectorChoiceQuestion(rng: Rng, seed: string): ChoiceQuestion {
  for (let i = 0; i < 200; i++) {
    const size = rng.pick([3000, 5000, 15000, 20000, 38000, 42000, 120000, 180000, 250000, 800000, 1500000]);
    const fits = vectorsFor(size);
    if (fits.length === 0) continue;
    const correct = rng.pick(fits);
    const wrong = VECTOR_CAPACITIES.filter((v) => !fits.includes(v));
    if (wrong.length < 3) continue;
    const options = rng.shuffle([correct, ...rng.sample(wrong, 3)]);
    return {
      kind: 'num.vectors',
      seed,
      format: 'choice',
      prompt: `Which vector would you use to clone a DNA fragment of ${formatSize(size)}?`,
      options: options.map((v) => ({ id: v.id, label: v.name, note: v.range })),
      correct: [correct.id],
      explanation: [
        `${correct.name}: ${correct.range}, so ${formatSize(size)} fits.`,
        ...options.filter((v) => v !== correct).map((v) => `${v.name} (${v.range}) ${size > v.maxBp ? 'cannot carry it' : 'is designed for larger inserts'}.`),
      ],
    };
  }
  throw new Error('Could not build a vector question');
}
