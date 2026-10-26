/**
 * Expression vectors and protein purification: host from vector elements, how expression is
 * induced, tags and their purification, cloning in frame with a tag, SDS-PAGE of a purification,
 * Western blots with tag/protein antibodies, troubleshooting, cell-free expression.
 */

import { randomSequenceAvoiding } from '../science/dna';
import { getEnzyme } from '../science/enzymes';
import { createRng, type Rng } from '../science/rng';
import { randomSenseCodons, translateFrom } from '../science/translate';
import type { BlotLaneData, ChoiceOption, ChoiceQuestion, MatchQuestion, Question, VectorFeature } from './types';

export type ExpressionKind = 'host' | 'inducer' | 'tag' | 'frame' | 'sds' | 'western' | 'trouble' | 'cellfree';
export const EXPRESSION_KINDS: ExpressionKind[] = ['host', 'inducer', 'tag', 'frame', 'sds', 'western', 'trouble', 'cellfree'];

export function generateExpressionQuestion(seed: string, kind?: ExpressionKind): Question {
  const rng = createRng(`expr/${seed}`);
  const k = kind ?? rng.pick(EXPRESSION_KINDS);
  switch (k) {
    case 'host':
      return hostQuestion(rng, seed);
    case 'inducer':
      return rng.chance(0.5) ? inducerQuestion(rng, seed) : inductionLanesQuestion(rng, seed);
    case 'tag':
      return tagQuestion(rng, seed);
    case 'frame':
      return frameQuestion(rng, seed);
    case 'sds':
      return sdsQuestion(rng, seed);
    case 'western':
      return westernQuestion(rng, seed);
    case 'trouble':
      return troubleQuestion(rng, seed);
    case 'cellfree':
      return cellFreeQuestion(rng, seed);
  }
}

// ---------------------------------------------------------------------------------------------
// Element catalogue

type HostId = 'ecoli' | 'scer' | 'spombe' | 'pichia' | 'mammal';

interface HostDef {
  name: string;
  ori: string[];
  markers: string[];
  promoters: string[];
  terminators: string[];
  extras: string[];
  /** Why these elements point to this host. */
  clue: string;
}

export const HOSTS: Record<HostId, HostDef> = {
  ecoli: {
    name: 'E. coli',
    ori: ['ColE1 ori', 'p15A ori'],
    markers: ['AmpR', 'KanR'],
    promoters: ['Ptac', 'Plac', 'PT7', 'PL', 'ParaBAD'],
    terminators: ['rrnB terminator', 'T7 terminator'],
    extras: ['RBS (Shine–Dalgarno)', 'lacIq'],
    clue: 'only bacterial elements: a bacterial origin, an antibiotic resistance, a bacterial promoter and an RBS',
  },
  scer: {
    name: 'S. cerevisiae',
    ori: ['2µ ori', 'ARS/CEN'],
    markers: ['URA3', 'LEU2', 'TRP1'],
    promoters: ['PGAL1', 'PADH1', 'PCUP1'],
    terminators: ['CYC1 terminator'],
    extras: [],
    clue: 'a yeast replication origin (2µ or ARS/CEN) and an auxotrophic marker (URA3/LEU2/TRP1) with a budding-yeast promoter',
  },
  spombe: {
    name: 'S. pombe (fission yeast)',
    ori: ['ARS1'],
    markers: ['LEU2-d'],
    promoters: ['Pnmt1'],
    terminators: ['Tnmt1'],
    extras: [],
    clue: 'ARS1 and the thiamine-regulated nmt1 promoter of fission yeast',
  },
  pichia: {
    name: 'Pichia pastoris',
    ori: [],
    markers: ['HIS4'],
    promoters: ['PAOX1'],
    terminators: ['AOX1 terminator'],
    extras: ['α-factor secretion signal'],
    clue: 'the methanol-inducible AOX1 promoter, HIS4 marker and integration into the Pichia genome',
  },
  mammal: {
    name: 'mammalian cells',
    ori: ['SV40 ori'],
    markers: ['NeoR (G418)', 'PuroR'],
    promoters: ['PCMV', 'PEF1α'],
    terminators: ['bGH poly(A) signal', 'SV40 poly(A) signal'],
    extras: ['Kozak sequence'],
    clue: 'a viral/mammalian promoter (CMV, EF1α), a poly(A) signal and a G418/puromycin resistance for mammalian cells',
  },
};

