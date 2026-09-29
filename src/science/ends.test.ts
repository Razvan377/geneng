import { describe, expect, it } from 'vitest';
import { reverseComplement } from './dna';
import {
  canLigate,
  cutEnds,
  directionalVerdict,
  enzymesCuttingJunction,
  ligationJunction,
  schizomerRelation,
  vectorSelfLigation,
  type CloningSetup,
} from './ends';
import { endKind, ENZYMES, formatSite, getEnzyme, overhang, validateEnzyme } from './enzymes';

describe('enzyme table', () => {
  it('every entry is a valid palindromic site with a cut inside it', () => {
    for (const e of ENZYMES) expect(validateEnzyme(e)).toEqual([]);
  });

  it('has the cut positions from the course', () => {
    const sites = Object.fromEntries(
      ['EcoRI', 'EcoRV', 'SacI', 'BamHI', 'BglII', 'Sau3AI', 'SmaI', 'XmaI', 'PstI', 'KpnI'].map((n) => [
        n,
        formatSite(getEnzyme(n)),
      ]),
    );
    expect(sites).toEqual({
      EcoRI: 'G^AATTC',
      EcoRV: 'GAT^ATC',
      SacI: 'GAGCT^C',
      BamHI: 'G^GATCC',
      BglII: 'A^GATCT',
      Sau3AI: '^GATC',
      SmaI: 'CCC^GGG',
      XmaI: 'C^CCGGG',
      PstI: 'CTGCA^G',
      KpnI: 'GGTAC^C',
    });
  });
});

describe('end types and overhangs', () => {
  it.each([
    ['EcoRI', '5prime', 'AATT'],
    ['BamHI', '5prime', 'GATC'],
    ['Sau3AI', '5prime', 'GATC'],
    ['NotI', '5prime', 'GGCC'],
    ['PstI', '3prime', 'TGCA'],
    ['KpnI', '3prime', 'GTAC'],
    ['SacI', '3prime', 'AGCT'],
    ['EcoRV', 'blunt', ''],
    ['SmaI', 'blunt', ''],
  ])('%s → %s %s', (name, kind, oh) => {
    const e = getEnzyme(name);
    expect(endKind(e)).toBe(kind);
    expect(overhang(e)).toBe(oh);
  });

  it('draws EcoRI ends with the 5′ AATT protruding', () => {
    const { left, right } = cutEnds('EcoRI', 'CGT', 'ACG');
    expect(left.top).toBe('CGTG');
    expect(left.bottom).toBe('GCACTTAA'); // bottom strand 3′→5′ extends to the right: 5′ overhang
    expect(right.top).toBe('AATTCACG');
    expect(right.bottom).toBe('GTGC');
    expect(right.topStart).toBe(4);
    expect(right.bottomStart).toBe(8);
    expect(left.overhang).toEqual([4, 8]);
  });

  it('draws PstI ends with the 3′ TGCA protruding', () => {
    const { left, right } = cutEnds('PstI', 'AA', 'TT');
    expect(left.top).toBe('AACTGCA'); // top strand (3′ end) protrudes
    expect(left.bottom).toBe('TTG');
    expect(right.top).toBe('GTT');
    expect(right.bottomStart).toBe(3);
  });
});

describe('ligation', () => {
  it('ends from the same enzyme always ligate', () => {
    expect(canLigate('EcoRI', 'EcoRI').ok).toBe(true);
    expect(canLigate('PstI', 'PstI').ok).toBe(true);
  });

  it('different enzymes with the same overhang are compatible', () => {
    expect(canLigate('BamHI', 'BglII').ok).toBe(true);
    expect(canLigate('BamHI', 'Sau3AI').ok).toBe(true);
    expect(canLigate('SalI', 'XhoI').ok).toBe(true);
    expect(canLigate('XbaI', 'SpeI').ok).toBe(true);
    expect(canLigate('NheI', 'XbaI').ok).toBe(true);
  });

  it('any blunt end joins any other blunt end', () => {
    expect(canLigate('EcoRV', 'SmaI').ok).toBe(true);
  });

  it('rejects blunt + sticky, 5′ + 3′ and non-complementary overhangs', () => {
    expect(canLigate('EcoRV', 'EcoRI').ok).toBe(false);
    expect(canLigate('KpnI', 'Acc65I').ok).toBe(false); // GTAC 3′ vs GTAC 5′
    expect(canLigate('SacI', 'HindIII').ok).toBe(false); // AGCT 3′ vs AGCT 5′
    expect(canLigate('EcoRI', 'BamHI').ok).toBe(false);
    expect(canLigate('SmaI', 'XmaI').ok).toBe(false);
  });

  it('agrees with a strand-level check: overhangs must be reverse complements', () => {
    for (const a of ENZYMES)
      for (const b of ENZYMES) {
        const ka = endKind(a);
        const kb = endKind(b);
        const expected =
          ka === 'blunt' ? kb === 'blunt' : ka === kb && overhang(a) === reverseComplement(overhang(b));
        expect(canLigate(a.name, b.name).ok).toBe(expected);
      }
  });
});

