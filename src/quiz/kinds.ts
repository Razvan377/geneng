/** Question kinds (stats keys) and the modes they belong to. */

export type ModeId = 'map' | 'ends' | 'pcr' | 'gel' | 'num' | 'tf';

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
  tf: {
    title: 'True / false',
    route: 'tf',
    blurb: 'Exam statements in Spanish, with the reasoning.',
  },
};

export const MODE_ORDER: ModeId[] = ['map', 'ends', 'pcr', 'gel', 'num', 'tf'];

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
  'num.freq': 'Site frequency 4ⁿ',
  'num.units': 'Restriction enzyme units',
  'num.a260': 'Concentration from A260',
  'num.purity': 'Purity from A260/A280',
  'num.coverage': 'Library coverage (Clarke–Carbon)',
  'num.vectors': 'Vector capacity',
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
