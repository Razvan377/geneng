/**
 * Sticky ends, blunt ends and ligation (Brown §4.2.3, §4.3).
 *
 * Double-stranded DNA is drawn as two aligned rows: the top strand 5′→3′ left to right and the
 * bottom strand 3′→5′ underneath. Columns are shared, so a cut on each strand is just a column
 * index, and an overhang is the set of columns where only one strand is present.
 */

import { complement, findAll, reverseComplement } from './dna';
import { bottomCut, endKind, getEnzyme, overhang, type EndKind, type Enzyme } from './enzymes';

/** One end of a double-stranded fragment, as drawn on screen. */
export interface DsEnd {
  enzyme: string;
  /** 'right' = the right-hand end of the left fragment; 'left' = the left-hand end of the right fragment. */
  side: 'left' | 'right';
  top: string;
  bottom: string;
  /** Column where each strand starts (lets the renderer offset the protruding strand). */
  topStart: number;
  bottomStart: number;
  /** Columns [from, to) of the single-stranded overhang (empty for blunt ends). */
  overhang: [number, number];
  kind: EndKind;
}

/**
 * Cut `flankLeft + site + flankRight` with an enzyme. Returns the right end of the left
 * fragment and the left end of the right fragment, sharing one column system.
 */
export function cutEnds(enzymeName: string, flankLeft: string, flankRight: string): { left: DsEnd; right: DsEnd } {
  const e = getEnzyme(enzymeName);
  const top = flankLeft + e.site + flankRight;
  const bottom = complement(top);
  const topCut = flankLeft.length + e.cut;
  const botCut = flankLeft.length + bottomCut(e);
  const kind = endKind(e);
  const ov: [number, number] = [Math.min(topCut, botCut), Math.max(topCut, botCut)];
  return {
    left: {
      enzyme: e.name,
      side: 'right',
      top: top.slice(0, topCut),
      bottom: bottom.slice(0, botCut),
      topStart: 0,
      bottomStart: 0,
      overhang: ov,
      kind,
    },
    right: {
      enzyme: e.name,
      side: 'left',
      top: top.slice(topCut),
      bottom: bottom.slice(botCut),
      topStart: topCut,
      bottomStart: botCut,
      overhang: ov,
      kind,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Ligation

export interface LigationVerdict {
  ok: boolean;
  reason: string;
}

/**
 * Can an end made by enzyme A be joined to an end made by enzyme B?
 * Blunt ends join any blunt end. Sticky ends need the same kind of overhang (5′ with 5′, 3′ with
 * 3′) and complementary single strands — for palindromic sites, the same overhang sequence.
 */
export function canLigate(aName: string, bName: string): LigationVerdict {
  const a = getEnzyme(aName);
  const b = getEnzyme(bName);
  const ka = endKind(a);
  const kb = endKind(b);
  const oa = overhang(a);
  const ob = overhang(b);
  if (ka === 'blunt' && kb === 'blunt') {
    return {
      ok: true,
      reason: `Both ends are blunt, and any two blunt ends can be joined by DNA ligase (although blunt-end ligation is much less efficient than sticky-end ligation).`,
    };
  }
  if (ka === 'blunt' || kb === 'blunt') {
    const [blunt, sticky] = ka === 'blunt' ? [a, b] : [b, a];
    return {
      ok: false,
      reason: `${blunt.name} leaves a blunt end but ${sticky.name} leaves a ${label(endKind(sticky))} (${overhang(sticky)}). A single-stranded overhang cannot be joined to a blunt end.`,
    };
  }
  if (ka !== kb) {
    return {
      ok: false,
      reason: `${a.name} leaves a ${label(ka)} (${oa}) but ${b.name} leaves a ${label(kb)} (${ob}). Even ${oa === ob ? 'with the same sequence, ' : ''}a protruding 5′ end cannot pair with a protruding 3′ end: the strands would have to run in the same direction.`,
    };
  }
  if (oa.length !== ob.length || oa !== reverseComplement(ob)) {
    return {
      ok: false,
      reason: `Both are ${label(ka)}s, but ${oa} (${a.name}) and ${ob} (${b.name}) are not complementary, so the ends cannot base-pair.`,
    };
  }
  return {
    ok: true,
    reason:
      a.name === b.name
        ? `Both ends were made by ${a.name}: identical ${oa} ${label(ka)}s are complementary and anneal.`
        : `${a.name} and ${b.name} recognise different sites but leave the same ${oa} ${label(ka)}, so their sticky ends are compatible.`,
  };
}

function label(k: EndKind): string {
  return k === '5prime' ? '5′ overhang' : k === '3prime' ? '3′ overhang' : 'blunt end';
}

export interface Junction {
  /** Top strand of the ligated product around the junction. */
  seq: string;
  /** Columns of the two strand breaks that ligase sealed (equal for blunt ends). */
  topJunction: number;
  bottomJunction: number;
}

/**
 * Ligated product of a left fragment cut by `leftEnzyme` and a right fragment cut by
 * `rightEnzyme` (the ends must be compatible): left half-site up to its top-strand cut, then the
 * right half-site from its cut. The bottom strand is broken where the left enzyme cut it.
 */
export function ligationJunction(leftEnzyme: string, rightEnzyme: string, flankLeft = '', flankRight = ''): Junction {
  const l = getEnzyme(leftEnzyme);
  const r = getEnzyme(rightEnzyme);
  const leftPart = flankLeft + l.site.slice(0, l.cut);
  return {
    seq: leftPart + r.site.slice(r.cut) + flankRight,
    topJunction: leftPart.length,
    bottomJunction: flankLeft.length + bottomCut(l),
  };
}

/**
 * Enzymes (from the candidates) with a site that includes the junction: it spans a sealed strand
 * break or lies in the annealed overhang, so it only exists because of this ligation.
 */
export function enzymesCuttingJunction(j: Junction, candidates: readonly string[]): string[] {
  const lo = Math.min(j.topJunction, j.bottomJunction);
  const hi = Math.max(j.topJunction, j.bottomJunction);
  return candidates.filter((name) => {
    const site = getEnzyme(name).site;
    return findAll(j.seq, site).some((i) => (lo === hi ? i < lo && i + site.length > lo : i < hi && i + site.length > lo));
  });
}

/** Enzymes (from the candidates) with a site anywhere in `seq`. */
export function enzymesCutting(seq: string, candidates: readonly string[]): string[] {
  return candidates.filter((name) => seq.includes(getEnzyme(name).site));
}

// ---------------------------------------------------------------------------------------------
// Isoschizomers and neoschizomers

export type SchizomerRelation = 'isoschizomers' | 'neoschizomers' | 'different-sites';

/**
 * Isoschizomers recognise the same sequence and cut it at the same position; neoschizomers
 * recognise the same sequence but cut at a different position.
 */
export function schizomerRelation(aName: string, bName: string): SchizomerRelation {
  const a = getEnzyme(aName);
  const b = getEnzyme(bName);
  if (a.site !== b.site) return 'different-sites';
  return a.cut === b.cut ? 'isoschizomers' : 'neoschizomers';
}

// ---------------------------------------------------------------------------------------------
// Directional cloning

export interface CloningSetup {
  /** Unique sites of the vector's multiple cloning site, in order. */
  mcs: string[];
  /** Enzymes that also cut elsewhere in the vector backbone. */
  vectorBackbone: string[];
  /** Sites at the 5′ end of the insert, at its 3′ end, and inside it. */
  insert5: string[];
  insert3: string[];
  insertInternal: string[];
}

export interface PairVerdict {
  ok: boolean;
  reason: string;
}

/** Does cutting vector and insert with enzymes a (5′ end) + b (3′ end) give directional cloning? */
export function directionalVerdict(setup: CloningSetup, a: string, b: string): PairVerdict {
  if (a === b) {
    return { ok: false, reason: `Using ${a} at both ends gives identical ends: the insert can ligate in either orientation, and the vector can close on itself.` };
  }
  for (const [name, end] of [
    [a, "5′"],
    [b, "3′"],
  ] as const) {
    const where = end === "5′" ? setup.insert5 : setup.insert3;
    if (!where.includes(name)) return { ok: false, reason: `There is no ${name} site at the ${end} end of the insert.` };
    if (setup.insertInternal.includes(name))
      return { ok: false, reason: `${name} also cuts inside the insert, so the insert would be cut into pieces.` };
    if (!setup.mcs.includes(name)) return { ok: false, reason: `${name} has no site in the vector's MCS.` };
    if (setup.vectorBackbone.includes(name))
      return { ok: false, reason: `${name} also cuts the vector backbone, which would destroy the vector.` };
  }
  const lig = canLigate(a, b);
  if (lig.ok) {
    return {
      ok: false,
      reason: `${a} and ${b} give compatible ends (${endDescription(getEnzyme(a))} and ${endDescription(getEnzyme(b))}), so the insert could still go in backwards and the vector could re-close.`,
    };
  }
  return {
    ok: true,
    reason: `${a} and ${b} each cut once in the MCS, flank the insert without cutting inside it, and leave incompatible ends — so the insert can only go in one way round and the vector cannot close on itself.`,
  };
}

function endDescription(e: Enzyme): string {
  const k = endKind(e);
  return k === 'blunt' ? 'blunt' : `${overhang(e)} ${k === '5prime' ? '5′' : '3′'}`;
}

// ---------------------------------------------------------------------------------------------
// Alkaline phosphatase and vector self-ligation

export interface SelfLigationScenario {
  enzymes: string[]; // one or two enzymes used to open the vector
  phosphatase: boolean;
}

export interface SelfLigationVerdict {
  canSelfLigate: boolean;
  reason: string;
}

export function vectorSelfLigation({ enzymes, phosphatase }: SelfLigationScenario): SelfLigationVerdict {
  const [a, b = a] = enzymes;
  if (phosphatase) {
    return {
      canSelfLigate: false,
      reason:
        'Alkaline phosphatase removed the 5′ phosphate groups from both ends of the vector. DNA ligase can only make a phosphodiester bond between a 3′-OH and a 5′-phosphate, so the vector cannot close on itself. An insert (which still has its 5′ phosphates) can be ligated in: two of the four bonds form, and the two remaining nicks are repaired inside E. coli.',
    };
  }
  const lig = canLigate(a, b);
  if (lig.ok) {
    return {
      canSelfLigate: true,
      reason:
        (a === b
          ? `Both ends were made by ${a}, so they are compatible`
          : `The ${a} and ${b} ends are compatible`) +
        ' and still carry their 5′ phosphates: ligase will happily re-circularise the empty vector, giving a high background of non-recombinants.',
    };
  }
  return {
    canSelfLigate: false,
    reason: `${a} and ${b} leave incompatible ends, so the vector cannot re-circularise (provided the small fragment cut out of the MCS is removed). This is also what makes the cloning directional.`,
  };
}
