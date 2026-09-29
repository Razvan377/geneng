/**
 * Minimal hash router. Hash URLs keep the static build working from any folder, and every
 * puzzle/question lives in the URL (e.g. #/map?d=hard&seed=k3j9x2), so a link replays it.
 */

import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function snapshot(): string {
  return window.location.hash;
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = h.split('?');
  return { path: path || '/', params: new URLSearchParams(query) };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '');
  return parseHash(hash);
}

export type Params = Record<string, string | number | undefined | null>;

export function href(path: string, params: Params = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const qs = q.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

/** Go to a route. `replace` swaps the current history entry (used for "next question"). */
export function navigate(path: string, params: Params = {}, options: { replace?: boolean } = {}): void {
  const target = href(path, params);
  if (options.replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

/** Absolute URL of a route, for sharing. */
export function shareUrl(path: string, params: Params = {}): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${href(path, params)}`;
}
