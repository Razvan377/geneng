/**
 * Interactive restriction map: a ruler for linear DNA, a circle for plasmids.
 * Markers are dragged with pointer events (mouse, pen or touch), snap to the puzzle grid, and can
 * be nudged with the arrow keys. Fragment lengths between neighbouring markers update live.
 */

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Topology } from '../science/digest';
import { formatKb } from '../science/format';
import { useElementWidth } from '../lib/hooks';
import type { MarkerShape } from '../lib/theme';

export interface Marker {
  id: string;
  enzyme: string;
  pos: number;
}

export interface EnzymeStyle {
  name: string;
  color: string;
  shape: MarkerShape;
}

export interface MapViewProps {
  topology: Topology;
  length: number;
  grid: number;
  enzymes: EnzymeStyle[];
  markers: Marker[];
  selectedId?: string | null;
  onSelect?(id: string | null): void;
  onMove?(id: string, pos: number): void;
  onRemove?(id: string): void;
  readOnly?: boolean;
  ariaLabel?: string;
}

export function MapView(props: MapViewProps) {
  return props.topology === 'linear' ? <LinearMap {...props} /> : <CircularMap {...props} />;
}

/** Fragment sizes between consecutive markers (the combined digest of every placed site). */
export function segmentsOf(topology: Topology, length: number, markers: readonly Marker[]): { from: number; to: number }[] {
  const pos = [...new Set(markers.map((m) => m.pos))].sort((a, b) => a - b);
  if (topology === 'linear') {
    const bounds = [0, ...pos.filter((p) => p > 0 && p < length), length];
    return bounds.slice(1).map((to, i) => ({ from: bounds[i], to }));
  }
  if (pos.length === 0) return [];
  if (pos.length === 1) return [{ from: pos[0], to: pos[0] + length }];
  return pos.map((p, i) => ({ from: p, to: i + 1 < pos.length ? pos[i + 1] : pos[0] + length }));
}

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function tickStep(length: number, width: number): number {
  const maxTicks = Math.max(3, Math.floor(width / 56));
  for (const s of [100, 200, 500, 1000, 2000, 5000, 10000, 20000]) if (length / s <= maxTicks) return s;
  return 50000;
}

export function MarkerGlyph({ shape, color, x, y, r = 7, selected }: { shape: MarkerShape; color: string; x: number; y: number; r?: number; selected?: boolean }) {
  const common = { fill: color, stroke: 'var(--surface)', strokeWidth: 2 };
  const ring = selected ? <circle cx={x} cy={y} r={r + 5} className="marker-ring" /> : null;
  if (shape === 'triangle') {
    const h = r * 1.15;
    return (
      <>
        {ring}
        <path d={`M${x - h} ${y - h * 0.8} L${x + h} ${y - h * 0.8} L${x} ${y + h * 0.95} Z`} {...common} />
      </>
    );
  }
  if (shape === 'square') {
    return (
      <>
        {ring}
        <rect x={x - r * 0.85} y={y - r * 0.85} width={r * 1.7} height={r * 1.7} rx={1.5} {...common} />
      </>
    );
  }
  return (
    <>
      {ring}
      <circle cx={x} cy={y} r={r} {...common} />
    </>
  );
}

/** Pointer-drag plumbing shared by both map shapes. */
function useDrag(props: MapViewProps, toPos: (x: number, y: number) => number) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const start = (id: string) => (e: PointerEvent<SVGGElement>) => {
    if (props.readOnly) return;
    e.preventDefault(); // no text selection / scrolling while dragging…
    (e.currentTarget as SVGGElement).focus({ preventScroll: true }); // …but keep arrow-key nudging
    props.onSelect?.(id);
    setDragging(id);
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    props.onMove?.(dragging, toPos(e.clientX - rect.left, e.clientY - rect.top));
  };
  const end = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging) svgRef.current?.releasePointerCapture?.(e.pointerId);
    setDragging(null);
  };
  const key = (m: Marker) => (e: KeyboardEvent<SVGGElement>) => {
    if (props.readOnly) return;
    const step = props.grid * (e.shiftKey ? 10 : 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      props.onMove?.(m.id, m.pos - step);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      props.onMove?.(m.id, m.pos + step);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      props.onRemove?.(m.id);
    }
  };
  return { svgRef, dragging, start, move, end, key };
}

