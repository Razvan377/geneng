/** Smaller visuals: expression-vector cassette, bar chart, data table. */

import type { VectorFeature } from '../../quiz/types';
import { trimNumber } from '../../science/format';

const CASSETTE_KINDS = new Set(['promoter', 'tag', 'protease', 'mcs', 'terminator', 'other']);

export function VectorView({ name, features }: { name: string; features: VectorFeature[] }) {
  const cassette = features.filter((f) => CASSETTE_KINDS.has(f.kind));
  const backbone = features.filter((f) => !CASSETTE_KINDS.has(f.kind));
  return (
    <figure className="vector-view" aria-label={`Vector ${name}: ${features.map((f) => f.label).join(', ')}`}>
      <div className="cloning-title">{name} — expression cassette</div>
      <div className="cassette">
        {cassette.map((f, i) => (
          <span key={i} className={`cas cas-${f.kind}`}>
            {f.label}
          </span>
        ))}
      </div>
      <div className="cloning-title" style={{ marginTop: 10 }}>
        Rest of the plasmid
      </div>
      <div className="backbone">
        {backbone.map((f, i) => (
          <span key={i} className={`bb bb-${f.kind}`}>
            <small>{f.kind === 'ori' ? 'origin' : 'marker'}</small>
            {f.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function BarsChart({
  unit,
  bars,
  reference,
  caption,
}: {
  unit: string;
  bars: { label: string; value: number; error?: number }[];
  reference?: number;
  caption?: string;
}) {
  const max = Math.max(reference ?? 0, ...bars.map((b) => b.value)) * 1.08;
  return (
    <figure className="bars-chart">
      <div className="bars-unit">{unit}</div>
      <div className="bars" role="img" aria-label={bars.map((b) => `${b.label}: ${trimNumber(b.value, 1)}`).join('; ')}>
        {bars.map((b) => (
          <div key={b.label} className="bar-row">
            <span className="bar-label">{b.label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(b.value / max) * 100}%` }} />
              {reference !== undefined && <div className="bar-ref" style={{ left: `${(reference / max) * 100}%` }} />}
            </div>
            <span className="bar-value">{trimNumber(b.value, 1)}</span>
          </div>
        ))}
      </div>
      {caption && <figcaption className="fine-print">{caption}</figcaption>}
    </figure>
  );
}

export function TableView({ head, rows, caption }: { head: string[]; rows: string[][]; caption?: string }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j > 0 ? 'num' : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && <p className="fine-print">{caption}</p>}
    </div>
  );
}
