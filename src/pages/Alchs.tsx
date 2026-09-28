import { useMemo, useState } from 'react';
import { Field, Kpi, Segmented } from '../components/Controls';
import { Icon } from '../components/Icon';
import { ItemCell, ItemIcon, ItemName } from '../components/ItemBits';
import { BottomNav, MobileBar } from '../components/Shell';
import { Empty, MarketError } from '../components/Status';
import { useIsMobile } from '../hooks/useNow';
import { alchOf, NATURE_RUNE_ID, type Alch, type PriceBasis } from '../lib/calc';
import { fmtFull, fmtShort, parseGp, signed } from '../lib/format';
import { useMarket } from '../state/market';
import { updateSettings, useSettings } from '../state/settings';

type SortKey = 'name' | 'price' | 'ha' | 'profit' | 'limit' | 'ppl' | 'vol' | 'gph';
const COLS: { key: SortKey; label: string; title?: string }[] = [
  { key: 'name', label: 'Item' },
  { key: 'price', label: 'GE price' },
  { key: 'ha', label: 'High alch' },
  { key: 'profit', label: 'Profit / cast', title: 'High alch − GE price − nature rune' },
  { key: 'limit', label: 'Limit' },
  { key: 'ppl', label: 'Profit / limit' },
  { key: 'vol', label: 'Vol 1h' },
  { key: 'gph', label: 'GP / hr', title: 'Profit per cast × min(casts per hour, buy limit ÷ 4)' },
];
const GRID = 'minmax(180px,2.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,.7fr) minmax(0,1fr) minmax(0,.8fr) minmax(0,.9fr)';
const val: Record<SortKey, (a: Alch) => number | string> = {
  name: (a) => a.item.name,
  price: (a) => a.price,
  ha: (a) => a.item.highalch ?? 0,
  profit: (a) => a.profit,
  limit: (a) => a.item.limit ?? -1,
  ppl: (a) => a.ppl,
  vol: (a) => a.item.vol1h,
  gph: (a) => a.gph,
};
const PAGE = 50;

