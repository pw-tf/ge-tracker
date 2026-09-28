import type { Flip } from '../lib/calc';
import type { FlipSortKey } from '../lib/filters';
import { fmtFull, fmtPct, fmtShort, signed } from '../lib/format';
import { ConfidencePill, ItemIcon, ItemName, ScoreBar, ScoreChip, StarButton, TagList, TierDot } from './ItemBits';
import { TIER_LABEL } from '../lib/calc';

const COLS: { key: FlipSortKey; label: string; right: boolean; title?: string }[] = [
  { key: 'name', label: 'Item', right: false },
  { key: 'last', label: 'Last trade', right: true, title: 'The two most recent trades (buy / sell) and their margin. Often a spike: see Buy at / Sell at' },
  { key: 'buy', label: 'Buy at', right: true, title: 'Realistic buy offer: the last buy-side trade, but not below the recent average' },
  { key: 'sell', label: 'Sell at', right: true, title: 'Realistic sell offer: the last sell-side trade, but not above the recent average' },
  { key: 'margin', label: 'Margin', right: true, title: 'Sell at − 2% GE tax − Buy at' },
  { key: 'roi', label: 'ROI', right: true },
  { key: 'ppl', label: 'Per limit', right: true, title: 'Margin × buy limit (per 4h), capped by your cash stack' },
  { key: 'vol', label: 'Vol 1h', right: true, title: 'Trades in the last hour' },
  { key: 'conf', label: 'Fill', right: true, title: 'Fill confidence: liquidity, margin stability, spikes and trend' },
  { key: 'score', label: 'Flip score', right: true, title: 'ROI, profit, volume and fill confidence combined (0–100)' },
];

const GRID =
  '28px minmax(210px,2.3fr) minmax(0,1.05fr) minmax(0,1.05fr) minmax(0,1.05fr) minmax(0,.9fr) minmax(0,.7fr) minmax(0,1fr) minmax(0,.7fr) 88px 84px';
const MIN_W = '1040px';

function pplCell(f: Flip) {
  if (f.item.limit == null) return { main: '—', sub: 'limit unknown', dim: true };
  if (f.qty === 0) return { main: 'Can’t afford', sub: `needs ${fmtShort(f.buy)}`, dim: true };
  return { main: fmtShort(f.ppl), sub: f.qty < f.item.limit ? `capped ×${fmtShort(f.qty)}` : `×${fmtShort(f.qty)}`, dim: false };
}

