/** Recognition sites drawn as double strands with the staggered (or blunt) cut in coral. */

import { complement } from '../../science/dna';
import { bottomCut, END_KIND_LABEL, endKind, formatSite, getEnzyme } from '../../science/enzymes';

const CW = 14;

export function SiteCards({ enzymes }: { enzymes: string[] }) {
  return (
    <div className="site-cards">
      {enzymes.map((name) => (
        <SiteCard key={name} name={name} />
      ))}
    </div>
  );
}

function SiteCard({ name }: { name: string }) {
  const e = getEnzyme(name);
  const n = e.site.length;
  const pad = 22;
  const x = (col: number) => pad + col * CW;
  const yTop = 20;
  const yBot = 46;
  const topCutX = x(e.cut);
  const botCutX = x(bottomCut(e));
  const mid = (yTop + yBot) / 2 - 5;
  const bottom = complement(e.site);
  return (
    <div className="site-card">
      <div className="site-card-head">
        {name}
        <span>{END_KIND_LABEL[endKind(e)]}</span>
      </div>
      <svg className="site-svg" width={pad * 2 + n * CW} height={56} role="img" aria-label={`${name} cuts ${formatSite(e)}`}>
        <text x={4} y={yTop} className="prime">
          5′
        </text>
        <text x={pad * 2 + n * CW - 4} y={yTop} textAnchor="end" className="prime">
          3′
        </text>
        <text x={4} y={yBot} className="prime">
          3′
        </text>
        <text x={pad * 2 + n * CW - 4} y={yBot} textAnchor="end" className="prime">
          5′
        </text>
        {e.site.split('').map((b, i) => (
          <text key={`t${i}`} x={x(i) + CW / 2} y={yTop} textAnchor="middle">
            {b}
          </text>
        ))}
        {bottom.split('').map((b, i) => (
          <text key={`b${i}`} x={x(i) + CW / 2} y={yBot} textAnchor="middle">
            {b}
          </text>
        ))}
        <path className="cut" d={`M${topCutX} ${yTop - 14} V${mid} H${botCutX} V${yBot + 5}`} />
      </svg>
    </div>
  );
}
