const MINUS = '−';

/** 1234567 → "1,234,567" */
export function fmtFull(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Compact GP: 950 · 12.3k · 450k · 1.25M · 12.5M · 1.45B */
export function fmtShort(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? MINUS : '';
  if (a >= 1e9) return s + (a / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
  if (a >= 1e4) return s + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k';
  return s + Math.round(a).toLocaleString('en-US');
}

/** Prefix a "+" on positive values so profit columns read at a glance. */
export function signed(n: number, fmt: (n: number) => string = fmtShort): string {
  return (n > 0 ? '+' : '') + fmt(n);
}

export function fmtPct(n: number, digits = 2): string {
  return (n < 0 ? MINUS : '') + Math.abs(n).toFixed(digits) + '%';
}

/**
 * Parse a GP amount typed by a player: "1,250", "12.5k", "3m", "1.2b".
 * Returns null for empty or unparseable input.
 */
export function parseGp(input: string | null | undefined): number | null {
  const m = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[,_\s]/g, '')
    .match(/^(\d*\.?\d+)([kmb])?$/);
  if (!m) return null;
  const mult = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : m[2] === 'b' ? 1e9 : 1;
  return parseFloat(m[1]) * mult;
}

/** Seconds → "now", "45s", "12m", "3h", "2d" */
export function fmtAge(seconds: number): string {
  if (!isFinite(seconds)) return '—';
  if (seconds < 5) return 'now';
  if (seconds < 60) return Math.floor(seconds) + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
  return Math.floor(seconds / 86400) + 'd';
}

/** Two-letter monogram used when an item icon fails to load. */
export function monogram(name: string): string {
  const words = name.replace(/'/g, '').replace(/[^A-Za-z ]/g, ' ').split(' ').filter(Boolean);
  if (words.length === 0) return '?';
  const second = words[1]?.[0] ?? words[0][1] ?? '';
  return (words[0][0] + second).toUpperCase();
}
