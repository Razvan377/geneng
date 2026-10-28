/**
 * A game in normal form, laid out like the course slides: player 2's strategies across the top,
 * player 1's down the side, "u1, u2" in each cell. Corrections underline best responses, strike
 * out eliminated strategies and ring equilibria.
 */

import type { BimatrixMarks } from '../../quiz/types';

interface Props {
  players: [string, string];
  rows: string[];
  cols: string[];
  cells: string[][][];
  marks?: BimatrixMarks;
  rowProbs?: string[];
  colProbs?: string[];
  caption?: string;
}

export function Bimatrix({ players, rows, cols, cells, marks, rowProbs, colProbs, caption }: Props) {
  const struckRows = new Set(marks?.struckRows ?? []);
  const struckCols = new Set(marks?.struckCols ?? []);
  const ringed = new Set((marks?.ring ?? []).map(([r, c]) => `${r},${c}`));
  const describe = (r: number, c: number) => `${players[0]} ${rows[r]}, ${players[1]} ${cols[c]}: ${cells[r][c].join(', ')}`;

  return (
    <figure className="bimatrix-figure">
      <div className="table-scroll">
        <table className="bimatrix" aria-label={`Payoff matrix. ${players[0]} chooses a row, ${players[1]} a column.`}>
          <thead>
            <tr>
              <th colSpan={2} rowSpan={2} className="bm-corner" aria-hidden="true" />
              <th colSpan={cols.length} scope="colgroup" className="bm-player">
                {players[1]}
              </th>
            </tr>
            <tr>
              {cols.map((c, j) => (
                <th key={j} scope="col" className={`bm-strategy${struckCols.has(j) ? ' is-struck' : ''}`}>
                  {colProbs?.[j] && <span className="bm-prob">({colProbs[j]})</span>}
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {i === 0 && (
                  <th rowSpan={rows.length} scope="rowgroup" className="bm-player bm-player-side">
                    <span>{players[0]}</span>
                  </th>
                )}
                <th scope="row" className={`bm-strategy${struckRows.has(i) ? ' is-struck' : ''}`}>
                  {rowProbs?.[i] && <span className="bm-prob">({rowProbs[i]})</span>}
                  {r}
                </th>
                {cols.map((_, j) => {
                  const struck = struckRows.has(i) || struckCols.has(j);
                  const ring = ringed.has(`${i},${j}`);
                  return (
                    <td key={j} className={`bm-cell${struck ? ' is-struck' : ''}${ring ? ' is-ringed' : ''}`} aria-label={describe(i, j)}>
                      {cells[i][j].map((v, k) => (
                        <span key={k}>
                          {k > 0 && ', '}
                          <span className={marks?.underline?.[i]?.[j]?.[k] ? 'bm-best' : undefined}>{v}</span>
                        </span>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <figcaption className="fine-print">{caption}</figcaption>}
    </figure>
  );
}
