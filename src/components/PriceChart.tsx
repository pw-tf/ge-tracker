import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimeseriesPoint, Timestep } from '../api/wiki';
import { afterTax } from '../lib/calc';
import { fmtFull, fmtShort, signed } from '../lib/format';

const AXIS_W = 60;
const PAD_TOP = 12;
const VOL_H = 64;
const GAP = 28;

function fmtTime(ts: number, step: Timestep): string {
  const d = new Date(ts * 1000);
  if (step === '5m' || step === '1h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fmtTipTime(ts: number, step: Timestep): string {
  const d = new Date(ts * 1000);
  return step === '24h'
    ? d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Line path that breaks at missing values instead of drawing through them. */
function linePath(vals: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = '';
  let pen = false;
  vals.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    pen = true;
  });
  return d;
}

export function PriceChart({
  points,
  step,
  height = 300,
  exempt = false,
  label,
}: {
  points: TimeseriesPoint[];
  step: Timestep;
  height?: number;
  exempt?: boolean;
  label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = width - AXIS_W;
  const priceBottom = height - PAD_TOP;
  const n = points.length;

  const geo = useMemo(() => {
    const vals = points.flatMap((p) => [p.avgHighPrice, p.avgLowPrice]).filter((v): v is number => v != null);
    if (!vals.length) return null;
    let hi = Math.max(...vals);
    let lo = Math.min(...vals);
    const pad = (hi - lo) * 0.08 || hi * 0.01 || 1;
    hi += pad;
    lo -= pad;
    const x = (i: number) => (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
    const y = (v: number) => PAD_TOP + ((hi - v) / (hi - lo)) * (priceBottom - PAD_TOP);
    const highs = points.map((p) => p.avgHighPrice);
    const lows = points.map((p) => p.avgLowPrice);
    const vmax = Math.max(1, ...points.map((p) => p.highPriceVolume + p.lowPriceVolume));
    const bw = Math.max(1, plotW / n - 2);
    const vol = points
      .map((p, i) => {
        const h = Math.max(1, ((p.highPriceVolume + p.lowPriceVolume) / vmax) * (VOL_H - 4));
        const bx = (i * plotW) / n + 1;
        return `M${bx.toFixed(1)} ${VOL_H} V${(VOL_H - h).toFixed(1)} H${(bx + bw).toFixed(1)} V${VOL_H} Z`;
      })
      .join(' ');
    const ticks = [0, 1 / 3, 2 / 3, 1].map((f) => ({ y: PAD_TOP + f * (priceBottom - PAD_TOP), label: fmtShort(hi - (hi - lo) * f) }));
    const fracs = plotW < 420 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
    const xTicks = n > 1 ? fracs.map((f) => Math.round(f * (n - 1))) : [0];
    return { x, y, high: linePath(highs, x, y), low: linePath(lows, x, y), vol, vmax, ticks, xTicks };
  }, [points, plotW, priceBottom, n]);

  if (!geo) {
    return (
      <div ref={wrap} className="empty" style={{ height }}>
        No trades in this window.
      </div>
    );
  }

  const onMove = (clientX: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    const rel = Math.min(Math.max(clientX - r.left, 0), plotW);
    setHover(Math.round((rel / plotW) * (n - 1)));
  };

  const hp = hover != null ? points[hover] : null;
  const hx = hover != null ? geo.x(hover) : 0;
  const margin = hp && hp.avgHighPrice != null && hp.avgLowPrice != null ? afterTax(hp.avgHighPrice, exempt) - hp.avgLowPrice : null;

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div
        ref={wrap}
        className="chart"
        style={{ height }}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
      >
        <svg width={width} height={height} role="img" aria-label={label}>
          {geo.ticks.map((t, i) => (
            <g key={i}>
              <line x1={0} x2={plotW} y1={t.y} y2={t.y} stroke={i === geo.ticks.length - 1 ? 'var(--line2)' : 'var(--grid)'} />
              <text x={plotW + 8} y={t.y + 4} fontSize={11} fill="var(--muted)" fontFamily="var(--font-num)">
                {t.label}
              </text>
            </g>
          ))}
          <path d={geo.low} fill="none" stroke="var(--c-low)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={geo.high} fill="none" stroke="var(--c-high)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hp && (
            <g>
              <line x1={hx} x2={hx} y1={PAD_TOP} y2={priceBottom} stroke="var(--line2)" />
              {hp.avgHighPrice != null && <circle cx={hx} cy={geo.y(hp.avgHighPrice)} r={5} fill="var(--c-high)" stroke="var(--panel)" strokeWidth={2} />}
              {hp.avgLowPrice != null && <circle cx={hx} cy={geo.y(hp.avgLowPrice)} r={5} fill="var(--c-low)" stroke="var(--panel)" strokeWidth={2} />}
            </g>
          )}
        </svg>
        {hp && (
          <div className="chart-tip" style={{ left: hx > plotW * 0.6 ? Math.max(0, hx - 216) : hx + 16 }}>
            <div className="muted">{fmtTipTime(hp.timestamp, step)}</div>
            <div className="row2">
              <span className="row" style={{ gap: 6 }}>
                <span className="swatch hi" />
                Buy (high)
              </span>
              <span className="num">{hp.avgHighPrice != null ? fmtFull(hp.avgHighPrice) : '—'}</span>
            </div>
            <div className="row2">
              <span className="row" style={{ gap: 6 }}>
                <span className="swatch lo" />
                Sell (low)
              </span>
              <span className="num">{hp.avgLowPrice != null ? fmtFull(hp.avgLowPrice) : '—'}</span>
            </div>
            <div className="row2 muted">
              <span>Margin after tax</span>
              <span className={'num ' + (margin == null ? '' : margin > 0 ? 'up' : 'down')}>{margin != null ? signed(margin, fmtFull) : '—'}</span>
            </div>
            <div className="row2 muted">
              <span>Volume</span>
              <span className="num">{fmtFull(hp.highPriceVolume + hp.lowPriceVolume)}</span>
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop: GAP - 6 }}>
        <div className="row" style={{ justifyContent: 'space-between', width: plotW, fontSize: 12 }}>
          <span className="muted">Volume</span>
          <span className="num muted">peak {fmtFull(geo.vmax)}</span>
        </div>
        <svg width={width} height={VOL_H} aria-hidden="true" style={{ display: 'block' }}>
          <path d={geo.vol} fill="var(--muted)" opacity={0.45} />
          {hover != null && <rect x={(hover * plotW) / n} y={0} width={Math.max(1, plotW / n)} height={VOL_H} fill="var(--gold)" opacity={0.15} />}
          <line x1={0} x2={plotW} y1={VOL_H} y2={VOL_H} stroke="var(--line2)" />
        </svg>
        <div className="num muted" style={{ position: 'relative', width: plotW, height: 16, fontSize: 11, marginTop: 4 }}>
          {geo.xTicks.map((i, k) => (
            <span
              key={k}
              style={{
                position: 'absolute',
                left: geo.x(i),
                transform: k === 0 ? 'none' : k === geo.xTicks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              {fmtTime(points[i].timestamp, step)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
