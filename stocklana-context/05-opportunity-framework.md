# Opportunity framework

Do not start by asking “what can we build with stocks?”

Start with:

> What important action involving tokenized stocks is still unsafe, fragmented, manual, opaque or impossible, and what does Solana let us enforce or automate that a normal brokerage cannot?

## Product filters

A candidate should pass all of these:

1. **Real user** — name the person/operator who has the problem.
2. **Painful action** — identify the exact workflow that fails today.
3. **Solana-native advantage** — the solution depends on composability, atomic settlement, programmatic custody, public state or low-cost automation.
4. **Sponsor primitive is essential** — the sponsor integration changes the product's capability, not just the README.
5. **30-second judge clarity** — a judge should understand WHAT, WHY SOLANA and the demo in under 30 seconds.
6. **End-to-end proof** — at least one real or safely simulated lifecycle should complete.
7. **Not a dashboard clone** — visualization alone is not enough unless it directly drives a meaningful action.
8. **Bounded automation** — if agents move value, use permissions, limits, pause/revoke and human recovery paths.
9. **Correct asset semantics** — do not claim ownership/dividend rights that a token does not actually provide.
10. **Post-hackathon use** — there should be a plausible user even after the prize disappears.

## Questions for the next research phase

### User-side gaps

- What do holders struggle to do after acquiring tokenized stocks?
- Which workflows still require hopping between issuer, wallet, DEX, oracle and lending apps?
- What becomes dangerous when the underlying market is closed but the token remains tradable?
- What happens when the token's DEX price diverges sharply from issuer mark/reference price?
- How are corporate actions, halts, splits, redemptions and issuer-specific rules surfaced to DeFi users?
- What happens when a user has equivalent exposure issued by multiple issuers with different rights and liquidity?

### Protocol/operator gaps

- How does a protocol decide which tokenized-stock mint is acceptable collateral?
- How does an app verify freshness, liquidity depth and issuer/reference-price consistency before executing?
- Can a policy be enforced atomically rather than merely displayed as a warning?
- Can an agent operate within a revocable mandate instead of unrestricted wallet control?
- Can a market or vault recover safely when an issuer pauses transfers or a reference feed disappears?

### Bounty-specific gap test

- PreStocks: what can we do with their mark/token/valuation/mint data beyond a screener?
- Tessera: what real workflow becomes possible specifically with T-OpenAI or T-Kalshi?
- Clawpump: what useful business/service can an agent perform that earns or manages stock-linked value, beyond autonomous trading?
- Meteora: what stock-specific market design problem needs a configurable curve, fee schedule, quote token or graduation rule?
- Pyth: what decision becomes safer or possible only when live reference data is enforced in the workflow?

## Strong demo structure

1. Show the real problem state.
2. User/agent attempts the action.
3. Product reads onchain + market/reference data.
4. A program or deterministic policy makes the critical decision.
5. Transaction settles or is blocked for an explainable reason.
6. User can inspect evidence and recover/control the automation.
