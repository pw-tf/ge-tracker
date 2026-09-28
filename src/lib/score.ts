export interface ScoreInput {
  margin: number;
  roi: number;
  /** Profit per (affordable) buy limit. */
  ppl: number;
  vol1h: number;
  /** Minutes since the older of the two latest trades. */
  ageMin: number;
}

export interface ScoreParts {
  roi: number;
  profit: number;
  volume: number;
  fresh: number;
  total: number;
}

export const SCORE_WEIGHTS = { roi: 30, profit: 25, volume: 25, fresh: 20 } as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Flip score (0–100). Rewards items that are profitable, liquid and freshly traded,
 * so safe flips rank above thin, stale ones with a big-looking margin.
 *  - ROI:     linear, full marks at 5%
 *  - Profit:  log scale on profit per limit, full marks at 5M
 *  - Volume:  log scale on trades in the last hour, full marks at 20k
 *  - Fresh:   full marks when both trades are ≤5 min old, zero at 60 min
 */
export function flipScore({ margin, roi, ppl, vol1h, ageMin }: ScoreInput): ScoreParts {
  if (margin <= 0) return { roi: 0, profit: 0, volume: 0, fresh: 0, total: 0 };
  const r = clamp01(roi / 5) * SCORE_WEIGHTS.roi;
  const p = clamp01(Math.log10(Math.max(ppl, 1)) / Math.log10(5e6)) * SCORE_WEIGHTS.profit;
  const v = clamp01(Math.log10(vol1h + 1) / Math.log10(20_000)) * SCORE_WEIGHTS.volume;
  const f = ageMin <= 5 ? SCORE_WEIGHTS.fresh : clamp01(1 - (ageMin - 5) / 55) * SCORE_WEIGHTS.fresh;
  return { roi: r, profit: p, volume: v, fresh: f, total: Math.round(r + p + v + f) };
}
