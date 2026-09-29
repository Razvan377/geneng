import type { Highlight, SeqRow, Tone } from '../../quiz/types';

const TONE_LABEL: Record<Tone, string> = { teal: 'teal', coral: 'coral', amber: 'amber', muted: 'grey' };

/** Monospace sequence rows with 5′/3′ labels and tinted highlight spans. */
export function SequenceView({ rows, wrap }: { rows: SeqRow[]; wrap?: boolean }) {
  const legend = rows.flatMap((r) => (r.highlights ?? []).filter((h) => h.label)).filter((h, i, all) => all.findIndex((x) => x.label === h.label) === i);
  return (
    <div className="seq-block">
      {rows.map((row, i) => (
        <div key={i} className="seq-row">
          <span className="seq-label">{row.label ?? ''}</span>
          <span className={`seq-text ${wrap ? 'wrap' : 'nowrap'}`}>
            {row.primes && <span className="seq-prime">{row.reversed ? '3′-' : '5′-'}</span>}
            {row.offset ? ' '.repeat(row.offset) : null}
            {segments(row.seq, row.highlights ?? []).map((s, j) =>
              s.tone ? (
                <span key={j} className={`hl-${s.tone}`}>
                  {s.text}
                </span>
              ) : (
                <span key={j}>{s.text}</span>
              ),
            )}
            {row.primes && <span className="seq-prime">{row.reversed ? '-5′' : '-3′'}</span>}
          </span>
        </div>
      ))}
      {legend.length > 0 && (
        <div className="seq-legend">
          {legend.map((h) => (
            <span key={h.label}>
              <i className={`swatch hl-${h.tone}`} aria-hidden="true" />
              {h.label}
              <span className="sr-only"> ({TONE_LABEL[h.tone]})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function segments(seq: string, highlights: Highlight[]): { text: string; tone?: Tone }[] {
  const tones: (Tone | undefined)[] = new Array(seq.length).fill(undefined);
  for (const h of highlights) for (let i = Math.max(0, h.from); i < Math.min(seq.length, h.to); i++) tones[i] = h.tone;
  const out: { text: string; tone?: Tone }[] = [];
  for (let i = 0; i < seq.length; i++) {
    const last = out[out.length - 1];
    if (last && last.tone === tones[i]) last.text += seq[i];
    else out.push({ text: seq[i], tone: tones[i] });
  }
  return out;
}