export function FlipTable({
  flips,
  sort,
  dir,
  onSort,
  loading = false,
  footer,
}: {
  flips: Flip[];
  sort: FlipSortKey;
  dir: 'asc' | 'desc';
  onSort: (key: FlipSortKey) => void;
  loading?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div className="panel table">
      <div className="table-scroll">
        <div role="table" aria-label="Margin flips" aria-rowcount={flips.length}>
          <div className="thead" role="row" style={{ ['--cols' as string]: GRID, ['--min-w' as string]: MIN_W }}>
            <span role="columnheader" className="th">
              <span className="sr-only">Watch</span>
            </span>
            {COLS.map((c) => {
              const on = sort === c.key;
              return (
                <div key={c.key} role="columnheader" aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={c.right ? 'r' : ''} style={{ display: 'flex' }}>
                  <button type="button" className={'th' + (on ? ' active' : '')} title={c.title} onClick={() => onSort(c.key)}>
                    {c.label}
                    {on && <span className="arrow">{dir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </div>
              );
            })}
          </div>
          {loading && flips.length === 0 && Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" />)}
          {flips.map((f) => {
            const p = pplCell(f);
            const up = f.margin > 0;
            return (
              <div key={f.item.id} className="trow" role="row" style={{ ['--cols' as string]: GRID, ['--min-w' as string]: MIN_W }}>
                <span role="cell">
                  <StarButton item={f.item} />
                </span>
                <div role="cell" style={{ minWidth: 0 }}>
                  <div className="item-cell">
                    <ItemIcon item={f.item} />
                    <div className="meta">
                      <ItemName item={f.item} />
                      <div className="item-sub">
                        <TierDot tier={f.tier} />
                        {TIER_LABEL[f.tier]} · {f.item.members ? 'Mem' : 'F2P'}
                        <TagList tags={f.tags} />
                      </div>
                    </div>
                  </div>
                </div>
                <div role="cell" className="last-cell" title={`Last trades ${fmtAgeMin(f.ageMin)} ago`}>
                  <span>
                    {fmtShort(f.lastBuy)} / {fmtShort(f.lastSell)}
                  </span>
                  <span className={f.lastMargin > 0 ? 'up' : 'down'} style={{ opacity: 0.85 }}>
                    {signed(f.lastMargin)} · {fmtAgeMin(f.ageMin)}
                  </span>
                </div>
                <div role="cell" className="cell strong">{fmtFull(f.buy)}</div>
                <div role="cell" className="cell strong">{fmtFull(f.sell)}</div>
                <div role="cell" className={'cell strong ' + (up ? 'up' : 'down')}>{signed(f.margin)}</div>
                <div role="cell" className={'cell ' + (up ? 'up' : 'down')}>{fmtPct(f.roi)}</div>
                <div role="cell" className="cell">
                  <span className="strong" style={{ color: p.dim ? 'var(--muted)' : undefined }}>{p.main}</span>
                  <small>{p.sub}</small>
                </div>
                <div role="cell" className="cell">{fmtShort(f.item.vol1h)}</div>
                <div role="cell" className="cell">
                  <ConfidencePill c={f.confidence} compact />
                </div>
                <div role="cell">
                  <ScoreBar score={f.score} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {footer}
    </div>
  );
}

export function fmtAgeMin(m: number): string {
  if (m < 1) return '<1m';
  if (m < 60) return Math.floor(m) + 'm';
  if (m < 1440) return Math.floor(m / 60) + 'h';
  return Math.floor(m / 1440) + 'd';
}

export function FlipCard({ f }: { f: Flip }) {
  const p = pplCell(f);
  const up = f.margin > 0;
  return (
    <article className="card">
      <div className="card-top">
        <ItemIcon item={f.item} />
        <div className="meta">
          <ItemName item={f.item} />
          <span className="item-sub">
            <TierDot tier={f.tier} />
            {TIER_LABEL[f.tier]} · {f.item.members ? 'Members' : 'F2P'} · {fmtAgeMin(f.ageMin)} ago
          </span>
        </div>
        <ScoreChip score={f.score} />
        <StarButton item={f.item} touch />
      </div>
      <div className="card-tags">
        <ConfidencePill c={f.confidence} />
        <TagList tags={f.tags} />
      </div>
      <div className="card-stats">
        <div>
          <span className="k">Buy at</span>
          <span className="v">{fmtShort(f.buy)}</span>
        </div>
        <div>
          <span className="k">Sell at</span>
          <span className="v">{fmtShort(f.sell)}</span>
        </div>
        <div>
          <span className="k">Margin · ROI</span>
          <span className={'v ' + (up ? 'up' : 'down')} style={{ fontWeight: 700 }}>
            {signed(f.margin)} <span style={{ fontSize: 11, fontWeight: 500 }}>{fmtPct(f.roi, 1)}</span>
          </span>
        </div>
      </div>
      <div className="card-foot">
        <span title="Last trades (buy / sell)">
          Last {fmtShort(f.lastBuy)}/{fmtShort(f.lastSell)}
        </span>
        <span>Vol {fmtShort(f.item.vol1h)}/h</span>
        <span className="strong" style={{ color: p.dim ? 'var(--muted)' : 'var(--gold)' }}>
          {p.main}
          {p.dim ? '' : ' / limit'}
        </span>
      </div>
    </article>
  );
}
