/**
 * Functional analysis: yeast two-hybrid, CRISPR knockout screens, RNAi target validation,
 * reporter (luciferase) assays and recognising techniques from their data.
 */

import { trimNumber } from '../science/format';
import { createRng, type Rng } from '../science/rng';
import type { CaseQuestion, ChoiceOption, ChoiceQuestion, NumericQuestion, Question } from './types';

export type FunctionalKind = 'y2h' | 'crispr' | 'rnai' | 'reporter' | 'technique';
export const FUNCTIONAL_KINDS: FunctionalKind[] = ['y2h', 'crispr', 'rnai', 'reporter', 'technique'];

export function generateFunctionalQuestion(seed: string, kind?: FunctionalKind): Question {
  const rng = createRng(`func/${seed}`);
  const k = kind ?? rng.pick(FUNCTIONAL_KINDS);
  switch (k) {
    case 'y2h':
      return twoHybridCase(rng, seed);
    case 'crispr':
      return crisprQuestion(rng, seed);
    case 'rnai':
      return rnaiQuestion(rng, seed);
    case 'reporter':
      return reporterCase(rng, seed);
    case 'technique':
      return techniqueQuestion(rng, seed);
  }
}

// ---------------------------------------------------------------------------------------------
// Yeast two-hybrid

const REPORTERS = [
  { gene: 'HIS3', mutant: 'his3', nutrient: 'His' },
  { gene: 'ADE2', mutant: 'ade2', nutrient: 'Ade' },
];

