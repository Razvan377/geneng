import { IconCalendar, ModeGlyph } from '../components/Icons';
import { href } from '../lib/router';
import { MODE_ORDER, MODES } from '../quiz/kinds';
import { formatPercent } from '../science/format';
import { CLASSICS } from '../science/puzzle';
import { isoDate } from '../science/rng';
import { modeAccuracy } from '../state/progress';
import { useProgress } from '../state/ProgressContext';
import { dailyDifficulty } from './MappingMode';

export function Home() {
  const { progress } = useProgress();
  const acc = modeAccuracy(progress);
  const today = isoDate(new Date());
  const daily = progress.daily[today];

  return (
    <div className="page home">
      <section className="hero">
        <h1>Practise the calculations the exam asks for.</h1>
        <p className="muted">
          Restriction maps, gels, sticky ends, PCR and lab numbers — every question is generated from a seed, checked by
          the same code that is unit-tested, and explained step by step.
        </p>
      </section>

      <a className="card daily-card" href={href('/map', { daily: today })}>
        <div className="daily-icon">
          <IconCalendar size={26} />
        </div>
        <div className="daily-text">
          <span className="eyebrow">Daily challenge · {today}</span>
          <strong>Today's {dailyDifficulty(today)} restriction map</strong>
          <span className="muted small">Same puzzle for everyone today — generated from the date.</span>
        </div>
        <span className={`tag ${daily?.solved ? 'tag-good' : 'tag-accent'}`}>{daily?.solved ? `Solved · +${daily.points}` : 'Play'}</span>
      </a>

      <div className="mode-grid">
        {MODE_ORDER.map((id) => {
          const m = MODES[id];
          const a = acc[id];
          return (
            <a key={id} className="card mode-card" href={href(`/${m.route}`)}>
              <div className="mode-glyph">
                <ModeGlyph mode={id} />
              </div>
              <div className="mode-text">
                <strong>{m.title}</strong>
                <span className="muted small">{m.blurb}</span>
              </div>
              <div className="mode-acc" aria-label={a.rate === null ? 'not played yet' : `accuracy ${formatPercent(a.rate)}`}>
                {a.rate === null ? <span className="muted small">new</span> : <span>{formatPercent(a.rate)}</span>}
                {a.attempts > 0 && <span className="muted small">{a.attempts} done</span>}
              </div>
            </a>
          );
        })}
      </div>

      <section className="card classics">
        <h2>Classic levels</h2>
        <p className="muted small">Fixed problems from the lecture slides and from Brown, Figure 4.16.</p>
        <div className="classic-list">
          {CLASSICS.map((c) => (
            <a key={c.id} className="classic-item" href={href('/map', { classic: c.id.replace('classic-', '') })}>
              <strong>{c.title}</strong>
              <span className="muted small">{c.intro}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
