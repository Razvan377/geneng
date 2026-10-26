/**
 * Cloning strategy: get a gene out of a fragment and into an expression vector in the right
 * orientation, deal with incompatible sites (blunting), select recombinants, design primers when
 * the gene is drawn backwards, and keep the RBS–ATG spacing with NdeI.
 */

import { randomSequence, randomSequenceAvoiding, reverseComplement } from '../science/dna';
import { endKind, getEnzyme, overhang } from '../science/enzymes';
import { createRng, type Rng } from '../science/rng';
import type { CaseQuestion, ChoiceOption, ChoiceQuestion, Question } from './types';

export type CloningKind = 'plac' | 'rescue' | 'blunt' | 'select' | 'primers' | 'rbs';
export const CLONING_KINDS: CloningKind[] = ['plac', 'rescue', 'blunt', 'select', 'primers', 'rbs'];

export function generateCloningQuestion(seed: string, kind?: CloningKind): Question {
  const rng = createRng(`clone/${seed}`);
  const k = kind ?? rng.pick(CLONING_KINDS);
  switch (k) {
    case 'plac':
      return placCase(rng, seed);
    case 'rescue':
      return rescueQuestion(rng, seed);
    case 'blunt':
      return bluntQuestion(rng, seed);
    case 'select':
      return selectQuestion(rng, seed);
    case 'primers':
      return primersQuestion(rng, seed);
    case 'rbs':
      return rbsQuestion(rng, seed);
  }
}

/** pUC multiple cloning sites, listed from the lac promoter outwards (lacZα reading direction). */
export const PUC_FROM_PROMOTER: Record<'pUC18' | 'pUC19', string[]> = {
  pUC18: ['EcoRI', 'SacI', 'KpnI', 'SmaI', 'BamHI', 'XbaI', 'SalI', 'PstI', 'SphI', 'HindIII'],
  pUC19: ['HindIII', 'SphI', 'PstI', 'SalI', 'XbaI', 'BamHI', 'SmaI', 'KpnI', 'SacI', 'EcoRI'],
};

const MCS_ENZYMES = PUC_FROM_PROMOTER.pUC19.filter((e) => e !== 'SmaI');
const NON_MCS = ['BglII', 'XhoI', 'NcoI', 'NotI'];

/** Klenow fills in 5′ overhangs; 3′ overhangs must be trimmed (T4 DNA polymerase or S1 nuclease). */
export function bluntingStep(enzyme: string): string {
  const k = endKind(getEnzyme(enzyme));
  if (k === 'blunt') return 'nothing (already blunt)';
  return k === '5prime' ? 'Klenow fill-in (+ dNTPs)' : 'T4 DNA polymerase (3′→5′ exonuclease) or S1 nuclease';
}

// ---------------------------------------------------------------------------------------------
// Subcloning under Plac (case)

export interface FragmentMap {
  length: number;
  gene: { from: number; to: number; dir: 1 | -1; name: string };
  sites: { enzyme: string; pos: number }[];
}

