import { formatInt } from '../../science/format';
import { AGAROSE_TABLE, agaroseModel, LADDERS } from '../../science/gel';
import { formatSize } from '../../quiz/gelQuestions';
import type { Visual } from '../../quiz/types';
import { Gel } from '../Gel';
import { CloningDiagram } from './CloningDiagram';
import { DnaEnds } from './DnaEnds';
import { SequenceView } from './SequenceView';
import { SiteCards } from './SiteCards';
import { StandardCurve } from './StandardCurve';

interface Props {
  visual: Visual;
  /** The player's numeric answer converted to bp, for charts that plot it. */
  guessBp?: number | null;
}

export function VisualView({ visual, guessBp = null }: Props) {
  switch (visual.type) {
    case 'ends':
      return <DnaEnds ends={visual.ends} captions={visual.captions} dephosphorylated={visual.dephosphorylated} />;
    case 'sites':
      return <SiteCards enzymes={visual.enzymes} />;
    case 'cloning':
      return <CloningDiagram setup={visual.setup} />;
    case 'sequence':
      return <SequenceView rows={visual.rows} wrap={visual.wrap} />;
    case 'facts':
      return (
        <div className="table-scroll">
          <table className="data-table facts">
            <tbody>
              {visual.rows.map(([k, v], i) =>
                i === 0 && k === '' ? (
                  <tr key={i}>
                    <th />
                    <th>{v}</th>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td>{k}</td>
                    <td className="num">{v}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      );
    case 'gelReading': {
      const ladder = LADDERS[visual.ladderId];
      return (
        <Gel
          ariaLabel={`Agarose gel: ${ladder.name} in lane M and one unknown band in lane 1, ${visual.unknownMm} mm from the well.`}
          model={agaroseModel(visual.percent)}
          rulerMm={visual.runMm}
          ladderLabels={(s) => (ladder.id === 'bp100' ? formatInt(s) : formatSize(s).replace(' kb', ''))}
          ladderUnit={ladder.id === 'bp100' ? 'bp' : 'kb'}
          height={320}
          lanes={[
            {
              id: 'M',
              label: 'M',
              ladder: true,
              reference: ladder.reference,
              inspect: true,
              bands: ladder.sizes.map((size, i) => ({
                size,
                copies: 1,
                mass: 1,
                form: 'linear',
                apparentSize: size,
                position: visual.ladderMm[i] / visual.runMm,
                info: `Marker ${formatSize(size)} · ${visual.ladderMm[i]} mm`,
              })),
            },
            {
              id: 'u',
              label: '1',
              bands: [
                {
                  size: visual.unknownBp,
                  copies: 1,
                  mass: 1,
                  form: 'linear',
                  apparentSize: visual.unknownBp,
                  position: visual.unknownMm / visual.runMm,
                },
              ],
            },
          ]}
        />
      );
    }
    case 'standardCurve':
      return (
        <StandardCurve
          ladderSizes={visual.ladderSizes}
          ladderMm={visual.ladderMm}
          inRange={visual.inRange}
          unknownMm={visual.unknownMm}
          unknownBp={visual.unknownBp}
          guessBp={guessBp}
        />
      );
    case 'agaroseTable':
      return (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agarose</th>
                <th>Separates linear DNA of</th>
              </tr>
            </thead>
            <tbody>
              {AGAROSE_TABLE.map((r) => (
                <tr key={r.percent} className={visual.highlight.includes(r.percent) ? 'is-highlight' : undefined}>
                  <td>{r.percent}%</td>
                  <td className="num">
                    {formatSize(r.minBp)} – {formatSize(r.maxBp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visual.target && (
            <p className="fine-print">
              Needed: {formatSize(visual.target[0])} – {formatSize(visual.target[1])}. Highlighted rows cover the whole range.
            </p>
          )}
        </div>
      );
  }
}
