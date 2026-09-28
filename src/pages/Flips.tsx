import { useCallback, useMemo, useState } from 'react';
import { Kpi, Segmented } from '../components/Controls';
import { FilterPanel } from '../components/FilterPanel';
import { FlipCard, FlipTable } from '../components/FlipList';
import { Icon } from '../components/Icon';
import { BankrollInput, BottomNav, MobileBar } from '../components/Shell';
import { Sheet } from '../components/Sheet';
import { Empty, MarketError } from '../components/Status';
import { useFlips } from '../hooks/useFlips';
import { useIsMobile } from '../hooks/useNow';
import type { Tier } from '../lib/calc';
import { activeFilterCount, filterFlips, sortFlips, type FlipSortKey, type TierFilter } from '../lib/filters';
import { fmtPct, fmtShort } from '../lib/format';
import { useFlipFilters } from '../state/filters';
import { useMarket } from '../state/market';

const PAGE = 50;

const TIERS: { value: TierFilter; label: string; short: string }[] = [
  { value: 'all', label: 'All tiers', short: 'All' },
  { value: 'low', label: 'Low <100k', short: 'Low' },
  { value: 'med', label: 'Medium 100k–10M', short: 'Medium' },
  { value: 'high', label: 'High >10M', short: 'High' },
];

const SORT_OPTIONS: { value: FlipSortKey; label: string }[] = [
  { value: 'score', label: 'Flip score' },
  { value: 'conf', label: 'Fill confidence' },
  { value: 'ppl', label: 'Profit per limit' },
  { value: 'roi', label: 'ROI' },
  { value: 'margin', label: 'Margin' },
  { value: 'vol', label: 'Volume (1h)' },
  { value: 'buy', label: 'Price' },
];

