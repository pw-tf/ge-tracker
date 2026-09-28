import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchTimeseries, wikiUrl, type Timestep } from '../api/wiki';
import { Field, Segmented } from '../components/Controls';
import { fmtAgeMin } from '../components/FlipList';
import { Icon } from '../components/Icon';
import { ConfidencePill, ItemIcon, scoreBreakdown, scoreColor } from '../components/ItemBits';
import { PriceChart } from '../components/PriceChart';
import { MobileBar } from '../components/Shell';
import { Empty, MarketError } from '../components/Status';
import { useIsMobile, useNow } from '../hooks/useNow';
import { breakEvenSell, flipOf, geTax, NATURE_RUNE_ID, TIER_LABEL } from '../lib/calc';
import { fmtFull, fmtPct, fmtShort, parseGp, signed } from '../lib/format';
import { marginHistory, TAG_INFO } from '../lib/predict';
import { useMarket } from '../state/market';
import { isWatched, toggleWatch, useWatchlist } from '../state/watchlist';
import { useSettings } from '../state/settings';

/** How many points of each timestep to show. */
const WINDOW: Record<Timestep, { n: number; label: string }> = {
  '5m': { n: 144, label: '12 hours, 5-minute averages' },
  '1h': { n: 168, label: '7 days, hourly averages' },
  '6h': { n: 120, label: '30 days, 6-hour averages' },
  '24h': { n: 365, label: '1 year, daily averages' },
};

function Stat({ label, value, sub, color, swatch }: { label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string; swatch?: 'hi' | 'lo' }) {
  return (
    <div className="panel kpi">
      <div className="kpi-label row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        {swatch && <span className={'swatch ' + swatch} style={{ width: 10 }} />}
        {label}
      </div>
      <div className="kpi-value" style={{ fontSize: 20, color }}>
        {value}
      </div>
      {sub && <div className="kpi-sub" style={{ whiteSpace: 'normal' }}>{sub}</div>}
    </div>
  );
}

/** Keyed by id so the calculator and chart state reset when navigating between items. */
export function ItemRoute() {
  const { id } = useParams();
  return <ItemDetailPage key={id} id={Number(id)} />;
}