function twoHybridCase(rng: Rng, seed: string): CaseQuestion {
  const rep = rng.pick(REPORTERS);
  const other = REPORTERS.find((r) => r !== rep)!;
  const [bait, prey] = rng.shuffle(['R', 'S']);
  const strains = rng.shuffle([
    { id: 'right', g: `trp1⁻ leu2⁻ ${rep.mutant}⁻`, r: `GAL4 UAS → ${rep.gene}`, note: 'Correct: auxotrophic for both plasmid markers (TRP1, LEU2) and for the reporter, which is driven by GAL4-binding sites.' },
    { id: 'lexa', g: `trp1⁻ leu2⁻ ${rep.mutant}⁻`, r: `LexA operator → ${rep.gene}`, note: 'The GAL4 DNA-binding domain cannot bind LexA operators: the reporter would never switch on.' },
    { id: 'notaux', g: `trp1⁻ leu2⁻ ${other.mutant}⁻`, r: `GAL4 UAS → ${rep.gene}`, note: `The strain already makes ${rep.nutrient.toLowerCase()}${rep.nutrient === 'His' ? 'tidine' : 'nine'} (it is not ${rep.mutant}⁻), so a ${rep.gene} reporter gives no selection.` },
    { id: 'lys', g: `trp1⁻ leu2⁻ ${rep.mutant}⁻`, r: 'GAL4 UAS → LYS2', note: 'The strain is LYS2⁺ anyway (no lys2 mutation): a LYS2 reporter cannot be selected.' },
  ]);
  const part1: ChoiceQuestion = {
    kind: 'func.y2h',
    seed,
    format: 'choice',
    prompt: 'Which S. cerevisiae strain should you use?',
    visual: { type: 'table', head: ['Strain', 'Genotype', 'Reporter'], rows: strains.map((s, i) => [String.fromCharCode(97 + i), s.g, s.r]) },
    options: strains.map((s, i) => ({ id: s.id, label: `Strain ${String.fromCharCode(97 + i)}`, note: s.note })),
    correct: ['right'],
    explanation: [
      'Three things must match: the plasmid markers (pGBKT7 carries TRP1, pGADT7 carries LEU2 → strain trp1⁻ leu2⁻), the binding sites in the reporter promoter (GAL4 UAS, because the bait is fused to the GAL4 DNA-binding domain), and a reporter whose nutrient the strain cannot make on its own.',
    ],
  };
  const part2: ChoiceQuestion = {
    kind: 'func.y2h',
    seed,
    format: 'choice',
    prompt: `First you check that the bait (protein ${bait} fused to the GAL4 DNA-binding domain, in pGBKT7) does not activate transcription on its own. Which plates do you use (transformation control / activation test)?`,
    options: rng.shuffle([
      { id: 'right', label: `−Trp / −Trp −${rep.nutrient}` },
      { id: 'leu', label: `−Trp −Leu / −Trp −Leu −${rep.nutrient}`, note: 'Only the bait plasmid (TRP1) is in the cells: they cannot grow without leucine.' },
      { id: 'complete', label: `Complete medium / −Trp −${other.nutrient}`, note: `The reporter is ${rep.gene}, not ${other.gene}.` },
      { id: 'notrp', label: `−Trp / −Trp −Leu`, note: 'Leucine selects for the prey plasmid, which is not there; it says nothing about reporter activation.' },
    ]),
    correct: ['right'],
    explanation: [
      `Cells with the bait plasmid grow on −Trp (transformation control). If they also grow on −Trp −${rep.nutrient}, the bait alone switches on the ${rep.gene} reporter (autoactivation) and the screen would be meaningless.`,
    ],
  };
  const part3: ChoiceQuestion = {
    kind: 'func.y2h',
    seed,
    format: 'choice',
    prompt: `Now you co-transform bait (${bait}, pGBKT7) and prey (${prey}, pGADT7). Which plates test transformation and interaction?`,
    options: rng.shuffle([
      { id: 'right', label: `−Trp −Leu / −Trp −Leu −${rep.nutrient}` },
      { id: 'one', label: `−Trp / −Trp −Leu −${rep.nutrient}`, note: '−Trp alone does not check that the prey plasmid is there.' },
      { id: 'wrongrep', label: `−Trp −Leu / −Trp −Leu −${other.nutrient}`, note: `The reporter is ${rep.gene}.` },
      { id: 'complete', label: `Complete medium / −Trp −Leu −${rep.nutrient}`, note: 'Complete medium does not select for either plasmid.' },
    ]),
    correct: ['right'],
    explanation: [
      `−Trp −Leu selects cells carrying both plasmids. On −Trp −Leu −${rep.nutrient} only cells in which bait and prey interact grow: the interaction brings the GAL4 activation domain to the UAS and switches on ${rep.gene}.`,
    ],
  };
  return {
    kind: 'func.y2h',
    seed,
    format: 'case',
    prompt: `You want to test whether proteins R and S interact using a GAL4 two-hybrid system: ${bait} is cloned in frame with the GAL4 DNA-binding domain in pGBKT7 (TRP1 marker) and ${prey} with the GAL4 activation domain in pGADT7 (LEU2 marker).`,
    parts: [part1, part2, part3, domainPart(rng, seed)],
    explanation: [],
  };
}

