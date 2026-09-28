export const TAX_RATE = 0.02;
export const TAX_CAP = 5_000_000;
/** Items sold for less than this pay no tax (2% of 49 floors to 0). */
export const TAX_FLOOR = 50;

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
