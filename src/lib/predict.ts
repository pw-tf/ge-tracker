/**
 * Turns noisy "last trade" prices into prices a player can realistically fill at,
 * plus warnings and a fill-confidence rating.
 *
 * `/latest` is a single trade per side. One panic-sell or one impatient buyer makes the
 * margin look better than it is, so offers are anchored to recent averages instead.
 */
import type { TimeseriesPoint } from '../api/wiki';
import { afterTax } from './tax';
import type { Item } from './types';

/** Last trade this far past its 1h average (%) counts as a spike or dip. */
export const SPIKE_PCT = 3;
/** 5m vs 1h mid-price move (%) that counts as a trend. */
export const TREND_PCT = 1.5;
/** Fewer trades than this in the last hour, on either side, is thin. */
export const THIN_TRADES = 5;
/** Last trades older than this (minutes) are stale. */
export const STALE_MIN = 30;
/** Trades per hour on the thinner side that earns full liquidity marks. */
const LIQUID_TRADES = 200;

export type Tag = 'spike' | 'dip' | 'falling' | 'rising' | 'thin' | 'stale';

export const TAG_INFO: Record<Tag, { label: string; tip: string; tone: 'up' | 'down' | 'gold' | 'neutral' }> = {
  spike: { label: 'Spike', tip: `Last sell-side trade is over ${SPIKE_PCT}% above the 1h average. It probably won't repeat.`, tone: 'down' },
  dip: { label: 'Dip', tip: `Last buy-side trade is over ${SPIKE_PCT}% below the 1h average. You likely can't buy that low again.`, tone: 'down' },
  falling: { label: 'Falling', tip: `Price is more than ${TREND_PCT}% below its recent average. Selling may take a lower price.`, tone: 'down' },
  rising: { label: 'Rising', tip: `Price is more than ${TREND_PCT}% above its recent average. Buy offers may need to go higher.`, tone: 'up' },
  thin: { label: 'Thin', tip: `Fewer than ${THIN_TRADES} trades in the last hour on one side. Offers may sit unfilled.`, tone: 'gold' },
  stale: { label: 'Stale', tip: `No trade on one side for over ${STALE_MIN} minutes. Prices may have moved.`, tone: 'neutral' },
};

/** Most recent reliable price for one side: 5m average if it traded, else 1h average, else the last trade. */
export function refPrice(avg5m: number | null, vol5m: number, avg1h: number | null, last: number | null): number | null {
  if (avg5m != null && vol5m > 0) return avg5m;
  if (avg1h != null) return avg1h;
  return last;
}

export interface Offers {
  /** What to offer when buying (balanced). */
  buyAt: number;
  /** What to offer when selling (balanced). */
  sellAt: number;
  refLow: number;
  refHigh: number;
}

/**
 * Balanced offers: never assume a dip below the recent average will still be there,
 * and never assume a spike above it will repeat.
 */
export function offersOf(item: Item): Offers | null {
  if (item.high == null || item.low == null) return null;
  const refLow = refPrice(item.avgLow5m, item.volLow5m, item.avgLow1h, item.low) ?? item.low;
  const refHigh = refPrice(item.avgHigh5m, item.volHigh5m, item.avgHigh1h, item.high) ?? item.high;
  return {
    buyAt: Math.max(item.low, Math.round(refLow)),
    sellAt: Math.min(item.high, Math.round(refHigh)),
    refLow,
    refHigh,
  };
}

function midOf(high: number | null, low: number | null): number | null {
  return high != null && low != null ? (high + low) / 2 : null;
}

/** % move of the short-window mid price against the longer window (5m vs 1h, else 1h vs 24h). */
export function trendPct(item: Item): number | null {
  const m5 = midOf(item.avgHigh5m, item.avgLow5m);
  const m1 = midOf(item.avgHigh1h, item.avgLow1h);
  const m24 = midOf(item.avgHigh24h, item.avgLow24h);
  if (m5 != null && m1 != null && m1 > 0) return (m5 / m1 - 1) * 100;
  if (m1 != null && m24 != null && m24 > 0) return (m1 / m24 - 1) * 100;
  return null;
}

