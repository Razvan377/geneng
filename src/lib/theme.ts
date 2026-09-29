import { useEffect } from 'react';
import { useSetting } from './hooks';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** Colour theme: follows the OS unless the player picks one. Applied as <html data-theme>. */
export function useTheme(): [ThemeChoice, () => void] {
  const [theme, setTheme] = useSetting<ThemeChoice>('theme', 'system');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
  const cycle = () => setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system');
  return [theme, cycle];
}

/**
 * Enzyme colours (teal / coral / amber) and marker shapes. Validated for colour-vision
 * deficiency in both themes; the shape is a second, colour-independent cue.
 */
export const ENZYME_STYLES = [
  { color: 'var(--teal)', shape: 'circle' },
  { color: 'var(--coral)', shape: 'triangle' },
  { color: 'var(--amber)', shape: 'square' },
] as const;

export type MarkerShape = (typeof ENZYME_STYLES)[number]['shape'];
