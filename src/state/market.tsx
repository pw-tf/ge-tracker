import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { fetchAverages, fetchLatest, fetchMapping } from '../api/wiki';
import { buildItems } from '../lib/market';
import type { Item } from '../lib/types';

const MINUTE = 60_000;

/** All items joined with live prices. Latest prices poll every 60s while the tab is visible. */
function useMarketData() {
  const mapping = useQuery({
    queryKey: ['mapping'],
    queryFn: ({ signal }) => fetchMapping(signal),
    staleTime: 24 * 60 * MINUTE,
    gcTime: Infinity,
  });
  const latest = useQuery({
    queryKey: ['latest'],
    queryFn: ({ signal }) => fetchLatest(signal),
    refetchInterval: MINUTE,
    staleTime: 30_000,
  });
  const avg5m = useQuery({
    queryKey: ['avg', '5m'],
    queryFn: ({ signal }) => fetchAverages('5m', signal),
    refetchInterval: MINUTE,
    staleTime: 30_000,
  });
  const avg1h = useQuery({
    queryKey: ['avg', '1h'],
    queryFn: ({ signal }) => fetchAverages('1h', signal),
    refetchInterval: 5 * MINUTE,
    staleTime: 2 * MINUTE,
  });
  const avg24h = useQuery({
    queryKey: ['avg', '24h'],
    queryFn: ({ signal }) => fetchAverages('24h', signal),
    refetchInterval: 15 * MINUTE,
    staleTime: 10 * MINUTE,
  });

  const items = useMemo<Item[]>(
    () => (mapping.data ? buildItems(mapping.data, latest.data, avg1h.data, avg24h.data, avg5m.data) : []),
    [mapping.data, latest.data, avg1h.data, avg24h.data, avg5m.data],
  );
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const byName = useMemo(() => new Map(items.map((i) => [i.name, i])), [items]);

  const error = mapping.error ?? latest.error ?? null;
  return {
    items,
    byId,
    byName,
    loading: mapping.isPending || latest.isPending,
    error: error as Error | null,
    updatedAt: latest.dataUpdatedAt,
    fetching: latest.isFetching || avg1h.isFetching,
    refresh: () => {
      void latest.refetch();
      void avg5m.refetch();
      void avg1h.refetch();
    },
  };
}

type Market = ReturnType<typeof useMarketData>;
const MarketContext = createContext<Market | null>(null);

/** Builds the joined item list once and shares it with every page. */
export function MarketProvider({ children }: { children: ReactNode }) {
  const market = useMarketData();
  return <MarketContext.Provider value={market}>{children}</MarketContext.Provider>;
}

export function useMarket(): Market {
  const m = useContext(MarketContext);
  if (!m) throw new Error('useMarket must be used inside <MarketProvider>');
  return m;
}
