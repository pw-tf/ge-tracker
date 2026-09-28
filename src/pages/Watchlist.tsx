import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Kpi, Segmented } from '../components/Controls';
import { FlipTable } from '../components/FlipList';
import { Icon } from '../components/Icon';
import { ItemIcon, ItemName } from '../components/ItemBits';
import { BottomNav, MobileBar } from '../components/Shell';
import { Empty, MarketError } from '../components/Status';
import { useFlips } from '../hooks/useFlips';
import { useIsMobile } from '../hooks/useNow';
import { priceChange } from '../lib/calc';
import { sortFlips, type FlipSortKey } from '../lib/filters';
import { fmtShort, signed } from '../lib/format';
import { addWatch, toggleWatch, useWatchlist } from '../state/watchlist';

type MobileSort = 'ppl' | 'roi' | 'change';

export function WatchlistPage() {
  const mobile = useIsMobile();
  const ids = useWatchlist();
  const flips = useFlips();
  const [sort, setSort] = useState<{ key: FlipSortKey; dir: 'asc' | 'desc' }>({ key: 'ppl', dir: 'desc' });
  const [mSort, setMSort] = useState<MobileSort>('ppl');
  const [undo, setUndo] = useState<{ id: number; name: string } | null>(null);

  const watched = useMemo(() => {
    const set = new Set(ids);
    return flips.filter((f) => set.has(f.item.id));
  }, [flips, ids]);
  const profitable = watched.filter((f) => f.margin > 0);
  const total = profitable.reduce((s, f) => s + f.ppl, 0);

  const kpis = (
    <div className="kpis">
      <Kpi label="Profitable now" value={`${profitable.length} of ${watched.length}`} color="var(--up)" />
      <Kpi label="Profit if every limit fills" value={fmtShort(total)} color="var(--gold)" sub="profitable items, capped by your cash stack" />
    </div>
  );

  const empty = (
    <Empty title="Nothing starred yet">
      Tap the <Icon name="star" size={14} /> on any item to follow its margin here. <Link to="/">Browse flips</Link>
    </Empty>
  );

  if (mobile) {
    const list = [...watched].sort((a, b) =>
      mSort === 'change' ? (priceChange(b.item, '24h') ?? 0) - (priceChange(a.item, '24h') ?? 0) : mSort === 'roi' ? b.roi - a.roi : b.ppl - a.ppl,
    );
    return (
      <>
        <MobileBar title={`Watchlist · ${watched.length}`} />
        <main className="page">
          <MarketError />
          {kpis}
          <Segmented<MobileSort>
            label="Sort watchlist"
            className="fill on-panel"
            value={mSort}
            onChange={setMSort}
            options={[
              { value: 'ppl', label: 'Profit / limit' },
              { value: 'roi', label: 'ROI' },
              { value: 'change', label: '24h change' },
            ]}
          />
          <div className="cards" style={{ gap: 8 }}>
            {list.map((f) => {
              const ch = priceChange(f.item, '24h');
              const up = (ch ?? 0) >= 0;
              return (
                <article key={f.item.id} className="card" style={{ flexDirection: 'row', alignItems: 'center', padding: '10px 4px 10px 12px' }}>
                  <ItemIcon item={f.item} />
                  <div className="stack" style={{ gap: 3, flexGrow: 1 }}>
                    <ItemName item={f.item} />
                    <span className="num muted" style={{ fontSize: 12 }}>
                      {fmtShort(f.buy)} → {fmtShort(f.sell)}
                    </span>
                  </div>
                  <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                    <span className={'num strong ' + (f.margin > 0 ? 'up' : 'down')}>{signed(f.margin)}</span>
                    {ch != null && (
                      <span className={'pill ' + (up ? 'up' : 'down')} style={{ fontSize: 11, padding: '2px 6px' }}>
                        <Icon name={up ? 'arrowUp' : 'arrowDown'} size={9} strokeWidth={3} />
                        {(up ? '+' : '−') + Math.abs(ch).toFixed(1)}% 24h
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="star-btn touch"
                    aria-pressed="true"
                    aria-label={`Remove ${f.item.name} from watchlist`}
                    onClick={() => {
                      toggleWatch(f.item.id);
                      setUndo({ id: f.item.id, name: f.item.name });
                    }}
                  >
                    <Icon name="star" size={20} filled strokeWidth={1.8} />
                  </button>
                </article>
              );
            })}
            {watched.length === 0 && empty}
            {undo && (
              <button
                type="button"
                className="btn"
                style={{ borderStyle: 'dashed', color: 'var(--muted)', fontWeight: 500, minHeight: 44 }}
                onClick={() => {
                  addWatch(undo.id);
                  setUndo(null);
                }}
              >
                Removed {undo.name} · Undo
              </button>
            )}
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Watchlist</h1>
          <p>Items you’ve starred. Saved in this browser.</p>
        </div>
      </div>
      <MarketError />
      {kpis}
      {watched.length === 0 ? (
        <div className="panel">{empty}</div>
      ) : (
        <FlipTable
          flips={sortFlips(watched, sort.key, sort.dir)}
          sort={sort.key}
          dir={sort.dir}
          onSort={(key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }))}
        />
      )}
    </main>
  );
}
