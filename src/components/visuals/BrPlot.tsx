/**
 * Best-response functions in the strategy plane, as on the slides: one curve per player, with
 * the equilibria where they cross marked.
 */

import { useElementWidth } from '../../lib/hooks';

interface Props {
  xLabel: string;
  yLabel: string;
  xMax: number;
  yMax: number;
  xTicks: { at: number; label: string }[];
  yTicks: { at: number; label: string }[];
  series: { label: string; tone: 'teal' | 'coral'; points: [number, number][] }[];
  dots?: { x: number; y: number; label?: string }[];
  caption?: string;
}

export function BrPlot({ xLabel, yLabel, xMax, yMax, xTicks, yTicks, series, dots = [], caption }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>(320);
  const m = { left: 44, right: 16, top: 18, bottom: 40 };
  const side = Math.max(200, Math.min(300, width - m.left - m.right));
  const w = side + m.left + m.right;
  const h = side + m.top + m.bottom;
  const xOf = (v: number) => m.left + (v / xMax) * side;
  const yOf = (v: number) => m.top + side - (v / yMax) * side;
  const summary = dots.length
    ? `Equilibria at ${dots.map((d) => d.label ?? `(${d.x}, ${d.y})`).join('; ')}.`
    : 'The curves do not cross.';

  return (
    <figure className="chart br-plot" ref={ref}>
      <svg width={w} height={h} role="img" aria-label={`Best-response functions: ${series.map((s) => s.label).join(' and ')}. ${summary}`}>
        {xTicks.map((t) => (
          <g key={`x${t.at}`}>
            <line x1={xOf(t.at)} x2={xOf(t.at)} y1={m.top} y2={m.top + side} className="grid-line" />
            <text x={xOf(t.at)} y={m.top + side + 15} textAnchor="middle" className="tick-label">
              {t.label}
            </text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t.at}`}>
            <line x1={m.left} x2={m.left + side} y1={yOf(t.at)} y2={yOf(t.at)} className="grid-line" />
            <text x={m.left - 6} y={yOf(t.at) + 3.5} textAnchor="end" className="tick-label">
              {t.label}
            </text>
          </g>
        ))}
        <line x1={m.left} x2={m.left} y1={m.top} y2={m.top + side} className="axis-line" />
        <line x1={m.left} x2={m.left + side} y1={m.top + side} y2={m.top + side} className="axis-line" />
        <text x={m.left + side / 2} y={h - 6} textAnchor="middle" className="axis-label">
          {xLabel}
        </text>
        <text x={4} y={11} className="axis-label">
          {yLabel}
        </text>
        {series.map((s, i) => (
          <polyline
            key={s.label}
            points={s.points.map(([x, y]) => `${xOf(x)},${yOf(y)}`).join(' ')}
            className={`br-line br-${s.tone}`}
            strokeDasharray={i === 1 ? '7 4' : undefined}
          />
        ))}
        {dots.map((d, i) => (
          <circle key={i} cx={xOf(d.x)} cy={yOf(d.y)} r={5.5} className="br-dot" />
        ))}
      </svg>
      <figcaption className="br-legend">
        {series.map((s, i) => (
          <span key={s.label} className="br-key">
            <svg width="26" height="8" aria-hidden="true">
              <line x1="1" x2="25" y1="4" y2="4" className={`br-line br-${s.tone}`} strokeDasharray={i === 1 ? '7 4' : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
        {dots.length > 0 && (
          <span className="br-key">
            <svg width="12" height="12" aria-hidden="true">
              <circle cx="6" cy="6" r="4.5" className="br-dot" />
            </svg>
            Nash equilibrium
          </span>
        )}
        {caption && <span className="fine-print">{caption}</span>}
      </figcaption>
    </figure>
  );
}
