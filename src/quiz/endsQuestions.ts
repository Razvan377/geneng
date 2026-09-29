/** Mode 3 — enzyme ends & ligation. */

import { randomSequence } from '../science/dna';
import {
  canLigate,
  cutEnds,
  directionalVerdict,
  enzymesCutting,
  enzymesCuttingJunction,
  ligationJunction,
  schizomerRelation,
  vectorSelfLigation,
  type CloningSetup,
} from '../science/ends';
import { complement } from '../science/dna';
import { END_KIND_LABEL, endKind, formatSite, getEnzyme, overhang, type EndKind } from '../science/enzymes';
import { createRng, type Rng } from '../science/rng';
import type { ChoiceQuestion, Question } from './types';

export type EndsKind = 'type' | 'ligate' | 'recut' | 'schizomer' | 'directional' | 'phosphatase';
export const ENDS_KINDS: EndsKind[] = ['type', 'ligate', 'recut', 'schizomer', 'directional', 'phosphatase'];

export function generateEndsQuestion(seed: string, kind?: EndsKind): Question {
  const rng = createRng(`ends/${seed}`);
  const k = kind ?? rng.pick(ENDS_KINDS);
  switch (k) {
    case 'type':
      return endTypeQuestion(rng, seed);
    case 'ligate':
      return ligateQuestion(rng, seed);
    case 'recut':
      return recutQuestion(rng, seed);
    case 'schizomer':
      return schizomerQuestion(rng, seed);
    case 'directional':
      return directionalQuestion(rng, seed);
    case 'phosphatase':
      return phosphataseQuestion(rng, seed);
  }
}

const END_OPTIONS: { id: EndKind; label: string }[] = [
  { id: '5prime', label: '5′ overhang' },
  { id: '3prime', label: '3′ overhang' },
  { id: 'blunt', label: 'Blunt' },
];

/** Why an enzyme leaves the end it does, in terms of its cut positions. */
export function endReasoning(name: string): string {
  const e = getEnzyme(name);
  const n = e.site.length;
  const k = endKind(e);
  const oh = overhang(e);
  const cutText = `${name} cuts \`${formatSite(e)}\`: the top strand after base ${e.cut} of ${n}, and — because the site is a palindrome — the bottom strand at the mirror position (after base ${e.cut} reading its own 5′→3′).`;
  if (k === 'blunt') return `${cutText} Both cuts are opposite each other in the middle of the site, so no single strand is left over: blunt ends.`;
  if (k === '5prime')
    return `${cutText} The top-strand cut lies nearer the 5′ end of the site than the bottom-strand cut, so each fragment keeps a single-stranded ${oh.length}-nt tail ending in a 5′ phosphate: a 5′ overhang (\`${oh}\`).`;
  return `${cutText} The top-strand cut lies nearer the 3′ end of the site, so each fragment keeps a single-stranded ${oh.length}-nt tail ending in a 3′-OH: a 3′ overhang (\`${oh}\`).`;
}

const TYPE_POOL = ['EcoRI', 'EcoRV', 'SacI', 'BamHI', 'BglII', 'Sau3AI', 'SmaI', 'XmaI', 'PstI', 'KpnI', 'HindIII', 'NotI', 'SphI', 'NcoI', 'PvuII', 'Acc65I', 'ApaI', 'HaeIII', 'NdeI', 'ScaI'];

function flank(rng: Rng, n = 4): string {
  return randomSequence(rng, n);
}

function endTypeQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const name = rng.pick(TYPE_POOL);
  const e = getEnzyme(name);
  const { left, right } = cutEnds(name, flank(rng), flank(rng));
  const fromPicture = rng.chance(0.5);
  const kind = endKind(e);
  return {
    kind: 'ends.type',
    seed,
    format: 'choice',
    prompt: fromPicture
      ? 'This DNA has just been cut by a restriction enzyme. What kind of ends were produced?'
      : `${name} recognises \`${formatSite(e)}\` (^ marks where the top strand is cut). What kind of ends does it leave?`,
    visual: fromPicture ? { type: 'ends', ends: [left, right], gap: true } : { type: 'sites', enzymes: [name] },
    revealVisual: fromPicture ? { type: 'sites', enzymes: [name] } : { type: 'ends', ends: [left, right], gap: true },
    options: END_OPTIONS.map((o) => ({ ...o })),
    correct: [kind],
    explanation: [
      fromPicture ? `The enzyme was ${name}.` : '',
      endReasoning(name),
      kind === 'blunt'
        ? 'Tip: in the drawing both strands stop at the same column.'
        : `Tip: find the strand that sticks out and read its free end. The bottom strand is drawn 3′→5′, so a bottom strand protruding to the right ends in 5′; a top strand protruding to the right ends in 3′.`,
    ].filter(Boolean),
  };
}