function placCase(rng: Rng, seed: string): CaseQuestion {
  for (let attempt = 0; attempt < 600; attempt++) {
    const length = 100 * rng.int(45, 70);
    const gFrom = 100 * rng.int(12, 18);
    const gTo = gFrom + 100 * rng.int(10, 20);
    if (gTo > length - 1000) continue;
    const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
    const pool = rng.shuffle([...MCS_ENZYMES, ...rng.sample(NON_MCS, 2)]);
    const inside = pool.slice(0, rng.int(1, 2));
    const leftOnly = pool.slice(2, 4);
    const rightOnly = pool.slice(4, 6);
    const both = rng.chance(0.5) ? [pool[6]] : [];
    const sites: { enzyme: string; pos: number }[] = [];
    const used = new Set<number>();
    const place = (enzyme: string, lo: number, hi: number) => {
      for (let t = 0; t < 50; t++) {
        const pos = 100 * rng.int(Math.ceil(lo / 100), Math.floor(hi / 100));
        if ([...used].every((u) => Math.abs(u - pos) >= 200)) {
          used.add(pos);
          sites.push({ enzyme, pos });
          return true;
        }
      }
      return false;
    };
    let ok = true;
    for (const e of inside) ok &&= place(e, gFrom + 200, gTo - 200);
    for (const e of leftOnly) ok &&= place(e, 200, gFrom - 200);
    for (const e of rightOnly) ok &&= place(e, gTo + 200, length - 200);
    for (const e of both) ok &&= place(e, 200, gFrom - 200) && place(e, gTo + 200, length - 200);
    if (!ok) continue;

    // Which side holds the gene's 5′ end?
    const fivePrime = dir === 1 ? leftOnly : rightOnly;
    const threePrime = dir === 1 ? rightOnly : leftOnly;
    const usable5 = fivePrime.filter((e) => MCS_ENZYMES.includes(e));
    const usable3 = threePrime.filter((e) => MCS_ENZYMES.includes(e));
    if (!usable5.length || !usable3.length) continue;
    const x = usable5[0];
    const y = usable3[0];
    const vector = PUC_FROM_PROMOTER.pUC18.indexOf(x) < PUC_FROM_PROMOTER.pUC18.indexOf(y) ? 'pUC18' : 'pUC19';
    const other = vector === 'pUC18' ? 'pUC19' : 'pUC18';

    const insideEnzyme = inside[0];
    const nonMcs = [...fivePrime, ...threePrime].find((e) => !MCS_ENZYMES.includes(e));
    const pairOptions: ChoiceOption[] = [
      { id: 'right', label: `${x} (5′ end) + ${y} (3′ end), into ${vector}`, note: `Correct: in ${vector}, ${x} lies closer to Plac than ${y}, so the gene's 5′ end faces the promoter.` },
      { id: 'flip', label: `${x} (5′ end) + ${y} (3′ end), into ${other}`, note: `In ${other} the order of ${x} and ${y} is reversed: the gene would be cloned backwards relative to Plac.` },
      {
        id: 'inside',
        label: `${insideEnzyme} + ${y}, into ${vector}`,
        note: `${insideEnzyme} cuts inside the gene.`,
      },
    ];
    if (nonMcs) {
      const label = fivePrime.includes(nonMcs) ? `${nonMcs} (5′ end) + ${y} (3′ end)` : `${x} (5′ end) + ${nonMcs} (3′ end)`;
      pairOptions.push({ id: 'nonmcs', label: `${label}, into ${vector}`, note: `${nonMcs} has no site in the pUC MCS.` });
    } else if (both.length) {
      pairOptions.push({ id: 'both', label: `${both[0]} alone, into ${vector}`, note: `${both[0]} cuts on both sides: same ends, so the insert can go in either way round.` });
    } else continue;

    const geneName = rng.pick(['Z', 'A', 'cirA', 'redA', 'fepA', 'X']);
    const fragmentVisual = { type: 'probeMap' as const, length, sites, probe: [gFrom, gTo] as [number, number], regionLabel: geneName, arrow: dir };
    const dirText = dir === 1 ? 'left → right' : 'right → left';
    const all = [...new Set(sites.map((s) => s.enzyme))];

    const part1: ChoiceQuestion = {
      kind: 'clone.excise',
      seed,
      format: 'choice',
      multi: true,
      prompt: `Which of these enzymes can NOT be used, because they cut inside gene ${geneName}?`,
      options: all.map((e) => ({ id: e, label: e })),
      correct: inside,
      explanation: [
        `Gene ${geneName} spans ${(gFrom / 1000).toFixed(1)}–${(gTo / 1000).toFixed(1)} kb. ${inside.join(' and ')} ${inside.length > 1 ? 'have sites' : 'has a site'} inside it, so ${inside.length > 1 ? 'they' : 'it'} would cut the gene in two.`,
        `The others flank the gene and can be used to excise it${both.length ? ` (${both[0]} cuts on both sides, giving identical ends — non-directional)` : ''}.`,
      ],
    };
    const part2: ChoiceQuestion = {
      kind: 'clone.orient',
      seed,
      format: 'choice',
      prompt: `You want ${geneName} expressed from Plac. Which enzymes and which vector clone it directionally in the right orientation?`,
      detail: `From Plac outwards — pUC18: ${PUC_FROM_PROMOTER.pUC18.join(' · ')}. pUC19: ${PUC_FROM_PROMOTER.pUC19.join(' · ')}.`,
      options: rng.shuffle(pairOptions),
      correct: ['right'],
      explanation: [
        `${geneName} is transcribed ${dirText}, so its 5′ end is on the ${dir === 1 ? 'left' : 'right'}: the enzyme on that side (${x}) must go to the MCS site nearest to Plac.`,
        `pUC18 and pUC19 have the same MCS in opposite orientations. ${x} is closer to Plac than ${y} in ${vector}, so cut fragment and ${vector} with ${x} + ${y}: the incompatible ends force one orientation.`,
      ],
    };
    const part3 = selectPart(rng, seed, false);
    return {
      kind: 'clone.plac',
      seed,
      format: 'case',
      prompt: `The fragment below (amber = gene ${geneName}, transcribed ${dirText}) has to be subcloned into pUC18 or pUC19 so that ${geneName} is expressed from the lac promoter.`,
      visual: fragmentVisual,
      parts: [part1, part2, part3],
      explanation: [],
    };
  }
  throw new Error('Could not build a Plac cloning case');
}

