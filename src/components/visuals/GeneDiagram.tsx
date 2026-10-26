/**
 * Gene structure for blot problems: exons (coding part teal, UTRs white), introns, promoter and
 * transcription start, EcoRI sites with their coordinates, the probe, RT-PCR primers, the
 * antibody epitope and the positions hit by each variant (lettered like the lanes).
 */

import type { GeneMarker } from '../../quiz/types';
import { exonStarts, geneEnd, mrnaPos, type GeneModel } from '../../science/geneModel';
import { useElementWidth } from '../../lib/hooks';

interface Props {
  gene: GeneModel;
  markers: GeneMarker[];
  show: { probe?: boolean; primers?: boolean; epitope?: boolean; sites?: boolean };
}

export function GeneDiagram({ gene: g, markers, show }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>(360);
  const starts = exonStarts(g);
  const end = geneEnd(g);
  const from = -g.upstream;
  const to = end + g.downstream;
  const pad = 14;
  const W = Math.max(300, width);
  const x = (pos: number) => pad + ((pos - from) / (to - from)) * (W - 2 * pad);
  const yAxis = 62;
  const cdsStart = g.utr5;
  const cdsEnd = g.exons.reduce((a, b) => a + b, 0) - g.utr3;

  // Coordinates of the coding part of each exon (genomic).
  const exonBoxes = g.exons.map((len, i) => {
    const m0 = mrnaPos(g, i, 0);
    const cFrom = Math.max(m0, cdsStart) - m0;
    const cTo = Math.min(m0 + len, cdsEnd) - m0;
    return { gFrom: starts[i], gTo: starts[i] + len, cFrom: starts[i] + cFrom, cTo: starts[i] + Math.max(cFrom, cTo) };
  });

  const probeFrom = starts[g.probe.exon] + g.probe.from;
  const probeTo = starts[g.probe.exon] + g.probe.to;
  const fwdAt = starts[g.primers.fwd.exon] + g.primers.fwd.at;
  const revAt = starts[g.primers.rev.exon] + g.primers.rev.at;
  const epiExon = g.epitope === 'N' ? 0 : g.exons.length - 1;
  const epi = exonBoxes[epiExon];

  // Site labels in two rows so neighbours never collide.
  const siteRows: number[] = [];
  const siteLabels = g.sites.map((s, i) => {
    const row = i > 0 && x(s) - x(g.sites[i - 1]) < 34 && siteRows[i - 1] === 0 ? 1 : 0;
    siteRows.push(row);
    return { s, row };
  });

  const kbTicks: number[] = [];
  for (let k = Math.ceil(from / 1000); k * 1000 <= to; k++) kbTicks.push(k * 1000);
  const H = 150;

  return (
    <figure className="gene-figure" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={`Gene ${g.name}: ${g.exons.length} exons, EcoRI sites and probe`}>
        {/* variant markers */}
        {markers.map((m, i) => {
          const x1 = x(m.at);
          const x2 = m.to !== undefined ? x(m.to) : x1;
          return (
            <g key={i} className="gene-marker">
              {m.to !== undefined ? (
                <path d={`M${x1} 20 V14 H${x2} V20`} />
              ) : (
                <path d={`M${x1 - 4} 12 L${x1 + 4} 12 L${x1} 19 Z`} className="gene-marker-point" />
              )}
              <text x={(x1 + x2) / 2} y={9} textAnchor="middle">
                {m.label}
              </text>
            </g>
          );
        })}

        {/* primers */}
        {show.primers && (
          <g className="gene-primers">
            <path d={`M${x(fwdAt)} 36 h14 l-4 -3 M${x(fwdAt) + 14} 36 l-4 3`} className="primer-f" />
            <text x={x(fwdAt)} y={31} className="primer-label">
              F
            </text>
            <path d={`M${x(revAt)} 36 h-14 l4 -3 M${x(revAt) - 14} 36 l4 3`} className="primer-r" />
            <text x={x(revAt) - 8} y={31} textAnchor="end" className="primer-label">
              R
            </text>
          </g>
        )}

        {/* genomic line, promoter and TSS */}
        <line x1={x(from)} x2={x(to)} y1={yAxis} y2={yAxis} className="gene-line" />
        <rect x={x(-g.promoter)} y={yAxis - 4} width={x(0) - x(-g.promoter)} height={8} className="gene-promoter" />
        <text x={(x(-g.promoter) + x(0)) / 2} y={yAxis + 18} textAnchor="middle" className="gene-small">
          P
        </text>
        <path d={`M${x(0)} ${yAxis - 9} V${yAxis - 20} h9`} className="gene-tss" />
        <path d={`M${x(0) + 9} ${yAxis - 23} l4 3 l-4 3`} className="gene-tss" />

        {/* exons */}
        {exonBoxes.map((b, i) => (
          <g key={i}>
            <rect x={x(b.gFrom)} y={yAxis - 9} width={Math.max(1, x(b.gTo) - x(b.gFrom))} height={18} className="exon-utr" />
            {b.cTo > b.cFrom && <rect x={x(b.cFrom)} y={yAxis - 9} width={x(b.cTo) - x(b.cFrom)} height={18} className="exon-cds" />}
            {x(b.gTo) - x(b.gFrom) >= 20 && (
              <text
                x={(x(b.gFrom) + x(b.gTo)) / 2}
                y={yAxis + 4}
                textAnchor="middle"
                className={(b.gFrom + b.gTo) / 2 >= b.cFrom && (b.gFrom + b.gTo) / 2 <= b.cTo ? 'exon-label' : 'exon-label exon-label-utr'}
              >
                {i + 1}
              </text>
            )}
          </g>
        ))}

        {/* EcoRI sites */}
        {show.sites &&
          siteLabels.map(({ s, row }) => (
            <g key={s} className="gene-site">
              <line x1={x(s)} x2={x(s)} y1={yAxis - 14} y2={yAxis + 14} />
              <text x={x(s)} y={yAxis + 50 + row * 11} textAnchor="middle">
                {(s / 1000).toFixed(2).replace(/0$/, '')}
              </text>
            </g>
          ))}

        {/* probe and epitope */}
        {show.probe && (
          <g className="gene-probe">
            <rect x={x(probeFrom)} y={yAxis + 22} width={Math.max(3, x(probeTo) - x(probeFrom))} height={5} rx={2} />
          </g>
        )}
        {show.epitope && (
          <g className="gene-epitope">
            <path d={`M${x(epi.cFrom)} ${yAxis + 31} v4 H${x(epi.cTo)} v-4`} />
            <text x={(x(epi.cFrom) + x(epi.cTo)) / 2} y={yAxis + 44} textAnchor="middle">
              Ab
            </text>
          </g>
        )}

        {/* kb ruler */}
        <line x1={x(from)} x2={x(to)} y1={H - 18} y2={H - 18} className="gene-ruler" />
        {kbTicks.map((k) => (
          <g key={k} className="gene-ruler">
            <line x1={x(k)} x2={x(k)} y1={H - 21} y2={H - 15} />
            <text x={x(k)} y={H - 4} textAnchor="middle">
              {k / 1000}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="gene-legend">
        <span><i className="swatch swatch-cds" />coding exon</span>
        <span><i className="swatch swatch-utr" />UTR</span>
        <span><i className="swatch swatch-site" />EcoRI (kb from TSS)</span>
        <span><i className="swatch swatch-probe" />probe</span>
        <span>F / R primers · Ab epitope · P promoter · letters = strains</span>
      </figcaption>
    </figure>
  );
}
