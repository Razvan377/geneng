/**
 * Virtual agarose gel, drawn as SVG. Dark gel, glowing orange bands, wells at the top.
 * Band position comes from the migration model (∝ log10 size) unless a lane supplies explicit
 * positions; brightness is proportional to band mass (size × copies).
 */

import { useId, useState } from 'react';
import { bandIntensity, migrate, type Band, type MigrationModel } from '../science/gel';
import { useElementWidth } from '../lib/hooks';

export interface GelBand extends Band {
  /** Explicit position as a fraction of the running length (overrides the model). */
  position?: number;
  /** Tooltip text for inspectable lanes. */
  info?: string;
}

export interface GelLane {
  id: string;
  /** Short label above the well ("M", "1", "U"). */
  label: string;
  bands: GelBand[];
  ladder?: boolean;
  /** Reference band of a ladder (drawn brighter). */
  reference?: number;
  status?: 'error';
  /** Allow tapping bands to see their size. */
  inspect?: boolean;
}

interface Props {
  lanes: GelLane[];
  model: MigrationModel;
  ariaLabel: string;
  /** Label ladder band sizes at the left edge. */
  ladderLabels?: (size: number) => string;
  /** Unit written above the ladder labels ("kb", "bp"). */
  ladderUnit?: string;
  /** Draw a millimetre ruler for a gel of this running length (mm). */
  rulerMm?: number;
  height?: number;
}

const LABEL_H = 22;
const WELL_H = 6;

export function Gel({ lanes, model, ariaLabel, ladderLabels, ladderUnit, rulerMm, height }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>(360);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const uid = useId().replace(/:/g, '');

  const rulerW = rulerMm ? 34 : 0;
  const labelsW = ladderLabels ? 40 : 6;
  const left = rulerW + labelsW;
  const n = lanes.length;
  // The gel body is n lanes + 12 px padding, plus 4 px of breathing room on the right.
  const laneW = Math.max(24, Math.min(62, (width - left - 16) / n));
  const gelW = laneW * n + 12;
  const gelX = left;
  const runH = height ?? Math.max(240, Math.min(380, width * 0.7));
  const wellY = LABEL_H + 12;
  const runTop = wellY + WELL_H;
  const gelBottom = runTop + runH + 14;
  const svgW = Math.max(Math.floor(width), Math.ceil(gelX + gelW + 4));
  const svgH = gelBottom + 4;

  const sampleMasses = lanes.filter((l) => !l.ladder).flatMap((l) => l.bands.map((b) => b.mass));
  const maxMass = Math.max(1, ...sampleMasses);
  const yOf = (b: GelBand) => runTop + (b.position ?? migrate(model, b.apparentSize)) * runH;

  const ladder = lanes.find((l) => l.ladder);
  const labelYs: { y: number; text: string }[] = [];
  if (ladder && ladderLabels) {
    let lastY = -Infinity;
    for (const b of [...ladder.bands].sort((a, c) => yOf(a) - yOf(c))) {
      const y = yOf(b);
      if (y - lastY >= 11 && y <= runTop + runH) {
        labelYs.push({ y, text: ladderLabels(b.size) });
        lastY = y;
      }
    }
  }

  return (
    <div className="gel" ref={ref} onPointerLeave={() => setTip(null)}>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={(e) => {
          if ((e.target as Element).tagName !== 'rect' || !(e.target as Element).classList.contains('gel-band-hit')) setTip(null);
        }}
      >
        <defs>
          <linearGradient id={`gelbg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gel-top)" />
            <stop offset="1" stopColor="var(--gel-bottom)" />
          </linearGradient>
          <filter id={`glow-${uid}`} x="-50%" y="-200%" width="200%" height="500%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x={gelX} y={LABEL_H + 4} width={gelW} height={gelBottom - LABEL_H - 4} rx={8} fill={`url(#gelbg-${uid})`} />

        {rulerMm ? <Ruler x={rulerW - 6} top={runTop} height={runH} mm={rulerMm} /> : null}

        {labelYs.map(({ y, text }) => (
          <text key={text + y} x={gelX - 6} y={y + 3.5} className="gel-ladder-label" textAnchor="end">
            {text}
          </text>
        ))}
        {ladderUnit && labelYs.length > 0 && (
          <text x={gelX - 6} y={LABEL_H - 6} className="gel-ladder-label gel-ladder-unit" textAnchor="end">
            {ladderUnit}
          </text>
        )}

        {lanes.map((lane, i) => {
          const x = gelX + 6 + i * laneW;
          const cx = x + laneW / 2;
          const bw = laneW * 0.7;
          return (
            <g key={lane.id} className={lane.status === 'error' ? 'gel-lane gel-lane-error' : 'gel-lane'}>
              <text x={cx} y={LABEL_H - 6} textAnchor="middle" className="gel-lane-label">
                {lane.label}
              </text>
              {lane.status === 'error' && (
                <rect
                  x={x + 1.5}
                  y={LABEL_H + 7}
                  width={laneW - 3}
                  height={gelBottom - LABEL_H - 12}
                  rx={5}
                  className="gel-lane-error-outline"
                />
              )}
              <rect x={cx - bw / 2} y={wellY} width={bw} height={WELL_H} rx={1.5} className="gel-well" />
              {lane.bands.map((b, j) => {
                const frac = b.position ?? migrate(model, b.apparentSize);
                if (frac > 1.03) return null; // ran off the gel
                const y = runTop + frac * runH;
                const intensity = lane.ladder
                  ? b.size === lane.reference
                    ? 0.95
                    : 0.6
                  : bandIntensity(b.mass, maxMass);
                const h = 2.2 + 3.4 * intensity;
                return (
                  <g key={j}>
                    <rect
                      x={cx - bw / 2}
                      y={y - h / 2}
                      width={bw}
                      height={h}
                      rx={h / 2}
                      fill="var(--band)"
                      opacity={intensity}
                      filter={`url(#glow-${uid})`}
                    />
                    {lane.inspect && b.info && (
                      <rect
                        className="gel-band-hit"
                        x={cx - laneW / 2}
                        y={y - 7}
                        width={laneW}
                        height={14}
                        fill="transparent"
                        onPointerEnter={() => setTip({ x: cx, y: y - 10, text: b.info! })}
                        onPointerDown={() => setTip({ x: cx, y: y - 10, text: b.info! })}
                      >
                        <title>{b.info}</title>
                      </rect>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="gel-tip" style={{ left: tip.x, top: tip.y }} role="status">
          {tip.text}
        </div>
      )}
    </div>
  );
}

function Ruler({ x, top, height, mm }: { x: number; top: number; height: number; mm: number }) {
  const ticks: number[] = [];
  for (let v = 0; v <= mm; v += 5) ticks.push(v);
  return (
    <g className="gel-ruler">
      <line x1={x} y1={top} x2={x} y2={top + height} />
      {ticks.map((v) => {
        const y = top + (v / mm) * height;
        const major = v % 10 === 0;
        return (
          <g key={v}>
            <line x1={x - (major ? 7 : 4)} y1={y} x2={x} y2={y} />
            {major && (
              <text x={x - 9} y={y + 3.5} textAnchor="end">
                {v}
              </text>
            )}
          </g>
        );
      })}
      <text x={x - 9} y={top - 8} textAnchor="end">
        mm
      </text>
    </g>
  );
}
