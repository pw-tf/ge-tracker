import type { Item } from './types';
import { flipScore, type ScoreParts } from './score';
import { afterTax, geTax } from './tax';
import { confidenceOf, offersOf, refPrice, tagsOf, type Confidence, type Tag } from './predict';

export { TAX_CAP, TAX_FLOOR, TAX_RATE, afterTax, breakEvenSell, geTax } from './tax';

export const NATURE_RUNE_ID = 561;
export const BUY_LIMIT_WINDOW_HOURS = 4;

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
  /** Realistic buy offer (see predict.ts). */
  buy: number;
  /** Realistic sell offer. */
  sell: number;
  tax: number;
  /** After-tax margin at the realistic offers. */
  margin: number;
  roi: number;
  qty: number;
  /** Profit if a full (affordable) buy limit is flipped at the realistic offers. */
  ppl: number;
  tier: Tier;
  /** Latest instant-sell trade (the raw "buy" price). */
  lastBuy: number;
  /** Latest instant-buy trade (the raw "sell" price). */
  lastSell: number;
  /** After-tax margin between the two last trades. */
  lastMargin: number;
  /** Minutes since the older of the two latest trades. */
  ageMin: number;
  tags: Tag[];
  confidence: Confidence;
  score: ScoreParts;
}

export interface FlipOptions {
  bankroll: number | null;
  /** Unix seconds. */
  now: number;
}

export function flipOf(item: Item, { bankroll, now }: FlipOptions): Flip | null {
  const offers = offersOf(item);
  if (!offers || item.high == null || item.low == null || offers.buyAt <= 0) return null;
  const buy = offers.buyAt;
  const sell = offers.sellAt;
  const tax = geTax(sell, item.taxExempt);
  const margin = sell - tax - buy;
  const roi = (margin / buy) * 100;
  const qty = affordableQty(item.limit, buy, bankroll);
  const ppl = margin * qty;
  const oldest = Math.min(item.highTime ?? 0, item.lowTime ?? 0);
  const ageMin = Math.max(0, (now - oldest) / 60);
  const tags = tagsOf(item, ageMin);
  const confidence = confidenceOf(item, tags);
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
    lastBuy: item.low,
    lastSell: item.high,
    lastMargin: afterTax(item.high, item.taxExempt) - item.low,
    ageMin,
    tags,
    confidence,
    score: flipScore({ margin, roi, ppl, vol1h: item.vol1h, confidence: confidence.value }),
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

/**
 * Realistic cost to buy one item for alching. Like flip offers, a last trade that dipped
 * below the recent average isn't assumed to still be available.
 *  - instant: pay the ask, never below the recent average ask
 *  - patient: offer at the bid, never below the recent average bid
 */
export function alchBuyPrice(item: Item, basis: PriceBasis): number | null {
  const last = basis === 'instant' ? item.high : item.low;
  if (last == null) return null;
  const ref =
    basis === 'instant'
      ? refPrice(item.avgHigh5m, item.volHigh5m, item.avgHigh1h, last)
      : refPrice(item.avgLow5m, item.volLow5m, item.avgLow1h, last);
  return Math.max(last, Math.round(ref ?? last));
}

/** Profit per cast = high alch value − realistic GE price − one nature rune (fire staff assumed). */
export function alchOf(item: Item, basis: PriceBasis, naturePrice: number, castsPerHour: number): Alch | null {
  if (!item.highalch) return null;
  const price = alchBuyPrice(item, basis);
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