function domainPart(rng: Rng, seed: string): ChoiceQuestion {
  const lenR = 10 * rng.int(40, 70);
  const a = 10 * rng.int(15, Math.floor(lenR / 10) - 20);
  const b = a + 10 * rng.int(6, 10);
  const lo = a - 10 * rng.int(3, 8);
  const hi = b + 10 * rng.int(1, 4);
  const lenS = 10 * rng.int(45, 70);
  const cTerm = rng.chance(0.6);
  const sRegionStart = cTerm ? lenS - 10 * rng.int(10, 15) : 1;
  const sRegionEnd = cTerm ? lenS : 10 * rng.int(10, 15);
  const rRows = [
    ['Whole R', '+'],
    [`R 1–${hi}`, '+'],
    [`R 1–${lo}`, '−'],
    [`R ${hi + 1}–${lenR}`, '−'],
  ];
  const sRows = cTerm
    ? [
        ['Whole S', '+'],
        [`S 1–${sRegionStart - 10}`, '−'],
        [`S ${Math.round(sRegionStart / 2)}–${sRegionStart + 30}`, '−'],
        [`S ${sRegionStart}–${lenS}`, '+'],
      ]
    : [
        ['Whole S', '+'],
        [`S ${sRegionEnd + 10}–${lenS}`, '−'],
        [`S ${sRegionEnd - 30}–${Math.round((sRegionEnd + lenS) / 2)}`, '−'],
        [`S 1–${sRegionEnd}`, '+'],
      ];
  const sText = cTerm ? `the C-terminal end of S (${sRegionStart}–${lenS})` : `the N-terminal end of S (1–${sRegionEnd})`;
  const sWrong = cTerm ? `the N-terminal end of S` : `the C-terminal end of S`;
  return {
    kind: 'func.y2h',
    seed,
    format: 'choice',
    prompt: 'R and S interact. You test fragments of each protein against the other whole protein (+ = growth on the selective plate). What do you conclude?',
    visual: { type: 'table', head: ['Construct', 'Interaction'], rows: [...rRows, ...sRows] },
    options: rng.shuffle([
      { id: 'right', label: `The interacting regions lie between aa ${lo} and ${hi} of R and at ${sText}` },
      { id: 'sflip', label: `The interacting regions lie between aa ${lo} and ${hi} of R and at ${sWrong}` },
      { id: 'whole', label: 'Both whole proteins are needed for the interaction' },
      { id: 'rwrong', label: `The interacting regions lie between aa ${hi + 1} and ${lenR} of R and at ${sText}` },
    ]),
    correct: ['right'],
    explanation: [
      `R: 1–${hi} still interacts but 1–${lo} does not, so something essential lies between ${lo} and ${hi}; the C-terminal part (${hi + 1}–${lenR}) alone does not bind.`,
      `S: only the fragment ${cTerm ? `${sRegionStart}–${lenS}` : `1–${sRegionEnd}`} interacts, so the binding region is at ${sText}.`,
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// CRISPR screens

function crisprQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const drug = rng.chance(0.4);
  const [g1, g2] = rng.shuffle(['A', 'B', 'C', 'D']).slice(0, 2);
  if (drug) {
    const enriched = rng.chance(0.5);
    return {
      kind: 'func.crispr',
      seed,
      format: 'choice',
      prompt: `Cas9-expressing cancer cells were transduced with a genome-wide pooled gRNA library (one gRNA per cell) and treated with drug X for two weeks. Sequencing the surviving population shows that gRNAs targeting gene ${g1} are strongly ${enriched ? 'enriched' : 'depleted'} compared with untreated cells. What does this suggest?`,
      options: rng.shuffle([
        { id: 'enr', label: `Losing ${g1} makes cells resistant to drug X (${g1} is needed for the drug to act)` },
        { id: 'dep', label: `Losing ${g1} makes cells more sensitive to drug X (${g1} protects them from it)` },
        { id: 'ess', label: `${g1} is an essential gene in every condition` },
        { id: 'noexp', label: `${g1} is not expressed in these cells` },
      ]),
      correct: [enriched ? 'enr' : 'dep'],
      explanation: [
        'In a pooled screen each gRNA is a barcode of a knockout; its frequency after selection tells you how that knockout fared.',
        enriched
          ? `Enriched under drug = the knockout survives better: ${g1} is required for the drug's effect (for example its target pathway or its uptake).`
          : `Depleted under drug (compared with untreated) = the knockout dies more: ${g1} helps cells withstand the drug, a potential combination target.`,
      ],
    };
  }
  return {
    kind: 'func.crispr',
    seed,
    format: 'choice',
    prompt: `Cas9-expressing pancreatic cancer cells receive a genome-wide pooled gRNA library (one gRNA per cell). After two weeks of proliferation, gRNAs targeting gene ${g1} are strongly depleted and gRNAs targeting gene ${g2} strongly enriched compared with the starting library. What do you conclude?`,
    options: rng.shuffle([
      { id: 'right', label: `${g1} is required for proliferation/survival; ${g2} normally restrains proliferation (tumour-suppressor-like)` },
      { id: 'flip', label: `${g1} is a tumour suppressor; ${g2} is required for survival` },
      { id: 'none', label: `Neither ${g1} nor ${g2} affects growth` },
      { id: 'lethal', label: `${g1} is not expressed; knocking out ${g2} is lethal` },
    ]),
    correct: ['right'],
    explanation: [
      `Depleted gRNAs = cells with that knockout disappeared: ${g1} is needed for these cells to grow (an essential or dependency gene).`,
      `Enriched gRNAs = those knockouts out-grew the rest: ${g2} normally limits proliferation.`,
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// RNAi target validation

function rnaiQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const scenario = rng.pick(['selective', 'toxic', 'none', 'scrambled'] as const);
  const v = (x: number) => Math.round(x + rng.float(-3, 3));
  const normal = { ctrl: 100, scr: v(97), si: scenario === 'selective' || scenario === 'none' ? v(92) : v(15) };
  const tumour = { ctrl: 100, scr: v(98), si: scenario === 'none' ? v(94) : v(14) };
  if (scenario === 'scrambled') {
    normal.scr = v(40);
    tumour.scr = v(38);
  }
  const answer = ({ selective: 'good', toxic: 'toxic', none: 'notneeded', scrambled: 'control' } as const)[scenario];
  return {
    kind: 'func.rnai',
    seed,
    format: 'choice',
    prompt: 'Gene A was knocked down by RNAi in normal pancreatic epithelial cells and in pancreatic cancer cells, with a scrambled siRNA as control. Proliferation is shown relative to untreated cells. Is gene A a promising drug target?',
    visual: {
      type: 'bars',
      unit: '% growth',
      reference: 100,
      bars: [
        { label: 'Normal', value: normal.ctrl },
        { label: 'Normal + scrambled', value: normal.scr },
        { label: 'Normal + siRNA A', value: normal.si },
        { label: 'Tumour', value: tumour.ctrl },
        { label: 'Tumour + scrambled', value: tumour.scr },
        { label: 'Tumour + siRNA A', value: tumour.si },
      ],
    },
    options: rng.shuffle([
      { id: 'good', label: 'Yes: knocking it down stops tumour cells but spares normal cells' },
      { id: 'toxic', label: 'No: normal cells need it too, so a drug would be toxic' },
      { id: 'notneeded', label: 'No: neither cell type needs it to proliferate' },
      { id: 'control', label: 'Cannot conclude: the scrambled control already reduces growth' },
    ]),
    correct: [answer],
    explanation: [
      'Compare each siRNA with its own scrambled control (which accounts for transfection itself), and tumour with normal cells.',
      {
        good: 'Only the tumour cells collapse: a selective dependency — exactly what you want from a drug target.',
        toxic: 'Both normal and tumour cells stop growing: gene A is a general essential gene; inhibiting it would harm healthy tissue too.',
        notneeded: 'Growth barely changes in either cell type: gene A is not required (check the knockdown efficiency by qPCR or Western first).',
        control: 'The scrambled siRNA alone kills cells, so transfection itself is toxic here: the experiment needs to be repeated before drawing conclusions.',
      }[answer],
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Reporter assays (promoter bashing)

function reporterCase(rng: Rng, seed: string): CaseQuestion {
  const ends = [3000, 1500, 800, 300, 100].map((x) => x + 10 * rng.int(-5, 5));
  // Intervals between consecutive construct ends; put an enhancer in one and a silencer in another.
  const intervals = ends.slice(0, -1).map((e, i) => [ends[i + 1], e] as [number, number]);
  const [enh, sil] = rng.sample([0, 1, 2, 3], 2);
  const enhFactor = rng.pick([3, 4, 5]);
  const silFactor = rng.pick([0.25, 0.3, 0.4]);
  const base = rng.int(4, 7);
  const activity = ends.map((e) => {
    let a = base;
    if (e >= intervals[enh][1]) a *= enhFactor;
    if (e >= intervals[sil][1]) a *= silFactor;
    return Math.round(a * 10) / 10;
  });
  const region = (i: number) => `−${intervals[i][1]} to −${intervals[i][0]}`;
  const effect = rng.pick([0.62, 0.74, 0.81, 1.35, 1.6]);

  const tech: ChoiceQuestion = {
    kind: 'func.reporter',
    seed,
    format: 'choice',
    prompt: 'Which technique is this?',
    options: rng.shuffle([
      { id: 'right', label: 'Reporter (luciferase) assay with 5′ deletions — promoter bashing' },
      { id: 'qpcr', label: 'RT-qPCR of the endogenous gene' },
      { id: 'chip', label: 'Chromatin immunoprecipitation' },
      { id: 'y2h', label: 'Yeast one-hybrid' },
    ]),
    correct: ['right'],
    explanation: [
      'Fragments of the 5′ region of decreasing length are cloned upstream of a reporter gene (firefly luciferase) and transfected; light output measures how strongly each fragment drives transcription.',
    ],
  };
  const which = rng.chance(0.5) ? 'silencer' : 'enhancer';
  const target = which === 'silencer' ? sil : enh;
  const regionQ: ChoiceQuestion = {
    kind: 'func.reporter',
    seed,
    format: 'choice',
    prompt: `Which region contains ${which === 'silencer' ? 'a repressor (silencer) element' : 'an activating (enhancer) element'}?`,
    options: intervals.map((_, i) => ({ id: String(i), label: region(i) })),
    correct: [String(target)],
    explanation: [
      'Compare consecutive constructs: removing a region that contains an activator lowers the activity; removing a repressor element raises it.',
      ...intervals.map((_, i) => {
        const longer = activity[i];
        const shorter = activity[i + 1];
        return `${region(i)}: removing it changes the activity ${trimNumber(longer, 1)} → ${trimNumber(shorter, 1)}${i === enh ? ' (drops: enhancer)' : i === sil ? ' (rises: silencer)' : ' (no change)'}.`;
      }),
    ],
  };
  const pct: NumericQuestion = {
    kind: 'func.reporter',
    seed,
    format: 'numeric',
    prompt: `A patient variant introduced into the longest construct gives ${effect} times the activity of the wild-type construct. By what percentage does the variant change promoter activity? (negative = decrease)`,
    answer: Math.round((effect - 1) * 100),
    unit: '%',
    tolerance: 0,
    absTolerance: 1,
    answerLabel: `${effect > 1 ? '+' : ''}${Math.round((effect - 1) * 100)}%`,
    explanation: [`(${effect} − 1) × 100 = ${Math.round((effect - 1) * 100)}%: the variant ${effect < 1 ? 'reduces' : 'increases'} expression${effect < 1 ? ' — for example by weakening an enhancer element' : ''}.`],
  };
  return {
    kind: 'func.reporter',
    seed,
    format: 'case',
    prompt: 'Progressively shorter fragments of the 5′ region of a gene (from the indicated position to the transcription start) were cloned upstream of a luciferase gene and transfected into cells.',
    visual: {
      type: 'bars',
      unit: 'relative luciferase activity',
      bars: ends.map((e, i) => ({ label: `−${e}`, value: activity[i] })),
      caption: 'Each bar: construct starting at the position shown (bp upstream of the TSS).',
    },
    parts: [tech, regionQ, pct],
    explanation: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Recognising techniques

const TECHNIQUES = [
  {
    id: 'qpcr',
    name: 'RT-qPCR',
    data: 'A bar chart of "target mRNA / rRNA (fold change vs. cell line 1)" for ten cell lines, with error bars.',
    follow: { q: 'Why is the mRNA divided by rRNA (or GAPDH)?', a: 'To normalise for how much RNA/cDNA went into each reaction', wrong: ['To convert mRNA into protein levels', 'To remove genomic DNA', 'To make the bars fit on the axis'] },
  },
  {
    id: 'western',
    name: 'Western blot',
    data: 'Bands from cell extracts detected with antibodies against E-cadherin and N-cadherin, plus a β-actin band of equal intensity in every lane.',
    follow: { q: 'What is the β-actin band for?', a: 'A loading control: it shows that the same amount of protein was loaded in each lane', wrong: ['A size marker', 'A positive control for the antibody against cadherin', 'It is the secondary antibody'] },
  },
  {
    id: 'if',
    name: 'Immunofluorescence (in situ immunodetection)',
    data: 'Microscope images: a green protein signal at the cell membranes, blue nuclei stained with DAPI.',
    follow: { q: 'What does DAPI (or Hoechst) stain?', a: 'DNA, so it marks the nuclei', wrong: ['Membrane proteins', 'Microtubules', 'mRNA'] },
  },
  {
    id: 'reporter',
    name: 'Reporter (luciferase) assay',
    data: 'Bars of relative luciferase activity for constructs carrying 3078, 1483 or 200 bp of a gene’s 5′ region.',
    follow: { q: 'What does each construct contain?', a: 'A fragment of the regulatory region cloned upstream of the luciferase gene', wrong: ['The full coding sequence fused to GFP', 'An siRNA against luciferase', 'A gRNA targeting the promoter'] },
  },
  {
    id: 'northern',
    name: 'Northern blot',
    data: 'RNA from five tissues run on a denaturing gel, transferred to a membrane and hybridised with a labelled probe: one band of 2.1 kb in three lanes.',
    follow: { q: 'What does a band in one tissue tell you?', a: 'That the gene is transcribed there, and the size of its mRNA', wrong: ['The size of the protein', 'The number of copies of the gene in the genome', 'Where the protein localises in the cell'] },
  },
  {
    id: 'southern',
    name: 'Southern blot',
    data: 'Genomic DNA digested with EcoRI, run on agarose, transferred and hybridised with a labelled probe: one band of 3.6 kb.',
    follow: { q: 'Why is the band larger than the probe?', a: 'The band is the whole restriction fragment the probe hybridises to', wrong: ['The probe is degraded', 'The DNA was not fully digested', 'Introns are added during transfer'] },
  },
  {
    id: 'crispr',
    name: 'Pooled CRISPR knockout screen',
    data: 'Read counts of each gRNA in the library before and after two weeks of growth; some gRNAs are depleted, others enriched.',
    follow: { q: 'What does a depleted gRNA mean?', a: 'Cells with that knockout grew worse: the gene is needed for proliferation/survival', wrong: ['The gRNA was not cloned', 'The gene is a tumour suppressor', 'Cas9 was not expressed'] },
  },
  {
    id: 'y2h',
    name: 'Yeast two-hybrid',
    data: 'Yeast colonies carrying bait and prey plasmids grow on −Trp −Leu but only some grow on −Trp −Leu −His.',
    follow: { q: 'Why do some colonies grow without histidine?', a: 'Bait and prey interact, reconstituting GAL4 and switching on the HIS3 reporter', wrong: ['They lost the bait plasmid', 'They are contaminating bacteria', 'Histidine is made by the prey protein'] },
  },
];

function techniqueQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const t = rng.pick(TECHNIQUES);
  if (rng.chance(0.5)) {
    const others = rng.sample(TECHNIQUES.filter((x) => x !== t), 3);
    return {
      kind: 'func.technique',
      seed,
      format: 'choice',
      prompt: `Which technique produced these data? ${t.data}`,
      options: rng.shuffle([t, ...others]).map((x) => ({ id: x.id, label: x.name })),
      correct: [t.id],
      explanation: [`${t.name}: ${t.follow.q} ${t.follow.a}.`],
    };
  }
  const options: ChoiceOption[] = rng.shuffle([
    { id: 'right', label: t.follow.a },
    ...t.follow.wrong.map((w, i) => ({ id: `w${i}`, label: w })),
  ]);
  return {
    kind: 'func.technique',
    seed,
    format: 'choice',
    prompt: `${t.data} (${t.name}.) ${t.follow.q}`,
    options,
    correct: ['right'],
    explanation: [`${t.follow.a}.`],
  };
}