describe('re-cutting a ligated junction', () => {
  const candidates = ['BamHI', 'BglII', 'Sau3AI', 'EcoRI', 'SalI', 'XhoI', 'TaqI', 'XbaI', 'SpeI', 'EcoRV', 'SmaI'];

  it('BamHI/BglII hybrid (GGATCT) is cut by neither parent, but still by Sau3AI', () => {
    const j = ligationJunction('BamHI', 'BglII', 'TTC', 'CAA');
    expect(j.seq).toBe('TTCGGATCTCAA');
    expect(enzymesCuttingJunction(j, candidates)).toEqual(['Sau3AI']);
  });

  it('BglII/BamHI hybrid in the other orientation (AGATCC) is also resistant to both', () => {
    const j = ligationJunction('BglII', 'BamHI', 'TTC', 'CAA');
    expect(j.seq).toBe('TTCAGATCCCAA');
    expect(enzymesCuttingJunction(j, candidates)).toEqual(['Sau3AI']);
  });

  it('same-enzyme ligation recreates the site', () => {
    const j = ligationJunction('EcoRI', 'EcoRI', 'TT', 'AA');
    expect(enzymesCuttingJunction(j, candidates)).toEqual(['EcoRI']);
  });

  it('SalI/XhoI hybrid is cut by neither, but by TaqI', () => {
    const j = ligationJunction('SalI', 'XhoI', 'AT', 'TA');
    expect(enzymesCuttingJunction(j, candidates)).toEqual(['TaqI']);
  });

  it('XbaI/SpeI and EcoRV/SmaI junctions are not recut', () => {
    expect(enzymesCuttingJunction(ligationJunction('XbaI', 'SpeI', 'AA', 'TT'), candidates)).toEqual([]);
    expect(enzymesCuttingJunction(ligationJunction('EcoRV', 'SmaI', 'AA', 'TT'), candidates)).toEqual([]);
  });

  it('BamHI vector + Sau3AI insert: BamHI is restored only if the insert continues with C', () => {
    expect(enzymesCuttingJunction(ligationJunction('BamHI', 'Sau3AI', 'AA', 'CT'), ['BamHI'])).toEqual(['BamHI']);
    expect(enzymesCuttingJunction(ligationJunction('BamHI', 'Sau3AI', 'AA', 'TT'), ['BamHI'])).toEqual([]);
  });
});

describe('isoschizomers and neoschizomers', () => {
  it('classifies pairs', () => {
    expect(schizomerRelation('Sau3AI', 'MboI')).toBe('isoschizomers');
    expect(schizomerRelation('HpaII', 'MspI')).toBe('isoschizomers');
    expect(schizomerRelation('SmaI', 'XmaI')).toBe('neoschizomers');
    expect(schizomerRelation('KpnI', 'Acc65I')).toBe('neoschizomers');
    expect(schizomerRelation('SacI', 'Ecl136II')).toBe('neoschizomers');
    expect(schizomerRelation('BamHI', 'BglII')).toBe('different-sites');
  });
});

describe('directional cloning', () => {
  const setup: CloningSetup = {
    mcs: ['EcoRI', 'SacI', 'KpnI', 'SmaI', 'BamHI', 'XbaI', 'SalI', 'PstI', 'HindIII'],
    vectorBackbone: ['PstI'],
    insert5: ['EcoRI', 'BamHI'],
    insert3: ['HindIII', 'BglII', 'PstI'],
    insertInternal: ['BamHI'],
  };

  it('accepts a pair of unique, non-internal enzymes with incompatible ends', () => {
    expect(directionalVerdict(setup, 'EcoRI', 'HindIII').ok).toBe(true);
  });

  it('rejects internal sites, missing MCS sites, backbone sites and same-enzyme pairs', () => {
    expect(directionalVerdict(setup, 'BamHI', 'HindIII').reason).toMatch(/inside the insert/);
    expect(directionalVerdict(setup, 'EcoRI', 'BglII').reason).toMatch(/MCS/);
    expect(directionalVerdict(setup, 'EcoRI', 'PstI').reason).toMatch(/backbone/);
    expect(directionalVerdict(setup, 'EcoRI', 'EcoRI').ok).toBe(false);
  });

  it('rejects compatible-end pairs (they are not directional)', () => {
    const s: CloningSetup = { ...setup, insert5: ['SalI'], insert3: ['XhoI'], mcs: [...setup.mcs, 'XhoI'], insertInternal: [] };
    expect(directionalVerdict(s, 'SalI', 'XhoI').ok).toBe(false);
  });
});

describe('alkaline phosphatase', () => {
  it('a dephosphorylated vector cannot self-ligate', () => {
    expect(vectorSelfLigation({ enzymes: ['BamHI'], phosphatase: true }).canSelfLigate).toBe(false);
    expect(vectorSelfLigation({ enzymes: ['SmaI'], phosphatase: true }).canSelfLigate).toBe(false);
  });

  it('an untreated vector with compatible ends can', () => {
    expect(vectorSelfLigation({ enzymes: ['BamHI'], phosphatase: false }).canSelfLigate).toBe(true);
    expect(vectorSelfLigation({ enzymes: ['BamHI', 'BglII'], phosphatase: false }).canSelfLigate).toBe(true);
  });

  it('two incompatible ends cannot re-close even without phosphatase', () => {
    expect(vectorSelfLigation({ enzymes: ['EcoRI', 'HindIII'], phosphatase: false }).canSelfLigate).toBe(false);
  });
});
