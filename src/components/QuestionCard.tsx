/** Renders any generated Question, collects the answer, grades it and teaches the reasoning. */

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { grade as gradeAnswer, type Answer } from '../quiz/grade';
import { kindLabel } from '../quiz/kinds';
import type {
  CaseQuestion,
  ChoiceQuestion,
  Grade,
  LanesQuestion,
  MatchQuestion,
  NumericQuestion,
  OrderQuestion,
  Question,
  SimpleQuestion,
} from '../quiz/types';
import { parseNumber } from '../science/numbers';
import { trimNumber } from '../science/format';
import { IconCheck, IconCross, IconNext, IconPlus, IconUndo } from './Icons';
import { RichText } from './RichText';
import { BlotView } from './visuals/BlotView';
import { VisualView } from './visuals/VisualView';

/** Called once per answered part; returns the points awarded. */
export type AnswerHandler = (grade: Grade, kind: string) => number;

interface Props {
  question: Question;
  onAnswered: AnswerHandler;
  onNext(): void;
  footer?: ReactNode;
}

export function QuestionCard({ question, onAnswered, onNext, footer }: Props) {
  if (question.format === 'case') return <CaseCard q={question} onAnswered={onAnswered} onNext={onNext} footer={footer} />;
  return <SingleCard q={question} onAnswered={onAnswered} onNext={onNext} footer={footer} />;
}

function SingleCard({ q, onAnswered, onNext, footer }: { q: SimpleQuestion; onAnswered: AnswerHandler; onNext(): void; footer?: ReactNode }) {
  const [done, setDone] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (done) nextRef.current?.focus({ preventScroll: true });
  }, [done]);
  return (
    <article className="card quiz-card" aria-live="polite">
      <div className="quiz-meta">
        <span className="quiz-kind">{kindLabel(q.kind)}</span>
      </div>
      <PartView q={q} onAnswered={onAnswered} onDone={() => setDone(true)} />
      {done && (
        <div className="actions">
          <button ref={nextRef} type="button" className="btn btn-primary" onClick={onNext}>
            Next question <IconNext size={16} />
          </button>
        </div>
      )}
      {footer}
    </article>
  );
}

/** A multi-part problem: shared scenario, then parts revealed one after another. */
function CaseCard({ q, onAnswered, onNext, footer }: { q: CaseQuestion; onAnswered: AnswerHandler; onNext(): void; footer?: ReactNode }) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [shown, setShown] = useState(1);
  const partRefs = useRef<(HTMLElement | null)[]>([]);
  const finished = grades.length === q.parts.length;

  useEffect(() => {
    if (shown > 1) partRefs.current[shown - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [shown]);

  const right = grades.filter((g) => g.correct).length;
  return (
    <article className="card quiz-card case-card" aria-live="polite">
      <div className="quiz-meta">
        <span className="quiz-kind">{kindLabel(q.kind)}</span>
        <span>{q.parts.length} parts</span>
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
      {q.parts.slice(0, shown).map((part, i) => (
        <section
          key={i}
          className="case-part"
          ref={(el) => {
            partRefs.current[i] = el;
          }}
        >
          <h3 className="case-part-title">
            Part {i + 1} of {q.parts.length} <span className="muted">· {kindLabel(part.kind)}</span>
          </h3>
          <PartView
            q={part}
            onAnswered={onAnswered}
            onDone={(g) => setGrades((gs) => (gs.length === i ? [...gs, g] : gs))}
          />
          {grades.length > i && i + 1 === shown && i + 1 < q.parts.length && (
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={() => setShown((n) => n + 1)}>
                Part {i + 2} <IconNext size={16} />
              </button>
            </div>
          )}
        </section>
      ))}
      {finished && (
        <div className="case-summary">
          <p>
            <strong>
              {right} of {q.parts.length} parts right.
            </strong>{' '}
            {right === q.parts.length ? 'The whole problem is solved.' : 'Read the explanations of the parts you missed, then try another one.'}
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={onNext}>
              Next problem <IconNext size={16} />
            </button>
          </div>
        </div>
      )}
      {footer}
    </article>
  );
}

/** One question: prompt, visual, answer input, feedback and explanation. */
function PartView({ q, onAnswered, onDone }: { q: SimpleQuestion; onAnswered: AnswerHandler; onDone(g: Grade): void }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [result, setResult] = useState<{ grade: Grade; points: number } | null>(null);

  const submit = (a: Answer) => {
    if (result) return;
    const g = gradeAnswer(q, a);
    setAnswer(a);
    const points = onAnswered(g, q.kind);
    setResult({ grade: g, points });
    onDone(g);
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
    <>
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
      {q.format === 'lanes' && <LanesInput q={q} grade={result?.grade ?? null} onSubmit={(lanes) => submit({ format: 'lanes', lanes })} />}
      {q.format === 'match' && <MatchInput q={q} grade={result?.grade ?? null} onSubmit={(choice) => submit({ format: 'match', choice })} />}

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
        </>
      )}
    </>
  );
}

