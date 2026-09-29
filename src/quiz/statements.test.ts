import { describe, expect, it } from 'vitest';
import raw from '../data/statements.json';
import { splitTrapWords, STATEMENTS, topicSlug, validateStatements } from './statements';

describe('statements.json', () => {
  it('is valid against the schema', () => {
    const { statements, errors } = validateStatements(raw);
    expect(errors).toEqual([]);
    expect(statements.length).toBeGreaterThanOrEqual(10);
    expect(STATEMENTS.statements).toHaveLength(statements.length);
  });

  it('reports malformed entries instead of crashing', () => {
    const { statements, errors } = validateStatements([
      { id: 'ok', exam: 'x', number: 1, topic: 't', textEs: 'a', textEn: 'b', answer: true, explanation: 'c' },
      { id: 'bad', exam: 'x', number: '2', topic: 't', textEs: 'a', textEn: 'b', answer: 'yes', explanation: 'c' },
      { id: 'ok', exam: 'x', number: 3, topic: 't', textEs: 'a', textEn: 'b', answer: false, explanation: 'c' },
      null,
    ]);
    expect(statements.map((s) => s.id)).toEqual(['ok']);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/"number" must be a number/);
    expect(errors[1]).toMatch(/duplicate id/);
    expect(validateStatements({}).errors).toHaveLength(1);
  });
});

describe('trap words', () => {
  const traps = (text: string) => splitTrapWords(text).filter((p) => p.trap).map((p) => p.text);

  it('finds whole words, case-insensitively, with accents', () => {
    expect(traps('Sólo los plásmidos... SIEMPRE, únicamente; todos')).toEqual(['Sólo', 'SIEMPRE', 'únicamente', 'todos']);
    expect(traps('Solo una enzima, solamente una, ninguna otra, cualquier vector')).toEqual([
      'Solo',
      'solamente',
      'ninguna',
      'cualquier',
    ]);
  });

  it('highlights common inflections', () => {
    expect(traps('cualquiera de las dos, todas las enzimas, ningún vector')).toEqual(['cualquiera', 'todas', 'ningún']);
  });

  it('does not match inside other words', () => {
    expect(traps('consolidar, soloista, siempreviva, todosanto')).toEqual([]);
  });

  it('keeps the full text when rejoined', () => {
    const text = 'La enzima EcoRI siempre produce extremos romos.';
    expect(splitTrapWords(text).map((p) => p.text).join('')).toBe(text);
  });

  it('slugifies topics for stats keys', () => {
    expect(topicSlug('Enzimas de restricción')).toBe('enzimas-de-restriccion');
  });
});
