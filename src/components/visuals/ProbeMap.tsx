/** Linear restriction map with a highlighted region: a probe, or a gene with its direction. */

import { useElementWidth } from '../../lib/hooks';
import { formatKb } from '../../science/format';

interface Props {
  length: number;
  sites: { enzyme: string; pos: number }[];
  probe: [number, number];
  regionLabel?: string;
  arrow?: 1 | -1;
}

export function ProbeMap({ length, sites, probe, regionLabel, arrow }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>(360);
  const W = Math.max(300, width);
  const pad = 18;
  const x = (p: number) => pad + (p / length) * (W - 2 * pad);
  const y = 58;
  const sorted = [...sites].sort((a, b) => a.pos - b.pos);
  // Stagger labels above the line when neighbours are close.
  const rows: number[] = [];
  sorted.forEach((s, i) => {
    const close = i > 0 && x(s.pos) - x(sorted[i - 1].pos) < 52;
    rows.push(close ? (rows[i - 1] + 1) % 3 : 0);
  });
  const ticks: number[] = [];
  for (let k = 0; k <= length; k += 1000) ticks.push(k);
  const isGene = arrow !== undefined;

  return (
    <figure className="probe-map" ref={ref}>
      <svg width={W} height={124} role="img" aria-label={`Restriction map, ${formatKb(length)} kb, ${isGene ? 'gene' : 'probe'} from ${formatKb(probe[0])} to ${formatKb(probe[1])} kb`}>
        <line x1={x(0)} x2={x(length)} y1={y} y2={y} className="map-strand" />
        {sorted.map((s, i) => (
          <g key={`${s.enzyme}-${s.pos}`} className="pm-site">
            <line x1={x(s.pos)} x2={x(s.pos)} y1={y - 8 - rows[i] * 12} y2={y + 7} />
            <text x={x(s.pos)} y={y - 12 - rows[i] * 12} textAnchor="middle">
              {s.enzyme}
            </text>
          </g>
        ))}
        {isGene ? (
          <g className="pm-gene">
            <rect x={x(probe[0])} y={y - 5} width={x(probe[1]) - x(probe[0])} height={10} rx={2} />
            <path
              d={
                arrow === 1
                  ? `M${x(probe[0])} ${y + 20} H${x(probe[1])} m-7 -4 l7 4 l-7 4`
                  : `M${x(probe[1])} ${y + 20} H${x(probe[0])} m7 -4 l-7 4 l7 4`
              }
              className="pm-arrow"
            />
            <text x={(x(probe[0]) + x(probe[1])) / 2} y={y + 36} textAnchor="middle" className="pm-gene-label">
              {regionLabel ?? 'gene'}
            </text>
          </g>
        ) : (
          <rect x={x(probe[0])} y={y + 12} width={x(probe[1]) - x(probe[0])} height={6} rx={3} className="pm-probe" />
        )}
        {ticks.map((k) => (
          <g key={k} className="gene-ruler">
            <line x1={x(k)} x2={x(k)} y1={y + 46} y2={y + 52} />
            <text x={x(k)} y={y + 64} textAnchor="middle">
              {k / 1000}
            </text>
          </g>
        ))}
        <text x={x(length)} y={y + 64} textAnchor="end" className="gene-small">
          kb
        </text>
      </svg>
    </figure>
  );
}
