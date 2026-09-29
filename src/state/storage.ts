/**
 * localStorage access that never throws. Private browsing, blocked cookies or a full quota just
 * mean progress is not remembered — the app keeps working.
 */

const PREFIX = 'digest-lab:';

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = store()?.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    store()?.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
