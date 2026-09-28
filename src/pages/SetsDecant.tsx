import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Segmented } from '../components/Controls';
import { Icon } from '../components/Icon';
import { BottomNav, MobileBar } from '../components/Shell';
import { Empty, MarketError } from '../components/Status';
import { SETS } from '../data/sets';
import { useIsMobile } from '../hooks/useNow';
import { bestDecant, buyPerDose, geTax, parseDose, setArbitrage, type Decant, type Dose, type SetArb } from '../lib/calc';
import { fmtFull, fmtShort, signed } from '../lib/format';
import type { Item } from '../lib/types';
import { useMarket } from '../state/market';

interface SetRow {
  name: string;
  set: Item & { high: number; low: number };
  pieces: (Item & { high: number; low: number })[];
  arb: SetArb;
}

interface PotionRow {
  base: string;
  doses: Dose[];
  best: Decant;
}

const priced = (i: Item | undefined): i is Item & { high: number; low: number } => !!i && i.high != null && i.low != null;

function useSetRows(): SetRow[] {
  const { byName } = useMarket();
  return useMemo(() => {
    const rows: SetRow[] = [];
    for (const def of SETS) {
      const set = byName.get(def.name);
      const pieces = def.pieces.map((p) => byName.get(p));
      if (!priced(set) || !pieces.every(priced)) continue;
      const ps = pieces as SetRow['pieces'];
      const arb = setArbitrage(
        { low: set.low, high: set.high, exempt: set.taxExempt },
        ps.map((p) => ({ low: p.low, high: p.high, exempt: p.taxExempt })),
      );
      rows.push({ name: def.name, set, pieces: ps, arb });
    }
    return rows.sort((a, b) => b.arb.profit - a.arb.profit);
  }, [byName]);
}

function usePotionRows(): PotionRow[] {
  const { items } = useMarket();
  return useMemo(() => {
    const groups = new Map<string, Dose[]>();
    for (const item of items) {
      const d = parseDose(item.name);
      if (!d || item.high == null || item.low == null) continue;
      const g = groups.get(d.base) ?? [];
      g.push({ dose: d.dose, item, low: item.low, high: item.high });
      groups.set(d.base, g);
    }
    const rows: PotionRow[] = [];
    for (const [base, doses] of groups) {
      if (doses.length < 2) continue;
      // Skip groups nobody trades: they produce phantom margins.
      if (doses.reduce((s, d) => s + d.item.vol24h, 0) < 50) continue;
      doses.sort((a, b) => b.dose - a.dose);
      const best = bestDecant(doses);
      if (best) rows.push({ base, doses, best });
    }
    return rows.sort((a, b) => b.best.perLimit - a.best.perLimit);
  }, [items]);
}