// ---------------------------------------------------------------------------------------------
// Selection and screening

function selectPart(rng: Rng, seed: string, standalone: boolean): ChoiceQuestion {
  const ampHost = rng.chance(0.35);
  const options: ChoiceOption[] = ampHost
    ? [
        { id: 'tet', label: 'Add a TetR cassette (e.g. from pBR322) to the vector; plate on tetracycline + X-gal + IPTG and pick white colonies', note: 'Correct: a second, usable marker plus blue/white screening.' },
        { id: 'amp', label: 'Plate on ampicillin + X-gal + IPTG and pick white colonies', note: 'Useless here: the host is already ampicillin resistant, so every cell grows, with or without plasmid.' },
        { id: 'blue', label: 'Plate on tetracycline + X-gal and pick blue colonies', note: 'Blue colonies make β-galactosidase: their lacZα is intact, so they carry no insert.' },
        { id: 'none', label: 'No selection is needed: only recombinant plasmids replicate', note: 'Any plasmid with an ori replicates; without selection you cannot tell transformed cells apart.' },
      ]
    : [
        { id: 'white', label: 'Ampicillin + X-gal + IPTG; recombinants form white colonies', note: 'Correct: AmpR selects transformants; the insert disrupts lacZα, so no α-complementation and no blue colour.' },
        { id: 'blue', label: 'Ampicillin + X-gal + IPTG; recombinants form blue colonies', note: 'Blue = β-galactosidase active = lacZα intact = empty vector.' },
        { id: 'amponly', label: 'Ampicillin only; every colony carries the insert', note: 'Re-ligated empty vector also gives AmpR colonies.' },
        { id: 'tet', label: 'Tetracycline + X-gal; white colonies', note: 'pUC vectors carry no tetracycline resistance.' },
      ];
  return {
    kind: 'clone.select',
    seed,
    format: 'choice',
    prompt: ampHost
      ? `${standalone ? 'You cloned a gene into the MCS of pUC19 (AmpR, lacZα). ' : ''}The E. coli host (lacZΔM15) already carries an ampicillin-resistance gene in its chromosome. How do you select and identify recombinant clones?`
      : `${standalone ? 'You cloned a gene into the MCS of pUC19 (AmpR, lacZα). ' : ''}After ligation you transform E. coli lacZΔM15. How do you select transformants and recognise the recombinants?`,
    options: rng.shuffle(options),
    correct: [ampHost ? 'tet' : 'white'],
    explanation: [
      'Selection kills cells without the plasmid (the antibiotic-resistance marker); screening tells recombinant from empty plasmids (blue/white α-complementation: the insert in the MCS disrupts lacZα, X-gal stays uncleaved, colonies are white; IPTG induces Plac).',
      ...(ampHost ? ['When the host is already resistant to the vector’s antibiotic, that marker cannot select anything: another one is needed (in the course problem, TetR taken from pBR322).'] : []),
    ],
  };
}

