/** Modes 2–5: generic quiz runner plus each mode's configuration. */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QuestionCard } from '../components/QuestionCard';
import { PageHeader, SeedBar } from '../components/ui';
import { href, navigate, shareUrl, useRoute } from '../lib/router';
import { ENDS_KINDS, generateEndsQuestion } from '../quiz/endsQuestions';
import { GEL_KINDS, generateGelQuestion } from '../quiz/gelQuestions';
import { pointsFor } from '../quiz/grade';
import { KIND_LABELS, MODES, type ModeId } from '../quiz/kinds';
import { generateNumbersQuestion, NUMBERS_KINDS } from '../quiz/numbersQuestions';
import { BROWN_PRIMER, generatePcrQuestion, PCR_KINDS, tmWorking } from '../quiz/pcrQuestions';
import type { Grade, Question } from '../quiz/types';
import { randomSeed } from '../science/rng';
import { useProgress } from '../state/ProgressContext';

interface QuizModeProps {
  mode: ModeId;
  kinds: readonly string[];
  generate(seed: string, kind?: string): Question;
  aside?: ReactNode;
}

function QuizMode({ mode, kinds, generate, aside }: QuizModeProps) {
  const { params } = useRoute();
  const { progress, record } = useProgress();
  const meta = MODES[mode];
  const path = `/${meta.route}`;
  const type = params.get('type');
  const kind = type && kinds.includes(type) ? type : undefined;
  const seed = params.get('seed');
  const [session, setSession] = useState({ answered: 0, correct: 0 });
  const filterRef = useRef<HTMLElement>(null);

  // A new question starts at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [seed]);

  // Keep the active filter chip visible on narrow screens.
  useEffect(() => {
    filterRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [kind]);

  useEffect(() => {
    if (!seed) navigate(path, { type: kind, seed: randomSeed() }, { replace: true });
  }, [seed, kind, path]);

  const question = useMemo(() => (seed ? generate(seed, kind) : null), [seed, kind, generate]);
  if (!seed || !question) return null;

  const onAnswered = (g: Grade) => {
    const points = pointsFor(g, progress.streak);
    record({ kind: question.kind, correct: g.correct, points });
    setSession((s) => ({ answered: s.answered + 1, correct: s.correct + (g.correct ? 1 : 0) }));
    return points;
  };
  const next = () => navigate(path, { type: kind, seed: randomSeed() }, { replace: true });

  return (
    <div className="page">
      <PageHeader title={meta.title} subtitle={meta.blurb} />
      <nav className="quiz-filter" aria-label="Question type" ref={filterRef}>
        <a className={`chip${kind ? '' : ' is-active'}`} href={href(path)} aria-current={kind ? undefined : 'page'}>
          Mixed
        </a>
        {kinds.map((k) => (
          <a key={k} className={`chip${kind === k ? ' is-active' : ''}`} href={href(path, { type: k })} aria-current={kind === k ? 'page' : undefined}>
            {KIND_LABELS[`${mode}.${k}`] ?? k}
          </a>
        ))}
      </nav>
      {aside}
      <QuestionCard
        key={`${seed}/${kind ?? ''}`}
        question={question}
        onAnswered={onAnswered}
        onNext={next}
        footer={<SeedBar seed={seed} url={shareUrl(path, { type: kind, seed })} />}
      />
      {session.answered > 0 && (
        <p className="session-line">
          This session: {session.correct} of {session.answered} correct
        </p>
      )}
    </div>
  );
}

const generators = {
  ends: (s: string, k?: string) => generateEndsQuestion(s, k as never),
  pcr: (s: string, k?: string) => generatePcrQuestion(s, k as never),
  gel: (s: string, k?: string) => generateGelQuestion(s, k as never),
  num: (s: string, k?: string) => generateNumbersQuestion(s, k as never),
};

export function EndsMode() {
  return <QuizMode mode="ends" kinds={ENDS_KINDS} generate={generators.ends} />;
}

export function PcrMode() {
  return (
    <QuizMode
      mode="pcr"
      kinds={PCR_KINDS}
      generate={generators.pcr}
      aside={
        <details className="card worked-example">
          <summary>
            <strong>Worked example (Brown, Fig. 9.9)</strong>
          </summary>
          <p style={{ marginTop: 8 }}>
            Primer <code>5′-{BROWN_PRIMER}-3′</code>: {tmWorking(BROWN_PRIMER)} Anneal at about 52 − 2 = 50 °C.
          </p>
        </details>
      }
    />
  );
}

export function GelMode() {
  return <QuizMode mode="gel" kinds={GEL_KINDS} generate={generators.gel} />;
}

export function NumbersMode() {
  return <QuizMode mode="num" kinds={NUMBERS_KINDS} generate={generators.num} />;
}
