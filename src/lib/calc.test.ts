import { describe, expect, it } from 'vitest';
import {
  affordableQty,
  alchOf,
  bestDecant,
  breakEvenSell,
  flipOf,
  geTax,
  parseDose,
  priceChange,
  setArbitrage,
  tierOf,
  volumeSpike,
  type Dose,
} from './calc';
import { flipScore } from './score';
import { fmtShort, parseGp, monogram } from './format';
import type { Item } from './types';

function item(over: Partial<Item> = {}): Item {
  return {
    id: 1, name: 'Test item', examine: '', members: true, limit: 70, highalch: null, value: 0, icon: 'Test.png', taxExempt: false,
    high: null, highTime: null, low: null, lowTime: null,
    avgHigh5m: null, avgLow5m: null, volHigh5m: 0, volLow5m: 0,
    avgHigh1h: null, avgLow1h: null, volHigh1h: 0, volLow1h: 0, vol1h: 0,
    avgHigh24h: null, avgLow24h: null, vol24h: 0,
    ...over,
  };
}

describe('geTax', () => {
  it('charges 2% rounded down', () => {
    expect(geTax(1_428_000)).toBe(28_560);
    expect(geTax(9_166)).toBe(183);
  });
  it('exempts items under 50gp', () => {
    expect(geTax(49)).toBe(0);
    expect(geTax(50)).toBe(1);
  });
  it('caps at 5M per item', () => {
    expect(geTax(250_000_000)).toBe(5_000_000);
    expect(geTax(1_462_000_000)).toBe(5_000_000);
  });
  it('skips exempt items', () => {
    expect(geTax(10_000_000, true)).toBe(0);
  });
});

describe('breakEvenSell', () => {
  it('finds the lowest sell price that recovers the buy after tax', () => {
    const be = breakEvenSell(1_392_000);
    expect(be - geTax(be)).toBeGreaterThanOrEqual(1_392_000);
    expect(be - 1 - geTax(be - 1)).toBeLessThan(1_392_000);
  });
  it('adds exactly the cap for items taxed at the cap', () => {
    expect(breakEvenSell(1_000_000_000)).toBe(1_005_000_000);
  });
});

describe('tierOf', () => {
  it('splits at 100k and 10M', () => {
    expect(tierOf(99_999)).toBe('low');
    expect(tierOf(100_000)).toBe('med');
    expect(tierOf(10_000_000)).toBe('med');
    expect(tierOf(10_000_001)).toBe('high');
  });
});

describe('affordableQty', () => {
  it('uses the full limit without a bankroll', () => {
    expect(affordableQty(70, 1_392_000, null)).toBe(70);
  });
  it('caps by bankroll', () => {
    expect(affordableQty(8, 12_420_000, 50_000_000)).toBe(4);
    expect(affordableQty(8, 1_448_000_000, 50_000_000)).toBe(0);
  });
  it('treats an unknown limit as zero', () => {
    expect(affordableQty(null, 100, null)).toBe(0);
  });
});

describe('flipOf', () => {
  const now = 1_000_000;
  const whip = item({ name: 'Abyssal whip', high: 1_428_000, low: 1_392_000, highTime: now - 120, lowTime: now - 360, vol1h: 64 });

  it('computes margin, ROI and profit per limit after tax', () => {
    const f = flipOf(whip, { bankroll: null, now })!;
    expect(f.margin).toBe(7_440);
    expect(f.roi).toBeCloseTo(0.5345, 3);
    expect(f.ppl).toBe(520_800);
    expect(f.tier).toBe('med');
    expect(f.ageMin).toBe(6);
  });
  it('returns null without both prices', () => {
    expect(flipOf(item({ high: 5 }), { bankroll: null, now })).toBeNull();
  });
});

describe('flipScore', () => {
  it('is zero for unprofitable flips', () => {
    expect(flipScore({ margin: -1, roi: 5, ppl: 1e6, vol1h: 1e4, confidence: 1 }).total).toBe(0);
  });
  it('matches the design example for the whip', () => {
    expect(flipScore({ margin: 7_440, roi: 0.5345, ppl: 520_800, vol1h: 64, confidence: 1 }).total).toBe(55);
  });
  it('maxes at 100', () => {
    expect(flipScore({ margin: 1, roi: 50, ppl: 1e9, vol1h: 1e6, confidence: 1 }).total).toBe(100);
  });
  it('rewards fill confidence', () => {
    const sure = flipScore({ margin: 1, roi: 1, ppl: 1e5, vol1h: 100, confidence: 1 });
    const unsure = flipScore({ margin: 1, roi: 1, ppl: 1e5, vol1h: 100, confidence: 0 });
    expect(sure.confidence).toBe(20);
    expect(unsure.confidence).toBe(0);
    expect(sure.total - unsure.total).toBe(20);
  });
});

