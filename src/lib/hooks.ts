import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { loadJSON, saveJSON } from '../state/storage';

/** Width of an element, kept up to date with a ResizeObserver. */
export function useElementWidth<T extends HTMLElement>(fallback = 360): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width];
}

/** A user preference persisted in localStorage (falls back to in-memory state). */
export function useSetting<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => loadJSON(`setting:${key}`, initial));
  const set = useCallback(
    (v: T) => {
      setValue(v);
      saveJSON(`setting:${key}`, v);
    },
    [key],
  );
  return [value, set];
}

/** Seconds elapsed since `start` (ms), ticking once per second while `running`. */
export function useClock(start: number, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running, start]);
  return Math.max(0, Math.floor((now - start) / 1000));
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
