import { useMarket } from '../state/market';

/** Shown when the price API can't be reached. */
export function MarketError() {
  const { error, refresh, items } = useMarket();
  if (!error) return null;
  return (
    <div className="notice error" role="alert">
      <span>
        <strong>Couldn’t reach the OSRS Wiki price API.</strong>{' '}
        <span className="muted">{items.length ? 'Showing the last prices we got.' : 'Check your connection and try again.'}</span>
      </span>
      <button type="button" className="btn" onClick={refresh}>
        Try again
      </button>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
