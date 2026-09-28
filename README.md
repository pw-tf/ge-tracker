# GE Profit Tracker

An Old School RuneScape Grand Exchange tracker built for making money, not just checking prices. It uses live prices from the [OSRS Wiki real-time prices API](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices).

## What it does

| Page | What you get |
| --- | --- |
| **Flips** | Last trades next to realistic **Buy at / Sell at** offers. Margin after the 2% GE tax (capped at 5M per item), ROI, profit per buy limit, 1h volume, **fill confidence**, warning tags and a 0–100 **Flip score**. Filter by price tier (Low <100k · Medium 100k–10M · High >10M), profit, ROI, volume, trade age, price range, buy limit, cost of a full limit and membership. Presets: *Safe & liquid*, *Big margins*, *Cheap bulk*. Filters live in the URL, so a view can be bookmarked or shared. |
| **Alchs** | High alch profit after the nature rune (live, or your own price), and GP/hr capped by casts per hour or buy limit ÷ 4. Price on instant buy or a patient offer. |
| **Sets & Decant** | Combine or split armour sets, with tax charged on every piece. Find the best potion dose to buy and decant for resale. |
| **Movers** | Top gainers and losers against the 1h or 24h average, and volume spikes, with 24h sparklines. |
| **Item page** | Buy and sell price chart (5m / 1h / 6h / 24h) with hover or tap inspection and volume bars. Also a flip calculator with break-even price, liquidity, and alch value. |
| **Watchlist** | Star any item. Saved in your browser. |

Enter your **cash stack** (e.g. `50m`) and every "profit per limit" is capped to what you can afford. Prices refresh every 60 seconds while the tab is open. Dark and light themes are included, and the layout switches to cards with a bottom tab bar on phones.

### Realistic prices & fill confidence

The Wiki's "latest" price is a single trade. One panic sale or one impatient buyer can make a margin look far better than it is. So the tracker shows both:

- **Last trade:** the raw latest buy and sell trades, with their margin and age.
- **Buy at / Sell at:** realistic offers. The buy offer is never below the recent average buy-side price, and the sell offer is never above the recent average sell-side price (5-minute average when the item traded, otherwise 1-hour). **Margin, ROI, profit and the Flip score all use these.**

Every flip also gets:

- **Fill confidence** (High / Medium / Low). Half is liquidity (trades per hour on the quieter side). Half is margin stability (how many of the 5m / 1h / 24h averages were profitable after tax). It's reduced for spikes, stale trades and falling prices. Hover it to see why.
- **Warning tags:**
  - **Spike** or **Dip:** last trade more than 3% away from the 1h average
  - **Falling** or **Rising:** 5m vs 1h trend beyond 1.5%
  - **Thin:** fewer than 5 trades an hour on one side
  - **Stale:** no trade for 30+ minutes
- **Margin history** (item page): how many of the last 24 hours were actually profitable after tax, hour by hour.

### Flip score

| Part | Weight | Full marks at |
| --- | --- | --- |
| ROI | 30 | 5% |
| Profit per limit (log) | 25 | 5M |
| Trades in the last hour (log) | 25 | 20k |
| Fill confidence | 20 | High confidence |

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

`.github/workflows/deploy.yml` lints, tests and builds every push and PR. It publishes the built `dist/` folder to GitHub Pages from the repository's **default branch**.

Set this once: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

> If Source is set to *Deploy from a branch*, Pages serves the unbuilt source files. The page is then blank, with `main.tsx 404` in the console. Switch Source to **GitHub Actions** and re-run the workflow (Actions → CI & Pages → Run workflow).

## Notes

- Buy at the latest *instant-sell* price (low) and sell at the latest *instant-buy* price (high). Real fills vary, so treat margins as a guide.
- Sets are listed in `src/data/sets.ts` by name. A set is skipped if any of its item names isn't found in the Wiki item list.
- Item icons load from the OSRS Wiki. If one fails, a two-letter placeholder is shown instead.
