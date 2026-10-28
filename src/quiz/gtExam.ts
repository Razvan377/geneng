/**
 * Game theory mock midterm, laid out like the October 2023 paper: four problems worth
 * 3 + 2 + 3 + 2 points — a parametric 2×2 game, dominance and iterated elimination on a
 * numeric bimatrix, a story to model as a game, and a game with continuous strategies.
 * Every exam comes from one seed, so there is an endless supply and any exam can be replayed.
 */

import { createRng } from '../science/rng';
import { generateGameQuestion } from './gameQuestions';
import type { MockExam } from './mockExam';

export function generateGameTheoryExam(seed: string): MockExam {
  const rng = createRng(`gtexam/${seed}`);
  const sub = (label: string) => `${seed}-${label}`;
  const problems = [
    {
      title: 'A game with parameters',
      source: 'Midterm 2023 · 1; problem set 1.1, 1.3, 1.4',
      points: 3,
      blocks: [rng.chance(0.75) ? generateGameQuestion(sub('params'), 'params') : generateGameQuestion(sub('transfer'), 'transfer')],
    },
    {
      title: 'Dominance and iterated elimination',
      source: 'Midterm 2023 · 2; problem set 1.2, 1.16; rationalizability',
      points: 2,
      blocks: [rng.chance(0.8) ? generateGameQuestion(sub('iesds'), 'iesds') : generateGameQuestion(sub('rational'), 'rational')],
    },
    {
      title: 'From a story to a game',
      source: 'Midterm 2023 · 3; problem set 1.8, 1.9; selection',
      points: 3,
      blocks: [rng.chance(0.82) ? generateGameQuestion(sub('story'), 'story') : generateGameQuestion(sub('selection'), 'selection')],
    },
    {
      title: 'Continuous strategies',
      source: 'Midterm 2023 · 4; problem set 1.5, 1.11, 1.14, 1.15; Cournot and Bertrand',
      points: 2,
      blocks: [rng.chance(0.6) ? generateGameQuestion(sub('continuous'), 'continuous') : generateGameQuestion(sub('cournot'), 'cournot')],
    },
  ];
  return { seed, problems: problems.map((p, i) => ({ ...p, number: i + 1 })) };
}