function selectQuestion(rng: Rng, seed: string): ChoiceQuestion {
  return selectPart(rng, seed, true);
}

// ---------------------------------------------------------------------------------------------
// Blunting

const BLUNT_POOL = ['EcoRI', 'BamHI', 'HindIII', 'SalI', 'XbaI', 'PstI', 'KpnI', 'SacI', 'SphI', 'NotI'];

function bluntQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const e = rng.pick(BLUNT_POOL);
  const k = endKind(getEnzyme(e));
  const oh = overhang(getEnzyme(e));
  const options: ChoiceOption[] = [
    { id: 'klenow', label: 'Klenow fragment + dNTPs (fill in)', note: k === '5prime' ? 'Correct: the polymerase extends the recessed 3′ end, copying the overhang: all bases kept.' : 'A polymerase can only extend a recessed 3′ end; a 3′ overhang has none to fill.' },
    { id: 'trim', label: 'T4 DNA polymerase (3′→5′ exonuclease) or S1 nuclease (trim)', note: k === '3prime' ? 'Correct: the protruding 3′ strand is removed, leaving a blunt end.' : 'This would work, but removes the 4 overhang bases instead of keeping them.' },
    { id: 'cip', label: 'Alkaline phosphatase', note: 'Removes 5′ phosphates; the end stays sticky.' },
    { id: 'pnk', label: 'T4 polynucleotide kinase', note: 'Adds 5′ phosphates; the end stays sticky.' },
  ];
  return {
    kind: 'clone.blunt',
    seed,
    format: 'choice',
    prompt: `You need to ligate an ${e} end to a blunt (SmaI) end. ${e} leaves a ${k === '5prime' ? '5′' : '3′'} overhang (${oh}). Which treatment makes the ${e} end blunt${k === '5prime' ? ' without losing any bases' : ''}?`,
    visual: { type: 'sites', enzymes: [e] },
    options,
    correct: [k === '5prime' ? 'klenow' : 'trim'],
    explanation: [
      k === '5prime'
        ? `${e} leaves a 5′ overhang: the 3′ end is recessed, so a DNA polymerase (Klenow) can fill it in using the overhang as template.`
        : `${e} leaves a 3′ overhang: there is no recessed 3′ end to extend, so the single-stranded 3′ tail is removed (3′→5′ exonuclease of T4 DNA polymerase, or S1 nuclease).`,
      'A blunted end ligates to any blunt end (SmaI, EcoRV, HincII), which is the classic trick when the sites you need are in the wrong order in the vector.',
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Rescuing an orientation problem by blunting

function rescueQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const blunt = rng.pick(['SmaI', 'EcoRV']);
  const [x, y] = rng.sample(['EcoRI', 'BamHI', 'HindIII', 'PstI', 'SalI', 'XbaI', 'KpnI', 'SacI'], 2);
  // Vector, from the promoter: blunt site, Y, X — so X/Y are in the wrong order for the gene.
  const vector = [blunt, y, x];
  const fix = bluntingStep(x);
  const options: ChoiceOption[] = [
    { id: 'right', label: `Fragment: cut with ${x}, make it blunt (${fix}), then cut with ${y}. Vector: ${blunt} + ${y}.`, note: `Correct: the blunted 5′ end of the gene joins the ${blunt} site next to the promoter and the ${y} ends join each other.` },
    { id: 'plain', label: `Fragment and vector both cut with ${x} + ${y}.`, note: `In this vector ${y} is nearer the promoter than ${x}: the gene would go in backwards.` },
    { id: 'reverse', label: `Fragment: cut with ${y}, make it blunt, then cut with ${x}. Vector: ${blunt} + ${x}.`, note: `This puts the gene's 3′ end next to the promoter — backwards again.` },
    { id: 'noblunt', label: `Fragment: ${x} + ${y}. Vector: ${blunt} + ${y}, no further treatment.`, note: `The sticky ${x} end cannot ligate to the blunt ${blunt} end.` },
  ];
  return {
    kind: 'clone.rescue',
    seed,
    format: 'choice',
    prompt: `Gene A is flanked by ${x} at its 5′ end and ${y} at its 3′ end (neither cuts inside). The only vector available has, from the promoter outwards: ${vector.join(' – ')}. How do you clone A so it is expressed from the promoter?`,
    options: rng.shuffle(options),
    correct: ['right'],
    explanation: [
      `The gene's 5′ end must face the promoter, but the ${x} site of the vector is the most distal one. Use the blunt ${blunt} site (closest to the promoter) instead.`,
      `Cut the fragment with ${x} first and blunt it (${fix}); then cut with ${y}. Cut the vector with ${blunt} and ${y}. Blunt joins blunt and ${y} joins ${y}: only one orientation is possible.`,
      'Order matters: blunt the first end before making the second cut, or you would blunt both ends.',
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Primers for a gene drawn right-to-left

function primersQuestion(rng: Rng, seed: string): ChoiceQuestion {
  for (let attempt = 0; attempt < 100; attempt++) {
    const vector = rng.pick<'pUC18' | 'pUC19'>(['pUC18', 'pUC19']);
    const order = PUC_FROM_PROMOTER[vector].filter((e) => e !== 'SmaI');
    const [i, j] = rng.sample([0, 1, 2, 3, 4, 5, 6, 7, 8], 2).sort((a, b) => a - b);
    const prox = order[i];
    const dist = order[j];
    const sites = [getEnzyme(prox).site, getEnzyme(dist).site];
    const left = randomSequenceAvoiding(rng, 20, sites);
    const right = randomSequenceAvoiding(rng, 20, sites);
    const dir: 1 | -1 = rng.chance(0.6) ? -1 : 1;
    const extra = rng.pick(['GC', 'CG', 'AT', 'GCG']);
    const leftPrimer = left.slice(0, 18);
    const rightPrimer = reverseComplement(right.slice(-18));
    const startPrimer = dir === 1 ? leftPrimer : rightPrimer;
    const endPrimer = dir === 1 ? rightPrimer : leftPrimer;
    const ps = (site: string, anneal: string) => `5′-${extra}${site}${anneal}-3′`;
    const pairs = [
      { id: 'right', a: ps(getEnzyme(prox).site, startPrimer), b: ps(getEnzyme(dist).site, endPrimer), note: `Correct: the ${prox} site (nearest to Plac in ${vector}) is added to the primer at the gene's start.` },
      { id: 'swap', a: ps(getEnzyme(dist).site, startPrimer), b: ps(getEnzyme(prox).site, endPrimer), note: `Sites swapped: the gene would be cloned backwards relative to Plac.` },
      { id: 'norc', a: ps(getEnzyme(prox).site, dir === 1 ? leftPrimer : right.slice(-18)), b: ps(getEnzyme(dist).site, dir === 1 ? right.slice(-18) : leftPrimer), note: 'The primer for the right-hand end copies the top strand instead of its reverse complement, so it cannot anneal.' },
      { id: 'three', a: `5′-${startPrimer}${getEnzyme(prox).site}-3′`, b: `5′-${endPrimer}${getEnzyme(dist).site}-3′`, note: 'Sites must be added at the 5′ end of primers; the 3′ end has to anneal for extension.' },
    ];
    if (new Set(pairs.map((p) => p.a + p.b)).size < 4) continue;
    return {
      kind: 'clone.primers',
      seed,
      format: 'choice',
      prompt: `Only the ends of the fragment carrying gene A are known (top strand shown). Gene A is transcribed ${dir === 1 ? 'left → right' : 'right → left'}. You will PCR-amplify it and clone it under Plac in ${vector} (MCS from Plac: ${PUC_FROM_PROMOTER[vector].join(' · ')}) using ${prox} and ${dist}. Which primer pair is right?`,
      visual: {
        type: 'sequence',
        rows: [
          { label: 'left end', seq: left + '…', primes: true },
          { label: 'right end', seq: '…' + right, primes: true },
        ],
      },
      options: rng.shuffle(pairs).map((p) => ({ id: p.id, label: `${p.a}\n${p.b}`, mono: true, note: p.note })),
      correct: ['right'],
      explanation: [
        dir === 1
          ? 'The gene runs left → right: its start is at the left end, whose top strand is the sense strand, so that primer copies the left end as written.'
          : 'The gene runs right → left: it is encoded on the bottom strand, so its START is at the right end. The primer there is the reverse complement of the right end of the top strand.',
        `In ${vector}, ${prox} is closer to Plac than ${dist}, so ${prox} goes on the primer at the gene's start and ${dist} on the primer at its end. Add a few bases before each site so the enzymes can cut near the ends of the product.`,
      ],
    };
  }
  throw new Error('Could not build a primer question');
}

// ---------------------------------------------------------------------------------------------
// Keeping the RBS–ATG distance: NdeI

function rbsQuestion(rng: Rng, seed: string): ChoiceQuestion {
  for (let attempt = 0; attempt < 100; attempt++) {
    const before = rng.pick(['G', 'A', 'T']);
    const upstream = randomSequence(rng, 6) + before;
    const body = 'ATG' + randomSequenceAvoiding(rng, 15, ['CATATG', 'AGATCT']);
    if (upstream.includes('CATATG') || (upstream + body).includes('CATATG')) continue;
    const vector = 'TTTAAGAAGGAGATATACATATG';
    const anneal = body.slice(3, 18);
    const options: ChoiceOption[] = [
      { id: 'nde', label: `5′-GC CATATG ${anneal}-3′`, mono: true, note: 'Correct: the NdeI site CATATG contains the ATG, so after NdeI cloning the gene ATG sits exactly where the vector ATG was, at the optimal distance from the RBS.' },
      { id: 'bgl', label: `5′-GC AGATCT ${upstream}ATG ${anneal.slice(0, 9)}-3′`, mono: true, note: 'Cloning upstream (e.g. BglII) keeps extra bases and the vector ATG: the gene ATG ends up too far from the RBS, and translation starts at the vector ATG out of frame.' },
      { id: 'shift', label: `5′-GC CATATG ${anneal.slice(1)}-3′`, mono: true, note: 'One base of the gene is missing after ATG: the reading frame shifts.' },
      { id: 'dup', label: `5′-GC CATATG ATG ${anneal.slice(0, 12)}-3′`, mono: true, note: 'This duplicates the ATG: the protein gets an extra N-terminal Met and the native start codon is no longer the one at the optimal spacing.' },
    ];
    return {
      kind: 'clone.rbs',
      seed,
      format: 'choice',
      prompt:
        'In the expression vector, the RBS is followed at the optimal distance by an ATG that is part of an NdeI site (CA^TATG); BamHI is downstream. Your gene has no NdeI site (the base before its ATG is not C). Which forward primer lets you clone the coding sequence so it is translated from the vector RBS?',
      visual: {
        type: 'sequence',
        rows: [
          { label: 'vector', seq: vector, primes: true, highlights: [{ from: 7, to: 11, tone: 'teal', label: 'RBS' }, { from: 17, to: 23, tone: 'coral', label: 'NdeI (contains ATG)' }] },
          { label: 'gene', seq: upstream + body + '…', primes: true, highlights: [{ from: upstream.length, to: upstream.length + 3, tone: 'amber', label: 'start codon' }] },
        ],
      },
      options: rng.shuffle(options),
      correct: ['nde'],
      explanation: [
        'Translation efficiency depends on the spacing between the Shine–Dalgarno (RBS) sequence and the ATG; the vector is built so that its NdeI ATG is at the optimal distance.',
        `The gene reads …${upstream.slice(-3)}ATG…: changing the base before ATG to C (${before}→C) in the forward primer creates CATATG. Cut with NdeI + BamHI and ligate: the gene's ATG replaces the vector ATG exactly.`,
      ],
    };
  }
  throw new Error('Could not build an RBS question');
}
