/**
 * Semi-log standard curve: log(size) against distance migrated, ladder points, the fitted line,
 * the unknown band read off the line, and the player's guess.
 */

import { useState } from 'react';
import { sizeFromCurve, standardCurve } from '../../science/gel';
import { useElementWidth } from '../../lib/hooks';
import { formatSize } from '../../quiz/gelQuestions';

interface Props {
  ladderSizes: number[];
  ladderMm: number[];
  inRange: boolean[];
  unknownMm: number;
  unknownBp: number;
  guessBp: number | null;
  runMm?: number;
}

const TICKS = [50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000];

export function StandardCurve({ ladderSizes, ladderMm, inRange, unknownMm, unknownBp, guessBp, runMm = 80 }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>(360);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const m = { left: 56, right: 14, top: 26, bottom: 40 };
  const h = 270;
  const w = Math.max(260, width);
  const innerW = w - m.left - m.right;
  const innerH = h - m.top - m.bottom;

  const fit = standardCurve(
    ladderSizes.filter((_, i) => inRange[i]),
    ladderMm.filter((_, i) => inRange[i]),
  );
  const estimate = sizeFromCurve(fit, unknownMm);
  const sizes = [...ladderSizes, unknownBp, ...(guessBp ? [guessBp] : [])];
  const logMax = Math.log10(Math.max(...sizes) * 1.25);
  const logMin = Math.log10(Math.min(...sizes) / 1.25);
  const xOf = (mm: number) => m.left + (mm / runMm) * innerW;
  const yOf = (bp: number) => m.top + ((logMax - Math.log10(bp)) / (logMax - logMin)) * innerH;
  const inView = (bp: number) => Math.log10(bp) <= logMax && Math.log10(bp) >= logMin;

  const fitMm = ladderMm.filter((_, i) => inRange[i]);
  const x1 = Math.max(0, Math.min(...fitMm) - 4);
  const x2 = Math.min(runMm, Math.max(...fitMm) + 4);
  const fitY = (mm: number) => 10 ** (fit.intercept + fit.slope * mm);

  const ticks = TICKS.filter(inView);
  const xTicks = Array.from({ length: Math.floor(runMm / 10) + 1 }, (_, i) => i * 10);

  const show = (x: number, y: number, text: string) => () => setTip({ x, y, text });

  return (
    <div className="chart" ref={ref} onPointerLeave={() => setTip(null)}>
      <svg width={w} height={h} role="img" aria-label={`Standard curve. The unknown band migrated ${unknownMm} mm, which the fitted line puts at ${formatSize(Math.round(estimate))}.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={w - m.right} y1={yOf(t)} y2={yOf(t)} className="grid-line" />
            <text x={m.left - 6} y={yOf(t) + 3.5} textAnchor="end" className="tick-label">
              {formatSize(t)}
            </text>
          </g>
        ))}
        <line x1={m.left} x2={m.left} y1={m.top} y2={h - m.bottom} className="axis-line" />
        <line x1={m.left} x2={w - m.right} y1={h - m.bottom} y2={h - m.bottom} className="axis-line" />
        {xTicks.map((t) => (
          <text key={t} x={xOf(t)} y={h - m.bottom + 15} textAnchor="middle" className="tick-label">
            {t}
          </text>
        ))}
        <text x={m.left + innerW / 2} y={h - 6} textAnchor="middle" className="axis-label">
          Distance migrated (mm)
        </text>
        <text x={4} y={12} className="axis-label">
          Size (log scale)
        </text>

        <line x1={xOf(x1)} y1={yOf(fitY(x1))} x2={xOf(x2)} y2={yOf(fitY(x2))} className="fit-line" />

        {/* read-off guides for the unknown */}
        <line x1={xOf(unknownMm)} x2={xOf(unknownMm)} y1={h - m.bottom} y2={yOf(estimate)} className="guide" stroke="var(--coral)" />
        <line x1={m.left} x2={xOf(unknownMm)} y1={yOf(estimate)} y2={yOf(estimate)} className="guide" stroke="var(--coral)" />

        {guessBp && inView(guessBp) && (
          <g>
            <line x1={m.left} x2={w - m.right} y1={yOf(guessBp)} y2={yOf(guessBp)} className="guide" stroke="var(--amber)" />
            <text
              x={guessBp > estimate ? m.left + 6 : w - m.right - 2}
              y={guessBp > estimate ? yOf(guessBp) - 6 : yOf(guessBp) + 14}
              textAnchor={guessBp > estimate ? 'start' : 'end'}
              className="tick-label halo"
            >
              your guess {formatSize(guessBp)}
            </text>
          </g>
        )}

        {ladderSizes.map((s, i) => {
          const x = xOf(ladderMm[i]);
          const y = yOf(s);
          return (
            <g key={s}>
              <circle cx={x} cy={y} r={5} fill={inRange[i] ? 'var(--teal)' : 'var(--surface)'} stroke={inRange[i] ? 'var(--surface)' : 'var(--muted)'} strokeWidth={inRange[i] ? 2 : 1.6} />
              <circle
                cx={x}
                cy={y}
                r={13}
                fill="transparent"
                onPointerEnter={show(x, y, `Marker ${formatSize(s)} · ${ladderMm[i]} mm${inRange[i] ? '' : ' (outside linear range)'}`)}
                onPointerDown={show(x, y, `Marker ${formatSize(s)} · ${ladderMm[i]} mm${inRange[i] ? '' : ' (outside linear range)'}`)}
              />
            </g>
          );
        })}
        <g>
          <circle cx={xOf(unknownMm)} cy={yOf(estimate)} r={6} fill="var(--coral)" stroke="var(--surface)" strokeWidth={2} />
          <circle
            cx={xOf(unknownMm)}
            cy={yOf(estimate)}
            r={14}
            fill="transparent"
            onPointerEnter={show(xOf(unknownMm), yOf(estimate), `Unknown · ${unknownMm} mm → ${formatSize(Math.round(estimate))}`)}
            onPointerDown={show(xOf(unknownMm), yOf(estimate), `Unknown · ${unknownMm} mm → ${formatSize(Math.round(estimate))}`)}
          />
        </g>
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
      <div className="chart-legend">
        <span>
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r="5" fill="var(--teal)" />
          </svg>
          Marker bands (used for the fit)
        </span>
        {inRange.some((r) => !r) && (
          <span>
            <svg width="12" height="12" aria-hidden="true">
              <circle cx="6" cy="6" r="4.2" fill="none" stroke="var(--muted)" strokeWidth="1.6" />
            </svg>
            Outside the gel's linear range
          </span>
        )}
        <span>
          <svg width="18" height="12" aria-hidden="true">
            <line x1="0" x2="18" y1="6" y2="6" stroke="var(--teal)" strokeWidth="2" />
          </svg>
          Fitted line
        </span>
        <span>
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r="5" fill="var(--coral)" />
          </svg>
          Unknown band
        </span>
        {guessBp && (
          <span>
            <svg width="18" height="12" aria-hidden="true">
              <line x1="0" x2="18" y1="6" y2="6" stroke="var(--amber)" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            Your guess
          </span>
        )}
      </div>
      <p className="chart-caption">
        log₁₀(size) = {fit.intercept.toFixed(3)} − {Math.abs(fit.slope).toFixed(4)} × distance · r² = {fit.r2.toFixed(4)}. At {unknownMm} mm the line gives{' '}
        {formatSize(Math.round(estimate))}.
      </p>
    </div>
  );
}
