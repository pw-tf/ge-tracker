export interface ScoreInput {
  /** After-tax margin at the realistic offers. */
  margin: number;
  roi: number;
  /** Profit per (affordable) buy limit. */
  ppl: number;
  vol1h: number;
  /** Fill confidence, 0–1 (see predict.ts). */
  confidence: number;
}

export interface ScoreParts {
  roi: number;
  profit: number;
  volume: number;
  confidence: number;
  total: number;
}

export const SCORE_WEIGHTS = { roi: 30, profit: 25, volume: 25, confidence: 20 } as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Flip score (0–100), computed on realistic offer prices. Rewards flips that are
 * profitable, liquid and likely to fill, so safe flips rank above spiky or thin ones.
 *  - ROI:        linear, full marks at 5%
 *  - Profit:     log scale on profit per limit, full marks at 5M
 *  - Volume:     log scale on trades in the last hour, full marks at 20k
 *  - Confidence: fill confidence (liquidity, margin stability, spike/stale/trend penalties)
 */
export function flipScore({ margin, roi, ppl, vol1h, confidence }: ScoreInput): ScoreParts {
  if (margin <= 0) return { roi: 0, profit: 0, volume: 0, confidence: 0, total: 0 };
  const r = clamp01(roi / 5) * SCORE_WEIGHTS.roi;
  const p = clamp01(Math.log10(Math.max(ppl, 1)) / Math.log10(5e6)) * SCORE_WEIGHTS.profit;
  const v = clamp01(Math.log10(vol1h + 1) / Math.log10(20_000)) * SCORE_WEIGHTS.volume;
  const c = clamp01(confidence) * SCORE_WEIGHTS.confidence;
  return { roi: r, profit: p, volume: v, confidence: c, total: Math.round(r + p + v + c) };
}
