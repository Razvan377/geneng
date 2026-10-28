/**
 * Mock exams: a full exam generated from a seed, answers hidden until it is finished. The same
 * page runs the genetics exam and the game theory midterm, each with its own configuration.
 */

import { useEffect, useMemo, useState } from 'react';
import { ExamQuestionView } from '../components/QuestionCard';
import { IconCheck, IconNext, IconRefresh, IconTimer } from '../components/Icons';
import { RichText } from '../components/RichText';
import { PageHeader, SeedBar } from '../components/ui';
import { useClock } from '../lib/hooks';
import { href, navigate, shareUrl, useRoute } from '../lib/router';
import { generateMockExam, gradeBand, partCount, partKey, partsOf, scoreExam, type MockExam } from '../quiz/mockExam';
import { generateGameTheoryExam } from '../quiz/gtExam';
import type { Grade } from '../quiz/types';
import { randomSeed } from '../science/rng';
import { useProgress } from '../state/ProgressContext';
import { loadJSON, saveJSON } from '../state/storage';

interface HistoryEntry {
  seed: string;
  date: string;
  grade: number;
  answered: number;
  total: number;
  seconds: number;
}

export interface ExamConfig {
  route: string;
  /** localStorage key of the list of past exams. */
  historyKey: string;
  title: string;
  tagline: string;
  /** "How it works" bullets (**bold** allowed). */
  rules: string[];
  generate(seed: string): MockExam;
}

const GENETICS_EXAM: ExamConfig = {
  route: '/exam',
  historyKey: 'examHistory',
  title: 'Mock exam',
  tagline: 'Full exams in the style of the solved problem collection — as many as you like.',
  rules: [
    'Seven problems, in the order of the course collection. Every exam is new: it is generated from a random seed.',
    'Answer in any order and save each part. You can change a saved answer until you finish.',
    'No feedback until you press **Finish exam**; then every part is corrected and explained, and you get a grade out of 10 (each problem weighs the same, unanswered parts score 0).',
    'Plan about 90 minutes. The clock is only a guide.',
  ],
  generate: generateMockExam,
};

const GAME_THEORY_EXAM: ExamConfig = {
  route: '/gt-exam',
  historyKey: 'gtExamHistory',
  title: 'Game theory midterm',
  tagline: 'Mock midterms in the format of the October 2023 paper — a new one every time.',
  rules: [
    'Four problems worth 3 + 2 + 3 + 2 points, like the real paper: a game with parameters, dominance and iterated elimination, a story to turn into a game, and a game with continuous strategies.',
    'Every exam is generated from a random seed, with new payoffs, stories and parameters.',
    'Save each part; you can change a saved answer until you finish. Probabilities can be typed as fractions (2/5) or decimals (0.4).',
    'No feedback until you press **Finish exam**; then every part is corrected with the worked solution, and you get a grade out of 10 weighted by the points of each problem.',
    'Plan about 75 minutes.',
  ],
  generate: generateGameTheoryExam,
};

function loadHistory(key: string): HistoryEntry[] {
  const h = loadJSON<unknown>(key, []);
  return Array.isArray(h) ? (h as HistoryEntry[]).filter((e) => typeof e?.seed === 'string' && typeof e?.grade === 'number') : [];
}

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
}

export function MockExamMode() {
  return <ExamMode config={GENETICS_EXAM} />;
}

export function GameTheoryExamMode() {
  return <ExamMode config={GAME_THEORY_EXAM} />;
}

function ExamMode({ config }: { config: ExamConfig }) {
  const { params } = useRoute();
  const seed = params.get('seed');
  const [attempt, setAttempt] = useState(0);
  if (!seed) return <ExamLanding config={config} />;
  return <ExamSession key={`${seed}/${attempt}`} config={config} seed={seed} onRetake={() => setAttempt((a) => a + 1)} />;
}

function startNew(config: ExamConfig) {
  navigate(config.route, { seed: randomSeed() });
}

