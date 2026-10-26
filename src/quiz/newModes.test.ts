import { describe, expect, it } from 'vitest';
import { applyVariant, codingLengthOfExon } from '../science/geneModel';
import { createRng } from '../science/rng';
import { generateBlotQuestion, makeGeneCase } from './blotQuestions';
import { generateCloningQuestion, PUC_FROM_PROMOTER } from './cloningQuestions';
import { checkFusion, generateExpressionQuestion } from './expressionQuestions';
import { generateFunctionalQuestion } from './functionalQuestions';
import { generateGelQuestion } from './gelQuestions';
import { generateNumbersQuestion } from './numbersQuestions';
import type { CaseQuestion, ChoiceQuestion, MatchQuestion, NumericQuestion } from './types';

const SEEDS = Array.from({ length: 40 }, (_, i) => `n${i}`);

describe('gene variant cases', () => {
  it('a skipped exon that is not a multiple of 3 removes the C-terminal epitope', () => {
    for (const seed of SEEDS) {
      const c = makeGeneCase(createRng(seed));
      c.variants.forEach((v, i) => {
        if (v.kind === 'exonSkip' && c.gene.epitope === 'C' && codingLengthOfExon(c.gene, v.exon) % 3 !== 0) {
          expect(c.outcomes[i].western).toEqual([]);
        }
        if (v.kind === 'exonSkip' && codingLengthOfExon(c.gene, v.exon) % 3 === 0 && c.outcomes[i].western.length) {
          expect(c.outcomes[i].western[0]).toBe(c.outcomes[0].western[0] - c.gene.exons[v.exon] / 3);
        }
      });
    }
  });

  it('frameshift variants only appear with a C-terminal antibody (so the answer is always deducible)', () => {
    for (const seed of SEEDS) {
      const c = makeGeneCase(createRng(seed));
      if (c.gene.epitope !== 'N') continue;
      c.variants.forEach((v) => {
        if (v.kind === 'exonDeletion') expect(v.length % 3).toBe(0);
        if (v.kind === 'exonSkip') expect(codingLengthOfExon(c.gene, v.exon) % 3).toBe(0);
      });
    }
  });

  it('the wild type always gives one band on every blot', () => {
    for (const seed of SEEDS) {
      const c = makeGeneCase(createRng(seed));
      const wt = applyVariant(c.gene, { kind: 'wt' });
      expect(wt.southern.length).toBeGreaterThan(0);
      expect(wt.northern).toHaveLength(1);
      expect(wt.rtpcr).toHaveLength(1);
      expect(wt.western).toHaveLength(1);
    }
  });

  it('the full problem has the four blots in exam order', () => {
    const q = generateBlotQuestion('panel', 'panel') as CaseQuestion;
    expect(q.parts.map((p) => p.kind)).toEqual(['blot.southern', 'blot.northern', 'blot.rtpcr', 'blot.western']);
  });

  it('missense and wild type are interchangeable in the mutant Western', () => {
    for (const seed of SEEDS) {
      const q = generateBlotQuestion(seed, 'mutants') as MatchQuestion;
      expect(q.correct.missense).toEqual(q.correct.wt);
      expect(q.correct.missense).toHaveLength(2);
    }
  });
});

describe('cloning strategy', () => {
  it('the right vector puts the 5′ enzyme nearest to Plac', () => {
    for (const seed of SEEDS) {
      const q = generateCloningQuestion(seed, 'plac') as CaseQuestion;
      const orient = q.parts.find((p) => p.kind === 'clone.orient') as ChoiceQuestion;
      const right = orient.options.find((o) => o.id === 'right')!.label;
      const m = right.match(/^(\w+) \(5′ end\) \+ (\w+) \(3′ end\), into (pUC1[89])$/)!;
      const order = PUC_FROM_PROMOTER[m[3] as 'pUC18' | 'pUC19'];
      expect(order.indexOf(m[1])).toBeLessThan(order.indexOf(m[2]));
    }
  });
});

describe('expression', () => {
  it('the in-frame site really puts the cDNA ATG a multiple of 3 after the tag ATG', () => {
    for (const seed of SEEDS) {
      const q = generateExpressionQuestion(seed, 'frame') as ChoiceQuestion;
      const rows = (q.visual as { rows: { seq: string }[] }).rows;
      const vector = rows[0].seq.replace(/ /g, '');
      const insert = rows[1].seq.replace('…', '');
      const atg = insert.search(/ATG[ACGT]{18}$/);
      expect(insert.slice(atg, atg + 3)).toBe('ATG');
      const c = checkFusion(vector, insert, atg, q.correct[0]);
      expect(c.inFrame && !c.stop).toBe(true);
    }
  });

  it('only the matrix after elution is an empty lane in the purification gel', () => {
    for (const seed of SEEDS) {
      const q = generateExpressionQuestion(seed, 'sds') as MatchQuestion;
      const lanes = (q.visual as { lanes: { bands: unknown[] }[] }).lanes;
      const empty = lanes.map((l, i) => (l.bands.length ? null : String(i + 1))).filter(Boolean);
      expect(empty).toEqual(q.correct.resinAfterElution);
    }
  });
});

describe('functional analysis', () => {
  it('the two-hybrid case ends with domain mapping', () => {
    const q = generateFunctionalQuestion('y', 'y2h') as CaseQuestion;
    expect(q.parts).toHaveLength(4);
  });
});

describe('course problems', () => {
  it('Lesson 2: 1 µg of a 5 kb plasmid with 2 EcoRI sites needs 5 U (λ = 50 kb, 4 sites)', () => {
    let found = false;
    for (const seed of SEEDS) {
      const q = generateNumbersQuestion(seed, 'unitsites') as NumericQuestion;
      if (q.prompt.includes('(50 kb, 4 EcoRI sites)') && q.prompt.includes('5 kb plasmid with 2')) {
        expect(q.answer).toBeCloseTo(5);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('band-intensity quantification: concentration × volume gives the requested mass', () => {
    for (const seed of SEEDS) {
      const q = generateGelQuestion(seed, 'quant') as CaseQuestion;
      const [conc, vol] = q.parts as NumericQuestion[];
      const target = Number(vol.prompt.match(/have (\d+) ng/)![1]);
      expect(conc.answer * vol.answer).toBeCloseTo(target, 6);
    }
  });
});