function answerText(q: SimpleQuestion, a: Answer | null): string {
  if (q.format === 'numeric') {
    const yours = a?.format === 'numeric' && a.value !== null ? `${trimNumber(a.value, 4)} ${q.unit}` : '—';
    return `Answer: ${q.answerLabel} (you said ${yours}).`;
  }
  if (q.format === 'order') {
    return `Correct order: ${q.correct.map((id) => q.items.find((i) => i.id === id)!.label).join(' < ')}.`;
  }
  if (q.format === 'lanes') return 'Compare your blot with the expected one below.';
  if (q.format === 'match') return '';
  const labels = q.correct.map((id) => q.options.find((o) => o.id === id)!.label.replace(/\n/g, ' · '));
  return `Answer: ${labels.join(', ')}.`;
}

// ---------------------------------------------------------------------------------------------
// Draw the expected blot: band sizes per lane

interface LaneState {
  bands: number[];
  none: boolean;
  text: string;
  error: string | null;
}

function fmtBand(v: number, unit: string): string {
  return `${trimNumber(v, unit === 'kDa' ? 1 : 2)} ${unit}`;
}

function LanesInput({ q, grade, onSubmit }: { q: LanesQuestion; grade: Grade | null; onSubmit(lanes: number[][]): void }) {
  const [lanes, setLanes] = useState<LaneState[]>(() => q.lanes.map(() => ({ bands: [], none: false, text: '', error: null })));
  const locked = grade !== null;
  const ready = lanes.every((l) => l.none || l.bands.length > 0);

  const update = (i: number, f: (l: LaneState) => LaneState) => setLanes((ls) => ls.map((l, j) => (j === i ? f(l) : l)));
  const add = (i: number) =>
    update(i, (l) => {
      const v = parseNumber(l.text);
      if (v === null || v <= 0) return { ...l, error: 'Type a size, e.g. 1.35' };
      if (l.bands.length >= 4) return { ...l, error: 'At most 4 bands per lane' };
      return { ...l, bands: [...l.bands, v].sort((a, b) => b - a), none: false, text: '', error: null };
    });

  const preview = q.lanes.map((lane, i) => ({ label: lane.label, bands: lanes[i].bands.map((size) => ({ size })) }));
  const expected = q.lanes.map((lane, i) => ({ label: lane.label, bands: q.expected[i].map((size) => ({ size })) }));
  const errors = grade?.details?.map((ok) => !ok);

  return (
    <div className="lanes-input">
      <p className="small muted">
        For each lane, add every band you expect ({q.unit}), or mark it “No band”. Your blot is drawn as you go.
      </p>
      <div className="lane-rows">
        {q.lanes.map((lane, i) => {
          const l = lanes[i];
          const verdict = grade?.details?.[i];
          return (
            <div key={lane.id} className={`lane-row${verdict === false ? ' is-bad' : verdict ? ' is-good' : ''}`}>
              <span className="lane-name">{lane.label}</span>
              <div className="lane-bands">
                {l.none && <span className="band-chip band-chip-none">no band</span>}
                {l.bands.map((b, j) => (
                  <button
                    key={j}
                    type="button"
                    className="band-chip"
                    disabled={locked}
                    onClick={() => update(i, (s) => ({ ...s, bands: s.bands.filter((_, k) => k !== j) }))}
                    aria-label={`Remove band ${fmtBand(b, q.unit)}`}
                  >
                    {fmtBand(b, q.unit)}
                    {!locked && <IconCross size={12} />}
                  </button>
                ))}
                {!locked && (
                  <form
                    className="lane-add"
                    onSubmit={(e) => {
                      e.preventDefault();
                      add(i);
                    }}
                  >
                    <input
                      className="input input-band"
                      inputMode="decimal"
                      placeholder={q.unit}
                      value={l.text}
                      onChange={(e) => update(i, (s) => ({ ...s, text: e.target.value, error: null }))}
                      aria-label={`Band size for lane ${lane.label}, in ${q.unit}`}
                    />
                    <button type="submit" className="btn btn-sm btn-outline" aria-label={`Add band to lane ${lane.label}`}>
                      <IconPlus size={14} />
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${l.none ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => update(i, (s) => ({ ...s, none: !s.none, bands: [], error: null }))}
                      aria-pressed={l.none}
                    >
                      No band
                    </button>
                  </form>
                )}
                {locked && verdict === false && (
                  <span className="lane-expected">
                    expected: {q.expected[i].length ? q.expected[i].map((b) => fmtBand(b, q.unit)).join(' + ') : 'no band'}
                  </span>
                )}
                {l.error && <span className="input-error">{l.error}</span>}
              </div>
              {locked && <span className="lane-verdict">{verdict ? <IconCheck size={16} /> : <IconCross size={16} />}</span>}
            </div>
          );
        })}
      </div>
      <div className={`blot-compare${locked ? ' is-graded' : ''}`}>
        <div>
          <div className="cloning-title">Your blot</div>
          <BlotView look={q.look} unit={q.unit} ladder={q.ladder} lanes={preview} errors={errors} height={220} />
        </div>
        {locked && (
          <div>
            <div className="cloning-title">Expected</div>
            <BlotView look={q.look} unit={q.unit} ladder={q.ladder} lanes={expected} height={220} />
          </div>
        )}
      </div>
      {!locked && (
        <div className="actions">
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => onSubmit(lanes.map((l) => (l.none ? [] : l.bands)))}>
            <IconCheck size={16} /> Check blot
          </button>
          {!ready && <span className="small muted">Every lane needs bands or “No band”.</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Matching samples to lanes

function MatchInput({ q, grade, onSubmit }: { q: MatchQuestion; grade: Grade | null; onSubmit(choice: Record<string, string>): void }) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const locked = grade !== null;
  const ready = q.rows.every((r) => choice[r.id]);
  const label = (id: string) => q.options.find((o) => o.id === id)?.label ?? id;
  return (
    <div className="match-input">
      {q.rows.map((r, i) => {
        const ok = grade?.details?.[i];
        return (
          <label key={r.id} className={`match-row${ok === false ? ' is-bad' : ok ? ' is-good' : ''}`}>
            <span className="match-label">{r.label}</span>
            <select
              className="input"
              value={choice[r.id] ?? ''}
              disabled={locked}
              onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}
            >
              <option value="" disabled>
                Choose…
              </option>
              {q.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {locked && (
              <span className="match-verdict">
                {ok ? <IconCheck size={16} /> : <IconCross size={16} />}
                {!ok && <span className="lane-expected">{q.correct[r.id].map(label).join(' or ')}</span>}
              </span>
            )}
          </label>
        );
      })}
      {!locked && (
        <div className="actions">
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => onSubmit(choice)}>
            <IconCheck size={16} /> Check
          </button>
        </div>
      )}
    </div>
  );
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