function ItemDetailPage({ id }: { id: number }) {
  const mobile = useIsMobile();
  const navigate = useNavigate();
  const { byId, loading } = useMarket();
  const { bankroll } = useSettings();
  const watch = useWatchlist();
  const now = useNow(15_000);
  const [step, setStep] = useState<Timestep>('1h');
  const item = byId.get(id);
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  const ts = useQuery({
    queryKey: ['ts', id, step],
    queryFn: ({ signal }) => fetchTimeseries(id, step, signal),
    enabled: Number.isFinite(id),
    staleTime: step === '5m' ? 60_000 : 5 * 60_000,
  });
  const points = useMemo(() => (ts.data ?? []).slice(-WINDOW[step].n), [ts.data, step]);
  // Hourly series for the margin-history check (shared with the chart when step = 1h).
  const hourly = useQuery({
    queryKey: ['ts', id, '1h'],
    queryFn: ({ signal }) => fetchTimeseries(id, '1h', signal),
    enabled: Number.isFinite(id),
    staleTime: 5 * 60_000,
  });
  const exempt = item?.taxExempt ?? false;
  const history = useMemo(() => (hourly.data ? marginHistory(hourly.data, exempt) : null), [hourly.data, exempt]);

  const flip = item ? flipOf(item, { bankroll: parseGp(bankroll), now }) : null;
  const [calc, setCalc] = useState<{ q: string; b: string; s: string } | null>(null);
  const calcVals = calc ?? {
    q: String(flip?.qty || item?.limit || 1),
    b: flip ? fmtFull(flip.buy) : '',
    s: flip ? fmtFull(flip.sell) : '',
  };

  if (!item) {
    return (
      <>
        {mobile && <MobileBar title="Item" left={<BackButton onClick={goBack} />} />}
        <main className="page">
          <MarketError />
          {loading ? <div className="panel skeleton" style={{ height: 200 }} /> : <Empty title="Item not found">That item ID isn’t in the Grand Exchange list.</Empty>}
        </main>
      </>
    );
  }

  const watched = isWatched(watch, item.id);
  const nature = byId.get(NATURE_RUNE_ID)?.high ?? 0;
  const alchProfit = item.highalch != null && item.high != null ? item.highalch - item.high - nature : null;

  const q = parseGp(calcVals.q) ?? 0;
  const b = parseGp(calcVals.b) ?? 0;
  const s = parseGp(calcVals.s) ?? 0;
  const tax = geTax(s, item.taxExempt) * q;
  const net = s * q - tax - b * q;
  const fillMin = item.limit && item.volLow1h > 0 ? (item.limit / item.volLow1h) * 60 : null;
  const highShare = item.vol1h > 0 ? (item.volHigh1h / item.vol1h) * 100 : 50;
  const nowS = Math.floor(Date.now() / 1000);

  const starBtn = (
    <button type="button" className="btn" aria-pressed={watched} onClick={() => toggleWatch(item.id)}>
      <Icon name="star" filled={watched} strokeWidth={1.8} />
      {watched ? 'On watchlist' : 'Add to watchlist'}
    </button>
  );

  const header = (
    <div className="row" style={{ gap: 16, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
      <ItemIcon item={item} large />
      <div className="stack" style={{ gap: 8, flexGrow: 1 }}>
        <div className="row" style={{ gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: mobile ? 24 : 30, fontWeight: 800, letterSpacing: '-0.02em' }}>{item.name}</h1>
          <span className="badge">{item.members ? 'Members' : 'F2P'}</span>
          {flip && (
            <span className="badge gold">
              <span className={'dot small ' + flip.tier} />
              {TIER_LABEL[flip.tier]} tier
            </span>
          )}
          {item.taxExempt && <span className="badge">Tax exempt</span>}
        </div>
        <div className="muted">
          {item.examine} · ID {item.id} · Buy limit {item.limit != null ? fmtFull(item.limit) : 'unknown'} per 4 hours
        </div>
      </div>
      {!mobile && starBtn}
      <a className="btn" href={wikiUrl(item.name)} target="_blank" rel="noreferrer">
        OSRS Wiki
        <Icon name="external" size={14} />
      </a>
    </div>
  );

  const stats = (
    <div className="stat-grid">
      <Stat
        label="Buy at (offer)"
        swatch="lo"
        value={flip ? fmtFull(flip.buy) : '—'}
        sub={item.low != null ? `Last trade ${fmtFull(item.low)}${item.lowTime ? ` · ${fmtAgeMin((nowS - item.lowTime) / 60)} ago` : ''}` : 'No recent trade'}
      />
      <Stat
        label="Sell at (offer)"
        swatch="hi"
        value={flip ? fmtFull(flip.sell) : '—'}
        sub={item.high != null ? `Last trade ${fmtFull(item.high)}${item.highTime ? ` · ${fmtAgeMin((nowS - item.highTime) / 60)} ago` : ''}` : 'No recent trade'}
      />
      <Stat
        label="Margin after tax"
        value={flip ? signed(flip.margin, fmtFull) : '—'}
        color={flip ? (flip.margin > 0 ? 'var(--up)' : 'var(--down)') : undefined}
        sub={flip ? `Tax ${fmtFull(flip.tax)} · last trades ${signed(flip.lastMargin, fmtFull)}` : undefined}
      />
      <Stat label="ROI" value={flip ? fmtPct(flip.roi) : '—'} color={flip ? (flip.margin > 0 ? 'var(--up)' : 'var(--down)') : undefined} sub="per flip cycle" />
      <Stat
        label="Profit per limit"
        value={flip && item.limit != null ? (flip.qty === 0 ? 'Can’t afford' : fmtShort(flip.ppl)) : '—'}
        color="var(--gold)"
        sub={flip && item.limit != null ? `${fmtFull(flip.qty)} × ${fmtFull(flip.margin)} every 4h` : undefined}
      />
      <Stat
        label="Flip score"
        value={
          flip ? (
            <span style={{ color: scoreColor(flip.score.total) }}>
              {flip.score.total}
              <span className="muted" style={{ fontSize: 12 }}> / 100</span>
            </span>
          ) : (
            '—'
          )
        }
        sub={flip ? scoreBreakdown(flip.score).replace(/\/\d+/g, '').replace('Confidence', 'Fill').replace('Volume', 'Vol') : undefined}
      />
    </div>
  );

  const chart = (
    <section className="panel panel-pad" aria-label="Price history">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 20 }}>
          <h2>Price history</h2>
          <div className="legend">
            <span>
              <span className="swatch hi" />
              Instant buy (high)
            </span>
            <span>
              <span className="swatch lo" />
              Instant sell (low)
            </span>
          </div>
        </div>
        <Segmented<Timestep>
          label="Timestep"
          className="mono"
          value={step}
          onChange={setStep}
          options={(['5m', '1h', '6h', '24h'] as Timestep[]).map((v) => ({ value: v, label: v }))}
        />
      </div>
      {ts.isPending ? (
        <div className="skeleton" style={{ height: mobile ? 200 : 300, borderTop: 'none', borderRadius: 8 }} />
      ) : ts.isError ? (
        <div className="notice error">
          Couldn’t load price history.
          <button type="button" className="btn" onClick={() => ts.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <PriceChart
          points={points}
          step={step}
          height={mobile ? 200 : 300}
          exempt={item.taxExempt}
          label={`${item.name} instant buy and sell prices, ${WINDOW[step].label}.`}
        />
      )}
      <div className="panel-sub">{WINDOW[step].label}. {mobile ? 'Tap' : 'Hover'} the chart to inspect a point.</div>
      <div className="avg-table">
        <div className="section-label">Window</div>
        <div className="section-label r">Avg buy</div>
        <div className="section-label r">Avg sell</div>
        <div className="section-label r">Avg margin</div>
        <div className="section-label r">Volume</div>
        {[
          { label: mobile ? '1h' : 'Last hour', hi: item.avgHigh1h, lo: item.avgLow1h, vol: item.vol1h },
          { label: mobile ? '24h' : 'Last 24 hours', hi: item.avgHigh24h, lo: item.avgLow24h, vol: item.vol24h },
        ].map((r) => {
          const m = r.hi != null && r.lo != null ? r.hi - geTax(r.hi, item.taxExempt) - r.lo : null;
          const f = mobile ? fmtShort : fmtFull;
          return (
            <div key={r.label} style={{ display: 'contents' }}>
              <div>{r.label}</div>
              <div className="num r">{r.hi != null ? f(r.hi) : '—'}</div>
              <div className="num r">{r.lo != null ? f(r.lo) : '—'}</div>
              <div className={'num r ' + (m == null ? '' : m > 0 ? 'up' : 'down')}>{m != null ? signed(m, f) : '—'}</div>
              <div className="num r">{f(r.vol)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const fillPanel = flip && (
    <section className="panel panel-pad" aria-label="Will it fill?">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Will it fill?</h2>
        <ConfidencePill c={flip.confidence} />
      </div>
      <ul className="reasons">
        {flip.confidence.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {flip.tags.map((t) => (
        <div key={t} className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <span className={'tag ' + TAG_INFO[t].tone}>{TAG_INFO[t].label}</span>
          <span className="panel-sub">{TAG_INFO[t].tip}</span>
        </div>
      ))}
      <div className="filter-group" style={{ gap: 8 }}>
        <div className="section-label">Margin history · last 24 hours</div>
        {history && history.hours.length > 0 ? (
          <>
            <div className="kv total" style={{ borderTop: 'none', paddingTop: 0 }}>
              <span>Profitable hours</span>
              <span className={history.positive >= history.counted / 2 ? 'up' : 'down'}>
                {history.positive} of {history.counted}
              </span>
            </div>
            <div
              className="hour-strip"
              role="img"
              aria-label={`Hourly after-tax margin: profitable in ${history.positive} of ${history.counted} hours with trades on both sides.`}
            >
              {history.hours.map((h) => (
                <span
                  key={h.timestamp}
                  className={h.margin == null ? 'none' : h.margin > 0 ? 'pos' : 'neg'}
                  title={`${new Date(h.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${
                    h.margin == null ? 'no trades on one side' : signed(h.margin, fmtFull)
                  }`}
                />
              ))}
            </div>
            <div className="row muted" style={{ justifyContent: 'space-between', fontSize: 11 }}>
              <span>24h ago</span>
              <span>Now</span>
            </div>
            <div className="panel-sub">Green: profitable after tax · red: not · dashed: no trades on one side</div>
            <div className="kv">
              <span>Median hourly margin</span>
              <span className={history.median != null && history.median > 0 ? 'up' : 'down'}>{history.median != null ? signed(history.median, fmtFull) : '—'}</span>
            </div>
          </>
        ) : hourly.isPending ? (
          <div className="skeleton" style={{ height: 60, borderTop: 'none', borderRadius: 8 }} />
        ) : (
          <div className="panel-sub">No hourly history for this item.</div>
        )}
      </div>
    </section>
  );

  const side = (
    <div className="stack">
      {!mobile && fillPanel}
      <section className="panel panel-pad" aria-label="Flip calculator">
        <h2>Flip calculator</h2>
        <div className="filter-grid" style={{ gridTemplateColumns: '80px minmax(0,1fr) minmax(0,1fr)' }}>
          <Field id="cq" label="Quantity" inputMode="numeric" value={calcVals.q} onChange={(v) => setCalc({ ...calcVals, q: v })} />
          <Field id="cb" label="Buy at" value={calcVals.b} onChange={(v) => setCalc({ ...calcVals, b: v })} />
          <Field id="cs" label="Sell at" value={calcVals.s} onChange={(v) => setCalc({ ...calcVals, s: v })} />
        </div>
        <div className="kv">
          <span>Total cost</span>
          <span>{fmtFull(b * q)}</span>
        </div>
        <div className="kv">
          <span>Revenue</span>
          <span>{fmtFull(s * q)}</span>
        </div>
        <div className="kv">
          <span>GE tax (2%, max 5M each)</span>
          <span className="down">−{fmtFull(tax)}</span>
        </div>
        <div className="kv total">
          <span>Net profit</span>
          <span className={net >= 0 ? 'up' : 'down'}>{signed(net, fmtFull)}</span>
        </div>
        <div className="kv">
          <span>ROI</span>
          <span className={net >= 0 ? 'up' : 'down'}>{b && q ? fmtPct((net / (b * q)) * 100) : '—'}</span>
        </div>
        <div className="kv">
          <span>Break-even sell price</span>
          <span>{b ? fmtFull(breakEvenSell(b, item.taxExempt)) : '—'}</span>
        </div>
        {calc && (
          <button type="button" className="btn small plain" style={{ alignSelf: 'flex-start' }} onClick={() => setCalc(null)}>
            Reset to live prices
          </button>
        )}
      </section>

      <section className="panel panel-pad" aria-label="Liquidity">
        <h2>Liquidity</h2>
        <div className="kv">
          <span>Trades last hour</span>
          <span>{fmtFull(item.vol1h)}</span>
        </div>
        {item.vol1h > 0 && (
          <>
            <div className="split-bar" aria-hidden="true">
              <div style={{ width: `${highShare}%`, background: 'var(--c-high)' }} />
              <div style={{ flexGrow: 1, background: 'var(--c-low)' }} />
            </div>
            <div className="row muted" style={{ justifyContent: 'space-between', fontSize: 12 }}>
              <span>{fmtFull(item.volHigh1h)} at buy price</span>
              <span>{fmtFull(item.volLow1h)} at sell price</span>
            </div>
          </>
        )}
        <div className="kv">
          <span>Trades last 24h</span>
          <span>{fmtFull(item.vol24h)}</span>
        </div>
        <div className="kv">
          <span title="Buy limit ÷ trades at the sell price in the last hour">Est. time to fill a limit</span>
          <span>{fillMin == null ? '—' : fillMin > 240 ? '> 4h' : `~${Math.max(1, Math.round(fillMin))} min`}</span>
        </div>
      </section>

      {item.highalch != null && (
        <section className="panel panel-pad" aria-label="High alchemy">
          <h2>High alchemy</h2>
          <div className="kv">
            <span>High alch value</span>
            <span>{fmtFull(item.highalch)}</span>
          </div>
          <div className="kv">
            <span>Nature rune</span>
            <span>{fmtFull(nature)}</span>
          </div>
          <div className="kv">
            <span>Profit per cast (instant buy)</span>
            <span className={alchProfit != null && alchProfit > 0 ? 'up' : 'down'}>{alchProfit != null ? signed(alchProfit, fmtFull) : '—'}</span>
          </div>
        </section>
      )}
    </div>
  );

  if (mobile) {
    return (
      <>
        <MobileBar
          title={item.name}
          left={<BackButton onClick={goBack} />}
          right={
            <button
              type="button"
              className="star-btn touch"
              aria-pressed={watched}
              aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
              onClick={() => toggleWatch(item.id)}
            >
              <Icon name="star" size={22} filled={watched} strokeWidth={1.8} />
            </button>
          }
        />
        <main className="page">
          <MarketError />
          {header}
          {stats}
          {fillPanel}
          {chart}
          {side}
        </main>
      </>
    );
  }

  return (
    <main className="page">
      <nav aria-label="Breadcrumb" className="muted" style={{ fontSize: 13, display: 'flex', gap: 8 }}>
        <Link to="/" className="crumb">
          Flips
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text)' }}>{item.name}</span>
      </nav>
      <MarketError />
      {header}
      {stats}
      <div className="with-aside" style={{ gridTemplateColumns: 'minmax(0,1fr) 360px' }}>
        {chart}
        {side}
      </div>
    </main>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="icon-btn ghost" style={{ width: 44, height: 44 }} aria-label="Back" onClick={onClick}>
      <Icon name="chevronLeft" size={22} />
    </button>
  );
}
