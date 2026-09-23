# Codex Research Brief

You are working on the Stocklana hackathon research phase.

## Current stage
Do not implement product code yet.

Read every file in `stocklana-context/` before proposing architecture or writing code.

## Goal
Find a high-value, defensible Stocklana product wedge for the $100K main track that can also naturally qualify for one funded sponsor bounty when useful.

## Constraints
- Product must solve a real user problem.
- Product must be explainable to judges in about 30 seconds.
- Product should be a working end-to-end product, not a dashboard-only demo.
- Sponsor integrations must be essential to the mechanism.
- Avoid generic AI wrappers.
- Avoid copying a visible Stocklana project.
- Prefer bounded, reversible or explicitly user-approved financial automation.
- Keep trust boundaries and issuer differences explicit.
- Do not imply that all tokenized representations of the same company are legally or economically identical.

## Crowded ideas
Treat these as occupied unless a new mechanism is materially different:
- stock analytics dashboard
- premium/discount tracker
- DCA
- baskets/indexes
- simple lending against tokenized stocks
- simple yield vault
- generic robo-adviser
- generic AI stock agent
- ordinary DBC launch/configuration UI
- corporate-action display alone
- simple after-hours price arbitrage

## Current research priorities
1. Corporate-action-aware execution guard
2. Programmable stock-backed payment/drawdown
3. Cross-issuer execution policy or migration
4. PreStocks lifecycle automation

## Required output before coding
Create `stocklana-context/09-candidate-validation.md` containing, for each candidate:
- exact user
- exact problem
- current workaround
- closest competitors
- evidence that the gap still exists
- required sponsor APIs/protocols
- exact onchain action
- why Solana is necessary
- 30-second demo flow
- technical feasibility
- external API/key requirements
- mainnet/devnet requirements
- security/trust boundaries
- what makes it a product rather than a demo
- reasons to reject the candidate

Then create `stocklana-context/10-selected-wedge.md` only after comparing the candidates. Do not choose based on novelty alone. Choose based on real problem, sponsor-native mechanism, feasibility, demo strength and competitive differentiation.
