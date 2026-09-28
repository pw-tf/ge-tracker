import type { AvgEntry, LatestEntry, MappingEntry } from '../api/wiki';
import { TAX_EXEMPT_NAMES } from '../data/taxExempt';
import type { Item } from './types';

/** Join item metadata with latest prices and 1h/24h averages. */
export function buildItems(
  mapping: MappingEntry[],
  latest: Record<string, LatestEntry> | undefined,
  avg1h: Record<string, AvgEntry> | undefined,
  avg24h: Record<string, AvgEntry> | undefined,
): Item[] {
  return mapping.map((m) => {
    const key = String(m.id);
    const l = latest?.[key];
    const h1 = avg1h?.[key];
    const d1 = avg24h?.[key];
    const volHigh1h = h1?.highPriceVolume ?? 0;
    const volLow1h = h1?.lowPriceVolume ?? 0;
    return {
      id: m.id,
      name: m.name,
      examine: m.examine,
      members: m.members,
      limit: m.limit ?? null,
      highalch: m.highalch ?? null,
      value: m.value,
      icon: m.icon,
      taxExempt: TAX_EXEMPT_NAMES.has(m.name),
      high: l?.high ?? null,
      highTime: l?.highTime ?? null,
      low: l?.low ?? null,
      lowTime: l?.lowTime ?? null,
      avgHigh1h: h1?.avgHighPrice ?? null,
      avgLow1h: h1?.avgLowPrice ?? null,
      volHigh1h,
      volLow1h,
      vol1h: volHigh1h + volLow1h,
      avgHigh24h: d1?.avgHighPrice ?? null,
      avgLow24h: d1?.avgLowPrice ?? null,
      vol24h: (d1?.highPriceVolume ?? 0) + (d1?.lowPriceVolume ?? 0),
    };
  });
}
