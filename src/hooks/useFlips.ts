import { useMemo } from 'react';
import { flipOf, type Flip } from '../lib/calc';
import { parseGp } from '../lib/format';
import { useMarket } from '../state/market';
import { useSettings } from '../state/settings';
import { useNow } from './useNow';

/** Every item with both prices, as a flip priced against the player's cash stack. */
export function useFlips(): Flip[] {
  const { items } = useMarket();
  const { bankroll } = useSettings();
  const now = useNow(15_000);
  const bank = parseGp(bankroll);
  return useMemo(
    () => items.map((i) => flipOf(i, { bankroll: bank, now })).filter((f): f is Flip => f !== null),
    [items, bank, now],
  );
}
