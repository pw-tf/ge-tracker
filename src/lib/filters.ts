import type { Flip, Tier } from './calc';
import { parseGp } from './format';

export type MemberFilter = 'all' | 'mem' | 'f2p';
export type TierFilter = 'all' | Tier;
export type FlipSortKey = 'name' | 'buy' | 'sell' | 'margin' | 'roi' | 'limit' | 'ppl' | 'vol' | 'age' | 'score';

/** Numeric filter fields, kept as the raw text the player typed. */
export const NUMERIC_FILTERS = ['minMargin', 'minRoi', 'minVol', 'maxAge', 'priceMin', 'priceMax', 'minLimit', 'maxCost'] as const;
export type NumericFilter = (typeof NUMERIC_FILTERS)[number];

export type FlipFilters = Record<NumericFilter, string> & {
  tier: TierFilter;
  member: MemberFilter;
  q: string;
  sort: FlipSortKey;
  dir: 'asc' | 'desc';
};

export const DEFAULT_FILTERS: FlipFilters = {
  tier: 'all',
  member: 'all',
  q: '',
  sort: 'score',
  dir: 'desc',
  minMargin: '',
  minRoi: '0.5',
  minVol: '5',
  maxAge: '60',
  priceMin: '',
  priceMax: '',
  minLimit: '',
  maxCost: '',
};

const blank = Object.fromEntries(NUMERIC_FILTERS.map((k) => [k, ''])) as Record<NumericFilter, string>;

export const PRESETS: { label: string; values: Record<NumericFilter, string> }[] = [
  { label: 'Safe & liquid', values: { ...blank, minRoi: '1', minVol: '500', maxAge: '10' } },
  { label: 'Big margins', values: { ...blank, minMargin: '50k', minVol: '5', maxAge: '60' } },
  { label: 'Cheap bulk', values: { ...blank, minRoi: '1.5', minVol: '1000', priceMax: '20k', minLimit: '2000' } },
];

export const FILTER_FIELDS: { title: string; fields: { key: NumericFilter; label: string; placeholder: string }[] }[] = [
  {
    title: 'Profit',
    fields: [
      { key: 'minMargin', label: 'Min margin (gp)', placeholder: 'any' },
      { key: 'minRoi', label: 'Min ROI (%)', placeholder: 'any' },
    ],
  },
  {
    title: 'Liquidity',
    fields: [
      { key: 'minVol', label: 'Min 1h volume', placeholder: 'any' },
      { key: 'maxAge', label: 'Max trade age (min)', placeholder: 'any' },
    ],
  },
  {
    title: 'Price & buy limit',
    fields: [
      { key: 'priceMin', label: 'Price from', placeholder: '0' },
      { key: 'priceMax', label: 'Price to', placeholder: 'any' },
      { key: 'minLimit', label: 'Min buy limit', placeholder: 'any' },
      { key: 'maxCost', label: 'Max cost of limit', placeholder: 'any' },
    ],
  },
];

export function activeFilterCount(f: FlipFilters): number {
  return NUMERIC_FILTERS.filter((k) => f[k].trim() !== '').length + (f.member !== 'all' ? 1 : 0);
}

/** Every filter except the price tier, so tier chips can show their counts. */
export function filterFlips(flips: Flip[], f: FlipFilters): Flip[] {
  const minMargin = parseGp(f.minMargin);
  const minRoi = parseFloat(f.minRoi);
  const minVol = parseGp(f.minVol);
  const maxAge = parseFloat(f.maxAge);
  const pMin = parseGp(f.priceMin);
  const pMax = parseGp(f.priceMax);
  const minLimit = parseGp(f.minLimit);
  const maxCost = parseGp(f.maxCost);
  const q = f.q.trim().toLowerCase();
  return flips.filter((x) => {
    if (f.member === 'mem' && !x.item.members) return false;
    if (f.member === 'f2p' && x.item.members) return false;
    if (q && !x.item.name.toLowerCase().includes(q)) return false;
    if (minMargin != null && x.margin < minMargin) return false;
    if (!isNaN(minRoi) && x.roi < minRoi) return false;
    if (minVol != null && x.item.vol1h < minVol) return false;
    if (!isNaN(maxAge) && x.ageMin > maxAge) return false;
    if (pMin != null && x.buy < pMin) return false;
    if (pMax != null && x.buy > pMax) return false;
    if (minLimit != null && (x.item.limit ?? 0) < minLimit) return false;
    if (maxCost != null && x.buy * (x.item.limit ?? 0) > maxCost) return false;
    return true;
  });
}

const SORT_VALUE: Record<FlipSortKey, (x: Flip) => number | string> = {
  name: (x) => x.item.name,
  buy: (x) => x.buy,
  sell: (x) => x.sell,
  margin: (x) => x.margin,
  roi: (x) => x.roi,
  limit: (x) => x.item.limit ?? -1,
  ppl: (x) => x.ppl,
  vol: (x) => x.item.vol1h,
  age: (x) => x.ageMin,
  score: (x) => x.score.total,
};

export function sortFlips(flips: Flip[], key: FlipSortKey, dir: 'asc' | 'desc'): Flip[] {
  const get = SORT_VALUE[key];
  const m = dir === 'asc' ? 1 : -1;
  return [...flips].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    const c = typeof va === 'string' ? va.localeCompare(vb as string) : va - (vb as number);
    return c * m || a.item.name.localeCompare(b.item.name);
  });
}