interface PromoterDef {
  host: HostId;
  /** How to switch expression on; null = constitutive. */
  how: string | null;
  on?: string;
  off?: string;
  note: string;
}

export const PROMOTERS: Record<string, PromoterDef> = {
  Plac: { host: 'ecoli', how: 'Add IPTG', on: 'with IPTG', off: 'without IPTG', note: 'IPTG binds the LacI repressor and releases it from the operator.' },
  Ptac: { host: 'ecoli', how: 'Add IPTG', on: 'with IPTG', off: 'without IPTG', note: 'tac = trp −35 + lac −10 and lac operator: strong and IPTG-inducible; lacIq prevents leaky expression.' },
  PT7: { host: 'ecoli', how: 'Add IPTG to a λDE3 host', on: 'with IPTG', off: 'without IPTG', note: 'Only T7 RNA polymerase reads PT7; in λDE3 strains its gene is under lacUV5, so IPTG induces the polymerase, which then transcribes the target.' },
  PL: { host: 'ecoli', how: 'Shift 30 → 42 °C (cI857 host)', on: 'at 42 °C', off: 'at 30 °C', note: 'The thermosensitive cI857 repressor holds PL off at 30 °C and denatures at 42 °C.' },
  ParaBAD: { host: 'ecoli', how: 'Add L-arabinose', on: 'with arabinose', off: 'with glucose', note: 'AraC activates PBAD with arabinose; glucose represses it (catabolite repression).' },
  PGAL1: { host: 'scer', how: 'Switch from glucose to galactose', on: 'in galactose', off: 'in glucose', note: 'Gal4 activates GAL1 in galactose; glucose represses it.' },
  PCUP1: { host: 'scer', how: 'Add copper', on: 'with Cu²⁺', off: 'without Cu²⁺', note: 'CUP1 (metallothionein) is induced by copper.' },
  PADH1: { host: 'scer', how: null, note: 'ADH1 is a strong constitutive promoter.' },
  Pnmt1: { host: 'spombe', how: 'Remove thiamine', on: 'without thiamine', off: 'with thiamine', note: 'nmt1 = "no message in thiamine": thiamine represses it, so expression is induced by its absence.' },
  PAOX1: { host: 'pichia', how: 'Grow on methanol', on: 'on methanol', off: 'on glycerol/glucose', note: 'AOX1 (alcohol oxidase) is strongly induced by methanol and repressed by glucose/glycerol.' },
  PCMV: { host: 'mammal', how: null, note: 'The CMV immediate-early promoter is constitutive and strong in most mammalian cells.' },
  PEF1α: { host: 'mammal', how: null, note: 'EF1α is a constitutive housekeeping promoter.' },
};

const INDUCER_OPTIONS = ['Add IPTG', 'Add IPTG to a λDE3 host', 'Shift 30 → 42 °C (cI857 host)', 'Add L-arabinose', 'Switch from glucose to galactose', 'Add copper', 'Remove thiamine', 'Grow on methanol'];

export const TAGS = {
  His6: { matrix: 'Ni²⁺-NTA resin', elution: 'imidazole (or acidic pH)', kDa: 1, epitope: 'anti-His' },
  GST: { matrix: 'glutathione–Sepharose', elution: 'reduced glutathione', kDa: 26, epitope: 'anti-GST' },
  MBP: { matrix: 'amylose resin', elution: 'maltose', kDa: 42, epitope: 'anti-MBP' },
} as const;
type TagId = keyof typeof TAGS;

export const PROTEASES: Record<string, string> = {
  thrombin: 'LVPR↓GS',
  'factor Xa': 'IEGR↓',
  enterokinase: 'DDDDK↓',
  'TEV protease': 'ENLYFQ↓G',
};

interface VectorSpec {
  host: HostId;
  promoter: string;
  tag: TagId | null;
  protease: string | null;
  features: VectorFeature[];
}