describe('alchOf', () => {
  const bow = item({ name: 'Yew longbow', highalch: 768, high: 440, low: 425, limit: 18_000 });
  it('subtracts the nature rune', () => {
    expect(alchOf(bow, 'instant', 94, 1200)!.profit).toBe(234);
    expect(alchOf(bow, 'patient', 94, 1200)!.profit).toBe(249);
  });
  it('limits GP/hr by casts per hour or buy limit ÷ 4', () => {
    expect(alchOf(bow, 'instant', 94, 1200)!.gph).toBe(234 * 1200);
    const axe = item({ highalch: 120_000, high: 118_600, limit: 70 });
    expect(alchOf(axe, 'instant', 94, 1200)!.gph).toBeCloseTo(1_306 * 17.5);
  });
  it('does not assume a dipped last price is still available', () => {
    const dipped = item({ highalch: 768, high: 400, low: 390, avgHigh1h: 440, avgLow1h: 425, limit: 18_000 });
    expect(alchOf(dipped, 'instant', 94, 1200)!.price).toBe(440);
    expect(alchOf(dipped, 'patient', 94, 1200)!.price).toBe(425);
    const rising = item({ highalch: 768, high: 460, low: 450, avgHigh1h: 440, avgLow1h: 425 });
    expect(alchOf(rising, 'instant', 94, 1200)!.price).toBe(460);
  });
});

describe('setArbitrage', () => {
  it('prefers combining when the set sells above its pieces', () => {
    const r = setArbitrage({ low: 26_100_000, high: 26_450_000 }, [
      { low: 8_120_000, high: 8_240_000 },
      { low: 8_960_000, high: 9_080_000 },
      { low: 8_340_000, high: 8_460_000 },
    ]);
    expect(r.best).toBe('combine');
    expect(r.profit).toBe(26_450_000 - 529_000 - 25_420_000);
  });
  it('taxes every piece when splitting', () => {
    const r = setArbitrage({ low: 1_000, high: 1_000 }, [
      { low: 600, high: 700 },
      { low: 600, high: 700 },
    ]);
    expect(r.best).toBe('split');
    expect(r.split).toBe(2 * (700 - 14) - 1_000);
  });
});

describe('decanting', () => {
  it('parses dose names', () => {
    expect(parseDose('Prayer potion(4)')).toEqual({ base: 'Prayer potion', dose: 4 });
    expect(parseDose('Divine super combat potion(1)')).toEqual({ base: 'Divine super combat potion', dose: 1 });
    expect(parseDose('Abyssal whip')).toBeNull();
  });
  it('picks the best buy/sell pair with different doses', () => {
    const mk = (dose: number, low: number, high: number): Dose => ({ dose, low, high, item: item({ limit: 2000 }) });
    const d = bestDecant([mk(4, 8_870, 9_166), mk(3, 6_420, 6_610), mk(2, 4_390, 4_560), mk(1, 2_150, 2_230)])!;
    expect(d.buy.dose).toBe(3);
    expect(d.sell.dose).toBe(4);
    expect(d.perDose).toBeCloseTo((9_166 - 183) / 4 - 6_420 / 3);
    expect(d.perLimit).toBeCloseTo(d.perDose * 3 * 2000);
  });
});

describe('movers', () => {
  it('compares the latest mid price with the window average', () => {
    const it1 = item({ high: 110, low: 90, avgHigh24h: 55, avgLow24h: 45 });
    expect(priceChange(it1, '24h')).toBeCloseTo(100);
    expect(priceChange(item(), '1h')).toBeNull();
  });
  it('measures volume against the hourly average', () => {
    expect(volumeSpike(item({ vol1h: 300, vol24h: 2400 }))).toBe(3);
    expect(volumeSpike(item())).toBeNull();
  });
});

describe('format', () => {
  it('parses k/m/b suffixes and commas', () => {
    expect(parseGp('50M')).toBe(50_000_000);
    expect(parseGp('12.5k')).toBe(12_500);
    expect(parseGp('1,392,000')).toBe(1_392_000);
    expect(parseGp('')).toBeNull();
    expect(parseGp('abc')).toBeNull();
  });
  it('formats compactly', () => {
    expect(fmtShort(950)).toBe('950');
    expect(fmtShort(12_345)).toBe('12.3k');
    expect(fmtShort(520_800)).toBe('521k');
    expect(fmtShort(1_250_000)).toBe('1.25M');
    expect(fmtShort(-12_500_000)).toBe('−12.5M');
    expect(fmtShort(1_462_000_000)).toBe('1.46B');
  });
  it('builds monograms', () => {
    expect(monogram('Abyssal whip')).toBe('AW');
    expect(monogram("Zulrah's scales")).toBe('ZS');
    expect(monogram('Shark')).toBe('SH');
  });
});
