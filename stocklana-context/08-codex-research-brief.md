# Codex Research Brief — Revised After Second Research Pass

You are working on the Stocklana hackathon research phase.

## Current stage
Do not implement product code yet.

Read every file in `stocklana-context/` before proposing architecture or writing code, including:
- `09-claude-opportunity-map-raw.md`
- `10-merged-opportunity-update.md`

The merged update contains corrections that override older rankings when they conflict.

## Goal
Find a high-value, defensible Stocklana product wedge for the $100K main track. A sponsor bounty is useful only when its integration is essential to the product.

## Hard constraints
- Solve a real named user's problem.
- Explain the product and demo in about 30 seconds.
- Produce an end-to-end product, not a dashboard-only demo.
- Prefer a real mainnet action over a mocked "future integration".
- Sponsor data must change a financial decision or transaction when used.
- Avoid generic AI wrappers.
- Avoid copying visible Stocklana entries.
- Prefer bounded, reversible or explicitly user-approved financial automation.
- Preserve the distinction between raw Token-2022 amounts and Scaled UI Amount for xStocks.
- Preserve issuer/legal/economic distinctions between different tokenized representations of the same company.
- Never assume a README claim is true if primary docs or code can verify it.

## Known occupied/crowded wedges
Treat these as occupied unless the mechanism is materially different:
- stock analytics dashboards
- premium/discount trackers
- DCA
- baskets/indexes
- generic lending against stocks
- generic auto-deleverage/stop-loss for Kamino obligations
- simple yield vaults
- generic robo advisers
- generic AI stock agents
- natural-language buy/sell rule engines
- ordinary Meteora DBC configuration UIs
- corporate-action display/multiplier tracker alone
- simple after-hours gap radar/price arbitrage
- generic QR stock-spending demo without a real xStock liquidation route

## Candidates to validate
A. Policy-preserving portfolio drawdown/spending
B. Corporate-action-aware transaction firewall
C. Cross-issuer equity execution policy/router
D. Correct tokenized-stock portfolio ledger/accounting
E. PreStocks exit/redemption router

Treat Jupiter tokenized-equity perp basis/carry as a lower-priority exploratory candidate only if the official integration surface is immediately usable.

## Phase 1: blocker tests first
Before broad competitor research, answer these with primary docs/code or live read-only API tests where possible:

1. Jupiter mainnet execution
   - Pick 2-3 liquid xStocks such as AAPLx/NVDAx/TSLAx.
   - Verify current mint addresses from an official/current source.
   - Determine whether a real xStock -> USDC route exists now.
   - Determine which Jupiter API should be used in September 2026.
   - Determine whether swap output can settle directly to a recipient token account, or whether swap + USDC transfer must be composed manually.
   - Do not send a transaction or spend funds in this research phase.

2. Pyth access
   - Obtain/document the exact steps for a self-serve trial key.
   - Verify whether a trial key can read at least one required pair of `Equity.US.*` and `Crypto.*X` feeds.
   - Verify feed freshness/session fields needed to distinguish a fresh print from a carried-forward price.
   - Do not assume Hermes is equivalent to Pyth Pro.

3. xStocks corporate-action safety
   - Verify how to read the current/pending multiplier and activation timestamp.
   - Verify raw amount vs Scaled UI Amount conversion needed to build transactions.
   - Verify the documented pause-window recommendation around multiplier activation.

4. Kamino duplication check
   - Inspect the official `Kamino-Finance/klend-sdk` obligation-order implementation.
   - State exactly what existing stop-loss/take-profit/LTV functionality already does.
   - Determine whether there is any stock-specific risk condition our Candidate B would add that Kamino does not already enforce.
   - Generic auto-repay is not a candidate.

5. Competitor reality check
   Inspect actual code/readmes for at least:
   - `himanshu-rawat77/xspend`
   - `Vibeaman/StockPilot`
   - `GODGRACE07/multiplier`
   - `angelraph/gapguard`
   - one strong cross-issuer/discovery product if found
   Record what is live, what is simulated and what is missing.

## Phase 2: candidate validation
Create `stocklana-context/11-candidate-validation.md`.

For each A-E candidate include:
- exact user
- exact painful workflow
- current workaround
- closest public competitors
- what those competitors actually execute vs simulate
- evidence the gap still exists
- exact product mechanism
- required APIs/protocols
- exact on-chain action
- how Pyth or another sponsor changes the action, if applicable
- why Solana is necessary
- 30-second judge demo
- mainnet feasibility
- API/key requirements
- security/trust boundaries
- failure/recovery path
- what makes it a product rather than a demo
- top three reasons to reject it

Do not use a numeric score as a substitute for reasoning. A short comparison table at the end is fine.

## Stop point
Do NOT write product code.
Do NOT create a selected architecture yet.
Do NOT choose a final winner solely on your own.

Finish after `11-candidate-validation.md` and print a concise terminal summary of:
- blockers found
- candidates eliminated
- candidates still viable
- strongest unresolved question

We will review that evidence before selecting the wedge.
