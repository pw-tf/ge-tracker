import type { Item } from './types';
import { flipScore, type ScoreParts } from './score';

export const TAX_RATE = 0.02;
export const TAX_CAP = 5_000_000;
/** Items sold for less than this pay no tax (2% of 49 floors to 0). */
export const TAX_FLOOR = 50;
export const NATURE_RUNE_ID = 561;
export const BUY_LIMIT_WINDOW_HOURS = 4;

/** GE tax on a single item sold at `price`: 2%, rounded down, capped at 5M per item. */
export function geTax(price: number, exempt = false): number {
  if (exempt || price < TAX_FLOOR) return 0;
  return Math.min(Math.floor(price * TAX_RATE), TAX_CAP);
}

/** What you actually receive for one item after tax. */
export function afterTax(price: number, exempt = false): number {
  return price - geTax(price, exempt);
}

/** Lowest sell price that at least breaks even on an item bought at `buy`. */
export function breakEvenSell(buy: number, exempt = false): number {
  if (exempt || buy < TAX_FLOOR) return buy;
  // Start just under the estimate (tax is floored) and step up to the first price that covers the buy.
  let p = Math.max(buy, Math.floor(buy / (1 - TAX_RATE)) - 2);
  if (geTax(p) >= TAX_CAP) return buy + TAX_CAP;
  while (afterTax(p) < buy) p++;
  return p;
}

export type Tier = 'low' | 'med' | 'high';
export const TIER_LABEL: Record<Tier, string> = { low: 'Low', med: 'Medium', high: 'High' };

/** Low < 100k · Medium 100k–10M · High > 10M, by buy price. */
export function tierOf(price: number): Tier {
  if (price < 100_000) return 'low';
  if (price <= 10_000_000) return 'med';
  return 'high';
}

/** How many to buy this limit window: the buy limit, capped by what the bankroll affords. */
export function affordableQty(limit: number | null, buy: number, bankroll: number | null): number {
  const lim = limit ?? 0;
  if (bankroll == null || bankroll <= 0 || buy <= 0) return lim;
  return Math.min(lim, Math.floor(bankroll / buy));
}

export interface Flip {
  item: Item;
  /** Buy at the instant-sell (low) price. */
  buy: number;
  /** Sell at the instant-buy (high) price. */
  sell: number;
  tax: number;
  margin: number;
  roi: number;
  qty: number;
  /** Profit if a full (affordable) buy limit is flipped. */
  ppl: number;
  tier: Tier;
  /** Minutes since the older of the two latest trades. */
  ageMin: number;
  score: ScoreParts;
}

export interface FlipOptions {
  bankroll: number | null;
  /** Unix seconds. */
  now: number;
}

export function flipOf(item: Item, { bankroll, now }: FlipOptions): Flip | null {
  if (item.high == null || item.low == null || item.low <= 0) return null;
  const buy = item.low;
  const sell = item.high;
  const tax = geTax(sell, item.taxExempt);
  const margin = sell - tax - buy;
  const roi = (margin / buy) * 100;
  const qty = affordableQty(item.limit, buy, bankroll);
  const ppl = margin * qty;
  const oldest = Math.min(item.highTime ?? 0, item.lowTime ?? 0);
  const ageMin = Math.max(0, (now - oldest) / 60);
  return {
    item,
    buy,
    sell,
    tax,
    margin,
    roi,
    qty,
    ppl,
    tier: tierOf(buy),
    ageMin,
    score: flipScore({ margin, roi, ppl, vol1h: item.vol1h, ageMin }),
  };
}

// ---------- High alchemy ----------

export interface Alch {
  item: Item;
  price: number;
  profit: number;
  ppl: number;
  gph: number;
}

export type PriceBasis = 'instant' | 'patient';

/** Profit per cast = high alch value − GE price − one nature rune (fire staff assumed). */
export function alchOf(item: Item, basis: PriceBasis, naturePrice: number, castsPerHour: number): Alch | null {
  if (!item.highalch) return null;
  const price = basis === 'instant' ? item.high : item.low;
  if (price == null) return null;
  const profit = item.highalch - price - naturePrice;
  const limit = item.limit ?? Infinity;
  return {
    item,
    price,
    profit,
    ppl: isFinite(limit) ? profit * limit : profit,
    gph: profit * Math.min(castsPerHour, limit / BUY_LIMIT_WINDOW_HOURS),
  };
}

// ---------- Sets ----------

export interface PricePair {
  low: number;
  high: number;
  exempt?: boolean;
}

export interface SetArb {
  combine: number;
  split: number;
  best: 'combine' | 'split';
  profit: number;
}

/**
 * Combine: buy the pieces, exchange for the set, sell the set.
 * Split: buy the set, exchange for the pieces, sell each piece (taxed per piece).
 */
export function setArbitrage(set: PricePair, pieces: PricePair[]): SetArb {
  const piecesLow = pieces.reduce((s, p) => s + p.low, 0);
  const piecesNet = pieces.reduce((s, p) => s + afterTax(p.high, p.exempt), 0);
  const combine = afterTax(set.high, set.exempt) - piecesLow;
  const split = piecesNet - set.low;
  return combine >= split
    ? { combine, split, best: 'combine', profit: combine }
    : { combine, split, best: 'split', profit: split };
}

// ---------- Decanting ----------

export interface Dose {
  dose: number;
  item: Item;
  low: number;
  high: number;
}

export interface Decant {
  buy: Dose;
  sell: Dose;
  /** Profit per dose, after tax. */
  perDose: number;
  /** Profit if a full buy limit of the cheapest dose size is decanted and sold. */
  perLimit: number;
}

export function buyPerDose(d: Dose): number {
  return d.low / d.dose;
}

export function sellPerDose(d: Dose): number {
  return afterTax(d.high, d.item.taxExempt) / d.dose;
}

/** Best buy-size → sell-size pair with different dose counts. */
export function bestDecant(doses: Dose[]): Decant | null {
  let best: Decant | null = null;
  for (const b of doses) {
    for (const s of doses) {
      if (b.dose === s.dose) continue;
      const perDose = sellPerDose(s) - buyPerDose(b);
      if (!best || perDose > best.perDose) {
        best = { buy: b, sell: s, perDose, perLimit: perDose * b.dose * (b.item.limit ?? 0) };
      }
    }
  }
  return best;
}

/** "Prayer potion(4)" → { base: "Prayer potion", dose: 4 } */
export function parseDose(name: string): { base: string; dose: number } | null {
  const m = name.match(/^(.+?)\s?\(([1-4])\)$/);
  if (!m) return null;
  return { base: m[1], dose: Number(m[2]) };
}

// ---------- Movers ----------

export function mid(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return (a + b) / 2;
}

export type MoverWindow = '1h' | '24h';

/** % change of the latest mid price against the window's average mid price. */
export function priceChange(item: Item, window: MoverWindow): number | null {
  const now = mid(item.high, item.low);
  const avg = window === '1h' ? mid(item.avgHigh1h, item.avgLow1h) : mid(item.avgHigh24h, item.avgLow24h);
  if (now == null || avg == null || avg <= 0) return null;
  return (now / avg - 1) * 100;
}

/** Trades in the last hour ÷ the average hourly trades over 24h. */
export function volumeSpike(item: Item): number | null {
  if (item.vol24h <= 0) return null;
  return item.vol1h / (item.vol24h / 24);
}
