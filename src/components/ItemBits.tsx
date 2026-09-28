import { useState } from 'react';
import { Link } from 'react-router';
import { iconUrl } from '../api/wiki';
import { TIER_LABEL, type Tier } from '../lib/calc';
import { monogram } from '../lib/format';
import { CONF_LABEL, TAG_INFO, type Confidence, type Tag } from '../lib/predict';
import type { ScoreParts } from '../lib/score';
import type { Item } from '../lib/types';
import { isWatched, toggleWatch, useWatchlist } from '../state/watchlist';
import { Icon } from './Icon';

export function ItemIcon({ item, large = false }: { item: Pick<Item, 'name' | 'icon'>; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={'item-icon' + (large ? ' lg' : '')} aria-hidden="true">
      {failed || !item.icon ? (
        monogram(item.name)
      ) : (
        <img src={iconUrl(item.icon)} alt="" loading="lazy" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

export function ItemName({ item }: { item: Pick<Item, 'id' | 'name'> }) {
  return (
    <Link className="item-link" to={`/item/${item.id}`}>
      {item.name}
    </Link>
  );
}

export function TierDot({ tier }: { tier: Tier | 'all' }) {
  return <span className={`dot small ${tier}`} />;
}

export function ItemCell({ item, tier, extra }: { item: Item; tier?: Tier; extra?: string }) {
  return (
    <div className="item-cell">
      <ItemIcon item={item} />
      <div className="meta">
        <ItemName item={item} />
        <div className="item-sub">
          {tier && (
            <>
              <TierDot tier={tier} />
              {TIER_LABEL[tier]} ·{' '}
            </>
          )}
          {item.members ? 'Members' : 'F2P'}
          {extra ? ` · ${extra}` : ''}
        </div>
      </div>
    </div>
  );
}

export function StarButton({ item, touch = false }: { item: Pick<Item, 'id' | 'name'>; touch?: boolean }) {
  const ids = useWatchlist();
  const on = isWatched(ids, item.id);
  return (
    <button
      type="button"
      className={'star-btn' + (touch ? ' touch' : '')}
      aria-pressed={on}
      aria-label={on ? `Remove ${item.name} from watchlist` : `Add ${item.name} to watchlist`}
      onClick={() => toggleWatch(item.id)}
    >
      <Icon name="star" size={touch ? 20 : 16} filled={on} strokeWidth={1.8} />
    </button>
  );
}

export function scoreColor(total: number): string {
  return total >= 70 ? 'var(--up)' : total >= 40 ? 'var(--gold)' : 'var(--muted)';
}

export function scoreBreakdown(s: ScoreParts): string {
  const r = (n: number) => Math.round(n);
  return `ROI ${r(s.roi)}/30 · Profit ${r(s.profit)}/25 · Volume ${r(s.volume)}/25 · Confidence ${r(s.confidence)}/20`;
}

export function ScoreBar({ score }: { score: ScoreParts }) {
  const c = scoreColor(score.total);
  return (
    <div className="score" title={scoreBreakdown(score)} aria-label={`Flip score ${score.total}. ${scoreBreakdown(score)}`}>
      <div className="score-bar">
        <div style={{ width: `${score.total}%`, background: c }} />
      </div>
      <span className="score-num" style={{ color: c }}>
        {score.total}
      </span>
    </div>
  );
}

export function ScoreChip({ score }: { score: ScoreParts }) {
  return (
    <div className="score-chip" title={scoreBreakdown(score)} aria-label={`Flip score ${score.total}. ${scoreBreakdown(score)}`}>
      <span className="score-num" style={{ color: scoreColor(score.total) }}>
        {score.total}
      </span>
      <span>score</span>
    </div>
  );
}

const CONF_CLASS = { high: 'up', med: 'gold', low: 'neutral' } as const;

/** High / Medium / Low fill confidence, with its reasons on hover. */
export function ConfidencePill({ c, compact = false }: { c: Confidence; compact?: boolean }) {
  const text = compact ? CONF_LABEL[c.level] : `${CONF_LABEL[c.level]} fill`;
  return (
    <span className={'pill conf ' + CONF_CLASS[c.level]} title={c.reasons.join(' · ')} aria-label={`Fill confidence ${CONF_LABEL[c.level]}. ${c.reasons.join('. ')}`}>
      <span className={'conf-bars ' + c.level} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {text}
    </span>
  );
}

/** Warning tags such as Spike, Falling or Thin. */
export function TagList({ tags }: { tags: Tag[] }) {
  if (!tags.length) return null;
  return (
    <span className="tags">
      {tags.map((t) => (
        <span key={t} className={'tag ' + TAG_INFO[t].tone} title={TAG_INFO[t].tip}>
          {TAG_INFO[t].label}
        </span>
      ))}
    </span>
  );
}