function buildVector(rng: Rng, host: HostId, opts: { tag?: TagId | null; promoter?: string } = {}): VectorSpec {
  const h = HOSTS[host];
  const promoter = opts.promoter ?? rng.pick(h.promoters);
  const tag = opts.tag === undefined ? (rng.chance(0.7) ? rng.pick(Object.keys(TAGS) as TagId[]) : null) : opts.tag;
  const protease = tag ? rng.pick(Object.keys(PROTEASES)) : null;
  const features: VectorFeature[] = [{ label: promoter, kind: 'promoter' }];
  if (host === 'ecoli') features.push({ label: 'RBS', kind: 'other' });
  if (host === 'mammal') features.push({ label: 'Kozak', kind: 'other' });
  if (tag) features.push({ label: tag, kind: 'tag' }, { label: `${protease} site`, kind: 'protease' });
  features.push({ label: 'MCS', kind: 'mcs' }, { label: rng.pick(h.terminators), kind: 'terminator' });
  if (host === 'ecoli' && (promoter === 'Ptac' || promoter === 'Plac')) features.push({ label: 'lacIq', kind: 'other' });
  if (h.ori.length) features.push({ label: rng.pick(h.ori), kind: 'ori' });
  features.push({ label: rng.pick(h.markers), kind: 'marker' });
  if (host !== 'ecoli') {
    // Shuttle vectors are propagated in E. coli too.
    features.push({ label: 'pUC ori', kind: 'ori' }, { label: 'AmpR', kind: 'marker' });
  }
  if (host === 'pichia') features.push({ label: rng.pick(h.extras), kind: 'other' });
  return { host, promoter, tag, protease, features };
}

// ---------------------------------------------------------------------------------------------

function hostQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const host = rng.pick(Object.keys(HOSTS) as HostId[]);
  const v = buildVector(rng, host);
  const others = rng.sample((Object.keys(HOSTS) as HostId[]).filter((h) => h !== host), 3);
  return {
    kind: 'expr.host',
    seed,
    format: 'choice',
    prompt: 'A colleague lends you this expression vector. In which organism is it designed to express the protein?',
    visual: { type: 'vector', name: 'pEXP', features: v.features },
    options: rng.shuffle([host, ...others]).map((id) => ({ id, label: HOSTS[id].name })),
    correct: [host],
    explanation: [
      `The giveaway: ${HOSTS[host].clue}.`,
      host === 'ecoli'
        ? 'Nothing here would work in a eukaryote: no eukaryotic origin, marker, promoter or poly(A) signal.'
        : 'The pUC ori and AmpR are there only to propagate the plasmid in E. coli during cloning (a shuttle vector); they say nothing about the expression host.',
      `${v.promoter}: ${PROMOTERS[v.promoter].note}`,
    ],
  };
}

function inducerQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const promoter = rng.pick(Object.keys(PROMOTERS));
  const def = PROMOTERS[promoter];
  const v = buildVector(rng, def.host, { promoter });
  const correctLabel = def.how ?? 'Nothing: the promoter is constitutive';
  const distractors = rng.sample(
    [...INDUCER_OPTIONS, 'Nothing: the promoter is constitutive'].filter((o) => o !== correctLabel),
    3,
  );
  const options = rng.shuffle([correctLabel, ...distractors]).map((label, i) => ({ id: `o${i}`, label }));
  return {
    kind: 'expr.inducer',
    seed,
    format: 'choice',
    prompt: `How do you switch on expression of the cloned gene in this ${HOSTS[def.host].name} vector?`,
    visual: { type: 'vector', name: 'pEXP', features: v.features },
    options,
    correct: [options.find((o) => o.label === correctLabel)!.id],
    explanation: [`${promoter}: ${def.note}`],
  };
}

function inductionLanesQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const promoter = rng.pick(Object.keys(PROMOTERS));
  const def = PROMOTERS[promoter];
  const on = def.on ?? 'condition 1';
  const off = def.off ?? 'condition 2';
  const conds = def.how ? rng.shuffle([on, off]) : ['in rich medium', 'in minimal medium'];
  const options: ChoiceOption[] = [
    { id: 'first', label: `Only in the cells grown ${conds[0]}` },
    { id: 'second', label: `Only in the cells grown ${conds[1]}` },
    { id: 'both', label: 'In both extracts' },
    { id: 'neither', label: 'In neither extract' },
  ];
  const correct = def.how ? (conds[0] === on ? 'first' : 'second') : 'both';
  return {
    kind: 'expr.inducer',
    seed,
    format: 'choice',
    prompt: `Cells carrying a ${promoter}-driven expression vector were grown ${conds[0]} and ${conds[1]}. Total protein extracts were run on an SDS-PAGE gel. Where do you expect an extra, strong band of the recombinant protein?`,
    options,
    correct: [correct],
    explanation: [
      `${promoter}: ${def.note}`,
      def.how
        ? `So the recombinant band appears ${on} and not ${off}${promoter === 'Pnmt1' ? ' — careful: thiamine REPRESSES nmt1, so the band is in the extract WITHOUT thiamine' : ''}.`
        : 'A constitutive promoter is always on, so both extracts contain it.',
    ],
  };
}

function tagQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const host = rng.pick<HostId>(['ecoli', 'ecoli', 'scer', 'spombe']);
  const tag = rng.pick(Object.keys(TAGS) as TagId[]);
  const v = buildVector(rng, host, { tag });
  const t = TAGS[tag];
  const wrongTag = TAGS[rng.pick((Object.keys(TAGS) as TagId[]).filter((x) => x !== tag))];
  const wrongProtease = rng.pick(Object.keys(PROTEASES).filter((p) => p !== v.protease));
  const options: ChoiceOption[] = [
    { id: 'right', label: `${t.matrix}, elute with ${t.elution}; remove the tag with ${v.protease}` },
    { id: 'protease', label: `${t.matrix}, elute with ${t.elution}; remove the tag with ${wrongProtease}` },
    { id: 'matrix', label: `${wrongTag.matrix}, elute with ${wrongTag.elution}; remove the tag with ${v.protease}` },
    { id: 'both', label: `${wrongTag.matrix}, elute with ${wrongTag.elution}; remove the tag with ${wrongProtease}` },
  ];
  return {
    kind: 'expr.tag',
    seed,
    format: 'choice',
    prompt: 'Your cDNA is cloned in frame in the MCS of this vector. How do you purify the recombinant protein and then obtain it without the tag?',
    visual: { type: 'vector', name: 'pEXP', features: v.features },
    options: rng.shuffle(options),
    correct: ['right'],
    explanation: [
      `${tag}: binds ${t.matrix}; elute with ${t.elution}. ${tag === 'GST' ? 'GST adds 26 kDa.' : tag === 'MBP' ? 'MBP adds 42 kDa and often improves solubility.' : 'The His tag is tiny (~1 kDa).'}`,
      `Between tag and protein the vector encodes a ${v.protease} site (${PROTEASES[v.protease!]}): only ${v.protease} releases the protein. A convenient trick is to cut while the fusion is still bound — the tag stays on the resin and the free protein comes off.`,
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Cloning in frame with an N-terminal tag

const FRAME_SITES = ['BamHI', 'EcoRI', 'NcoI', 'NheI', 'XhoI', 'SalI', 'KpnI', 'NdeI'];

function spaced(seq: string): string {
  return seq.match(/.{1,3}/g)!.join(' ');
}

/** Index map from an unspaced sequence to its codon-spaced rendering. */
function spacedIndex(i: number): number {
  return i + Math.floor(i / 3);
}

export interface FrameCheck {
  enzyme: string;
  inVector: boolean;
  inInsert: boolean;
  inFrame: boolean;
  /** Stop codon in frame before the ATG of the cDNA. */
  stop: boolean;
}

/** Is the cDNA in frame with the tag when both are cut with this enzyme and ligated? */
export function checkFusion(vector: string, insert: string, atg: number, enzyme: string): FrameCheck {
  const e = getEnzyme(enzyme);
  const vi = vector.indexOf(e.site);
  const ii = insert.lastIndexOf(e.site, atg + 3);
  const inVector = vi >= 0;
  const inInsert = ii >= 0;
  if (!inVector || !inInsert) return { enzyme, inVector, inInsert, inFrame: false, stop: false };
  const vCut = vi + e.cut;
  const iCut = ii + e.cut;
  const newAtg = vCut + (atg - iCut);
  const fused = vector.slice(0, vCut) + insert.slice(iCut);
  const inFrame = newAtg % 3 === 0;
  const stop = inFrame && translateFrom(fused, 0).protein.length * 3 < newAtg;
  return { enzyme, inVector, inInsert, inFrame, stop };
}

function frameQuestion(rng: Rng, seed: string): ChoiceQuestion {
  for (let attempt = 0; attempt < 400; attempt++) {
    const enzymes = rng.sample(FRAME_SITES, 3);
    const sites = enzymes.map((n) => getEnzyme(n).site);
    // Vector: ATG + His6 + spacer codons, then the three sites separated by 0–2 extra bases.
    let vector = 'ATG' + 'CAC'.repeat(6) + randomSenseCodons(rng, 2);
    for (const s of sites) vector += randomSequenceAvoiding(rng, rng.int(0, 2), sites) + s;
    vector += randomSequenceAvoiding(rng, 6, sites);
    // cDNA 5′ end: two of the sites sit upstream of (or overlap) the ATG.
    const inInsert = rng.sample(enzymes, 2);
    let insert = randomSequenceAvoiding(rng, 3, sites);
    for (const n of inInsert) insert += getEnzyme(n).site + randomSequenceAvoiding(rng, rng.int(0, 2), sites);
    const atg = insert.length;
    insert += 'ATG' + randomSenseCodons(rng, 6);
    if (sites.some((s) => vector.indexOf(s) !== vector.lastIndexOf(s))) continue;
    if (sites.some((s) => insert.slice(atg).includes(s))) continue;
    const checks = enzymes.map((n) => checkFusion(vector, insert, atg, n));
    const good = checks.filter((c) => c.inVector && c.inInsert && c.inFrame && !c.stop);
    if (good.length !== 1) continue;
    const answer = good[0].enzyme;
    const options: ChoiceOption[] = [
      ...enzymes.map((n) => {
        const c = checks.find((x) => x.enzyme === n)!;
        const note = !c.inInsert
          ? `${n} has no site in the cDNA upstream of the ATG.`
          : !c.inFrame
            ? `${n} joins the cDNA out of frame: the ATG lands at a position that is not a multiple of 3 from the tag's ATG.`
            : c.stop
              ? `${n} keeps the frame but brings an in-frame stop codon between the tag and the cDNA.`
              : `Correct: after ${n} ligation the cDNA's ATG is a multiple of 3 nt from the tag's ATG, with no stop in between.`;
        return { id: n, label: n, note };
      }),
      { id: 'none', label: 'None of them', note: 'One of the sites does work.' },
    ];
    const vHl = enzymes.map((n, k) => {
      const i = vector.indexOf(getEnzyme(n).site);
      return { from: spacedIndex(i), to: spacedIndex(i + getEnzyme(n).site.length - 1) + 1, tone: (['teal', 'coral', 'amber'] as const)[k], label: n };
    });
    const iHl = inInsert.map((n) => {
      const i = insert.indexOf(getEnzyme(n).site);
      const k = enzymes.indexOf(n);
      return { from: i, to: i + getEnzyme(n).site.length, tone: (['teal', 'coral', 'amber'] as const)[k] };
    });
    return {
      kind: 'expr.frame',
      seed,
      format: 'choice',
      prompt: 'The vector encodes ATG + His6 tag followed by an MCS (read in codons from the tag ATG). Which site lets you clone the cDNA so it is translated in frame with the tag?',
      detail: enzymes.map((n) => `${n} ${getEnzyme(n).site.slice(0, getEnzyme(n).cut)}^${getEnzyme(n).site.slice(getEnzyme(n).cut)}`).join(' · '),
      visual: {
        type: 'sequence',
        wrap: true,
        rows: [
          { label: 'vector', seq: spaced(vector), primes: true, highlights: vHl },
          { label: 'cDNA', seq: insert + '…', primes: true, highlights: [...iHl, { from: atg, to: atg + 3, tone: 'muted', label: 'ATG' }] },
        ],
      },
      options,
      correct: [answer],
      explanation: [
        'Cut both with the same enzyme: the product is vector up to the cut + cDNA from its cut. The cDNA ATG must end up a multiple of 3 nt after the tag ATG (and no stop codon may appear in between).',
        `Count it for ${answer}: the vector cut is at nt ${vector.indexOf(getEnzyme(answer).site) + getEnzyme(answer).cut} and the cDNA ATG is ${atg - (insert.indexOf(getEnzyme(answer).site) + getEnzyme(answer).cut)} nt after its cut, so the ATG lands at ${vector.indexOf(getEnzyme(answer).site) + getEnzyme(answer).cut + atg - (insert.indexOf(getEnzyme(answer).site) + getEnzyme(answer).cut)} = a multiple of 3.`,
      ],
    };
  }
  throw new Error('Could not build a reading-frame question');
}

// ---------------------------------------------------------------------------------------------
// SDS-PAGE of an affinity purification (match aliquots to lanes)

const ALIQUOTS = [
  { id: 'total', label: 'Total extract after induction' },
  { id: 'flow', label: 'Flow-through after binding to the matrix' },
  { id: 'wash', label: 'A wash of the matrix' },
  { id: 'eluate', label: 'Eluate (specific elution)' },
  { id: 'resinAfterElution', label: 'Matrix after elution' },
  { id: 'cleaved', label: 'Released after protease on the matrix' },
  { id: 'resinAfterProtease', label: 'Matrix after protease' },
] as const;
type AliquotId = (typeof ALIQUOTS)[number]['id'];

/** Host proteins: spread evenly on a log scale from 12 to 150 kDa (one per stratum). */
function background(rng: Rng): { size: number; intensity: number }[] {
  const lo = Math.log(12);
  const hi = Math.log(150);
  const n = 14;
  return Array.from({ length: n }, (_, i) => ({
    size: Math.round(Math.exp(lo + ((i + rng.float(0.15, 0.85)) / n) * (hi - lo))),
    intensity: rng.float(0.25, 0.75),
  }));
}

function laneContents(id: AliquotId, bg: { size: number; intensity: number }[], protein: number, tag: number, fault?: AliquotId) {
  const fusion = { size: protein + tag, intensity: 1 };
  switch (id) {
    case 'total':
      return [...bg, fusion];
    case 'flow':
      return fault === 'flow' ? [...bg, fusion] : bg;
    case 'wash':
      return [...bg.slice(0, 3).map((b) => ({ ...b, intensity: b.intensity * 0.4 })), ...(fault === 'wash' ? [fusion] : [])];
    case 'eluate':
      return fault ? [] : [fusion];
    case 'resinAfterElution':
      return fault === 'resinAfterElution' ? [fusion] : [];
    case 'cleaved':
      return fault === 'cleaved' ? [] : [{ size: protein, intensity: 0.9 }];
    case 'resinAfterProtease':
      return fault === 'cleaved' ? [fusion] : [{ size: tag, intensity: 0.9 }];
  }
}

function sdsQuestion(rng: Rng, seed: string): MatchQuestion {
  const tag = rng.pick<TagId>(['GST', 'MBP']);
  const t = TAGS[tag];
  const protease = rng.pick(['thrombin', 'factor Xa']);
  let protein = 5 * rng.int(4, 14);
  if (Math.abs(protein - t.kDa) < 8) protein += 15;
  const bg = background(rng);
  const order = rng.shuffle(ALIQUOTS.map((a) => a.id));
  const lanes: BlotLaneData[] = order.map((id, i) => ({ label: String(i + 1), bands: laneContents(id, bg, protein, t.kDa) }));
  const correct = Object.fromEntries(order.map((id, i) => [id, [String(i + 1)]]));
  return {
    kind: 'expr.sds',
    seed,
    format: 'match',
    prompt:
      `Protein A (${protein} kDa) was expressed in E. coli as a fusion with ${tag} (${t.kDa} kDa) followed by a ${protease} site, and purified on ${t.matrix}. ` +
      `After washing, half of the matrix was eluted with ${t.elution}; the other half was incubated with ${protease}. Aliquots of every step were run on an SDS-PAGE gel (Coomassie), but the lane order was lost. Which lane is which?`,
    visual: { type: 'blot', look: 'coomassie', unit: 'kDa', ladder: [15, 25, 35, 55, 70, 100, 130], lanes },
    rows: ALIQUOTS.map((a) => ({ id: a.id, label: a.label })),
    options: order.map((_, i) => ({ id: String(i + 1), label: `Lane ${i + 1}` })),
    correct,
    explanation: [
      `Total extract: all the bacterial proteins plus a strong fusion band at ${protein} + ${t.kDa} = ${protein + t.kDa} kDa.`,
      'Flow-through: the same proteins minus the fusion (it stayed on the matrix). A wash: just a few faint contaminants.',
      `Eluate: only the ${protein + t.kDa} kDa fusion. The matrix after elution is empty.`,
      `${protease} on the matrix releases protein A alone (${protein} kDa) while ${tag} (${t.kDa} kDa) stays bound: the matrix after protease shows ${tag}.`,
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Western blots with tag or protein antibodies

function westernQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const tag = rng.pick<TagId>(['His6', 'GST', 'MBP']);
  const protease = rng.pick(['thrombin', 'factor Xa', 'TEV protease']);
  const samples = rng.shuffle([
    { id: 'uninduced', label: 'Total extract, not induced', tag: false, protein: false },
    { id: 'induced', label: 'Total extract, induced', tag: true, protein: true },
    { id: 'eluate', label: 'Purified fusion (eluate)', tag: true, protein: true },
    { id: 'cleaved', label: `Protein released with ${protease}`, tag: false, protein: true },
    { id: 'resin', label: `Matrix after ${protease} (what stayed bound)`, tag: true, protein: false },
    { id: 'native', label: 'Native protein purified from the original organism', tag: false, protein: true },
  ]).slice(0, 5);
  const anti = rng.chance(0.5) ? 'tag' : 'protein';
  const correct = samples.filter((s) => (anti === 'tag' ? s.tag : s.protein)).map((s) => s.id);
  return {
    kind: 'expr.western',
    seed,
    format: 'choice',
    multi: true,
    exclusive: ['none'],
    prompt: `A protein was expressed as an N-terminal ${tag} fusion with a ${protease} site in between. These samples were blotted with an antibody against ${anti === 'tag' ? `the ${tag} tag` : 'the protein itself'}. In which lanes do you see a signal?`,
    options: [...samples.map((s, i) => ({ id: s.id, label: `${i + 1}. ${s.label}` })), { id: 'none', label: 'None' }],
    correct: correct.length ? correct : ['none'],
    explanation: [
      anti === 'tag'
        ? `An anti-${tag} antibody sees anything that still carries the tag: the induced extract, the intact fusion, and the tag left on the matrix after cleavage. Not the released protein or the native protein, and not uninduced cells.`
        : 'An antibody against the protein sees every sample containing it, with or without tag: induced extract, fusion, released protein and native protein. Not the tag left on the matrix, and not uninduced cells.',
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Troubleshooting a purification

const FAULTS: { fault: AliquotId; where: string; meaning: string }[] = [
  { fault: 'flow', where: 'the flow-through after binding', meaning: 'The fusion did not bind to the matrix' },
  { fault: 'wash', where: 'the wash', meaning: 'It bound but was lost during the washes' },
  { fault: 'resinAfterElution', where: 'the matrix after elution', meaning: 'It bound but was not eluted' },
  { fault: 'cleaved', where: `the matrix after protease (at the size of the fusion)`, meaning: 'The protease did not cut' },
];

function troubleQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const tag = rng.pick<TagId>(['GST', 'MBP', 'His6']);
  const f = rng.pick(FAULTS);
  const prompt =
    f.fault === 'cleaved'
      ? `A ${tag}-fusion purification went fine up to elution, but in the protease half nothing is released and the band left on the matrix has the size of the intact fusion. What went wrong?`
      : `In a ${tag}-fusion purification the eluate lane is empty, and the fusion band appears instead in ${f.where}. What went wrong?`;
  return {
    kind: 'expr.trouble',
    seed,
    format: 'choice',
    prompt,
    options: FAULTS.map((x) => ({ id: x.fault, label: x.meaning })),
    correct: [f.fault],
    explanation: [
      'Follow the fusion protein: wherever it shows up is where the process stopped working.',
      'In the flow-through → never bound. In a wash → bound, then lost. Still on the matrix after elution → bound but not eluted. Intact on the matrix after protease (and nothing released) → the protease failed.',
    ],
  };
}

function cellFreeQuestion(rng: Rng, seed: string): ChoiceQuestion {
  const options: ChoiceOption[] = rng.shuffle([
    { id: 't7', label: 'PT7 – RBS – MCS – T7 terminator', note: 'Correct: cell-free kits supply T7 RNA polymerase and E. coli ribosomes; the RBS lets them translate.' },
    { id: 'adh', label: 'PADH1 – GST – MCS – CYC1 terminator (yeast)', note: 'Needs the yeast transcription machinery.' },
    { id: 'cmv', label: 'PCMV – Kozak – MCS – bGH poly(A)', note: 'Needs mammalian RNA polymerase II.' },
    { id: 'nmt', label: 'Pnmt1 – MCS – Tnmt1 (fission yeast)', note: 'Needs S. pombe RNA polymerase II.' },
  ]);
  return {
    kind: 'expr.cellfree',
    seed,
    format: 'choice',
    prompt: 'Which of these cassettes would you use to make the protein in a cell-free (in vitro) transcription–translation system?',
    options,
    correct: ['t7'],
    explanation: [
      'A cell-free system contains RNA polymerase, ribosomes, tRNAs, amino acids and nucleotides — but no living cells. The standard set-up uses phage T7 RNA polymerase (a single subunit, very active) with a PT7 template, and needs an RBS for the bacterial ribosomes.',
    ],
  };
}
