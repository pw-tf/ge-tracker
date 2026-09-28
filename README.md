# GE Profit Tracker

An Old School RuneScape Grand Exchange tracker built for making money, not just checking prices. It uses live prices from the [OSRS Wiki real-time prices API](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices).

## What it does

| Page | What you get |
| --- | --- |
| **Flips** | Margin after the 2% GE tax (capped at 5M per item), ROI, profit per buy limit, 1h volume, trade freshness and a 0–100 **Flip score**. Filter by price tier (Low <100k · Medium 100k–10M · High >10M), profit, ROI, volume, trade age, price range, buy limit, cost of a full limit and membership. Presets: *Safe & liquid*, *Big margins*, *Cheap bulk*. Filters live in the URL, so a view can be bookmarked or shared. |
| **Alchs** | High alch profit after the nature rune (live, or your own price), and GP/hr capped by casts per hour or buy limit ÷ 4. Price on instant buy or a patient offer. |
| **Sets & Decant** | Combine or split armour sets, with tax charged on every piece. Find the best potion dose to buy and decant for resale. |
| **Movers** | Top gainers and losers against the 1h or 24h average, and volume spikes, with 24h sparklines. |
| **Item page** | Buy and sell price chart (5m / 1h / 6h / 24h) with hover or tap inspection and volume bars. Also a flip calculator with break-even price, liquidity, and alch value. |
| **Watchlist** | Star any item. Saved in your browser. |

Enter your **cash stack** (e.g. `50m`) and every "profit per limit" is capped to what you can afford. Prices refresh every 60 seconds while the tab is open. Dark and light themes are included, and the layout switches to cards with a bottom tab bar on phones.

### Flip score

| Part | Weight | Full marks at |
| --- | --- | --- |
| ROI | 30 | 5% |
| Profit per limit (log) | 25 | 5M |
| Trades in the last hour (log) | 25 | 20k |
| Freshness of both latest trades | 20 | ≤ 5 min (0 at 60 min) |

Unprofitable items score 0. Hover a score (desktop) to see its breakdown.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for tax, flip, alch, set, decant and score maths
npm run lint     # type-check
npm run build    # static build in dist/
```

Stack: Vite, React, TypeScript, TanStack Query and React Router (hash routing, so the static build works from any path).

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` lints, tests and builds every PR, and deploys `main` to GitHub Pages. Turn it on once under **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Notes

- Buy at the latest *instant-sell* price (low) and sell at the latest *instant-buy* price (high). Real fills vary, so treat margins as a guide.
- Sets are listed in `src/data/sets.ts` by name. A set is skipped if any of its item names isn't found in the Wiki item list.
- Item icons load from the OSRS Wiki. If one fails, a two-letter placeholder is shown instead.
