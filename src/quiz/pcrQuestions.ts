/** Mode 4 — PCR calculator challenges. */

import { atCount, complement, gcCount, randomSequence, randomSequenceAvoiding, reverse, reverseComplement } from '../science/dna';
import { getEnzyme } from '../science/enzymes';
import { formatInt, formatSci, superscript } from '../science/format';
import {
  analyzePrimerPair,
  annealingTemp,
  copiesAfterCycles,
  designCloningPrimers,
  HUMAN_GENOME_BP,
  PRIMER_ISSUE_LABEL,
  PRIMER_RULES,
  type PrimerIssue,
  wallaceTm,
} from '../science/pcr';
import { createRng, type Rng } from '../science/rng';
import type { ChoiceQuestion, NumericQuestion, Question } from './types';

export type PcrKind = 'tm' | 'badpair' | 'cycles' | 'product' | 'reverse' | 'design';
export const PCR_KINDS: PcrKind[] = ['tm', 'badpair', 'cycles', 'product', 'reverse', 'design'];

/** Brown Figure 9.9. */
export const BROWN_PRIMER = 'AGACTCAGAGAGAACCC';

export function generatePcrQuestion(seed: string, kind?: PcrKind): Question {
  const rng = createRng(`pcr/${seed}`);
  const k = kind ?? rng.pick(PCR_KINDS);
  switch (k) {
    case 'tm':
      return tmQuestion(rng, seed);
    case 'badpair':
      return badPairQuestion(rng, seed);
    case 'cycles':
      return cyclesQuestion(rng, seed);
    case 'product':
      return productQuestion(rng, seed);
    case 'reverse':
      return reversePrimerQuestion(rng, seed);
    case 'design':
      return designQuestion(rng, seed);
  }
}

/** Step-by-step Wallace-rule working, as in Brown Fig. 9.9. */
export function tmWorking(primer: string): string {
  const count = (b: string) => primer.split('').filter((x) => x === b).length;
  const gc = gcCount(primer);
  const at = atCount(primer);
  return `${count('G')} G + ${count('C')} C = ${gc} G+C; ${count('A')} A + ${count('T')} T = ${at} A+T. Tm = (4 × ${gc}) + (2 × ${at}) = ${4 * gc} + ${2 * at} = ${wallaceTm(primer)} °C.`;
}

