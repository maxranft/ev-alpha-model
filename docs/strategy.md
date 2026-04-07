# Strategy: profit vs capital at risk

## What you are optimizing

- **Expected profit per dollar staked** is captured by **EV per $1** (`expectedValuePerDollar`): higher is better **for the same stake**.
- **Staking as little as possible** while still growing wealth is usually handled by **fractional Kelly** (slider in the UI) and **caps** (max stake % of bankroll), not by picking “small EV” bets.

There is a real tradeoff: very small stakes reduce risk but also **cap upside**. The model surfaces **where** edge and friction look best; **how much** to stake stays a risk choice.

## Polymarket vs sports “spread”

On Polymarket, outcomes trade near probabilities in \([0,1]\). There is **no sports handicap spread** in the classic sense. What matters for execution is usually:

- **Bid–ask width** (we store `line.polymarket.bidAskSpread` when Gamma provides `bestBid` / `bestAsk` or a `spread` field).
- **Liquidity** (optional `liquidity` from Gamma).

**Alpha per friction** sorts by roughly `edge / (bid–ask spread + ε)`: more “alpha” per unit of trading friction when the book is tight.

## Where “alpha” comes from

**Alpha = your belief − market-implied probability** (after you map prices to probabilities).

The Polymarket importer sets `model.coverProbability` equal to the **mid** price so **edge is zero** until you supply **your own** probabilities (research model, blend, or manual overrides). Without that, sorting is **liquidity and friction aware**, but not “finding mispricing” in the statistical sense.

## Sort modes (implementation)

| Mode | Intent |
|------|--------|
| `ev` | Highest EV per $1 staked (default). |
| `alpha_per_friction` | Prioritize edge relative to bid–ask width (Polymarket). |
| `capital_efficiency` | `EV / (Kelly fraction + small floor)` — emphasizes strong EV relative to recommended Kelly size. |

## Not advice

This is experimental software. Trading and prediction markets carry risk of loss. Compliance and platform rules are your responsibility.
