/** Mode 6 — true/false statements from src/data/statements.json. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, IconCross, IconNext, IconRefresh } from '../components/Icons';
import { RichText } from '../components/RichText';
import { PageHeader } from '../components/ui';
import { navigate, useRoute } from '../lib/router';
import { pointsFor } from '../quiz/grade';
import { splitTrapWords, STATEMENTS, topicSlug, type Statement } from '../quiz/statements';
import { createRng, randomSeed } from '../science/rng';
import { useProgress } from '../state/ProgressContext';

const ALL = '';

export function TrueFalseMode() {
  const { params } = useRoute();
  const seed = params.get('seed');
  const topic = params.get('topic') ?? ALL;
  const exam = params.get('exam') ?? ALL;
  const { statements, errors } = STATEMENTS;

  useEffect(() => {
    if (!seed) navigate('/tf', { seed: randomSeed(), topic: topic || undefined, exam: exam || undefined }, { replace: true });
  }, [seed, topic, exam]);

  const topics = useMemo(() => [...new Set(statements.map((s) => s.topic))].sort(), [statements]);
  const exams = useMemo(() => [...new Set(statements.map((s) => s.exam))].sort(), [statements]);
  const deck = useMemo(() => {
    const filtered = statements.filter((s) => (!topic || s.topic === topic) && (!exam || s.exam === exam));
    return seed ? createRng(`tf/${seed}`).shuffle(filtered) : filtered;
  }, [statements, topic, exam, seed]);

  const setFilter = (next: { topic?: string; exam?: string }) =>
    navigate('/tf', { seed: seed ?? randomSeed(), topic: (next.topic ?? topic) || undefined, exam: (next.exam ?? exam) || undefined }, { replace: true });

  return (
    <div className="page">
      <PageHeader title="True / false" subtitle="Exam statements in Spanish. Decide, then read why — watch out for absolute words." />
      {errors.length > 0 && (
        <div className="warning-box" role="alert">
          <strong>Some statements in statements.json were skipped:</strong>
          <ul className="plain-list">
            {errors.slice(0, 6).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="tf-filters">
        <select className="input" value={topic} onChange={(e) => setFilter({ topic: e.target.value })} aria-label="Topic">
          <option value={ALL}>All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {exams.length > 1 && (
          <select className="input" value={exam} onChange={(e) => setFilter({ exam: e.target.value })} aria-label="Exam">
            <option value={ALL}>All exams</option>
            {exams.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/tf', { seed: randomSeed(), topic: topic || undefined, exam: exam || undefined })}>
          <IconRefresh size={15} /> Shuffle
        </button>
        <span className="muted small">{deck.length} statements</span>
      </div>
      {deck.length === 0 ? (
        <p className="empty-note">No statements match these filters.</p>
      ) : (
        <Deck key={`${seed}/${topic}/${exam}`} deck={deck} onReshuffle={() => navigate('/tf', { seed: randomSeed(), topic: topic || undefined, exam: exam || undefined })} />
      )}
    </div>
  );
}

function Deck({ deck, onReshuffle }: { deck: Statement[]; onReshuffle(): void }) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  if (index >= deck.length) {
    return (
      <section className="card quiz-card">
        <h2>Deck finished</h2>
        <p>
          {score} of {deck.length} correct.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onReshuffle}>
            <IconRefresh size={16} /> Shuffle and go again
          </button>
        </div>
      </section>
    );
  }
  return (
    <StatementCard
      key={deck[index].id}
      statement={deck[index]}
      position={`${index + 1} / ${deck.length}`}
      onDone={(correct) => correct && setScore((s) => s + 1)}
      onNext={() => {
        setIndex((i) => i + 1);
        window.scrollTo({ top: 0 });
      }}
    />
  );
}

function StatementCard({
  statement: s,
  position,
  onDone,
  onNext,
}: {
  statement: Statement;
  position: string;
  onDone(correct: boolean): void;
  onNext(): void;
}) {
  const { progress, record } = useProgress();
  const [choice, setChoice] = useState<boolean | null>(null);
  const [showEn, setShowEn] = useState(false);
  const answered = choice !== null;
  const correct = answered && choice === s.answer;
  const [earned, setEarned] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (answered) nextRef.current?.focus({ preventScroll: true });
  }, [answered]);

  const answer = (value: boolean) => {
    if (answered) return;
    const ok = value === s.answer;
    const g = { correct: ok, score: ok ? 1 : 0, headline: '' };
    const points = pointsFor(g, progress.streak);
    setEarned(points);
    record({ kind: `tf.${topicSlug(s.topic)}`, correct: ok, points });
    setChoice(value);
    onDone(ok);
  };

  return (
    <article className="card quiz-card">
      <div className="quiz-meta">
        <span className="quiz-kind">{s.topic}</span>
        <span>
          {s.exam} · nº {s.number} · {position}
        </span>
      </div>
      <p className="statement" lang="es">
        {answered ? (
          splitTrapWords(s.textEs).map((p, i) =>
            p.trap ? (
              <mark key={i} className="trap" title="Trap word: absolute statements are often false">
                {p.text}
              </mark>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )
        ) : (
          s.textEs
        )}
      </p>
      {(showEn || answered) && (
        <p className="statement-en" lang="en">
          {s.textEn}
        </p>
      )}
      {!answered && (
        <>
          <div className="tf-buttons">
            <button type="button" className="btn btn-outline" onClick={() => answer(true)}>
              Verdadero
            </button>
            <button type="button" className="btn btn-outline" onClick={() => answer(false)}>
              Falso
            </button>
          </div>
          {!showEn && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEn(true)} style={{ justifySelf: 'start' }}>
              Show English translation
            </button>
          )}
        </>
      )}
      {answered && (
        <>
          <div className={`feedback ${correct ? 'feedback-good' : 'feedback-bad'}`} role="status">
            {correct ? <IconCheck size={18} /> : <IconCross size={18} />}
            <div>
              <strong>{correct ? 'Correct' : 'Not quite'}.</strong> The statement is <strong>{s.answer ? 'Verdadero (true)' : 'Falso (false)'}</strong>.
              {earned > 0 && <span> +{earned} points</span>}
            </div>
          </div>
          {s.debatable && (
            <p className="warning-box">
              <strong>Debatable:</strong> this one is open to interpretation — the answer shown is the examiners' key.
            </p>
          )}
          <section className="explanation">
            <h3>Why</h3>
            <p>
              <RichText text={s.explanation} />
            </p>
            {splitTrapWords(s.textEs).some((p) => p.trap) && (
              <p className="small muted">Highlighted: absolute words (siempre, solo, ninguna, todos…). They make a statement easy to falsify with one counter-example.</p>
            )}
          </section>
          <div className="actions">
            <button ref={nextRef} type="button" className="btn btn-primary" onClick={onNext}>
              Next statement <IconNext size={16} />
            </button>
          </div>
        </>
      )}
    </article>
  );
}
