import { useMemo, useState } from 'react';
import { Field, Segmented } from '../components/Controls';
import { Icon, type IconName } from '../components/Icon';
import { ItemIcon, ItemName } from '../components/ItemBits';
import { BottomNav, MobileBar } from '../components/Shell';
import { Sparkline } from '../components/Sparkline';
import { MarketError } from '../components/Status';
import { useIsMobile } from '../hooks/useNow';
import { mid, priceChange, tierOf, volumeSpike, type MoverWindow } from '../lib/calc';
import type { TierFilter } from '../lib/filters';
import { fmtShort, parseGp } from '../lib/format';
import type { Item } from '../lib/types';
import { useMarket } from '../state/market';

const ROWS = 10;

interface MoverRow {
  item: Item;
  price: number;
  sub: string;
  value: number;
  label: string;
}

interface PanelDef {
  key: string;
  title: string;
  sub: string;
  icon: IconName;
  tone: 'up' | 'down' | 'gold';
  rows: MoverRow[];
}

export function MoversPage() {
  const mobile = useIsMobile();
  const { items } = useMarket();
  const [tier, setTier] = useState<TierFilter>('all');
  const [win, setWin] = useState<MoverWindow>('24h');
  const [minVol, setMinVol] = useState('100');
  const [tab, setTab] = useState('gain');

  const panels = useMemo<PanelDef[]>(() => {
    const min = parseGp(minVol) ?? 0;
    const pool = items.filter((i) => {
      const p = mid(i.high, i.low);
      return p != null && i.vol24h >= min && (tier === 'all' || tierOf(p) === tier);
    });
    const withChange = pool
      .map((item) => ({ item, ch: priceChange(item, win), price: mid(item.high, item.low)! }))
      .filter((x): x is { item: Item; ch: number; price: number } => x.ch != null && Math.abs(x.ch) >= 0.1);
    const avgOf = (i: Item) => (win === '1h' ? mid(i.avgHigh1h, i.avgLow1h) : mid(i.avgHigh24h, i.avgLow24h));
    const toRow = (x: { item: Item; ch: number; price: number }): MoverRow => ({
      item: x.item,
      price: x.price,
      sub: `avg ${fmtShort(avgOf(x.item) ?? 0)}`,
      value: x.ch,
      label: (x.ch >= 0 ? '+' : '−') + Math.abs(x.ch).toFixed(1) + '%',
    });
    const gainers = withChange.filter((x) => x.ch > 0).sort((a, b) => b.ch - a.ch).slice(0, ROWS).map(toRow);
    const losers = withChange.filter((x) => x.ch < 0).sort((a, b) => a.ch - b.ch).slice(0, ROWS).map(toRow);
    const spikes = pool
      .map((item) => ({ item, s: volumeSpike(item), price: mid(item.high, item.low)! }))
      .filter((x): x is { item: Item; s: number; price: number } => x.s != null && x.s > 1)
      .sort((a, b) => b.s - a.s)
      .slice(0, ROWS)
      .map((x) => ({ item: x.item, price: x.price, sub: `${fmtShort(x.item.vol1h)} trades/h`, value: x.s, label: '×' + x.s.toFixed(1) }));
    return [
      { key: 'gain', title: 'Top gainers', sub: `Price above the ${win} average`, icon: 'trendUp', tone: 'up', rows: gainers },
      { key: 'lose', title: 'Top losers', sub: `Price below the ${win} average, possible dip buys`, icon: 'trendDown', tone: 'down', rows: losers },
      { key: 'spike', title: 'Volume spikes', sub: 'Trades last hour vs the usual hourly rate', icon: 'bars', tone: 'gold', rows: spikes },
    ];
  }, [items, tier, win, minVol]);

  const controls = (
    <div className="row">
      <Segmented<TierFilter>
        label="Price tier"
        className="on-panel"
        value={tier}
        onChange={setTier}
        options={[
          { value: 'all', label: 'All' },
          { value: 'low', label: <><span className="dot small low" />Low</> },
          { value: 'med', label: <><span className="dot small med" />Medium</> },
          { value: 'high', label: <><span className="dot small high" />High</> },
        ]}
      />
      <Segmented<MoverWindow>
        label="Compare against"
        className="on-panel"
        value={win}
        onChange={setWin}
        options={[
          { value: '1h', label: 'vs 1h avg' },
          { value: '24h', label: 'vs 24h avg' },
        ]}
      />
      <div style={{ width: 150 }}>
        <Field id="mv-vol" label="Min 24h trades" value={minVol} onChange={setMinVol} placeholder="any" />
      </div>
    </div>
  );

  const renderPanel = (p: PanelDef) => (
    <section key={p.key} className="panel table" aria-label={p.title}>
      <div className="mover-head">
        <div className={'mover-icon ' + p.tone}>
          <Icon name={p.icon} strokeWidth={2.2} />
        </div>
        <div>
          <h2>{p.title}</h2>
          <span className="panel-sub">{p.sub}</span>
        </div>
      </div>
      {p.rows.map((r) => (
        <div key={r.item.id} className="mover-row">
          <ItemIcon item={r.item} />
          <div className="meta">
            <ItemName item={r.item} />
            <span className="num muted" style={{ fontSize: 12 }}>
              {fmtShort(r.price)} · {r.sub}
            </span>
          </div>
          <Sparkline id={r.item.id} color={`var(--${p.tone})`} width={mobile ? 72 : 96} />
          <span className={'pill ' + p.tone}>
            <Icon name={p.tone === 'down' ? 'arrowDown' : 'arrowUp'} size={10} strokeWidth={3} />
            {r.label}
          </span>
        </div>
      ))}
      {p.rows.length === 0 && <div className="empty" style={{ padding: 24 }}>Nothing here right now.</div>}
    </section>
  );

  if (mobile) {
    const current = panels.find((p) => p.key === tab) ?? panels[0];
    return (
      <>
        <MobileBar title="Movers" />
        <main className="page">
          <MarketError />
          <Segmented
            label="List"
            className="fill on-panel"
            value={tab}
            onChange={setTab}
            options={panels.map((p) => ({ value: p.key, label: p.title.replace('Top ', '') }))}
          />
          {controls}
          {renderPanel(current)}
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Movers</h1>
          <p>Price moves and volume spikes, for buying dips and riding momentum. Thinly traded items are left out.</p>
        </div>
        {controls}
      </div>
      <MarketError />
      <div className="three-col">{panels.map(renderPanel)}</div>
      <p className="panel-sub" style={{ margin: 0 }}>
        Change = latest mid price vs the window’s average mid price · spike = trades in the last hour vs the average hourly volume over 24h ·
        sparklines show the last 24 hours.
      </p>
    </main>
  );
}
