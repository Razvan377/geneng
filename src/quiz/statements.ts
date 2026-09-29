/** Mode 6 — true/false statements: schema validation, filtering and trap-word highlighting. */

import raw from '../data/statements.json';

export interface Statement {
  id: string;
  exam: string;
  number: number;
  topic: string;
  textEs: string;
  textEn: string;
  answer: boolean;
  explanation: string;
  debatable?: boolean;
}

export interface LoadResult {
  statements: Statement[];
  errors: string[];
}

const REQUIRED_STRINGS = ['id', 'exam', 'topic', 'textEs', 'textEn', 'explanation'] as const;

/** Validate untrusted JSON against the Statement schema. Invalid entries are skipped and reported. */
export function validateStatements(data: unknown): LoadResult {
  const errors: string[] = [];
  const statements: Statement[] = [];
  if (!Array.isArray(data)) return { statements, errors: ['statements.json must contain an array'] };
  const seen = new Set<string>();
  data.forEach((item, i) => {
    const where = `entry ${i + 1}`;
    if (typeof item !== 'object' || item === null) {
      errors.push(`${where}: not an object`);
      return;
    }
    const s = item as Record<string, unknown>;
    const problems: string[] = [];
    for (const key of REQUIRED_STRINGS) {
      if (typeof s[key] !== 'string' || !(s[key] as string).trim()) problems.push(`"${key}" must be a non-empty string`);
    }
    if (typeof s.number !== 'number' || !Number.isFinite(s.number)) problems.push('"number" must be a number');
    if (typeof s.answer !== 'boolean') problems.push('"answer" must be true or false');
    if (s.debatable !== undefined && typeof s.debatable !== 'boolean') problems.push('"debatable" must be true or false');
    if (typeof s.id === 'string') {
      if (seen.has(s.id)) problems.push(`duplicate id "${s.id}"`);
      seen.add(s.id);
    }
    if (problems.length) {
      errors.push(`${typeof s.id === 'string' ? `"${s.id}"` : where}: ${problems.join('; ')}`);
      return;
    }
    statements.push(s as unknown as Statement);
  });
  return { statements, errors };
}

export const STATEMENTS: LoadResult = validateStatements(raw);

export function topicSlug(topic: string): string {
  return topic
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------------------------
// Trap words

/** Absolute words that often make an exam statement false. */
export const TRAP_WORDS = ['siempre', 'solo', 'sólo', 'solamente', 'ninguna', 'cualquier', 'todos', 'únicamente'];

/** Inflected forms highlighted along with the list above. */
export const TRAP_VARIANTS = ['cualquiera', 'ningún', 'ninguno', 'todas'];

const TRAP_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${[...TRAP_WORDS, ...TRAP_VARIANTS].sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}\\p{N}])`,
  'giu',
);

export interface TextPart {
  text: string;
  trap: boolean;
}

/** Split a statement into plain text and trap words (whole words, case-insensitive, accent-aware). */
export function splitTrapWords(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(TRAP_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: text.slice(last, i), trap: false });
    parts.push({ text: m[0], trap: true });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), trap: false });
  return parts;
}
