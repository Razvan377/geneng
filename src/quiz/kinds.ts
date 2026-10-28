/** Question kinds (stats keys) and the modes they belong to. */

export type ModeId = 'map' | 'ends' | 'pcr' | 'gel' | 'num' | 'blot' | 'clone' | 'expr' | 'func' | 'tf' | 'gt';

export const MODES: Record<ModeId, { title: string; route: string; blurb: string }> = {
  map: {
    title: 'Restriction mapping',
    route: 'map',
    blurb: 'Build a map from single, double and partial digests.',
  },
  ends: {
    title: 'Enzyme ends & ligation',
    route: 'ends',
    blurb: 'Overhangs, compatible ends, hybrid sites, directional cloning.',
  },
  pcr: {
    title: 'PCR calculator',
    route: 'pcr',
    blurb: 'Tm, primer design, products and amplification.',
  },
  gel: {
    title: 'Gel reading',
    route: 'gel',
    blurb: 'Size bands with a standard curve; choose the right gel.',
  },
  num: {
    title: 'Numbers drill',
    route: 'numbers',
    blurb: '4ⁿ, enzyme units, A260, library coverage, vectors.',
  },
  blot: {
    title: 'Blots & variants',
    route: 'blots',
    blurb: 'Draw Southern, Northern, RT-PCR and Western results for gene variants.',
  },
  clone: {
    title: 'Cloning strategy',
    route: 'cloning',
    blurb: 'Vectors, enzymes, orientation under Plac, blunting, selection.',
  },
  expr: {
    title: 'Expression & purification',
    route: 'expression',
    blurb: 'Hosts, inducers, tags, reading frame, purification gels.',
  },
  func: {
    title: 'Functional analysis',
    route: 'functional',
    blurb: 'Two-hybrid, CRISPR screens, RNAi, reporter assays, techniques.',
  },
  tf: {
    title: 'True / false',
    route: 'tf',
    blurb: 'Exam statements in Spanish, with the reasoning.',
  },
  gt: {
    title: 'Game theory',
    route: 'gt',
    blurb: 'Dominance, IESDS, pure and mixed Nash equilibria, stories to bimatrices, Cournot, rationalizability.',
  },
};

/** Genetics modes, in the order the home page lists them. */
export const GENETICS_MODES: ModeId[] = ['map', 'blot', 'clone', 'expr', 'ends', 'pcr', 'gel', 'func', 'num', 'tf'];
export const MODE_ORDER: ModeId[] = [...GENETICS_MODES, 'gt'];

export const KIND_LABELS: Record<string, string> = {
  'map.easy': 'Mapping · easy',
  'map.medium': 'Mapping · medium',
  'map.hard': 'Mapping · hard',
  'map.exam': 'Mapping · exam mode',
  'ends.type': "5′ / 3′ overhang or blunt",
  'ends.ligate': 'Can these ends be ligated?',
  'ends.recut': 'Re-cutting a ligated junction',
  'ends.schizomer': 'Isoschizomer or neoschizomer',
  'ends.directional': 'Directional cloning',
  'ends.phosphatase': 'Alkaline phosphatase',
  'pcr.tm': 'Primer Tm (Wallace rule)',
  'pcr.badpair': 'Spot the bad primer pair',
  'pcr.cycles': 'Copies after n cycles',
  'pcr.product': 'PCR product',
  'pcr.reverse': 'Writing the reverse primer',
  'pcr.design': 'Primers that add restriction sites',
  'gel.size': 'Estimating band size',
  'gel.agarose': 'Choosing agarose %',
  'gel.pfge': 'Is PFGE needed?',
  'gel.quant': 'DNA amount from band intensity',
  'num.freq': 'Site frequency 4ⁿ',
  'num.units': 'Restriction enzyme units',
  'num.unitsites': 'Units corrected for site density',
  'num.a260': 'Concentration from A260',
  'num.purity': 'Purity from A260/A280',
  'num.coverage': 'Library coverage (Clarke–Carbon)',
  'num.vectors': 'Vector capacity',
  'blot.panel': 'Full problem: all four blots',
  'blot.southern': 'Southern blot of variants',
  'blot.northern': 'Northern blot of variants',
  'blot.rtpcr': 'RT-PCR of variants',
  'blot.western': 'Western blot of variants',
  'blot.isoforms': 'Splice isoforms on Northern blots',
  'blot.map': 'Southern blot of a restriction map',
  'blot.mutants': 'Western blot of mutants',
  'clone.plac': 'Subcloning under Plac',
  'clone.excise': 'Enzymes that cut inside the gene',
  'clone.orient': 'Orientation: pUC18 or pUC19',
  'clone.rescue': 'Sites in the wrong order: blunting trick',
  'clone.blunt': 'Making ends blunt',
  'clone.select': 'Selection and blue/white screening',
  'clone.primers': 'Primers for a gene drawn backwards',
  'clone.rbs': 'NdeI: keeping the RBS–ATG distance',
  'expr.host': 'Host from vector elements',
  'expr.inducer': 'Inducing expression',
  'expr.tag': 'Tags, purification and proteases',
  'expr.frame': 'Cloning in frame with a tag',
  'expr.sds': 'Purification gel: which lane is which',
  'expr.western': 'Tag vs protein antibodies',
  'expr.trouble': 'Troubleshooting a purification',
  'expr.cellfree': 'Cell-free expression',
  'func.y2h': 'Yeast two-hybrid',
  'func.crispr': 'CRISPR knockout screens',
  'func.rnai': 'RNAi target validation',
  'func.reporter': 'Reporter assays (promoter bashing)',
  'func.technique': 'Recognising techniques',
  'gt.params': 'Games with parameters',
  'gt.dominance': 'Dominated strategies',
  'gt.iesds': 'Iterated elimination (IESDS)',
  'gt.pure': 'Pure-strategy equilibria',
  'gt.mixed': 'Mixed-strategy equilibria',
  'gt.story': 'From a story to a bimatrix',
  'gt.transfer': 'Side payments (α)',
  'gt.selection': 'Payoff vs risk dominance',
  'gt.rational': 'Rationalizability',
  'gt.cournot': 'Cournot and Bertrand',
  'gt.continuous': 'Continuous strategies',
  'gt.theory': 'Theorems and definitions',
};

export function modeOf(kind: string): ModeId {
  return kind.split('.')[0] as ModeId;
}

export function kindLabel(kind: string): string {
  if (KIND_LABELS[kind]) return KIND_LABELS[kind];
  if (kind.startsWith('tf.')) return `True/false · ${kind.slice(3).replace(/-/g, ' ')}`;
  return kind;
}

/** Sub-types a mode offers as practice filters (e.g. "ends.recut" → "recut"). */
export function kindsOfMode(mode: ModeId): string[] {
  return Object.keys(KIND_LABELS).filter((k) => modeOf(k) === mode);
}
