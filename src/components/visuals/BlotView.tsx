import type { BlotLaneData, BlotLook, BlotUnit } from '../../quiz/types';
import { fitModel } from '../../science/gel';
import { trimNumber } from '../../science/format';
import { Gel, type GelBand, type GelLane } from '../Gel';

interface Props {
  look: BlotLook;
  unit: BlotUnit;
  ladder: number[];
  lanes: BlotLaneData[];
  caption?: string;
  /** Lane ids marked wrong (drawn with a dashed outline). */
  errors?: boolean[];
  ariaLabel?: string;
  height?: number;
}

function band(size: number, intensity?: number): GelBand {
  return { size, copies: 1, mass: 1, form: 'linear', apparentSize: size, intensity: intensity ?? 0.85 };
}

/** A blot or gel built from plain band sizes (kb or kDa), with an optional marker lane. */
export function BlotView({ look, unit, ladder, lanes, caption, errors, ariaLabel, height }: Props) {
  const sizes = [...ladder, ...lanes.flatMap((l) => l.bands.map((b) => b.size))].filter((s) => s > 0);
  const model = fitModel(sizes.length ? sizes : [1, 10]);
  const gelLanes: GelLane[] = [];
  if (ladder.length) {
    gelLanes.push({ id: 'L', label: 'L', ladder: true, bands: ladder.map((s) => band(s, look === 'film' ? 0.55 : 0.6)) });
  }
  lanes.forEach((l, i) =>
    gelLanes.push({
      id: `${l.label}-${i}`,
      label: l.label,
      bands: l.bands.map((b) => band(b.size, b.intensity)),
      status: errors?.[i] ? 'error' : undefined,
    }),
  );
  return (
    <figure className="blot-figure">
      <Gel
        look={look}
        lanes={gelLanes}
        model={model}
        height={height ?? 260}
        ariaLabel={ariaLabel ?? `${lanes.length}-lane ${look === 'coomassie' ? 'protein gel' : look === 'film' ? 'blot' : 'gel'}`}
        ladderLabels={ladder.length ? (s) => trimNumber(s, 2) : undefined}
        ladderUnit={ladder.length ? unit : undefined}
      />
      {caption && <figcaption className="fine-print">{caption}</figcaption>}
    </figure>
  );
}
