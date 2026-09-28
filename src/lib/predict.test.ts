import { describe, expect, it } from 'vitest';
import { flipOf } from './calc';
import { confidenceOf, marginHistory, offersOf, refPrice, tagsOf, trendPct } from './predict';
import type { Item } from './types';

function item(over: Partial<Item> = {}): Item {
  return {
    id: 1, name: 'Test item', examine: '', members: true, limit: 100, highalch: null, value: 0, icon: 'Test.png', taxExempt: false,
    high: 1_000, highTime: 0, low: 900, lowTime: 0,
    avgHigh5m: null, avgLow5m: null, volHigh5m: 0, volLow5m: 0,
    avgHigh1h: 1_000, avgLow1h: 900, volHigh1h: 300, volLow1h: 300, vol1h: 600,
    avgHigh24h: 1_000, avgLow24h: 900, vol24h: 10_000,
    ...over,
  };
}

describe('refPrice', () => {
  it('prefers the 5m average when that side traded', () => {
    expect(refPrice(105, 3, 100, 90)).toBe(105);
  });
  it('falls back to the 1h average, then the last trade', () => {
    expect(refPrice(105, 0, 100, 90)).toBe(100);
    expect(refPrice(null, 0, null, 90)).toBe(90);
  });
});

describe('offersOf', () => {
  it('clips a sell-side spike down to the recent average', () => {
    const o = offersOf(item({ high: 1_200, avgHigh1h: 1_000 }))!;
    expect(o.sellAt).toBe(1_000);
  });
  it('raises a buy-side dip up to the recent average', () => {
    const o = offersOf(item({ low: 800, avgLow1h: 900 }))!;
    expect(o.buyAt).toBe(900);
  });
  it('follows the last trade when it is the less optimistic side', () => {
    const o = offersOf(item({ high: 950, low: 920, avgHigh1h: 1_000, avgLow1h: 900 }))!;
    expect(o.sellAt).toBe(950);
    expect(o.buyAt).toBe(920);
  });
  it('uses the 5m average over the 1h average', () => {
    const o = offersOf(item({ high: 1_100, avgHigh5m: 1_050, volHigh5m: 2, avgHigh1h: 1_000 }))!;
    expect(o.sellAt).toBe(1_050);
  });
  it('needs both last prices', () => {
    expect(offersOf(item({ high: null }))).toBeNull();
  });
});

describe('flipOf with realistic offers', () => {
  it('shrinks a spiky margin and keeps the raw one', () => {
    const f = flipOf(item({ high: 1_200, avgHigh1h: 1_000 }), { bankroll: null, now: 0 })!;
    expect(f.lastMargin).toBe(1_200 - 24 - 900);
    expect(f.margin).toBe(1_000 - 20 - 900);
    expect(f.tags).toContain('spike');
  });
});

describe('tagsOf', () => {
  it('flags spikes and dips beyond 3%', () => {
    expect(tagsOf(item({ high: 1_031 }), 0)).toContain('spike');
    expect(tagsOf(item({ high: 1_029 }), 0)).not.toContain('spike');
    expect(tagsOf(item({ low: 870 }), 0)).toContain('dip');
  });
  it('flags trends from 5m vs 1h', () => {
    const falling = item({ avgHigh5m: 970, avgLow5m: 870, volHigh5m: 1, volLow5m: 1 });
    expect(trendPct(falling)!).toBeLessThan(-1.5);
    expect(tagsOf(falling, 0)).toContain('falling');
    expect(tagsOf(item({ avgHigh5m: 1_030, avgLow5m: 930 }), 0)).toContain('rising');
  });
  it('flags thin and stale items', () => {
    expect(tagsOf(item({ volLow1h: 4 }), 0)).toContain('thin');
    expect(tagsOf(item(), 31)).toContain('stale');
    expect(tagsOf(item(), 0)).toEqual([]);
  });
});

describe('confidenceOf', () => {
  it('is high for a liquid, steady margin', () => {
    const c = confidenceOf(item(), []);
    expect(c.level).toBe('high');
  });
  it('is low when the margin was never profitable and trading is thin', () => {
    const c = confidenceOf(item({ volHigh1h: 1, volLow1h: 0, avgHigh1h: 905, avgHigh24h: 905 }), ['thin']);
    expect(c.level).toBe('low');
  });
  it('applies penalties for spikes, stale trades and falling prices', () => {
    const base = confidenceOf(item(), []).value;
    expect(confidenceOf(item(), ['spike']).value).toBeCloseTo(base * 0.7);
    expect(confidenceOf(item(), ['stale', 'falling']).value).toBeCloseTo(base * 0.7 * 0.8);
  });
});

describe('marginHistory', () => {
  const pt = (t: number, hi: number | null, lo: number | null) => ({ timestamp: t, avgHighPrice: hi, avgLowPrice: lo, highPriceVolume: 1, lowPriceVolume: 1 });
  it('counts profitable hours after tax and skips hours without both sides', () => {
    const h = marginHistory([pt(1, 1_000, 900), pt(2, 1_000, 990), pt(3, null, 900), pt(4, 1_100, 900)]);
    expect(h.counted).toBe(3);
    expect(h.positive).toBe(2);
    expect(h.median).toBe(80);
    expect(h.hours[2].margin).toBeNull();
  });
  it('keeps only the last n points', () => {
    const pts = Array.from({ length: 30 }, (_, i) => pt(i, 1_000, 900));
    expect(marginHistory(pts).hours).toHaveLength(24);
  });
});
