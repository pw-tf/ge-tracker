import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { fetchTimeseries } from '../api/wiki';
import { mid } from '../lib/calc';

/** 24h mid-price sparkline, fetched only once the row scrolls into view. */
export function Sparkline({ id, color, width = 96, height = 32 }: { id: number; color: string; width?: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  const { data } = useQuery({
    queryKey: ['ts', id, '1h'],
    queryFn: ({ signal }) => fetchTimeseries(id, '1h', signal),
    enabled: seen,
    staleTime: 10 * 60_000,
  });

  const pts = (data ?? [])
    .slice(-24)
    .map((p) => mid(p.avgHighPrice, p.avgLowPrice))
    .filter((v): v is number => v != null);

  let d = '';
  if (pts.length > 1) {
    const mx = Math.max(...pts);
    const mn = Math.min(...pts);
    const span = mx - mn || 1;
    d = pts
      .map((v, i) => `${i ? 'L' : 'M'}${(2 + (i * (width - 4)) / (pts.length - 1)).toFixed(1)} ${(4 + ((mx - v) / span) * (height - 8)).toFixed(1)}`)
      .join(' ');
  }

  return (
    <div ref={ref} style={{ width, height }} aria-hidden="true">
      {d && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
