import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { DEFAULT_FILTERS, type FlipFilters } from '../lib/filters';

const KEYS = Object.keys(DEFAULT_FILTERS) as (keyof FlipFilters)[];

/**
 * Flip filters live in the URL query string, so a filtered view can be bookmarked
 * or shared. A key missing from the URL falls back to its default; a key present
 * but empty means "no limit".
 */
export function useFlipFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => {
    const f = { ...DEFAULT_FILTERS };
    for (const k of KEYS) {
      const v = params.get(k);
      if (v != null) (f as Record<string, string>)[k] = v;
    }
    return f;
  }, [params]);

  const setFilters = useCallback(
    (patch: Partial<FlipFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === DEFAULT_FILTERS[k as keyof FlipFilters]) next.delete(k);
            else next.set(k, String(v));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const resetFilters = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams();
        const q = prev.get('q');
        if (q) next.set('q', q);
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  return { filters, setFilters, resetFilters };
}