export function tagsOf(item: Item, ageMin: number): Tag[] {
  const tags: Tag[] = [];
  if (item.high != null && item.avgHigh1h != null && item.high > item.avgHigh1h * (1 + SPIKE_PCT / 100)) tags.push('spike');
  if (item.low != null && item.avgLow1h != null && item.low < item.avgLow1h * (1 - SPIKE_PCT / 100)) tags.push('dip');
  const t = trendPct(item);
  if (t != null && t < -TREND_PCT) tags.push('falling');
  if (t != null && t > TREND_PCT) tags.push('rising');
  if (Math.min(item.volHigh1h, item.volLow1h) < THIN_TRADES) tags.push('thin');
  if (ageMin > STALE_MIN) tags.push('stale');
  return tags;
}

export type ConfLevel = 'high' | 'med' | 'low';
export const CONF_LABEL: Record<ConfLevel, string> = { high: 'High', med: 'Medium', low: 'Low' };

export interface Confidence {
  /** 0–1 */
  value: number;
  level: ConfLevel;
  reasons: string[];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * How likely a flip is to fill at the suggested offers.
 * Half liquidity (trades per hour on the thinner side), half margin stability
 * (share of the 5m/1h/24h windows whose average spread was profitable after tax),
 * then penalties for spikes/dips, stale trades and a falling price.
 */
export function confidenceOf(item: Item, tags: Tag[]): Confidence {
  const reasons: string[] = [];
  const thinSide = Math.min(item.volHigh1h, item.volLow1h);
  const liquidity = clamp01(Math.log10(thinSide + 1) / Math.log10(LIQUID_TRADES + 1));
  reasons.push(`${thinSide.toLocaleString('en-US')} trades/h on the quieter side`);

  const windows = (
    [
      [item.avgHigh5m, item.avgLow5m],
      [item.avgHigh1h, item.avgLow1h],
      [item.avgHigh24h, item.avgLow24h],
    ] as const
  ).filter((w): w is readonly [number, number] => w[0] != null && w[1] != null);
  const good = windows.filter(([h, l]) => afterTax(h, item.taxExempt) - l > 0).length;
  const stability = windows.length ? good / windows.length : 0;
  reasons.push(windows.length ? `Margin profitable in ${good} of ${windows.length} recent averages` : 'No recent averages');

  let value = 0.5 * liquidity + 0.5 * stability;
  if (tags.includes('spike') || tags.includes('dip')) {
    value *= 0.7;
    reasons.push('Last trade is an outlier');
  }
  if (tags.includes('stale')) {
    value *= 0.7;
    reasons.push('Last trades are old');
  }
  if (tags.includes('falling')) {
    value *= 0.8;
    reasons.push('Price is falling');
  }
  const level: ConfLevel = value >= 0.7 ? 'high' : value >= 0.4 ? 'med' : 'low';
  return { value, level, reasons };
}

export interface HourMargin {
  timestamp: number;
  /** After-tax margin between that hour's average high and low; null if a side didn't trade. */
  margin: number | null;
}

export interface MarginHistory {
  hours: HourMargin[];
  positive: number;
  /** Hours with trades on both sides. */
  counted: number;
  median: number | null;
}

/** How often the spread was actually profitable, hour by hour (last 24 hourly points). */
export function marginHistory(points: TimeseriesPoint[], exempt = false, n = 24): MarginHistory {
  const hours = points.slice(-n).map((p) => ({
    timestamp: p.timestamp,
    margin: p.avgHighPrice != null && p.avgLowPrice != null ? afterTax(p.avgHighPrice, exempt) - p.avgLowPrice : null,
  }));
  const vals = hours.map((h) => h.margin).filter((m): m is number => m != null).sort((a, b) => a - b);
  const median = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null;
  return { hours, positive: vals.filter((m) => m > 0).length, counted: vals.length, median };
}
