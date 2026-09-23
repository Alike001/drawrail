# Hackathon and track map

## Main track

Prize pool: $100,000.

The organizers explicitly mention five product areas:

- Trading: 24/7 venues, order books, stock/stablecoin swaps.
- Investing: recurring buys, baskets, robo portfolios.
- Credit and yield: borrowing against stocks, dividends, structured products.
- Infrastructure: price feeds, corporate actions, compliance, analytics.
- Consumer: mobile investing, social trading, spending from a portfolio.

Judging is product-oriented. The hackathon asks whether this could be a real app people would use. Judges look for a real user/problem, a working end-to-end demo, a reason the product belongs on Solana, and execution quality.

The instruction “pick one wedge and make it excellent” is important. Sponsor stacking should not turn the product into a collection of unrelated integrations.

## PreStocks bounty — $10,000

Requirement: build using PreStocks tokenized pre-IPO stocks.

Hard exclusion: integrating any non-PreStocks pre-IPO token makes the project ineligible for this bounty.

The bounty is broad: discovery, research, analysis, social, AI agents, lending, collateral, derivatives, structured products, automations, launchpads and more are all allowed.

Current public API exposes PreStocks products such as Anduril, Anthropic, Figure AI, Kalshi, Neuralink, OpenAI, Polymarket and SpaceX, with fields including mark price, token price, implied valuation, mark valuation, supply and mint address.

## Tessera bounty — $6,000

Requirement in the Stocklana page: create a product/use case with OpenAI or Kalshi T-Tokens.

The public token endpoint currently also exposes T-SpaceX, but the bounty wording specifically names OpenAI and Kalshi, so a submission should make one of those required assets central unless the sponsor clarifies otherwise.

## Clawpump bounty — $5,000

Theme: tokenized stock agents that can access traditional-market/RWA exposure.

Hard requirement: launch the agent token with a stock-paired liquidity pool using Clawpump and Meteora.

Clawpump's public platform provides agents with wallets, skills, automations, market tools and token-launch capabilities. Its API also exposes custom launch pairs.

## Meteora bounty — $5,000

Requirement: use Meteora Dynamic Bonding Curve in a way that makes sense for tokenized stocks rather than simply copying memecoin launch mechanics.

Judging emphasizes:

- originality of the DBC configuration/use case;
- technical soundness;
- life after the hackathon;
- working mainnet code over slides.

The design space includes stock-aware price discovery, fee schedules, quote assets, graduation thresholds, migration to DAMM v2 and tooling for issuers/operators.

## Pyth bounty — non-cash prize

Prize: 3 months of Pyth Pro access.

Requirement: live financial data must do real work in the application.

The hackathon gives examples of both underlying-equity feeds and tokenized-stock feeds, which creates room for tracking error, reference-price enforcement, risk controls, baskets, lending and execution logic.

## Deadline and submission

- Submissions close: Friday 2026-09-25 at 4:00 PM ET.
- Judging runs through 2026-10-02.
- One submission per team.
- Include at least one of GitHub, live demo or video.
- Original work is required. Open-source components are allowed if disclosed.
