/** One tradeable item joined with its latest and averaged prices. */
export interface Item {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  /** GE buy limit per 4 hours; null when the Wiki doesn't know it. */
  limit: number | null;
  highalch: number | null;
  value: number;
  icon: string;
  taxExempt: boolean;

  /** Latest instant-buy price (what you sell at). */
  high: number | null;
  /** Unix seconds. */
  highTime: number | null;
  /** Latest instant-sell price (what you buy at). */
  low: number | null;
  lowTime: number | null;

  avgHigh1h: number | null;
  avgLow1h: number | null;
  /** Trades at the high price in the last hour. */
  volHigh1h: number;
  volLow1h: number;
  vol1h: number;

  avgHigh24h: number | null;
  avgLow24h: number | null;
  vol24h: number;
}
