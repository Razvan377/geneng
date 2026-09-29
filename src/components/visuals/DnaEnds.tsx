/**
 * Double-stranded DNA ends drawn base by base in SVG (so strands always line up, whatever the
 * font): top strand 5′→3′, bottom strand 3′→5′, single-stranded overhang highlighted in amber,
 * 5′ ends labelled with their phosphate (P) or, after phosphatase, their hydroxyl (OH).
 */

import type { DsEnd } from '../../science/ends';

const CW = 13; // character width
const ROW = 24;

interface Props {
  ends: DsEnd[];
  captions?: string[];
  dephosphorylated?: boolean;
}

export function DnaEnds({ ends, captions, dephosphorylated }: Props) {
  return (
    <div className="dna-ends">
      {ends.map((end, i) => (
        <div key={i} className="dna-end">
          {captions?.[i] && <span className="dna-caption">{captions[i]}</span>}
          <EndSvg end={end} dephosphorylated={dephosphorylated} />
        </div>
      ))}
    </div>
  );
}

function EndSvg({ end, dephosphorylated }: { end: DsEnd; dephosphorylated?: boolean }) {
  const topFrom = end.topStart;
  const topTo = end.topStart + end.top.length;
  const botFrom = end.bottomStart;
  const botTo = end.bottomStart + end.bottom.length;
  const minCol = Math.min(topFrom, botFrom);
  const maxCol = Math.max(topTo, botTo);
  const five = dephosphorylated ? '5′ OH' : '5′ P';
  // The fragment continues on the side away from the cut: draw an ellipsis there.
  const continuesLeft = end.side === 'right';
  const lead = 4; // columns reserved on each side for labels / ellipsis
  const x = (col: number) => (col - minCol + lead) * CW;
  const width = (maxCol - minCol + 2 * lead) * CW;
  const yTop = 18;
  const yBot = yTop + ROW;
  const [ohFrom, ohTo] = end.overhang;

  const bases = (seq: string, from: number, y: number) =>
    seq.split('').map((b, i) => {
      const col = from + i;
      const inOverhang = col >= ohFrom && col < ohTo && ohTo > ohFrom;
      return (
        <g key={col}>
          {inOverhang && <rect x={x(col) - 1} y={y - 14} width={CW} height={19} rx={2} className="oh-bg" />}
          <text x={x(col) + CW / 2 - 1} y={y} textAnchor="middle" className="base">
            {b}
          </text>
        </g>
      );
    });

  const label = (text: string, col: number, y: number, anchor: 'start' | 'end', emph = false) => (
    <text x={anchor === 'end' ? x(col) - 4 : x(col) + 3} y={y} textAnchor={anchor} className={emph ? 'end-label phos' : 'end-label'}>
      {text}
    </text>
  );

  return (
    <svg
      width={width}
      height={yBot + 12}
      className="dna-svg"
      role="img"
      aria-label={`DNA end: top strand 5′-${end.top}-3′ starting at column ${end.topStart}, bottom strand 3′-${end.bottom}-5′ starting at column ${end.bottomStart}`}
    >
      {continuesLeft ? (
        <>
          <text x={x(minCol) - 4} y={yTop} textAnchor="end" className="ellipsis">
            ···
          </text>
          <text x={x(minCol) - 4} y={yBot} textAnchor="end" className="ellipsis">
            ···
          </text>
          {label('3′', topTo, yTop, 'start')}
          {label(five, botTo, yBot, 'start', true)}
        </>
      ) : (
        <>
          {label(five, topFrom, yTop, 'end', true)}
          {label('3′', botFrom, yBot, 'end')}
          <text x={x(maxCol) + 4} y={yTop} className="ellipsis">
            ···
          </text>
          <text x={x(maxCol) + 4} y={yBot} className="ellipsis">
            ···
          </text>
        </>
      )}
      {bases(end.top, topFrom, yTop)}
      {bases(end.bottom, botFrom, yBot)}
      {/* base-pairing ticks where both strands are present */}
      {Array.from({ length: Math.max(0, Math.min(topTo, botTo) - Math.max(topFrom, botFrom)) }, (_, i) => {
        const col = Math.max(topFrom, botFrom) + i;
        return <line key={col} x1={x(col) + CW / 2 - 1} x2={x(col) + CW / 2 - 1} y1={yTop + 5} y2={yBot - 14} className="pair" />;
      })}
    </svg>
  );
}
