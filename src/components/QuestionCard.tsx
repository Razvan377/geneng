/** Renders any generated Question, collects the answer, grades it and teaches the reasoning. */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { grade as gradeAnswer, type Answer } from '../quiz/grade';
import { kindLabel } from '../quiz/kinds';
import type { ChoiceQuestion, Grade, NumericQuestion, OrderQuestion, Question } from '../quiz/types';
import { parseNumber } from '../science/numbers';
import { trimNumber } from '../science/format';
import { IconCheck, IconCross, IconNext, IconUndo } from './Icons';
import { RichText } from './RichText';
import { VisualView } from './visuals/VisualView';

interface Props {
  question: Question;
  onAnswered(grade: Grade): number;
  onNext(): void;
  footer?: React.ReactNode;
}

export function QuestionCard({ question: q, onAnswered, onNext, footer }: Props) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [result, setResult] = useState<{ grade: Grade; points: number } | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (result) nextRef.current?.focus({ preventScroll: true });
  }, [result]);

  const submit = (a: Answer) => {
    if (result) return;
    const g = gradeAnswer(q, a);
    setAnswer(a);
    const points = onAnswered(g);
    setResult({ grade: g, points });
  };

  const guessBp =
    answer?.format === 'numeric' && answer.value !== null && q.format === 'numeric'
      ? q.unit === 'kb'
        ? answer.value * 1000
        : q.unit === 'bp'
          ? answer.value
          : null
      : null;

  return (
    <article className="card quiz-card" aria-live="polite">
      <div className="quiz-meta">
        <span className="quiz-kind">{kindLabel(q.kind)}</span>
      </div>
      <p className="prompt">
        <RichText text={q.prompt} />
      </p>
      {q.visual && (
        <div className="visual">
          <VisualView visual={q.visual} />
        </div>
      )}
      {q.detail && (
        <p className="prompt-detail">
          <RichText text={q.detail} />
        </p>
      )}

      {q.format === 'choice' && <ChoiceInput q={q} result={result?.grade ?? null} selected={answer?.format === 'choice' ? answer.selected : null} onSubmit={(selected) => submit({ format: 'choice', selected })} />}
      {q.format === 'numeric' && <NumericInput q={q} locked={!!result} onSubmit={(value) => submit({ format: 'numeric', value })} />}
      {q.format === 'order' && <OrderInput q={q} locked={!!result} onSubmit={(order) => submit({ format: 'order', order })} />}

      {result && (
        <>
          <div className={`feedback ${result.grade.correct ? 'feedback-good' : result.grade.score > 0 ? 'feedback-neutral' : 'feedback-bad'}`} role="status">
            {result.grade.correct ? <IconCheck size={18} /> : <IconCross size={18} />}
            <div>
              <strong>{result.grade.headline}.</strong> {answerText(q, answer)}
              {result.points > 0 && <span> +{result.points} points</span>}
            </div>
          </div>
          {q.revealVisual && (
            <div className="visual">
              <VisualView visual={q.revealVisual} guessBp={guessBp} />
            </div>
          )}
          <section className="explanation">
            <h3>Why</h3>
            {q.explanation.map((p, i) => (
              <p key={i}>
                <RichText text={p} />
              </p>
            ))}
          </section>
          <div className="actions">
            <button ref={nextRef} type="button" className="btn btn-primary" onClick={onNext}>
              Next question <IconNext size={16} />
            </button>
          </div>
        </>
      )}
      {footer}
    </article>
  );
}

function answerText(q: Question, a: Answer | null): string {
  if (q.format === 'numeric') {
    const yours = a?.format === 'numeric' && a.value !== null ? `${trimNumber(a.value, 4)} ${q.unit}` : '—';
    return `Answer: ${q.answerLabel} (you said ${yours}).`;
  }
  if (q.format === 'order') {
    return `Correct order: ${q.correct.map((id) => q.items.find((i) => i.id === id)!.label).join(' < ')}.`;
  }
  const labels = q.correct.map((id) => q.options.find((o) => o.id === id)!.label.replace(/\n/g, ' · '));
  return `Answer: ${labels.join(', ')}.`;
}

// ---------------------------------------------------------------------------------------------