function styleOf(enzymes: EnzymeStyle[], name: string): EnzymeStyle {
  return enzymes.find((e) => e.name === name) ?? { name, color: 'var(--muted)', shape: 'circle' };
}

function labelWidth(name: string): number {
  return name.length * 7 + 26;
}

// ---------------------------------------------------------------------------------------------

function LinearMap(props: MapViewProps) {
  const { length: L, grid, enzymes, markers, selectedId, readOnly } = props;
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(360);
  const pad = 24;
  const x0 = pad;
  const x1 = width - pad;
  const scale = (x1 - x0) / L;
  const xOf = (p: number) => x0 + p * scale;

  const drag = useDrag(props, (x) => Math.min(L - grid, Math.max(grid, snap((x - x0) / scale, grid))));

  // Stack labels in rows so they never overlap.
  const sorted = [...markers].sort((a, b) => a.pos - b.pos);
  const rowEnds: number[] = [];
  const labelRow = new Map<string, { row: number; left: number; w: number }>();
  for (const m of sorted) {
    const w = labelWidth(m.enzyme);
    const left = Math.min(Math.max(2, xOf(m.pos) - w / 2), width - w - 2);
    let row = rowEnds.findIndex((end) => end + 4 <= left);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(0);
    }
    rowEnds[row] = left + w;
    labelRow.set(m.id, { row, left, w });
  }
  // Freeze the number of label rows while dragging, so the ruler does not jump under the pointer.
  const frozenRows = useRef(1);
  const rows = Math.max(1, rowEnds.length, drag.dragging ? frozenRows.current : 0);
  if (!drag.dragging) frozenRows.current = rows;
  const rowH = 24;
  const yLine = 10 + rows * rowH + 22;
  const rowY = (row: number) => 10 + (rows - 1 - row) * rowH;

  const step = tickStep(L, x1 - x0);
  const ticks: number[] = [];
  for (let p = 0; p <= L + 1e-6; p += step) ticks.push(p);
  const minorStep = step / (step % 500 === 0 && step >= 1000 ? 5 : 2);

  const segs = segmentsOf('linear', L, markers);
  const segRowEnds: number[] = [];
  const segLabels = segs.map((s) => {
    const text = formatKb(s.to - s.from);
    const w = text.length * 6.6 + 6;
    const cx = (xOf(s.from) + xOf(s.to)) / 2;
    let row = segRowEnds.findIndex((end) => end + 3 <= cx - w / 2);
    if (row === -1) {
      row = segRowEnds.length;
      segRowEnds.push(0);
    }
    segRowEnds[row] = cx + w / 2;
    return { ...s, text, cx, row };
  });
  const segY = yLine + 46;
  const height = segY + Math.max(1, segRowEnds.length) * 15 + 6;

  return (
    <div ref={wrapRef} className="map-view">
      <svg
        ref={drag.svgRef}
        width={width}
        height={height}
        role="group"
        aria-label={props.ariaLabel ?? `Linear map, ${formatKb(L)} kb`}
        onPointerMove={drag.move}
        onPointerUp={drag.end}
        onPointerCancel={drag.end}
        onPointerDown={(e) => {
          if (e.target === drag.svgRef.current) props.onSelect?.(null);
        }}
        className={drag.dragging ? 'is-dragging' : undefined}
      >
        {/* segment separators */}
        {[...new Set(markers.map((m) => m.pos))].map((p) => (
          <line key={p} x1={xOf(p)} y1={yLine + 4} x2={xOf(p)} y2={segY - 10} className="map-sep" />
        ))}
        {/* ruler */}
        <line x1={x0} y1={yLine} x2={x1} y2={yLine} className="map-strand" />
        <line x1={x0} y1={yLine - 6} x2={x0} y2={yLine + 6} className="map-end" />
        <line x1={x1} y1={yLine - 6} x2={x1} y2={yLine + 6} className="map-end" />
        {minorStep * scale >= 6 &&
          Array.from({ length: Math.floor(L / minorStep) + 1 }, (_, i) => i * minorStep).map((p) => (
            <line key={`m${p}`} x1={xOf(p)} y1={yLine + 3} x2={xOf(p)} y2={yLine + 6} className="map-tick-minor" />
          ))}
        {ticks.map((p) => (
          <g key={p}>
            <line x1={xOf(p)} y1={yLine + 3} x2={xOf(p)} y2={yLine + 9} className="map-tick" />
            <text x={xOf(p)} y={yLine + 21} textAnchor="middle" className="map-tick-label">
              {formatKb(p)}
            </text>
          </g>
        ))}
        <text x={x1} y={yLine + 33} textAnchor="end" className="map-unit">
          kb
        </text>

        {segLabels.map((s, i) => (
          <text key={i} x={s.cx} y={segY + s.row * 15} textAnchor="middle" className="map-seg-label">
            {s.text}
          </text>
        ))}

        {sorted.map((m) => {
          const st = styleOf(enzymes, m.enzyme);
          const lab = labelRow.get(m.id)!;
          const x = xOf(m.pos);
          const ly = rowY(lab.row);
          const selected = m.id === selectedId;
          return (
            <g
              key={m.id}
              className={`map-marker${selected ? ' is-selected' : ''}${readOnly ? '' : ' is-draggable'}`}
              tabIndex={readOnly ? -1 : 0}
              role={readOnly ? undefined : 'slider'}
              aria-label={`${m.enzyme} site`}
              aria-valuemin={0}
              aria-valuemax={L / 1000}
              aria-valuenow={m.pos / 1000}
              aria-valuetext={`${formatKb(m.pos)} kb`}
              onPointerDown={drag.start(m.id)}
              onKeyDown={drag.key(m)}
              onFocus={() => !readOnly && props.onSelect?.(m.id)}
            >
              <line x1={x} y1={ly + 20} x2={x} y2={yLine} className="map-stem" style={{ stroke: st.color }} />
              <rect x={lab.left} y={ly} width={lab.w} height={20} rx={10} className="map-label-box" style={{ stroke: st.color }} />
              <MarkerGlyph shape={st.shape} color={st.color} x={lab.left + 11} y={ly + 10} r={4.5} />
              <text x={lab.left + 20} y={ly + 14} className="map-label-text">
                {m.enzyme}
              </text>
              <MarkerGlyph shape={st.shape} color={st.color} x={x} y={yLine} selected={selected} />
              {!readOnly && <circle cx={x} cy={yLine} r={18} fill="transparent" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function CircularMap(props: MapViewProps) {
  const { length: L, grid, enzymes, markers, selectedId, readOnly } = props;
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(360);
  const size = Math.min(width, 440);
  const cx = width / 2;
  const cy = size / 2;
  const R = Math.max(84, size / 2 - 74);
  // Inner rings: tick labels just inside the strand, fragment lengths further in, title in the centre.
  const tickR = R - 15;
  const segR = R < 115 ? R - 31 : R - 46;
  const angle = (p: number) => (p / L) * 2 * Math.PI - Math.PI / 2;
  const pt = (p: number, r: number) => ({ x: cx + r * Math.cos(angle(p)), y: cy + r * Math.sin(angle(p)) });

  const drag = useDrag(props, (x, y) => {
    let a = Math.atan2(y - cy, x - cx) + Math.PI / 2;
    if (a < 0) a += 2 * Math.PI;
    return ((snap((a / (2 * Math.PI)) * L, grid) % L) + L) % L;
  });

  // Labels: push outward in rings until they stop overlapping.
  const sorted = [...markers].sort((a, b) => a.pos - b.pos);
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const placed = new Map<string, { x: number; y: number; w: number; anchorRight: boolean; r: number }>();
  for (const m of sorted) {
    const w = labelWidth(m.enzyme);
    const right = Math.cos(angle(m.pos)) >= -0.05;
    let chosen = null as null | { x: number; y: number; w: number; anchorRight: boolean; r: number };
    for (let ring = 0; ring < 5; ring++) {
      const r = R + 24 + ring * 20;
      const p = pt(m.pos, r);
      const bx = right ? p.x : p.x - w;
      const box = { x: bx, y: p.y - 10, w, h: 20 };
      const clash = boxes.some((b) => bx < b.x + b.w + 3 && bx + w + 3 > b.x && box.y < b.y + b.h + 2 && box.y + 22 > b.y);
      if (!clash || ring === 4) {
        chosen = { x: bx, y: p.y - 10, w, anchorRight: right, r };
        boxes.push(box);
        break;
      }
    }
    placed.set(m.id, chosen!);
  }
  const maxR = Math.max(R + 24, ...[...placed.values()].map((v) => v.r));
  const height = Math.max(size, cy + maxR + 16);

  const step = tickStep(L, 2 * Math.PI * R * 0.55);
  const ticks: number[] = [];
  for (let p = 0; p < L - 1e-6; p += step) ticks.push(p);

  const segs = segmentsOf('circular', L, markers);

  return (
    <div ref={wrapRef} className="map-view">
      <svg
        ref={drag.svgRef}
        width={width}
        height={height}
        role="group"
        aria-label={props.ariaLabel ?? `Plasmid map, ${formatKb(L)} kb`}
        onPointerMove={drag.move}
        onPointerUp={drag.end}
        onPointerCancel={drag.end}
        onPointerDown={(e) => {
          if (e.target === drag.svgRef.current) props.onSelect?.(null);
        }}
        className={drag.dragging ? 'is-dragging' : undefined}
      >
        <circle cx={cx} cy={cy} r={R} className="map-strand" fill="none" />
        {ticks.map((p) => {
          const a = pt(p, R - 5);
          const b = pt(p, R + 5);
          const t = pt(p, tickR);
          return (
            <g key={p}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="map-tick" />
              <text x={t.x} y={t.y + 3.5} textAnchor="middle" className="map-tick-label">
                {formatKb(p)}
              </text>
            </g>
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="map-center-title">
          {formatKb(L)} kb
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" className="map-center-sub">
          circular
        </text>

        {segs.map((s, i) => {
          const mid = (s.from + s.to) / 2;
          const span = (s.to - s.from) / L;
          if (span < 0.05 && segs.length > 1) return null;
          const p = pt(mid, segR);
          return (
            <text key={i} x={p.x} y={p.y + 4} textAnchor="middle" className="map-seg-label">
              {formatKb(s.to - s.from)}
            </text>
          );
        })}

        {sorted.map((m) => {
          const st = styleOf(enzymes, m.enzyme);
          const lab = placed.get(m.id)!;
          const h = pt(m.pos, R);
          const stemEnd = pt(m.pos, lab.r - 2);
          const selected = m.id === selectedId;
          return (
            <g
              key={m.id}
              className={`map-marker${selected ? ' is-selected' : ''}${readOnly ? '' : ' is-draggable'}`}
              tabIndex={readOnly ? -1 : 0}
              role={readOnly ? undefined : 'slider'}
              aria-label={`${m.enzyme} site`}
              aria-valuemin={0}
              aria-valuemax={L / 1000}
              aria-valuenow={m.pos / 1000}
              aria-valuetext={`${formatKb(m.pos)} kb`}
              onPointerDown={drag.start(m.id)}
              onKeyDown={drag.key(m)}
              onFocus={() => !readOnly && props.onSelect?.(m.id)}
            >
              <line x1={h.x} y1={h.y} x2={stemEnd.x} y2={stemEnd.y} className="map-stem" style={{ stroke: st.color }} />
              <rect x={lab.x} y={lab.y} width={lab.w} height={20} rx={10} className="map-label-box" style={{ stroke: st.color }} />
              <MarkerGlyph shape={st.shape} color={st.color} x={lab.x + 11} y={lab.y + 10} r={4.5} />
              <text x={lab.x + 20} y={lab.y + 14} className="map-label-text">
                {m.enzyme}
              </text>
              <MarkerGlyph shape={st.shape} color={st.color} x={h.x} y={h.y} selected={selected} />
              {!readOnly && <circle cx={h.x} cy={h.y} r={18} fill="transparent" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
