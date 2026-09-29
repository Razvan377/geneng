import { useState } from 'react';
import { PageHeader } from '../components/ui';
import { href } from '../lib/router';
import { kindLabel, MODE_ORDER, MODES, modeOf } from '../quiz/kinds';
import { STATEMENTS, topicSlug } from '../quiz/statements';
import { formatPercent } from '../science/format';
import { modeAccuracy, weakSpots } from '../state/progress';
import { useProgress } from '../state/ProgressContext';

/** Link that starts practising one question type. */
function practiceHref(kind: string): string {
  const mode = modeOf(kind);
  const sub = kind.slice(kind.indexOf('.') + 1);
  if (mode === 'map') return href('/map', { d: sub });
  if (mode === 'tf') {
    const topic = STATEMENTS.statements.find((s) => topicSlug(s.topic) === sub)?.topic;
    return href('/tf', { topic });
  }
  return href(`/${MODES[mode]?.route ?? ''}`, { type: sub });
}

export function StatsScreen() {
  const { progress, reset } = useProgress();
  const [confirming, setConfirming] = useState(false);
  const acc = modeAccuracy(progress);
  const weak = weakSpots(progress);
  const total = Object.values(progress.kinds).reduce((a, s) => a + s.attempts, 0);
  const dailies = Object.values(progress.daily).filter((d) => d.solved).length;

  return (
    <div className="page">
      <PageHeader title="Your progress" subtitle="Accuracy per mode, and the question types that need more practice." />

      <div className="stat-tiles">
        {[
          ['Points', progress.points],
          ['Current streak', progress.streak],
          ['Best streak', progress.bestStreak],
          ['Answered', total],
          ['Dailies solved', dailies],
        ].map(([label, value]) => (
          <div key={label} className="card stat-tile">
            <span className="muted small">{label}</span>
            <span className="value">{value}</span>
          </div>
        ))}
      </div>

      <section className="card">
        <h2>Accuracy by mode</h2>
        <div className="bars">
          {MODE_ORDER.map((id) => {
            const a = acc[id];
            return (
              <div key={id} className="bar-row">
                <a href={href(`/${MODES[id].route}`)}>{MODES[id].title}</a>
                <div className="bar-track" role="img" aria-label={a.rate === null ? 'not played' : `${formatPercent(a.rate)} correct`}>
                  {a.rate !== null && <div className="bar-fill" style={{ width: `${Math.max(2, a.rate * 100)}%` }} />}
                </div>
                <span className="bar-value">{a.rate === null ? '—' : `${formatPercent(a.rate)} · ${a.correct}/${a.attempts}`}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Weak spots</h2>
        <p className="muted small">Question types with at least 2 attempts, weakest first. Practise the top ones.</p>
        {weak.length === 0 ? (
          <p className="empty-note">Answer a few more questions and your weak spots will show up here.</p>
        ) : (
          <div>
            {weak.slice(0, 10).map((w) => (
              <div key={w.kind} className="weak-row">
                <span className="weak-name">{kindLabel(w.kind)}</span>
                <span className="bar-value">
                  {w.correct}/{w.attempts} · {formatPercent(w.rate)}{' '}
                  <a className="btn btn-sm btn-outline" href={practiceHref(w.kind)} style={{ marginLeft: 8 }}>
                    Practise
                  </a>
                </span>
                <div className="bar-track" aria-hidden="true">
                  <div className="bar-fill" style={{ width: `${Math.max(2, w.rate * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Reset</h2>
        <p className="muted small" style={{ margin: '4px 0 10px' }}>
          Progress is stored only in this browser (localStorage).
        </p>
        {confirming ? (
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                reset();
                setConfirming(false);
              }}
            >
              Yes, erase my progress
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-outline" onClick={() => setConfirming(true)}>
            Reset progress…
          </button>
        )}
      </section>
    </div>
  );
}