export function AlchsPage() {
  const mobile = useIsMobile();
  const { items, byId, loading } = useMarket();
  const settings = useSettings();
  const [basis, setBasis] = useState<PriceBasis>('instant');
  const [profitOnly, setProfitOnly] = useState(true);
  const [minVol, setMinVol] = useState('10');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'gph', dir: -1 });
  const [shown, setShown] = useState(PAGE);

  const liveNature = byId.get(NATURE_RUNE_ID)?.high ?? null;
  const nature = parseGp(settings.natureOverride) ?? liveNature ?? 0;
  const cph = settings.castsPerHour;

  const all = useMemo(
    () => items.map((i) => alchOf(i, basis, nature, cph)).filter((a): a is Alch => a !== null),
    [items, basis, nature, cph],
  );
  const minV = parseGp(minVol) ?? 0;
  const list = useMemo(() => {
    const l = all.filter((a) => a.item.vol1h >= minV && (!profitOnly || a.profit > 0));
    const get = val[sort.key];
    return l.sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      return (typeof va === 'string' ? va.localeCompare(vb as string) : va - (vb as number)) * sort.dir;
    });
  }, [all, minV, profitOnly, sort]);

  const profitable = all.filter((a) => a.profit > 0 && a.item.vol1h >= minV);
  const bestHr = profitable.reduce<Alch | null>((b, a) => (!b || a.gph > b.gph ? a : b), null);
  const bestCast = profitable.reduce<Alch | null>((b, a) => (!b || a.profit > b.profit ? a : b), null);
  const visible = list.slice(0, shown);

  const controls = (
    <div className="row">
      <Segmented<PriceBasis>
        label="Price basis"
        className="on-panel"
        value={basis}
        onChange={setBasis}
        options={[
          { value: 'instant', label: 'Instant buy' },
          { value: 'patient', label: 'Patient offer' },
        ]}
      />
      <button type="button" className="btn" aria-pressed={profitOnly} onClick={() => setProfitOnly((v) => !v)}>
        <Icon name={profitOnly ? 'check' : 'minus'} size={14} strokeWidth={2.4} />
        Profitable only
      </button>
    </div>
  );

  const setup = (
    <section className="panel panel-pad" aria-label="Alching setup">
      <h2>Your setup</h2>
      <Field
        id="nat"
        label={`Nature rune price${liveNature != null ? ` (live ${fmtFull(liveNature)})` : ''}`}
        placeholder={liveNature != null ? String(liveNature) : 'e.g. 95'}
        value={settings.natureOverride}
        onChange={(v) => updateSettings({ natureOverride: v })}
      />
      <Field
        id="cph"
        label="Casts per hour"
        inputMode="numeric"
        value={String(cph)}
        onChange={(v) => updateSettings({ castsPerHour: Math.max(0, parseInt(v.replace(/\D/g, '') || '0', 10)) })}
      />
      <Field id="minvol" label="Min 1h volume" value={minVol} onChange={setMinVol} placeholder="any" />
      <p className="panel-sub" style={{ margin: 0, lineHeight: 1.5 }}>
        Assumes a fire staff, so no fire runes. GP/hr = profit per cast × the lower of casts per hour and buy limit ÷ 4.
      </p>
    </section>
  );

  if (mobile) {
    return (
      <>
        <MobileBar title="High alchemy" />
        <main className="page">
          <MarketError />
          {controls}
          <div className="kpis">
            <Kpi label="Nature rune" value={`${fmtFull(nature)} gp`} sub="cost per cast" />
            <Kpi label="Best GP / hr" value={bestHr ? fmtShort(bestHr.gph) : '—'} sub={bestHr?.item.name} color="var(--gold)" />
          </div>
          <div className="cards">
            {visible.map((a) => (
              <article className="card" key={a.item.id}>
                <div className="card-top">
                  <ItemIcon item={a.item} />
                  <div className="meta">
                    <ItemName item={a.item} />
                    <span className="item-sub">
                      {a.item.members ? 'Members' : 'F2P'} · limit {a.item.limit != null ? fmtShort(a.item.limit) : '—'}
                    </span>
                  </div>
                  <span className={'pill ' + (a.profit > 0 ? 'up' : 'down')}>{signed(a.profit, fmtFull)}</span>
                </div>
                <div className="card-foot" style={{ paddingRight: 4 }}>
                  <span>Buy {fmtShort(a.price)}</span>
                  <span>Alch {fmtShort(a.item.highalch ?? 0)}</span>
                  <span className="gold strong">{a.profit > 0 ? `${fmtShort(a.gph)}/hr` : '—'}</span>
                </div>
              </article>
            ))}
            {!loading && list.length === 0 && <Empty title="No profitable alchs right now" />}
            {list.length > shown && (
              <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>
                Load more
              </button>
            )}
          </div>
          {setup}
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>High alchemy</h1>
          <p>Items that alch for more than they cost, after the nature rune. GP/hr respects the 4-hour buy limit.</p>
        </div>
        {controls}
      </div>
      <MarketError />
      <div className="with-aside">
        <div className="stack">
          <div className="kpis">
            <Kpi label="Nature rune" value={`${fmtFull(nature)} gp`} sub={settings.natureOverride ? 'your override' : 'cost per cast, live price'} />
            <Kpi label="Profitable alchs" value={profitable.length.toLocaleString('en-US')} sub={`of ${all.length.toLocaleString('en-US')} alchable items`} color="var(--up)" />
            <Kpi label="Best GP / hr" value={bestHr ? fmtShort(bestHr.gph) : '—'} sub={bestHr?.item.name ?? ''} color="var(--gold)" />
            <Kpi
              label="Best profit / cast"
              value={bestCast ? signed(bestCast.profit, fmtFull) : '—'}
              sub={bestCast ? `${bestCast.item.name} · limit ${bestCast.item.limit ?? '—'}` : ''}
              color="var(--up)"
            />
          </div>
          <div className="panel table">
            <div className="table-scroll">
              <div role="table" aria-label="High alchemy">
                <div className="thead" role="row" style={{ ['--cols' as string]: GRID, ['--min-w' as string]: '860px' }}>
                  {COLS.map((c) => {
                    const on = sort.key === c.key;
                    return (
                      <div key={c.key} role="columnheader" aria-sort={on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'} className={c.key === 'name' ? '' : 'r'} style={{ display: 'flex' }}>
                        <button
                          type="button"
                          className={'th' + (on ? ' active' : '')}
                          title={c.title}
                          onClick={() => setSort(on ? { key: c.key, dir: sort.dir > 0 ? -1 : 1 } : { key: c.key, dir: c.key === 'name' ? 1 : -1 })}
                        >
                          {c.label}
                          {on && <span className="arrow">{sort.dir > 0 ? '↑' : '↓'}</span>}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {loading && Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" />)}
                {visible.map((a) => (
                  <div key={a.item.id} role="row" className={'trow' + (a.profit > 0 ? '' : ' dim')} style={{ ['--cols' as string]: GRID, ['--min-w' as string]: '860px' }}>
                    <div role="cell" style={{ minWidth: 0 }}>
                      <ItemCell item={a.item} />
                    </div>
                    <div role="cell" className="cell">{fmtFull(a.price)}</div>
                    <div role="cell" className="cell">{fmtFull(a.item.highalch ?? 0)}</div>
                    <div role="cell" className={'cell strong ' + (a.profit > 0 ? 'up' : 'down')}>{signed(a.profit, fmtFull)}</div>
                    <div role="cell" className="cell muted">{a.item.limit != null ? fmtShort(a.item.limit) : '—'}</div>
                    <div role="cell" className="cell">{a.item.limit != null ? fmtShort(a.ppl) : '—'}</div>
                    <div role="cell" className="cell">{fmtShort(a.item.vol1h)}</div>
                    <div role="cell" className={'cell strong ' + (a.profit > 0 ? 'gold' : 'muted')}>{a.profit > 0 ? fmtShort(a.gph) : '—'}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="table-foot">
              <span>
                {list.length.toLocaleString('en-US')} items · volume filter hides items nobody is trading
              </span>
              {list.length > shown && (
                <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>
                  Load more
                </button>
              )}
            </div>
          </div>
          {!loading && list.length === 0 && <Empty title="No profitable alchs right now">Try the patient-offer price basis.</Empty>}
        </div>
        <div className="stack">
          {setup}
          <section className="panel panel-pad" aria-label="Buying tips">
            <h2>Buying tips</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--text)' }}>Instant buy</strong> fills now at the high price. <strong style={{ color: 'var(--text)' }}>Patient</strong>{' '}
              offers at the low price: more profit per cast, slower to fill.
            </p>
            <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
              Cheap items with big buy limits often beat expensive ones on GP/hr, because the limit caps how many expensive items you can cast.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
