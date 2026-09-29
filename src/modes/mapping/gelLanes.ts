/** Turn a mapping puzzle's digest data into gel lanes. */

import type { GelBand, GelLane } from '../../components/Gel';
import type { Lane } from '../../science/digest';
import { formatKb } from '../../science/format';
import {
  bandsFromFragments,
  chooseLadder,
  fitModel,
  ladderBands,
  PLASMID_FORMS,
  uncutPlasmidBands,
  type Ladder,
  type MigrationModel,
} from '../../science/gel';
import type { Puzzle } from '../../science/puzzle';

export interface PuzzleGel {
  lanes: GelLane[];
  model: MigrationModel;
  ladder: Ladder;
  /** Lane label → description, for the legend. */
  legend: { label: string; text: string; laneId: string }[];
}

export function laneTitle(lane: Lane): string {
  const names = lane.enzymes.join(' + ');
  return lane.kind === 'partial' ? `${names} (partial)` : names;
}

function info(title: string, size: number, copies: number, extra = ''): string {
  return `${title}: ${formatKb(size)} kb${copies > 1 ? ` × ${copies} (co-migrating, brighter)` : ''}${extra}`;
}

/** Bands of a partial lane: complete-digest fragments at full strength, partial products fainter. */
function partialBands(puzzle: Puzzle, lane: Lane): GelBand[] {
  const single = puzzle.problem.lanes.find((l) => l.kind === 'single' && l.enzymes.join() === lane.enzymes.join());
  const complete = single ? single.fragments : [];
  return lane.fragments.map((size) => {
    const copies = complete.filter((f) => f === size).length;
    const isComplete = copies > 0;
    return {
      size,
      copies: Math.max(1, copies),
      mass: size * Math.max(1, copies) * (isComplete ? 0.8 : 0.4),
      form: 'linear',
      apparentSize: size,
      info: info(laneTitle(lane), size, copies, isComplete ? '' : ' (partial product)'),
    };
  });
}

export function puzzleGel(puzzle: Puzzle, showUncut: boolean): PuzzleGel {
  const { problem, length } = puzzle;
  const all = problem.lanes.flatMap((l) => l.fragments);
  const uncut: GelBand[] =
    problem.topology === 'circular'
      ? uncutPlasmidBands(length).map((b) => ({
          ...b,
          info: `Uncut plasmid: ${PLASMID_FORMS.find((f) => f.form === b.form)!.label}`,
        }))
      : [{ ...bandsFromFragments([length])[0], info: info('Uncut', length, 1) }];
  const maxSize = Math.max(...all, ...(showUncut ? uncut.map((b) => b.apparentSize) : []));
  const ladder = chooseLadder(maxSize);
  const minSize = Math.min(...all);
  const model = fitModel([...ladder.sizes, maxSize, minSize, ...(showUncut ? uncut.map((b) => b.apparentSize) : [])]);

  const lanes: GelLane[] = [
    { id: 'ladder', label: 'M', bands: ladderBands(ladder), ladder: true, reference: ladder.reference, inspect: true },
  ];
  lanes[0].bands = lanes[0].bands.map((b) => ({ ...b, info: `Marker: ${formatKb(b.size)} kb` }));
  const legend: PuzzleGel['legend'] = [{ label: 'M', text: ladder.name, laneId: 'ladder' }];

  problem.lanes.forEach((lane, i) => {
    const label = String(i + 1);
    const bands: GelBand[] =
      lane.kind === 'partial'
        ? partialBands(puzzle, lane)
        : bandsFromFragments(lane.fragments).map((b) => ({ ...b, info: info(laneTitle(lane), b.size, b.copies) }));
    lanes.push({ id: lane.id, label, bands, inspect: true });
    legend.push({ label, text: laneTitle(lane), laneId: lane.id });
  });

  if (showUncut) {
    lanes.push({ id: 'uncut', label: 'U', bands: uncut, inspect: true });
    legend.push({
      label: 'U',
      text: problem.topology === 'circular' ? 'Uncut plasmid (supercoiled, linear, open-circular)' : 'Uncut DNA',
      laneId: 'uncut',
    });
  }
  return { lanes, model, ladder, legend };
}