export function FlipsPage() {
  const mobile = useIsMobile();
  const { loading } = useMarket();
  const flips = useFlips();
  const { filters, setFilters, resetFilters } = useFlipFilters();
  const [shown, setShown] = useState(PAGE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const base = useMemo(() => filterFlips(flips, filters), [flips, filters]);
  const counts = useMemo(() => {
    const c: Record<TierFilter, number> = { all: base.length, low: 0, med: 0, high: 0 };
    base.forEach((f) => c[f.tier as Tier]++);
    return c;
  }, [base]);
  const list = useMemo(
    () => sortFlips(filters.tier === 'all' ? base : base.filter((f) => f.tier === filters.tier), filters.sort, filters.dir),
    [base, filters.tier, filters.sort, filters.dir],
  );

  const kpis = useMemo(() => {
    const pos = list.filter((f) => f.margin > 0);
    const bestRoi = pos.reduce<(typeof pos)[number] | null>((b, f) => (!b || f.roi > b.roi ? f : b), null);
    const bestPpl = pos.reduce<(typeof pos)[number] | null>((b, f) => (!b || f.ppl > b.ppl ? f : b), null);
    return { count: pos.length, bestRoi, bestPpl, liquid: pos.filter((f) => f.item.vol1h >= 500).length };
  }, [list]);

  const onSort = (key: FlipSortKey) =>
    setFilters(filters.sort === key ? { dir: filters.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: key === 'name' ? 'asc' : 'desc' });

  const visible = list.slice(0, shown);
  const more = list.length > shown && (
    <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>
      Load more
    </button>
  );
  const active = activeFilterCount(filters);

  const tierChips = (
    <div className={mobile ? 'hscroll' : 'chips'} role="group" aria-label="Price tier">
      {TIERS.map((t) => (
        <button
          key={t.value}
          type="button"
          className="chip"
          aria-pressed={filters.tier === t.value}
          onClick={() => {
            setFilters({ tier: t.value });
            setShown(PAGE);
          }}
        >
          <span className={`dot ${t.value}`} />
          {mobile ? t.short : t.label}
          <span className="count">{counts[t.value].toLocaleString('en-US')}</span>
        </button>
      ))}
    </div>
  );

  if (mobile) {
    return (
      <>
        <MobileBar title="Flips" />
        <main className="page">
          <MarketError />
          <div style={{ position: 'relative' }}>
            <label htmlFor="flip-q" className="sr-only">
              Filter items by name
            </label>
            <span className="field-icon">
              <Icon name="search" size={18} />
            </span>
            <input
              id="flip-q"
              className="field text with-icon"
              placeholder="Search items"
              autoComplete="off"
              value={filters.q}
              onChange={(e) => setFilters({ q: e.target.value })}
            />
          </div>
          {tierChips}
          <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
            <label htmlFor="flip-sort" className="muted" style={{ fontSize: 13 }}>
              Sort
            </label>
            <select
              id="flip-sort"
              className="field"
              style={{ flexGrow: 1, height: 40 }}
              value={filters.sort}
              onChange={(e) => setFilters({ sort: e.target.value as FlipSortKey, dir: 'desc' })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn on" style={{ height: 40 }} onClick={() => setSheetOpen(true)}>
              <Icon name="sliders" />
              Filters{active ? ` · ${active}` : ''}
            </button>
          </div>
          <div className="cards">
            {loading && visible.length === 0 && Array.from({ length: 5 }, (_, i) => <div key={i} className="card skeleton" style={{ height: 128 }} />)}
            {visible.map((f) => (
              <FlipCard key={f.item.id} f={f} />
            ))}
            {!loading && list.length === 0 && <Empty title="No flips match">Loosen a filter or pick another tier.</Empty>}
            {more}
          </div>
        </main>
        <BottomNav />
        {sheetOpen && (
          <Sheet
            title="Filters"
            onClose={closeSheet}
            headerExtra={
              <button type="button" className="btn plain" onClick={resetFilters}>
                Reset
              </button>
            }
            footer={
              <button type="button" className="btn gold" onClick={closeSheet}>
                Show {list.length.toLocaleString('en-US')} flips
              </button>
            }
          >
            <div className="stack" style={{ gap: 18 }}>
              <BankrollInput id="bankroll-m" />
              <div className="stack" style={{ gap: 8 }}>
                <div className="section-label">Price tier</div>
                <Segmented<TierFilter>
                  label="Price tier"
                  className="fill"
                  value={filters.tier}
                  onChange={(tier) => setFilters({ tier })}
                  options={TIERS.map((t) => ({ value: t.value, label: <><span className={`dot small ${t.value}`} />{t.short}</> }))}
                />
              </div>
              <FilterPanel filters={filters} setFilters={setFilters} reset={resetFilters} idPrefix="m" showHeader={false} />
            </div>
          </Sheet>
        )}
      </>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Margin flips</h1>
          <p>Buy at and Sell at are realistic offers anchored to recent averages, so spikes don’t inflate the margin. Profit is after the 2% GE tax (capped at 5M per item).</p>
        </div>
        {tierChips}
      </div>
      <MarketError />
      <div className="with-sidebar">
        <aside className="panel panel-pad" aria-label="Filters">
          <div className="field-group">
            <label htmlFor="flip-q-d">Name contains</label>
            <input
              id="flip-q-d"
              className="field text"
              autoComplete="off"
              placeholder="e.g. potion"
              value={filters.q}
              onChange={(e) => setFilters({ q: e.target.value })}
            />
          </div>
          <FilterPanel filters={filters} setFilters={setFilters} reset={resetFilters} idPrefix="d" />
        </aside>
        <div className="stack">
          <div className="kpis">
            <Kpi label="Profitable flips" value={kpis.count.toLocaleString('en-US')} sub="after tax, in this view" />
            <Kpi label="Best ROI" value={kpis.bestRoi ? fmtPct(kpis.bestRoi.roi) : '—'} sub={kpis.bestRoi?.item.name ?? 'No matches'} color="var(--up)" />
            <Kpi
              label="Top profit per limit"
              value={kpis.bestPpl ? fmtShort(kpis.bestPpl.ppl) : '—'}
              sub={kpis.bestPpl ? `${kpis.bestPpl.item.name} · resets every 4h` : 'No matches'}
              color="var(--gold)"
            />
            <Kpi label="Liquid picks" value={kpis.liquid.toLocaleString('en-US')} sub="≥ 500 trades in the last hour" />
          </div>
          <FlipTable
            flips={visible}
            sort={filters.sort}
            dir={filters.dir}
            onSort={onSort}
            loading={loading}
            footer={
              <div className="table-foot">
                <span>
                  Showing {visible.length.toLocaleString('en-US')} of {list.length.toLocaleString('en-US')} matches · prices from the OSRS Wiki
                  real-time API
                </span>
                {more}
              </div>
            }
          />
          {!loading && list.length === 0 && <Empty title="No flips match">Loosen a filter or pick another tier.</Empty>}
        </div>
      </div>
    </main>
  );
}