/** "2.25/3 pts" for papers with points, "7.5/10" otherwise. */
function problemScore(fraction: number, points?: number): string {
  return points ? `${(Math.round(fraction * points * 100) / 100).toString()}/${points} pts` : `${(fraction * 10).toFixed(1)}/10`;
}

// ---------------------------------------------------------------------------------------------

function ExamLanding({ config }: { config: ExamConfig }) {
  const history = useMemo(() => loadHistory(config.historyKey), [config.historyKey]);
  const preview = useMemo(() => config.generate('preview'), [config]);
  const best = history.length ? Math.max(...history.map((h) => h.grade)) : null;
  return (
    <div className="page">
      <PageHeader title={config.title} subtitle={config.tagline} />
      <section className="card exam-intro">
        <h2>How it works</h2>
        <ul className="plain-list">
          {config.rules.map((r) => (
            <li key={r}>
              <RichText text={r} />
            </li>
          ))}
        </ul>
        <ol className="exam-outline">
          {preview.problems.map((p) => (
            <li key={p.number}>
              <strong>{p.title}</strong>
              {p.points && <span className="muted small"> ({p.points} points)</span>}
              <span className="muted small"> — {p.source}</span>
            </li>
          ))}
        </ol>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => startNew(config)}>
            Start a new exam <IconNext size={16} />
          </button>
        </div>
      </section>

      {history.length > 0 && (
        <section className="card">
          <h2>Your exams</h2>
          <p className="muted small" style={{ margin: '2px 0 10px' }}>
            {history.length} taken{best !== null ? ` · best ${best.toFixed(1)}` : ''}. Open one to retake the same exam.
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Grade</th>
                  <th>Answered</th>
                  <th aria-label="Retake" />
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 15).map((h) => (
                  <tr key={`${h.seed}-${h.date}`}>
                    <td>{new Date(h.date).toLocaleDateString()}</td>
                    <td className="num">
                      <strong>{h.grade.toFixed(1)}</strong> <span className="muted small">{gradeBand(h.grade)}</span>
                    </td>
                    <td className="num">
                      {h.answered}/{h.total} <span className="muted small">in {clock(h.seconds)}</span>
                    </td>
                    <td>
                      <a href={href(config.route, { seed: h.seed })}>Retake</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function ExamSession({ config, seed, onRetake }: { config: ExamConfig; seed: string; onRetake(): void }) {
  const exam = useMemo(() => config.generate(seed), [config, seed]);
  const total = useMemo(() => partCount(exam), [exam]);
  const { record } = useProgress();
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [finished, setFinished] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [duration, setDuration] = useState(0);
  const elapsed = useClock(startedAt, !finished);
  const answered = Object.keys(grades).length;
  const score = finished ? scoreExam(exam, grades) : null;

  // A new exam (or a retake) starts at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const setGrade = (key: string, g: Grade | null) =>
    setGrades((gs) => {
      const next = { ...gs };
      if (g) next[key] = g;
      else delete next[key];
      return next;
    });

  const finish = () => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    setDuration(seconds);
    setFinished(true);
    setConfirming(false);
    // Every part counts towards the stats; unanswered parts count as misses.
    exam.problems.forEach((p, pi) =>
      p.blocks.forEach((b, bi) =>
        partsOf(b).forEach((part, i) => {
          const g = grades[partKey(pi, bi, i)];
          record({ kind: part.kind, correct: g?.correct ?? false, points: g ? Math.round(10 * g.score) : 0 });
        }),
      ),
    );
    const s = scoreExam(exam, grades);
    const entry: HistoryEntry = { seed, date: new Date().toISOString(), grade: s.grade, answered: s.answered, total: s.total, seconds };
    saveJSON(config.historyKey, [entry, ...loadHistory(config.historyKey)].slice(0, 30));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page exam-page">
      <PageHeader title={config.title} subtitle={finished ? 'Corrected — every part is explained below.' : 'Save each answer; corrections appear when you finish.'} />

      {finished && score && <ExamResults config={config} exam={exam} score={score} seconds={duration} onRetake={onRetake} />}

      <div className="exam-bar" role="region" aria-label="Exam progress">
        <span className="exam-progress">
          <strong>
            {answered}/{total}
          </strong>{' '}
          parts saved
        </span>
        <span className="exam-progress-track" aria-hidden="true">
          <span style={{ width: `${(answered / total) * 100}%` }} />
        </span>
        <span className="exam-clock">
          <IconTimer size={15} /> {clock(finished ? duration : elapsed)}
        </span>
        {!finished &&
          (confirming ? (
            <span className="exam-confirm">
              {total - answered} unanswered.
              <button type="button" className="btn btn-sm btn-primary" onClick={finish}>
                Finish anyway
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)}>
                Keep going
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => (answered < total ? setConfirming(true) : finish())}>
              <IconCheck size={15} /> Finish exam
            </button>
          ))}
        {finished && score && (
          <span className="exam-final">
            Grade <strong>{score.grade.toFixed(1)}</strong>
          </span>
        )}
      </div>

      <nav className="exam-toc" aria-label="Problems">
        {exam.problems.map((p, pi) => (
          <a key={p.number} href={`#problem-${p.number}`} onClick={(e) => {
            e.preventDefault();
            document.getElementById(`problem-${p.number}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            {p.number}. {p.title}
            {score && <span className="muted"> · {problemScore(score.problems[pi], p.points)}</span>}
          </a>
        ))}
      </nav>

      {exam.problems.map((p, pi) => (
        <article key={p.number} id={`problem-${p.number}`} className="card quiz-card exam-problem">
          <header className="exam-problem-head">
            <h2>
              Problem {p.number} · {p.title}
              {p.points && <span className="exam-points"> ({p.points} points)</span>}
            </h2>
            <span className="muted small">{p.source}</span>
          </header>
          {p.blocks.map((b, bi) => (
            <div key={bi} className="exam-block">
              {p.blocks.length > 1 && <div className="exam-block-label">{p.number}.{bi + 1}</div>}
              <ExamQuestionView q={b} revealed={finished} onGrade={(part, g) => setGrade(partKey(pi, bi, part), g)} />
            </div>
          ))}
        </article>
      ))}

      {!finished && (
        <div className="actions exam-end">
          <button type="button" className="btn btn-primary" onClick={() => (answered < total ? setConfirming(true) : finish())}>
            <IconCheck size={16} /> Finish exam
          </button>
          {confirming && <span className="small muted">Confirm in the bar above.</span>}
        </div>
      )}
      <SeedBar seed={seed} url={shareUrl(config.route, { seed })} />
    </div>
  );
}

function ExamResults({ config, exam, score, seconds, onRetake }: { config: ExamConfig; exam: MockExam; score: ReturnType<typeof scoreExam>; seconds: number; onRetake(): void }) {
  return (
    <section className="card exam-results" aria-labelledby="exam-results-title">
      <div className="exam-grade">
        <span className="exam-grade-value">{score.grade.toFixed(1)}</span>
        <span>
          <strong id="exam-results-title">{gradeBand(score.grade)}</strong>
          <span className="muted small">
            {' '}
            · {score.answered}/{score.total} parts answered · {clock(seconds)}
          </span>
        </span>
      </div>
      <div className="bars">
        {exam.problems.map((p, i) => (
          <div key={p.number} className="bar-row">
            <a href={`#problem-${p.number}`} onClick={(e) => {
              e.preventDefault();
              document.getElementById(`problem-${p.number}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}>
              {p.number}. {p.title}
            </a>
            <div className="bar-track" role="img" aria-label={`${Math.round(score.problems[i] * 100)}%`}>
              <div className="bar-fill" style={{ width: `${Math.max(2, score.problems[i] * 100)}%` }} />
            </div>
            <span className="bar-value">{problemScore(score.problems[i], p.points)}</span>
          </div>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => startNew(config)}>
          <IconRefresh size={16} /> New exam
        </button>
        <button type="button" className="btn btn-outline" onClick={onRetake}>
          Retake this exam
        </button>
        <a className="btn btn-ghost" href={href('/stats')}>
          Weak spots
        </a>
      </div>
    </section>
  );
}