function ChoiceInput({
  q,
  result,
  selected,
  onSubmit,
}: {
  q: ChoiceQuestion;
  result: Grade | null;
  selected: string[] | null;
  onSubmit(ids: string[]): void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const answered = result !== null;
  const shown = answered ? (selected ?? []) : picked;
  const short = q.options.every((o) => o.label.length < 34 && !o.mono);

  const toggle = (id: string) => {
    if (answered) return;
    if (!q.multi) {
      onSubmit([id]);
      return;
    }
    setPicked((p) => {
      if (q.exclusive?.includes(id)) return p.includes(id) ? [] : [id];
      const rest = p.filter((x) => !q.exclusive?.includes(x));
      return rest.includes(id) ? rest.filter((x) => x !== id) : [...rest, id];
    });
  };

  return (
    <>
      {q.multi && !answered && <p className="small muted">Select all that apply, then check.</p>}
      <div className={`options${short ? ' options-short' : ''}`} role={q.multi ? 'group' : 'radiogroup'}>
        {q.options.map((o) => {
          const isSel = shown.includes(o.id);
          const isCorrect = q.correct.includes(o.id);
          let cls = 'option';
          if (!q.multi) cls += ' option-radio';
          if (answered) {
            if (isCorrect) cls += ' is-correct';
            else if (isSel) cls += ' is-wrong';
          } else if (isSel) cls += ' is-selected';
          return (
            <button
              key={o.id}
              type="button"
              className={cls}
              onClick={() => toggle(o.id)}
              disabled={answered}
              role={q.multi ? 'checkbox' : 'radio'}
              aria-checked={isSel}
              aria-label={answered && o.note ? `${o.label}. ${o.note}` : o.label}
            >
              <span className="option-mark" aria-hidden="true">
                {answered && !isCorrect && isSel ? <IconCross size={14} /> : <IconCheck size={14} />}
              </span>
              <span className="option-body">
                <span className={`option-label${o.mono ? ' mono' : ''}`}>{o.label}</span>
                {answered && o.note && <span className="option-note">{o.note}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {q.multi && !answered && (
        <div className="actions">
          <button type="button" className="btn btn-primary" disabled={picked.length === 0} onClick={() => onSubmit(picked)}>
            <IconCheck size={16} /> Check
          </button>
        </div>
      )}
    </>
  );
}

function NumericInput({ q, locked, onSubmit }: { q: NumericQuestion; locked: boolean; onSubmit(v: number | null): void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [q]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const v = parseNumber(text);
    if (v === null) {
      setError('I could not read that as a number. Examples: 0.5 · 4096 · 1.07e9 · 4.6x10^5');
      return;
    }
    setError(null);
    onSubmit(v);
  };

  return (
    <form className="numeric-row" onSubmit={submit}>
      <input
        ref={inputRef}
        className="input"
        inputMode="decimal"
        autoComplete="off"
        placeholder={q.placeholder ?? 'your answer'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={locked}
        aria-label={`Answer in ${q.unit}`}
        aria-invalid={error ? true : undefined}
      />
      <span className="muted">{q.unit}</span>
      <button type="submit" className="btn btn-primary" disabled={locked || !text.trim()}>
        <IconCheck size={16} /> Check
      </button>
      {error && <span className="input-error" role="alert">{error}</span>}
    </form>
  );
}

function OrderInput({ q, locked, onSubmit }: { q: OrderQuestion; locked: boolean; onSubmit(order: string[]): void }) {
  const [order, setOrder] = useState<string[]>([]);
  const label = (id: string) => q.items.find((i) => i.id === id)!.label;
  const remaining = q.items.filter((i) => !order.includes(i.id));
  return (
    <div className="order">
      <p className="small muted">Tap the items from smallest to largest capacity.</p>
      <div className="order-picked" aria-label="Your order">
        {order.length === 0 && <span className="muted small">Your order appears here.</span>}
        {order.map((id, i) => (
          <button key={id} type="button" className="order-chip" disabled={locked} onClick={() => setOrder((o) => o.filter((x) => x !== id))} aria-label={`Remove ${label(id)}`}>
            <b>{i + 1}</b> {label(id)}
          </button>
        ))}
      </div>
      <div className="order-pool" style={{ marginTop: 8 }}>
        {remaining.map((item) => (
          <button key={item.id} type="button" className="btn btn-outline btn-sm" disabled={locked} onClick={() => setOrder((o) => [...o, item.id])}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={locked || remaining.length > 0} onClick={() => onSubmit(order)}>
          <IconCheck size={16} /> Check
        </button>
        {order.length > 0 && !locked && (
          <button type="button" className="btn btn-ghost" onClick={() => setOrder([])}>
            <IconUndo size={15} /> Reset
          </button>
        )}
      </div>
    </div>
  );
}
