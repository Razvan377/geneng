/** Number formatting shared by the science layer and the UI. */

/** Round away float noise, then drop trailing zeros: 1500 → "1.5", 23130 → "23.13". */
export function formatKb(bp: number, maxDecimals = 2): string {
  const kb = bp / 1000;
  return trimNumber(kb, maxDecimals);
}

export function trimNumber(value: number, maxDecimals = 2): string {
  const fixed = value.toFixed(maxDecimals);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

/** "3 + 6.5" — fragment list as written in lecture problems (ascending, kb). */
export function formatFragments(fragmentsBp: readonly number[]): string {
  return [...fragmentsBp].sort((a, b) => a - b).map((f) => formatKb(f)).join(' + ');
}

/** Distinct band sizes, comma separated (used for partial-digest lanes). */
export function formatBands(fragmentsBp: readonly number[]): string {
  return [...new Set(fragmentsBp)].sort((a, b) => a - b).map((f) => formatKb(f)).join(', ');
}

/** Position with one decimal, as on a map ruler: 8000 → "8.0". */
export function formatPosKb(bp: number): string {
  return (bp / 1000).toFixed(bp % 100 === 0 ? 1 : 2);
}

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

export function superscript(n: number | string): string {
  return String(n)
    .split('')
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join('');
}

/** Scientific notation with Unicode exponent: 460515 → "4.61 × 10⁵". Small numbers stay plain. */
export function formatSci(value: number, significant = 3): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 0.01 && abs < 1e5) {
    return trimNumber(Number(value.toPrecision(significant)), 6);
  }
  const exp = Math.floor(Math.log10(abs));
  let mantissa = value / 10 ** exp;
  // toPrecision can round 9.996 up to 10.0
  if (Math.abs(Number(mantissa.toPrecision(significant))) >= 10) {
    mantissa /= 10;
    return `${trimNumber(Number(mantissa.toPrecision(significant)), 6)} × 10${superscript(exp + 1)}`;
  }
  return `${trimNumber(Number(mantissa.toPrecision(significant)), 6)} × 10${superscript(exp)}`;
}

/** Thousands separated by thin spaces, the way Brown prints large numbers: 65536 → "65 536". */
export function formatInt(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatPercent(fraction: number, decimals = 0): string {
  return `${trimNumber(fraction * 100, decimals)}%`;
}
