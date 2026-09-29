import type { WorkedSolution } from '../science/explain';
import type { SiteMap, Topology } from '../science/digest';
import { IconCheck, IconCross } from './Icons';
import { MapView, type EnzymeStyle } from './MapEditor';
import { RichText } from './RichText';

interface Props {
  solution: WorkedSolution;
  topology: Topology;
  enzymes: EnzymeStyle[];
}

function markersOf(map: SiteMap) {
  return Object.entries(map).flatMap(([enzyme, sites]) => sites.map((pos, i) => ({ id: `${enzyme}-${i}`, enzyme, pos })));
}

/** The textbook-style worked answer: numbered steps, every tried placement, and a final check. */
export function WorkedSolutionView({ solution, topology, enzymes }: Props) {
  const answer = solution.solutions.length === 1 ? solution.solutions[0] : null;
  return (
    <div className="worked">
      <ol className="worked-steps">
        {solution.steps.map((step, i) => (
          <li key={i} className="worked-step">
            <h4>
              <span className="step-no">{i + 1}</span>
              {step.title}
            </h4>
            {step.paragraphs.map((p, j) => (
              <p key={j}>
                <RichText text={p} />
              </p>
            ))}
            {step.items && (
              <ul className="worked-items">
                {step.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            )}
            {step.trials && step.trials.length > 0 && (
              <ul className="trials">
                {step.trials.map((t, j) => (
                  <li key={j} className={t.ok ? 'trial trial-ok' : 'trial trial-bad'}>
                    <span className="trial-icon" aria-label={t.ok ? 'fits' : 'rejected'}>
                      {t.ok ? <IconCheck size={15} /> : <IconCross size={15} />}
                    </span>
                    <span className="trial-body">
                      <span className="trial-label">
                        {t.label}
                        {t.duplicate && <span className="tag">mirror</span>}
                      </span>
                      {t.checks.map((c, k) => (
                        <span key={k} className={c.ok ? 'trial-check' : 'trial-check is-bad'}>
                          {c.lane}: {c.predicted}
                          {!c.ok && <em> — observed {c.expected}</em>}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
                {step.hiddenTrials ? <li className="trial-more">…and {step.hiddenTrials} other placements, all rejected in the same way.</li> : null}
              </ul>
            )}
            {step.conclusion && <p className="worked-conclusion">{step.conclusion}</p>}
            {i === solution.steps.length - 1 && answer && (
              <>
                <div className="worked-map">
                  <MapView topology={topology} length={solution.length} grid={100} enzymes={enzymes} markers={markersOf(answer)} readOnly ariaLabel="Solution map" />
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Digest</th>
                        <th>Observed (kb)</th>
                        <th>Predicted by the map</th>
                        <th aria-label="match" />
                      </tr>
                    </thead>
                    <tbody>
                      {solution.verification.map((v) => (
                        <tr key={v.lane}>
                          <td>{v.lane}</td>
                          <td className="num">{v.expected}</td>
                          <td className="num">{v.predicted}</td>
                          <td className={v.ok ? 'ok' : 'bad'}>{v.ok ? <IconCheck size={15} /> : <IconCross size={15} />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
