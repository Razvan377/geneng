import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  emptyProgress,
  recordAnswer,
  recordDaily,
  sanitizeProgress,
  type AnswerEvent,
  type DailyRecord,
  type Progress,
} from './progress';
import { loadJSON, saveJSON } from './storage';

interface ProgressApi {
  progress: Progress;
  record(e: AnswerEvent): void;
  recordDaily(date: string, rec: DailyRecord): void;
  reset(): void;
}

const Ctx = createContext<ProgressApi | null>(null);

const KEY = 'progress';

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(() => sanitizeProgress(loadJSON(KEY, null)));

  useEffect(() => {
    saveJSON(KEY, progress);
  }, [progress]);

  const record = useCallback((e: AnswerEvent) => setProgress((p) => recordAnswer(p, e)), []);
  const daily = useCallback((date: string, rec: DailyRecord) => setProgress((p) => recordDaily(p, date, rec)), []);
  const reset = useCallback(() => setProgress(emptyProgress()), []);

  const api = useMemo(() => ({ progress, record, recordDaily: daily, reset }), [progress, record, daily, reset]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useProgress(): ProgressApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useProgress must be used inside <ProgressProvider>');
  return api;
}
