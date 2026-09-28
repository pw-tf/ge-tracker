import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useNow } from '../hooks/useNow';
import { fmtAge, fmtShort } from '../lib/format';
import { useMarket } from '../state/market';
import { updateSettings, useSettings } from '../state/settings';
import { Icon, type IconName } from './Icon';
import { ItemIcon } from './ItemBits';

export const NAV: { to: string; label: string; short: string; icon: IconName }[] = [
  { to: '/', label: 'Flips', short: 'Flips', icon: 'flips' },
  { to: '/alchs', label: 'Alchs', short: 'Alchs', icon: 'flame' },
  { to: '/sets', label: 'Sets & Decant', short: 'Sets', icon: 'layers' },
  { to: '/movers', label: 'Movers', short: 'Movers', icon: 'trendUp' },
  { to: '/watchlist', label: 'Watchlist', short: 'Watchlist', icon: 'star' },
];

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="GE Profit Tracker home">
      <span className="brand-mark">GE</span>
      <span className="brand-name">
        Profit<span>Tracker</span>
      </span>
    </Link>
  );
}

export function LiveStatus({ compact = false }: { compact?: boolean }) {
  const { updatedAt, fetching, error } = useMarket();
  const now = useNow(1000);
  const age = updatedAt ? now - Math.floor(updatedAt / 1000) : Infinity;
  const stale = !!error || age > 180;
  const text = error && !updatedAt ? 'Offline' : updatedAt ? `${stale ? 'Stale' : 'Live'} · updated ${fmtAge(age)} ago` : 'Connecting…';
  return (
    <div className="live" role="status" aria-live="off" title={error ? error.message : undefined}>
      <span className={'live-dot' + (stale ? ' stale' : '') + (fetching ? ' busy' : '')} />
      <span className={compact ? '' : 'live-text'}>{compact ? (updatedAt ? fmtAge(age) : '…') : text}</span>
    </div>
  );
}

export function RefreshButton({ touch = false }: { touch?: boolean }) {
  const { refresh, fetching } = useMarket();
  return (
    <button type="button" className={'icon-btn' + (touch ? ' ghost' : '')} aria-label="Refresh prices" onClick={refresh} disabled={fetching}>
      <Icon name="refresh" size={touch ? 18 : 16} />
    </button>
  );
}

export function ThemeToggle() {
  const { theme } = useSettings();
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
    >
      <Icon name={theme === 'dark' ? 'moon' : 'sun'} />
    </button>
  );
}

export function BankrollInput({ id = 'bankroll' }: { id?: string }) {
  const { bankroll } = useSettings();
  return (
    <div className="bankroll">
      <label htmlFor={id}>Cash stack</label>
      <div className="field-wrap">
        <input
          id={id}
          className="field"
          inputMode="decimal"
          autoComplete="off"
          placeholder="optional"
          value={bankroll}
          onChange={(e) => updateSettings({ bankroll: e.target.value })}
          title="Caps quantities to what you can afford, e.g. 50m"
        />
        <span className="unit">gp</span>
      </div>
    </div>
  );
}

/** Jump-to-item search with a small suggestion list. */
export function SearchBox() {
  const { items } = useMarket();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const starts = items.filter((i) => i.name.toLowerCase().startsWith(s));
    const contains = items.filter((i) => !i.name.toLowerCase().startsWith(s) && i.name.toLowerCase().includes(s));
    return [...starts, ...contains].slice(0, 8);
  }, [q, items]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (id: number) => {
    setOpen(false);
    setQ('');
    navigate(`/item/${id}`);
  };

  return (
    <div className="header-search" ref={wrap}>
      <label htmlFor="global-search" className="sr-only">
        Search items
      </label>
      <span className="field-icon">
        <Icon name="search" />
      </span>
      <input
        id="global-search"
        className="field text with-icon"
        placeholder={items.length ? `Search ${items.length.toLocaleString('en-US')} items` : 'Search items'}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && matches[active]) {
            go(matches[active].id);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 && (
        <ul id={listId} role="listbox" className="panel suggest">
          {matches.map((m, i) => (
            <li
              key={m.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(m.id);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <ItemIcon item={m} />
              <span className="ellipsis" style={{ flexGrow: 1 }}>
                {m.name}
              </span>
              <span className="num muted">{m.high != null ? fmtShort(m.high) : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DesktopHeader() {
  return (
    <header className="app-header">
      <Brand />
      <nav className="main-nav" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <SearchBox />
      <div className="header-tools">
        <BankrollInput />
        <LiveStatus />
        <RefreshButton />
        <ThemeToggle />
      </div>
    </header>
  );
}

export function MobileBar({ title, left, right }: { title: string; left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="mobile-bar">
      {left ?? <span className="brand-mark">GE</span>}
      <h1>{title}</h1>
      {right}
      <LiveStatus compact />
      <RefreshButton touch />
      <ThemeToggle />
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              <Icon name={n.icon} size={22} filled={n.icon === 'star' && isActive} />
              {n.short}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