function tmQuestion(rng: Rng, seed: string): NumericQuestion {
  const primer = rng.chance(0.15) ? BROWN_PRIMER : randomSequence(rng, rng.int(16, 24), rng.float(0.35, 0.65));
  const tm = wallaceTm(primer);
  const askTa = rng.chance(0.35);
  const base = {
    kind: 'pcr.tm',
    seed,
    format: 'numeric' as const,
    unit: '°C',
    visual: { type: 'sequence' as const, rows: [{ label: 'primer', seq: primer, primes: true }] },
    placeholder: 'e.g. 56',
  };
  if (askTa) {
    return {
      ...base,
      prompt: 'Using the Wallace rule, what annealing temperature would you use for this primer?',
      answer: annealingTemp(tm),
      tolerance: 0,
      absTolerance: 1,
      answerLabel: `${annealingTemp(tm)} °C (Tm ${tm} °C − 2 °C)`,
      explanation: [
        tmWorking(primer),
        `Anneal 1–2 °C below the Tm: about ${tm} − 2 = ${annealingTemp(tm)} °C. Low enough for the perfectly matched primer to bind, but too high for a hybrid with a mismatch to be stable (Brown §9.2.2).`,
      ],
    };
  }
  return {
    ...base,
    prompt: 'What is the Tm of this primer according to the Wallace rule, Tm = 4(G+C) + 2(A+T)?',
    answer: tm,
    tolerance: 0,
    absTolerance: 0,
    answerLabel: `${tm} °C`,
    explanation: [
      tmWorking(primer),
      primer === BROWN_PRIMER
        ? 'This is the worked example from Brown (Figure 9.9), a primer for the human α1-globin gene: 52 °C.'
        : 'Count the G and C (three hydrogen bonds each, 4 °C) and the A and T (two hydrogen bonds each, 2 °C).',
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Spot the bad primer pair

type Defect = PrimerIssue | 'none';
const DEFECTS: Defect[] = ['none', 'tm-mismatch', 'gc-content', 'no-gc-clamp', 'self-complementary', 'primer-dimer', 'too-short'];

/** Random primer with exactly `gc` G/C bases, ending in G/C (`clamp`) or A/T. */
export function makePrimer(rng: Rng, length: number, gc: number, clamp = true): string {
  const last = clamp ? rng.pick(['G', 'C']) : rng.pick(['A', 'T']);
  const gcRest = gc - (clamp ? 1 : 0);
  const slots = rng.shuffle([...Array(gcRest).fill('S'), ...Array(length - 1 - gcRest).fill('W')]);
  return slots.map((s) => (s === 'S' ? rng.pick(['G', 'C']) : rng.pick(['A', 'T']))).join('') + last;
}

function balancedPrimer(rng: Rng, length: number, clamp = true): string {
  const gc = Math.round(length * rng.float(0.42, 0.58));
  // makePrimer needs room for the 3′ base of the requested class.
  return makePrimer(rng, length, Math.min(Math.max(gc, clamp ? 1 : 0), clamp ? length : length - 1), clamp);
}

function candidatePair(rng: Rng, defect: Defect): [string, string] {
  const len = rng.int(18, 22);
  switch (defect) {
    case 'none':
    case 'primer-dimer':
    case 'self-complementary':
      break;
    case 'tm-mismatch':
      return [balancedPrimer(rng, rng.int(17, 19)), balancedPrimer(rng, rng.int(25, 28))];
    case 'gc-content': {
      const low = rng.chance(0.5);
      const n = low ? rng.int(21, 25) : rng.int(16, 18);
      const gc = Math.round(n * (low ? rng.float(0.25, 0.35) : rng.float(0.68, 0.75)));
      const odd = makePrimer(rng, n, gc, true);
      return rng.shuffle([odd, balancedPrimer(rng, len)]) as [string, string];
    }
    case 'no-gc-clamp':
      return rng.shuffle([balancedPrimer(rng, len, false), balancedPrimer(rng, len)]) as [string, string];
    case 'too-short':
      return [balancedPrimer(rng, rng.int(10, 13)), balancedPrimer(rng, rng.int(10, 13))];
  }
  const f = balancedPrimer(rng, len);
  if (defect === 'none') return [f, balancedPrimer(rng, len + rng.int(-1, 1))];
  if (defect === 'primer-dimer') {
    // Reverse primer's 3′ end = reverse complement of the forward primer's 3′ end.
    const k = rng.int(5, 6);
    const tail = reverseComplement(f.slice(-k));
    return [f, balancedPrimer(rng, len - k) + tail];
  }
  // Self-complementary: the 3′ end folds back onto an earlier stretch of the same primer.
  const k = rng.int(5, 6);
  const stem = makePrimer(rng, k, Math.round(k * 0.6), true).split('').reverse().join('');
  const loop = randomSequence(rng, rng.int(3, 5));
  const prefix = balancedPrimer(rng, len - 2 * k - loop.length, true);
  return [prefix + stem + loop + reverseComplement(stem), balancedPrimer(rng, len)];
}

export function makeBadPair(rng: Rng, defect: Defect): [string, string] {
  for (let i = 0; i < 5000; i++) {
    const [f, r] = candidatePair(rng, defect);
    const issues = analyzePrimerPair(f, r).issues;
    if (defect === 'none' ? issues.length === 0 : issues.length === 1 && issues[0] === defect) return [f, r];
  }
  throw new Error(`Could not build a primer pair with defect ${defect}`);
}

function badPairQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const defect = rng.pick(DEFECTS);
  const [f, r] = makeBadPair(rng, defect);
  const a = analyzePrimerPair(f, r);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return {
    kind: 'pcr.badpair',
    seed,
    format: 'choice',
    prompt: `These primers are meant to amplify a single gene from human genomic DNA (${formatSci(HUMAN_GENOME_BP, 2)} bp). What is wrong with the pair?`,
    visual: {
      type: 'sequence',
      rows: [
        { label: 'forward', seq: f, primes: true },
        { label: 'reverse', seq: r, primes: true },
      ],
    },
    revealVisual: {
      type: 'facts',
      rows: [
        ['', 'forward · reverse'],
        ['Length', `${f.length} · ${r.length} nt`],
        ['GC content', `${pct(a.forward.gc)} · ${pct(a.reverse.gc)}`],
        ['Tm (Wallace)', `${a.forward.tm} · ${a.reverse.tm} °C`],
        ['3′ base', `${f.slice(-1)} · ${r.slice(-1)}`],
        ['3′ self-complementarity', `${a.forward.self} · ${a.reverse.self} nt`],
        ['3′ complementarity between primers', `${a.dimer} nt`],
      ],
    },
    options: [
      ...(Object.keys(PRIMER_ISSUE_LABEL) as PrimerIssue[]).map((id) => ({ id, label: PRIMER_ISSUE_LABEL[id] })),
      { id: 'none', label: 'Nothing: this is a good pair' },
    ],
    correct: [defect],
    explanation: [
      ...(a.notes.length ? a.notes : ['Both primers pass every check.']),
      `Checklist: similar Tm (within ${PRIMER_RULES.maxTmDifference} °C), 40–60% GC, a G or C at the 3′ end, no 3′ complementarity with itself or with the partner (≥ ${PRIMER_RULES.maxComplementarity + 1} nt counts here), and long enough to be unique: a 17-mer occurs once every 4¹⁷ ≈ 1.7 × 10¹⁰ bp, more than five times the human genome.`,
    ],
  };
}

// ---------------------------------------------------------------------------------------------

function cyclesQuestion(rng: Rng, seed: string): NumericQuestion {
  if (rng.chance(0.3)) {
    const target = rng.pick([1e6, 1e8, 1e9, 1e10, 1e12]);
    const n = Math.ceil(Math.log2(target));
    const exp = Math.round(Math.log10(target));
    return {
      kind: 'pcr.cycles',
      seed,
      format: 'numeric',
      prompt: `Starting from a single template molecule, how many cycles are needed to obtain at least 10${superscript(exp)} copies (assuming perfect doubling)?`,
      answer: n,
      unit: 'cycles',
      tolerance: 0,
      absTolerance: 0,
      answerLabel: `${n} cycles`,
      explanation: [
        `After n cycles there are 2ⁿ copies, so we need 2ⁿ ≥ 10${superscript(exp)}, i.e. n ≥ log₂(10${superscript(exp)}) = ${exp} × log₂10 ≈ ${(exp * Math.log2(10)).toFixed(2)}.`,
        `Round up: ${n} cycles (2${superscript(n)} = ${formatSci(2 ** n)}; 2${superscript(n - 1)} = ${formatSci(2 ** (n - 1))} is not enough).`,
      ],
    };
  }
  const n = rng.int(20, 35);
  const start = rng.pick([1, 1, 1, 10, 100, 1000]);
  const copies = copiesAfterCycles(n, start);
  return {
    kind: 'pcr.cycles',
    seed,
    format: 'numeric',
    prompt: `A PCR starts from ${start === 1 ? 'a single double-stranded template molecule' : `${formatInt(start)} template molecules`}. How many copies of the target are there after ${n} cycles (assuming perfect doubling)?`,
    answer: copies,
    unit: 'copies',
    tolerance: 0.03,
    answerLabel: `${formatSci(copies)} copies`,
    placeholder: 'e.g. 1.07e9 or 1.07x10^9',
    explanation: [
      `Each cycle doubles the number of target molecules, so after n cycles: N = N₀ × 2ⁿ = ${start === 1 ? '' : `${formatInt(start)} × `}2${superscript(n)} = ${formatSci(copies)}.`,
      'Handy anchor: 2¹⁰ ≈ 10³, so 2³⁰ ≈ 10⁹ (exactly 1.07 × 10⁹). In a real PCR the efficiency drops in late cycles (plateau), so this is an upper limit.',
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Products and primers from a template

interface Template {
  seq: string;
  start: number;
  end: number;
  forward: string;
  reverse: string;
}

/** Template with a unique forward primer site and a unique reverse primer site. */
function makeTemplate(rng: Rng, primerLength = 18): Template {
  for (let i = 0; i < 1000; i++) {
    const length = rng.int(72, 96);
    const seq = randomSequence(rng, length);
    const start = rng.int(3, 12);
    const end = length - rng.int(3, 12);
    const forward = seq.slice(start, start + primerLength);
    const bindR = seq.slice(end - primerLength, end);
    const reverse = reverseComplement(bindR);
    const unique = (s: string) => seq.indexOf(s) === seq.lastIndexOf(s) && !seq.includes(reverseComplement(s));
    if (unique(forward) && unique(bindR) && /[GC]$/.test(forward) && /[GC]$/.test(reverse)) {
      return { seq, start, end, forward, reverse };
    }
  }
  throw new Error('Could not build a PCR template');
}

function productQuestion(rng: Rng, seed: string): NumericQuestion {
  const t = makeTemplate(rng);
  const length = t.end - t.start;
  return {
    kind: 'pcr.product',
    seed,
    format: 'numeric',
    prompt: 'The top strand of a template is shown 5′→3′, with the two primers below. How long (in bp) is the PCR product?',
    visual: {
      type: 'sequence',
      wrap: true,
      rows: [
        { label: 'template', seq: t.seq, primes: true },
        { label: 'forward', seq: t.forward, primes: true },
        { label: 'reverse', seq: t.reverse, primes: true },
      ],
    },
    revealVisual: {
      type: 'sequence',
      wrap: true,
      rows: [
        {
          label: 'template',
          seq: t.seq,
          primes: true,
          highlights: [
            { from: t.start, to: t.start + t.forward.length, tone: 'teal', label: 'forward' },
            { from: t.start + t.forward.length, to: t.end - t.reverse.length, tone: 'amber' },
            { from: t.end - t.reverse.length, to: t.end, tone: 'coral', label: 'rev. compl. of reverse' },
          ],
        },
      ],
    },
    answer: length,
    unit: 'bp',
    tolerance: 0,
    absTolerance: 0,
    answerLabel: `${length} bp`,
    explanation: [
      `The forward primer matches the top strand directly: it starts at position ${t.start + 1}.`,
      `The reverse primer anneals to the bottom strand, so look for its reverse complement in the top strand: 5′-${reverseComplement(t.reverse)}-3′, which ends at position ${t.end}.`,
      `The product runs from the 5′ end of one primer to the 5′ end of the other, primers included: ${t.end} − ${t.start + 1} + 1 = ${length} bp. Everything outside the primers is not amplified.`,
    ],
  };
}

function reversePrimerQuestion(rng: Rng, seed: string): ChoiceQuestion {
  for (let i = 0; i < 100; i++) {
    const t = makeTemplate(rng);
    const bind = t.seq.slice(t.end - 18, t.end);
    const options = [
      { id: 'rc', label: reverseComplement(bind), note: 'Correct: the reverse complement of the top strand at the right-hand end.' },
      { id: 'same', label: bind, note: 'This is just the top strand: identical to the template, so it cannot anneal to it, and it points the wrong way.' },
      { id: 'comp', label: complement(bind), note: 'Complemented but not reversed: this is the right strand read 3′→5′, written as if it were 5′→3′.' },
      { id: 'rev', label: reverse(bind), note: 'Reversed but not complemented: it is not complementary to either strand.' },
    ];
    if (new Set(options.map((o) => o.label)).size < 4) continue;
    return {
      kind: 'pcr.reverse',
      seed,
      format: 'choice',
      prompt:
        'You want to amplify the highlighted region of this template (top strand shown 5′→3′). Which is the correct reverse primer, written 5′→3′?',
      visual: {
        type: 'sequence',
        wrap: true,
        rows: [
          {
            label: 'template',
            seq: t.seq,
            primes: true,
            highlights: [
              { from: t.start, to: t.end - 18, tone: 'amber' },
              { from: t.end - 18, to: t.end, tone: 'coral' },
            ],
          },
          { label: 'forward', seq: t.forward, primes: true },
        ],
      },
      options: rng.shuffle(options).map((o) => ({ ...o, label: `5′-${o.label}-3′`, mono: true })),
      correct: ['rc'],
      explanation: [
        'The reverse primer must anneal to the top strand at the right-hand end of the region and be extended leftwards (5′→3′ on the bottom strand).',
        `So it has the sequence of the BOTTOM strand there: take the top-strand sequence \`${bind}\`, complement it (\`${complement(bind)}\`, still reading 3′→5′) and reverse it to write it 5′→3′: \`${reverseComplement(bind)}\`.`,
      ],
    };
  }
  throw new Error('Could not build a reverse-primer question');
}

const CLONING_PAIRS: [string, string][] = [
  ['NotI', 'XhoI'],
  ['EcoRI', 'HindIII'],
  ['BamHI', 'XhoI'],
  ['BamHI', 'EcoRI'],
];

const EXTRA_BASES = ['GCGC', 'ATCG', 'TTAG', 'CGAT', 'GAGA', 'ATAAGA'];

/** A short ORF: ATG + random sense codons + a stop codon. */
function makeOrf(rng: Rng, codons: number, forbidden: string[]): string {
  const bases = ['A', 'C', 'G', 'T'];
  for (let i = 0; i < 500; i++) {
    let orf = 'ATG';
    while (orf.length < 3 * (codons + 1)) {
      const c = rng.pick(bases) + rng.pick(bases) + rng.pick(bases);
      if (!['TAA', 'TAG', 'TGA'].includes(c)) orf += c;
    }
    orf += rng.pick(['TAA', 'TAG', 'TGA']);
    if (forbidden.every((m) => !orf.includes(m))) return orf;
  }
  throw new Error('Could not build an ORF');
}

function designQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const [e5, e3] = rng.pick(CLONING_PAIRS);
  const sites = [getEnzyme(e5).site, getEnzyme(e3).site];
  const extra = rng.pick(EXTRA_BASES);
  for (let i = 0; i < 200; i++) {
    const orf = makeOrf(rng, rng.int(14, 18), sites);
    const left = randomSequenceAvoiding(rng, 6, sites);
    const right = randomSequenceAvoiding(rng, 6, sites);
    const template = left + orf + right;
    if (sites.some((s) => template.includes(s))) continue;
    const start = left.length;
    const end = left.length + orf.length;
    const p = designCloningPrimers(template, start, end, e5, e3, 18, extra);
    const fA = p.forwardParts.anneal;
    const rA = p.reverseParts.anneal;
    const s5 = p.forwardParts.site;
    const s3 = p.reverseParts.site;
    const all = [
      { id: 'correct', f: p.forward, r: p.reverse, note: `Correct: 5′-extra bases-${e5} site-annealing sequence-3′ on the forward primer, and the same layout with ${e3} on the reverse primer, whose annealing part is the reverse complement of the end of the gene.` },
      { id: 'not-rc', f: p.forward, r: extra + s3 + reverseComplement(rA), note: 'The reverse primer copies the top strand instead of its reverse complement, so it cannot anneal to the template.' },
      { id: 'three-prime', f: fA + s5, r: rA + s3, note: 'The sites are at the 3′ ends. The 3′ end must be the part that anneals, or the polymerase has nothing to extend; added tails always go at the 5′ end.' },
      { id: 'no-extra', f: s5 + fA, r: s3 + rA, note: 'Sites placed right at the very end of the primer: most enzymes cut very poorly when their site is at the end of a DNA molecule, so a few extra bases are added in front.' },
      { id: 'swapped', f: extra + s3 + fA, r: extra + s5 + rA, note: `Sites swapped: ${e3} would end up at the start of the gene and ${e5} at its end — the opposite of what was asked.` },
    ];
    const options = [all[0], ...rng.sample(all.slice(1), 3)];
    if (new Set(options.map((o) => o.f + o.r)).size < 4) continue;
    return {
      kind: 'pcr.design',
      seed,
      format: 'choice',
      prompt: `You want to amplify the open reading frame (highlighted) and add a restriction site for ${e5} at its 5′ end (start codon side) and one for ${e3} at its 3′ end, for cloning. Which primer pair is correctly designed?`,
      detail: `${e5} site: ${getEnzyme(e5).site} · ${e3} site: ${getEnzyme(e3).site}. Neither enzyme cuts inside the gene.`,
      visual: {
        type: 'sequence',
        wrap: true,
        rows: [{ label: 'template', seq: template, primes: true, highlights: [{ from: start, to: end, tone: 'amber' }] }],
      },
      revealVisual: {
        type: 'sequence',
        rows: [
          {
            label: 'forward',
            seq: p.forward,
            primes: true,
            highlights: [
              { from: 0, to: extra.length, tone: 'muted', label: 'extra' },
              { from: extra.length, to: extra.length + s5.length, tone: 'coral', label: e5 },
              { from: extra.length + s5.length, to: p.forward.length, tone: 'teal', label: 'anneals' },
            ],
          },
          {
            label: 'reverse',
            seq: p.reverse,
            primes: true,
            highlights: [
              { from: 0, to: extra.length, tone: 'muted', label: 'extra' },
              { from: extra.length, to: extra.length + s3.length, tone: 'coral', label: e3 },
              { from: extra.length + s3.length, to: p.reverse.length, tone: 'teal', label: 'anneals' },
            ],
          },
        ],
      },
      options: rng.shuffle(options).map((o) => ({ id: o.id, label: `F 5′-${o.f}-3′\nR 5′-${o.r}-3′`, mono: true, note: o.note })),
      correct: ['correct'],
      explanation: [
        'A cloning primer has three parts, 5′→3′: a few extra bases (so the enzyme can bind and cut near the end of the product), the restriction site, and 18–25 nt that anneal to the template. Only the 3′ annealing part needs to match; the 5′ tail is simply copied into the product.',
        `The reverse primer's annealing part is the reverse complement of the last ${rA.length} nt of the gene (\`${template.slice(end - rA.length, end)}\` → \`${rA}\`).`,
        'Before choosing the enzymes, check that neither cuts inside the gene — otherwise the insert would be cut too.',
      ],
    };
  }
  throw new Error('Could not build a primer-design question');
}