const COMPATIBLE_PAIRS: [string, string][] = [
  ['BamHI', 'BglII'],
  ['BglII', 'BamHI'],
  ['BamHI', 'Sau3AI'],
  ['Sau3AI', 'BglII'],
  ['SalI', 'XhoI'],
  ['XhoI', 'SalI'],
  ['XbaI', 'SpeI'],
  ['NheI', 'XbaI'],
  ['SpeI', 'AvrII'],
  ['EcoRV', 'SmaI'],
  ['PvuII', 'EcoRV'],
  ['HaeIII', 'SmaI'],
  ['EcoRI', 'EcoRI'],
  ['PstI', 'PstI'],
  ['KpnI', 'KpnI'],
];

const INCOMPATIBLE_PAIRS: [string, string][] = [
  ['KpnI', 'Acc65I'],
  ['SacI', 'HindIII'],
  ['SphI', 'NcoI'],
  ['EcoRI', 'BamHI'],
  ['SmaI', 'XmaI'],
  ['EcoRV', 'EcoRI'],
  ['PstI', 'KpnI'],
  ['ApaI', 'PspOMI'],
  ['XbaI', 'XhoI'],
  ['NotI', 'BamHI'],
  ['HindIII', 'EcoRI'],
  ['SmaI', 'KpnI'],
];

function ligateQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const [a, b] = rng.chance(0.5) ? rng.pick(COMPATIBLE_PAIRS) : rng.pick(INCOMPATIBLE_PAIRS);
  const leftEnd = cutEnds(a, flank(rng, 5), flank(rng, 2)).left;
  const rightEnd = cutEnds(b, flank(rng, 2), flank(rng, 5)).right;
  const verdict = canLigate(a, b);
  return {
    kind: 'ends.ligate',
    seed,
    format: 'choice',
    prompt: `The left fragment was cut with ${a}, the right fragment with ${b}. Can DNA ligase join these two ends?`,
    visual: { type: 'ends', ends: [leftEnd, rightEnd], captions: [`${a} end`, `${b} end`], gap: true },
    revealVisual: { type: 'sites', enzymes: a === b ? [a] : [a, b] },
    options: [
      { id: 'yes', label: 'Yes, they can be ligated' },
      { id: 'no', label: 'No, they are incompatible' },
    ],
    correct: [verdict.ok ? 'yes' : 'no'],
    explanation: [
      verdict.reason,
      'Rule: sticky ends ligate when they are the same type (5′ with 5′, 3′ with 3′) and their single strands are complementary; any blunt end ligates to any other blunt end; a blunt end never ligates to a sticky one.',
    ],
  };
}

const RECUT_PAIRS: [string, string][] = [
  ['BamHI', 'BglII'],
  ['BglII', 'BamHI'],
  ['SalI', 'XhoI'],
  ['XhoI', 'SalI'],
  ['XbaI', 'SpeI'],
  ['SpeI', 'XbaI'],
  ['NheI', 'XbaI'],
  ['EcoRI', 'EcoRI'],
  ['BamHI', 'BamHI'],
  ['BamHI', 'Sau3AI'],
  ['EcoRV', 'SmaI'],
  ['SmaI', 'SmaI'],
  ['PvuII', 'EcoRV'],
];

/** 4-cutters that recognise the shared overhang, where relevant. */
function fourCutterFor(a: string): string | null {
  const oh = overhang(getEnzyme(a));
  if (oh === 'GATC') return 'Sau3AI';
  if (oh === 'TCGA') return 'TaqI';
  return null;
}

function recutQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const [a, b] = rng.pick(RECUT_PAIRS);
  const four = fourCutterFor(a) ?? fourCutterFor(b);
  const options = [...new Set([a, b, ...(four ? [four] : [])])];

  // Flanks: random, but never creating a site of any option enzyme away from the junction.
  let junction = ligationJunction(a, b, flank(rng, 3), flank(rng, 3));
  for (let i = 0; i < 200; i++) {
    const j = ligationJunction(a, b, flank(rng, 3), flank(rng, 3));
    const anywhere = enzymesCutting(j.seq, options);
    const atJunction = enzymesCuttingJunction(j, options);
    if (anywhere.length === atJunction.length) {
      junction = j;
      break;
    }
  }
  const cutters = enzymesCuttingJunction(junction, options);
  const top = junction.seq;
  const lo = Math.min(junction.topJunction, junction.bottomJunction);
  const hi = Math.max(junction.topJunction, junction.bottomJunction);
  const siteStart = junction.topJunction - getEnzyme(a).cut;
  const siteLen = getEnzyme(a).cut + (getEnzyme(b).site.length - getEnzyme(b).cut);

  const perEnzyme = options.map((name) => {
    const site = getEnzyme(name).site;
    const ok = cutters.includes(name);
    return `${name} needs \`${site}\`: ${ok ? 'present across the junction, so it cuts' : 'not present at the junction, so it cannot cut'}.`;
  });

  return {
    kind: 'ends.recut',
    seed,
    format: 'choice',
    multi: true,
    exclusive: ['none'],
    prompt:
      a === b
        ? `Two fragments cut with ${a} were ligated. Which enzymes can cut the ligated junction? Select all that apply.`
        : `A fragment cut with ${a} was ligated to a fragment cut with ${b}. Which enzymes can cut the new junction? Select all that apply.`,
    visual: {
      type: 'sequence',
      rows: [
        {
          label: 'top',
          seq: top,
          primes: true,
          highlights: [
            { from: siteStart, to: junction.topJunction, tone: 'teal', label: a },
            { from: junction.topJunction, to: siteStart + siteLen, tone: 'coral', label: b },
          ],
        },
        {
          label: 'bottom',
          seq: complement(top),
          primes: true,
          reversed: true,
          highlights: [{ from: lo, to: hi === lo ? lo : hi, tone: 'amber' }],
        },
      ],
    },
    revealVisual: { type: 'sites', enzymes: options },
    options: [
      ...options.map((n) => ({ id: n, label: n, note: `site ${formatSite(getEnzyme(n))}` })),
      { id: 'none', label: 'None of them' },
    ],
    correct: cutters.length ? cutters : ['none'],
    explanation: [
      `After ligation the junction reads \`${top.slice(Math.max(0, siteStart - 1), siteStart + siteLen + 1)}\` (top strand, 5′→3′): the first half comes from the ${a} site, the second half from the ${b} site.`,
      ...perEnzyme,
      a !== b && overhang(getEnzyme(a)) === 'GATC' && b !== 'Sau3AI' && a !== 'Sau3AI'
        ? 'This is the classic trap: BamHI and BglII ends are compatible (both GATC), but the hybrid site GGATCT / AGATCC matches neither 6-bp site. Only a 4-cutter recognising GATC (Sau3AI, MboI) still cuts.'
        : '',
      b === 'Sau3AI'
        ? 'A BamHI end ligated to a Sau3AI end restores a BamHI site only if the base after GATC happens to be C (1 time in 4).'
        : '',
    ].filter(Boolean),
  };
}

const SCHIZOMER_PAIRS: [string, string][] = [
  ['Sau3AI', 'MboI'],
  ['Sau3AI', 'DpnII'],
  ['HpaII', 'MspI'],
  ['SmaI', 'XmaI'],
  ['KpnI', 'Acc65I'],
  ['SacI', 'Ecl136II'],
  ['ApaI', 'PspOMI'],
  ['NarI', 'KasI'],
  ['KasI', 'SfoI'],
  ['BamHI', 'BglII'],
  ['SalI', 'XhoI'],
  ['EcoRI', 'EcoRV'],
];

function schizomerQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const [a, b] = rng.shuffle(rng.pick(SCHIZOMER_PAIRS));
  const rel = schizomerRelation(a, b);
  const ea = getEnzyme(a);
  const eb = getEnzyme(b);
  const why =
    rel === 'isoschizomers'
      ? `${a} and ${b} recognise the same sequence (\`${ea.site}\`) and cut it at the same position (\`${formatSite(ea)}\`): isoschizomers. They come from different bacteria and may differ in, for example, sensitivity to methylation (HpaII is blocked by CpG methylation, MspI is not).`
      : rel === 'neoschizomers'
        ? `${a} and ${b} recognise the same sequence (\`${ea.site}\`) but cut it at different positions (\`${formatSite(ea)}\` vs \`${formatSite(eb)}\`): neoschizomers. They therefore leave different ends (${END_KIND_LABEL[endKind(ea)]} vs ${END_KIND_LABEL[endKind(eb)]}).`
        : `${a} (\`${ea.site}\`) and ${b} (\`${eb.site}\`) recognise different sequences, so they are neither.${canLigate(a, b).ok ? ' Their sticky ends happen to be compatible, which is a different property.' : ''}`;
  return {
    kind: 'ends.schizomer',
    seed,
    format: 'choice',
    prompt: `How are ${a} and ${b} related?`,
    visual: { type: 'sites', enzymes: [a, b] },
    options: [
      { id: 'isoschizomers', label: 'Isoschizomers' },
      { id: 'neoschizomers', label: 'Neoschizomers' },
      { id: 'different-sites', label: 'Neither (different recognition sites)' },
    ],
    correct: [rel],
    explanation: [
      why,
      'Definitions: isoschizomers share the recognition sequence (and cut it the same way); neoschizomers share the recognition sequence but cut at a different position. Some textbooks treat neoschizomers as a special case of isoschizomers.',
    ],
  };
}

/** A pBluescript-style polylinker: note the compatible pairs XhoI/SalI, SpeI/XbaI and EcoRV/SmaI. */
const MCS = ['KpnI', 'ApaI', 'XhoI', 'SalI', 'HindIII', 'EcoRV', 'EcoRI', 'PstI', 'SmaI', 'BamHI', 'SpeI', 'XbaI', 'NotI', 'SacI'];
const NON_MCS = ['BglII', 'NcoI', 'NdeI', 'SphI'];

/** Coarse category of a failure reason, used to vary the distractors. */
function reasonCategory(reason: string): string {
  if (/both ends/.test(reason)) return 'same';
  if (/inside the insert/.test(reason)) return 'internal';
  if (/MCS/.test(reason)) return 'mcs';
  if (/backbone/.test(reason)) return 'backbone';
  if (/compatible ends/.test(reason)) return 'compatible';
  return 'other';
}

function directionalQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const endPool = (from: string[]) => (rng.chance(0.2) ? [...from, rng.pick(NON_MCS)] : from);
  for (let attempt = 0; attempt < 2000; attempt++) {
    const setup: CloningSetup = {
      mcs: MCS,
      vectorBackbone: rng.chance(0.35) ? [rng.pick(['PstI', 'SacI', 'ApaI'])] : [],
      insert5: rng.sample(endPool(MCS.slice(0, 9)), rng.int(1, 2)),
      insert3: rng.sample(endPool(MCS.slice(5)), rng.int(1, 2)),
      insertInternal: rng.sample(MCS, rng.int(1, 2)),
    };
    // Options: every (5′ site, 3′ site) combination. The pools overlap, so the same enzyme can
    // sit at both ends and appear as a "same enzyme twice" distractor.
    const pairs: [string, string][] = [];
    for (const a of setup.insert5) for (const b of setup.insert3) pairs.push([a, b]);
    if (pairs.length < 3 || pairs.length > 4) continue;
    const verdicts = pairs.map(([a, b]) => directionalVerdict(setup, a, b));
    if (verdicts.filter((v) => v.ok).length !== 1) continue;
    // Distractors should fail for different reasons, so each teaches something.
    const categories = new Set(verdicts.filter((v) => !v.ok).map((v) => reasonCategory(v.reason)));
    if (categories.size < Math.min(2, pairs.length - 1)) continue;
    const options = pairs.map(([a, b], i) => ({
      id: `${a}+${b}`,
      label: a === b ? `${a} only (both ends)` : `${a} + ${b}`,
      note: verdicts[i].reason,
    }));
    const correct = options.find((_, i) => verdicts[i].ok)!.id;
    return {
      kind: 'ends.directional',
      seed,
      format: 'choice',
      prompt:
        'You want to clone this insert into the vector in one orientation only (directional cloning). Which pair of enzymes should you cut both vector and insert with?',
      visual: { type: 'cloning', setup },
      options: rng.shuffle(options),
      correct: [correct],
      explanation: [
        'For directional cloning you need two different enzymes that (1) each cut the vector only once, inside the MCS, (2) flank the insert without cutting inside it, and (3) leave ends that are not compatible with each other.',
        ...options.map((o) => `${o.label}: ${o.note}`),
      ],
    };
  }
  throw new Error('Could not build a directional-cloning question');
}

function phosphataseQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const scenarios: { enzymes: string[]; phosphatase: boolean }[] = [
    { enzymes: ['BamHI'], phosphatase: true },
    { enzymes: ['EcoRI'], phosphatase: true },
    { enzymes: ['SmaI'], phosphatase: true },
    { enzymes: ['BamHI'], phosphatase: false },
    { enzymes: ['PstI'], phosphatase: false },
    { enzymes: ['SmaI'], phosphatase: false },
    { enzymes: ['EcoRI', 'HindIII'], phosphatase: false },
    { enzymes: ['BamHI', 'BglII'], phosphatase: false },
    { enzymes: ['SalI', 'XhoI'], phosphatase: false },
  ];
  const variant = rng.chance(0.3) ? 'insert' : 'self';
  if (variant === 'insert') {
    const insertTreated = rng.chance(0.4);
    const name = rng.pick(['BamHI', 'EcoRI', 'HindIII']);
    const ends = cutEnds(name, flank(rng), flank(rng));
    return {
      kind: 'ends.phosphatase',
      seed,
      format: 'choice',
      prompt: insertTreated
        ? `A vector opened with ${name} was treated with alkaline phosphatase. By mistake, the ${name} insert was treated with phosphatase as well. Will you get recombinant plasmids?`
        : `A vector opened with ${name} was treated with alkaline phosphatase. Can an insert cut with ${name} still be ligated into it?`,
      visual: { type: 'ends', ends: [ends.left, ends.right], dephosphorylated: true, captions: ['vector end', 'vector end'], gap: true },
      options: [
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: 'No' },
      ],
      correct: [insertTreated ? 'no' : 'yes'],
      explanation: insertTreated
        ? [
            'DNA ligase joins a 3′-OH to a 5′-phosphate. With both vector and insert dephosphorylated there are no 5′ phosphates anywhere, so not a single phosphodiester bond can form: no ligation at all.',
          ]
        : [
            'Yes. The phosphatase removed the vector’s 5′ phosphates, so the vector cannot close on itself, but the insert still has its own 5′ phosphates.',
            'Ligase forms one bond at each junction (insert 5′-P to vector 3′-OH). The two nicks left where the vector’s 5′-OH ends meet the insert are repaired after transformation, inside E. coli.',
          ],
    };
  }
  const sc = rng.pick(scenarios);
  const verdict = vectorSelfLigation(sc);
  const [a, b = a] = sc.enzymes;
  const ends = [cutEnds(b, flank(rng), flank(rng)).right, cutEnds(a, flank(rng), flank(rng)).left];
  return {
    kind: 'ends.phosphatase',
    seed,
    format: 'choice',
    prompt:
      `A plasmid vector was cut with ${sc.enzymes.join(' + ')}` +
      (sc.phosphatase ? ' and then treated with alkaline phosphatase' : ' (no phosphatase treatment)') +
      '. With DNA ligase and no insert, can the vector re-circularise?',
    visual: {
      type: 'ends',
      ends,
      captions: [`${b} end`, `${a} end`],
      dephosphorylated: sc.phosphatase,
      gap: true,
    },
    options: [
      { id: 'yes', label: 'Yes, it self-ligates' },
      { id: 'no', label: 'No, it cannot' },
    ],
    correct: [verdict.canSelfLigate ? 'yes' : 'no'],
    explanation: [verdict.reason],
  };
}
