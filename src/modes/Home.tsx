import { IconCalendar, IconExam, ModeGlyph } from '../components/Icons';
import { href } from '../lib/router';
import { GENETICS_MODES, MODES } from '../quiz/kinds';
import { formatPercent } from '../science/format';
import { CLASSICS } from '../science/puzzle';
import { isoDate } from '../science/rng';
import { modeAccuracy } from '../state/progress';
import { useProgress } from '../state/ProgressContext';
import { loadJSON } from '../state/storage';
import { dailyDifficulty } from './MappingMode';

export function Home() {
  const { progress } = useProgress();
  const acc = modeAccuracy(progress);
  const today = isoDate(new Date());
  const daily = progress.daily[today];
  const lastGrade = (key: string) => {
    const list = loadJSON<{ grade: number }[]>(key, []);
    return Array.isArray(list) && list.length && typeof list[0]?.grade === 'number' ? list[0].grade : null;
  };
  const lastExam = lastGrade('examHistory');
  const lastGt = lastGrade('gtExamHistory');
  const gt = acc.gt;

  return (
    <div className="page home">
      <section className="hero">
        <h1>Practise the problems your exams ask for.</h1>
        <p className="muted">
          Game theory midterms and genetic engineering problems — every question is generated from a seed, checked by the same
          code that is unit-tested, and explained step by step.
        </p>
      </section>

      <h2 className="subject-title">
        Game theory <span className="muted small">· Game Theory and Economic Applications</span>
      </h2>

      <a className="card daily-card exam-card" href={href('/gt-exam')}>
        <div className="daily-icon exam-icon">
          <IconExam size={26} />
        </div>
        <div className="daily-text">
          <span className="eyebrow">Mock midterm · 10 points</span>
          <strong>A new midterm every time</strong>
          <span className="muted small">A game with parameters, dominance and IESDS, a story to turn into a game, continuous strategies — graded like the real paper.</span>
        </div>
        <span className="tag tag-accent">{lastGt !== null ? `Last ${lastGt.toFixed(1)}` : 'Start'}</span>
      </a>

      <a className="card mode-card gt-practice" href={href('/gt')}>
        <div className="mode-glyph">
          <ModeGlyph mode="gt" />
        </div>
        <div className="mode-text">
          <strong>Practice by topic</strong>
          <span className="muted small">{MODES.gt.blurb}</span>
        </div>
        <div className="mode-acc" aria-label={gt.rate === null ? 'not played yet' : `accuracy ${formatPercent(gt.rate)}`}>
          {gt.rate === null ? <span className="muted small">new</span> : <span>{formatPercent(gt.rate)}</span>}
          {gt.attempts > 0 && <span className="muted small">{gt.attempts} done</span>}
        </div>
      </a>

      <h2 className="subject-title">
        Enginyeria Genètica <span className="muted small">· after T.A. Brown</span>
      </h2>

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

      <a className="card daily-card exam-card" href={href('/exam')}>
        <div className="daily-icon exam-icon">
          <IconExam size={26} />
        </div>
        <div className="daily-text">
          <span className="eyebrow">Mock exam</span>
          <strong>A full 7-problem exam, new every time</strong>
          <span className="muted small">Cloning, calculations, blots, expression vectors, two-hybrid and techniques — corrected and graded out of 10 at the end.</span>
        </div>
        <span className="tag tag-accent">{lastExam !== null ? `Last ${lastExam.toFixed(1)}` : 'Start'}</span>
      </a>

      <div className="mode-grid">
        {GENETICS_MODES.map((id) => {
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