function SetsPanel({ rows, edgeOnly }: { rows: SetRow[]; edgeOnly: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = edgeOnly ? rows.filter((r) => r.arb.profit > 0) : rows;
  const grid = 'minmax(0,2.2fr) minmax(0,.9fr) minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,.9fr)';
  return (
    <div className="table-scroll">
      <div style={{ minWidth: 640 }}>
        <div className="thead" style={{ ['--cols' as string]: grid, padding: '10px 16px' }}>
          <span className="th" style={{ height: 'auto' }}>Set</span>
          <span className="th" style={{ height: 'auto' }}>Action</span>
          <span className="th r" style={{ height: 'auto' }} title="Set buy / sell price">Set price</span>
          <span className="th r" style={{ height: 'auto' }} title="Sum of piece buy / sell prices">Pieces</span>
          <span className="th r" style={{ height: 'auto' }}>Profit</span>
          <span className="th r" style={{ height: 'auto' }} title="GE buy limit on the set or pieces">
            × limit
          </span>
        </div>
        {list.map((r) => {
          const edge = r.arb.profit > 0;
          const isOpen = open === r.name;
          const limit = r.arb.best === 'combine' ? Math.min(...r.pieces.map((p) => p.limit ?? 0)) : (r.set.limit ?? 0);
          const piecesLow = r.pieces.reduce((s, p) => s + p.low, 0);
          const piecesHigh = r.pieces.reduce((s, p) => s + p.high, 0);
          return (
            <Fragment key={r.name}>
              <button
                type="button"
                className={'trow rowbtn' + (edge ? '' : ' dim')}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : r.name)}
                style={{ ['--cols' as string]: grid }}
              >
                <span className="item-cell" style={{ fontWeight: 600 }}>
                  <Icon name="chevronRight" size={12} strokeWidth={2.4} className={'chev' + (isOpen ? ' open' : '')} />
                  <span className="ellipsis">{r.name}</span>
                </span>
                <span>
                  <span className={'pill ' + (!edge ? 'neutral' : r.arb.best === 'combine' ? 'gold' : 'blue')}>
                    {!edge ? 'No edge' : r.arb.best === 'combine' ? 'Combine' : 'Split'}
                  </span>
                </span>
                <span className="cell">
                  {fmtShort(r.set.low)} / {fmtShort(r.set.high)}
                </span>
                <span className="cell">
                  {fmtShort(piecesLow)} / {fmtShort(piecesHigh)}
                </span>
                <span className={'cell strong ' + (edge ? 'up' : 'down')}>{signed(r.arb.profit, fmtFull)}</span>
                <span className={'cell ' + (edge ? 'up' : 'down')}>{limit ? signed(r.arb.profit * limit) : '—'}</span>
              </button>
              {isOpen && (
                <div className="set-detail">
                  <div className="set-piece">
                    <Link className="item-link" to={`/item/${r.set.id}`}>
                      {r.set.name}
                    </Link>
                    <span className="num muted r">buy {fmtFull(r.set.low)}</span>
                    <span className="num muted r">sell {fmtFull(r.set.high)}</span>
                  </div>
                  {r.pieces.map((p) => (
                    <div className="set-piece" key={p.id}>
                      <Link className="item-link" to={`/item/${p.id}`} style={{ fontWeight: 500 }}>
                        {p.name}
                      </Link>
                      <span className="num muted r">buy {fmtFull(p.low)}</span>
                      <span className="num muted r">sell {fmtFull(p.high)}</span>
                    </div>
                  ))}
                  <div className="panel-sub" style={{ paddingTop: 4 }}>
                    {r.arb.best === 'combine'
                      ? `Buy each piece at its buy price, exchange at a GE clerk, sell the set at ${fmtFull(r.set.high)} (tax ${fmtFull(geTax(r.set.high, r.set.taxExempt))}).`
                      : `Buy the set at ${fmtFull(r.set.low)}, split it at a GE clerk, sell each piece (tax is charged on every piece).`}
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
        {list.length === 0 && <Empty title="No set has an edge right now" />}
      </div>
    </div>
  );
}

function DecantPanel({ rows, edgeOnly }: { rows: PotionRow[]; edgeOnly: boolean }) {
  const list = edgeOnly ? rows.filter((r) => r.best.perDose > 0) : rows;
  const grid = 'minmax(0,1.6fr) repeat(4, minmax(0,.8fr)) minmax(0,1fr)';
  return (
    <div className="table-scroll">
      <div style={{ minWidth: 520 }}>
        <div className="thead" style={{ ['--cols' as string]: grid, padding: '10px 16px' }}>
          <span className="th" style={{ height: 'auto' }}>Potion</span>
          {[4, 3, 2, 1].map((d) => (
            <span key={d} className="th r" style={{ height: 'auto' }}>
              ({d})
            </span>
          ))}
          <span className="th r" style={{ height: 'auto' }}>Per limit</span>
        </div>
        {list.map((r) => {
          const edge = r.best.perDose > 0;
          return (
            <div key={r.base} className={'decant-row' + (edge ? '' : ' dim')}>
              <div className="decant-grid" style={{ ['--cols' as string]: grid }}>
                <span className="ellipsis strong">{r.base}</span>
                {[4, 3, 2, 1].map((dose) => {
                  const d = r.doses.find((x) => x.dose === dose);
                  if (!d) return <span key={dose} className="cell muted">—</span>;
                  const isBuy = d === r.best.buy;
                  const isSell = d === r.best.sell;
                  return (
                    <span key={dose} className={'cell dose' + (isBuy ? ' buy' : isSell ? ' sell' : '')} title={isBuy ? 'Cheapest per dose: buy this' : isSell ? 'Best to sell' : undefined}>
                      {fmtFull(buyPerDose(d))}
                    </span>
                  );
                })}
                <span className={'cell strong ' + (edge ? 'up' : 'down')}>{signed(r.best.perLimit)}</span>
              </div>
              <div className="panel-sub">
                Buy ({r.best.buy.dose}) at {fmtFull(r.best.buy.low)}, decant, sell ({r.best.sell.dose}) at {fmtFull(r.best.sell.high)} ·{' '}
                {signed(r.best.perDose, (n) => n.toFixed(1))} gp/dose
              </div>
            </div>
          );
        })}
        {list.length === 0 && <Empty title="No decanting edge right now" />}
        <div className="table-foot" style={{ justifyContent: 'flex-start', gap: 16 }}>
          <span className="row" style={{ gap: 6 }}>
            <span className="legend-box buy" />
            Cheapest per dose (buy)
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="legend-box sell" />
            Best to sell
          </span>
        </div>
      </div>
    </div>
  );
}

export function SetsDecantPage() {
  const mobile = useIsMobile();
  const setRows = useSetRows();
  const potionRows = usePotionRows();
  const [edgeOnly, setEdgeOnly] = useState(false);
  const [tab, setTab] = useState<'sets' | 'decant'>('sets');

  const edgeBtn = (
    <button type="button" className="btn" aria-pressed={edgeOnly} onClick={() => setEdgeOnly((v) => !v)}>
      <Icon name={edgeOnly ? 'check' : 'minus'} size={14} strokeWidth={2.4} />
      With an edge only
    </button>
  );

  const setsPanel = (
    <section className="panel table" aria-label="Armour sets">
      <div className="panel-pad" style={{ paddingBottom: 12, gap: 2 }}>
        <h2>Armour sets</h2>
        <span className="panel-sub">Combine or split at a Grand Exchange clerk. Select a row to see its pieces.</span>
      </div>
      <SetsPanel rows={setRows} edgeOnly={edgeOnly} />
    </section>
  );
  const decantPanel = (
    <section className="panel table" aria-label="Potion decanting">
      <div className="panel-pad" style={{ paddingBottom: 12, gap: 2 }}>
        <h2>Potion decanting</h2>
        <span className="panel-sub">Price per dose at each size. Decant for free with Bob Barter at the Grand Exchange.</span>
      </div>
      <DecantPanel rows={potionRows} edgeOnly={edgeOnly} />
    </section>
  );

  if (mobile) {
    return (
      <>
        <MobileBar title="Sets & decanting" />
        <main className="page">
          <MarketError />
          <Segmented
            label="View"
            className="fill on-panel"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'sets', label: 'Armour sets' },
              { value: 'decant', label: 'Decanting' },
            ]}
          />
          {edgeBtn}
          {tab === 'sets' ? setsPanel : decantPanel}
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Sets &amp; decanting</h1>
          <p>Arbitrage between a set and its pieces, and between potion dose sizes. Tax is charged on every item you sell.</p>
        </div>
        {edgeBtn}
      </div>
      <MarketError />
      <div className="two-col">
        {setsPanel}
        {decantPanel}
      </div>
    </main>
  );
}
