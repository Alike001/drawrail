# Merged Opportunity Update — 23 Sep 2026

This file merges the original Stocklana research pack with a second independent research pass supplied by the project owner. Treat repository claims as leads until code or primary documentation verifies them.

## Verified corrections and important changes

### 1. Deadline is resolved
The official Stocklana page currently says submissions close Friday 25 September 2026 at 4:00 PM ET. Ignore older repo references to 18 September.

Primary source: https://hackathons.solana.com/hackathons/stocklana

### 2. Generic Kamino loan-guard automation is not an open wedge
The second research pass proposed automated loan protection for xStock-collateral borrowers as the leading opportunity. That exact framing is too broad because Kamino's official `Kamino-Finance/klend-sdk` already contains obligation orders:

- owner-defined stop-loss and take-profit orders;
- LTV-based trigger conditions;
- price-based trigger conditions;
- full or partial debt repayment actions;
- execution bonuses for third-party executors;
- on-chain order state set by the owner and designed for permissionless execution.

Relevant official repo paths:
- `src/obligation_orders/common.ts`
- `src/obligation_orders/ltv_based.ts`
- `src/obligation_orders/price_based.ts`
- `examples/klend-examples/example_obligation_order.ts`

Repo: https://github.com/Kamino-Finance/klend-sdk

Therefore DO NOT pitch merely "monitor LTV and automatically repay before liquidation." That duplicates an existing Kamino primitive.

A narrower stock-specific protection layer may still be viable only if it handles information Kamino's existing order model does not already cover, for example corporate-action activation windows, issuer/reference dislocations, session state, or transaction-level stock-specific policy. Verify this before selecting it.

### 3. Corporate-action handling is a real Solana-specific integration problem
xStocks documentation confirms that on Solana the raw Token-2022 balance remains constant while a Scaled UI Amount multiplier represents the economic balance. Corporate actions include dividends, splits and reverse splits.

The xStocks docs also say a pending multiplier is published before activation and recommend that trading venues/protocols pause interactions for a short window around activation to prevent unexpected settlement behavior.

Primary sources:
- https://docs.xstocks.fi/developers/multipliers
- https://docs.xstocks.fi/docs/exchange-integration

This makes a corporate-action-aware execution guard technically grounded. But a display-only multiplier tracker is already occupied by `GODGRACE07/multiplier`, so the wedge must change or enforce a financial action.

### 4. Pyth access is not accurately described by the "$5k+/month with no free tier" claim
Current Pyth documentation provides a self-serve Pyth Pro free trial/API key through Pyth Terminal, with no credit card required. The exact entitlements of a trial token can vary by asset class/feed, so access to the required Stocklana feeds must still be tested immediately.

Stocklana itself explicitly names:
- `Equity.US.AAPL/USD`
- `Crypto.AAPLX/USD`
- `Crypto.AAPLON/USD`

Sources:
- https://docs.pyth.network/price-feeds/pro/pyth-terminal
- https://hackathons.solana.com/hackathons/stocklana

Do not assume Hermes is the correct path. Pyth Pro is the sponsor surface and requires authenticated access for production APIs. Test a free trial key against the exact required feeds.

### 5. "Spend tokenized stocks" now has a visible competitor, but its hard path is unfinished
`himanshu-rawat77/xspend` targets tokenized-stock spending via Solana Pay. Its README states:
- the verified live/devnet transaction is a direct test-USDC transfer;
- the real xStock-to-USDC Jupiter route is not verified/live;
- StockBack is simulated.

This means a generic "scan QR and spend stocks" clone is occupied, but a product that executes the real xStock liquidation/payment path on mainnet and adds portfolio-preservation policy can still be materially different.

Repo: https://github.com/himanshu-rawat77/xspend

### 6. Generic conditional stock trading is occupied
`Vibeaman/StockPilot` already supports natural-language deterministic rules, Pyth dual feeds and wallet-signed Jupiter swaps. Avoid "AI creates a buy/sell rule" as the wedge.

Repo: https://github.com/Vibeaman/StockPilot

### 7. After-hours gap monitoring/insurance is occupied
`angelraph/gapguard` already covers market-close divergence, wallet risk and a planned gap-insurance mechanism. Avoid a simple weekend-gap radar or insurance clone.

Repo: https://github.com/angelraph/gapguard

## Revised opportunity set

These candidates should be validated before any product code is written.

### Candidate A — Policy-preserving portfolio drawdown / spending
User asks for a stablecoin amount or payment while holding tokenized stocks.

Instead of forcing the user to manually choose what to sell, the application applies explicit preservation rules and live market facts before building the transaction.

Example:

```
Need: 100 USDC
Portfolio: AAPLx + NVDAx + 20 USDC
Rules:
- use existing USDC first
- never reduce NVDA exposure below $500
- do not sell an xStock >1% below its underlying reference
- do not execute through an xStocks corporate-action activation window
- max execution slippage 0.5%

20 USDC available
→ need 80 more
→ evaluate eligible stock positions
→ Pyth dual-feed check
→ xStocks multiplier/event-window check
→ choose permitted asset + amount
→ Jupiter quote
→ user reviews and signs
→ receive/pay 100 USDC
```

Why this deserves validation:
- Stocklana explicitly lists "spending from a portfolio" as a consumer direction.
- xSpend has not completed the real xStock-to-stablecoin path.
- Pyth can affect execution rather than draw a chart.
- Automation is bounded and user-approved.
- Mainnet execution can make the demo stronger than mock-heavy competitors.

Critical verification:
- Can Jupiter build a reliable mainnet xStock -> USDC route for the selected assets?
- Can swap + recipient USDC transfer be composed into one user-signed transaction, or must it be two?
- How should Scaled UI Amount be converted to raw transfer amount?
- What exact reference/session feed should be used outside US cash-market hours?

### Candidate B — Corporate-action-aware transaction firewall
A reusable policy layer that refuses or re-quotes risky tokenized-stock actions around corporate-action activation, stale reference data or abnormal token/reference divergence.

This must do more than display warnings. It needs to control a real transaction path, such as a swap, drawdown, vault action or another user-approved on-chain operation.

Why this deserves validation:
- xStocks explicitly recommends pausing interactions around multiplier activation windows.
- Multiplier tracking alone is already occupied.
- Stock-specific transaction safety may be useful across wallets/protocols.

Critical verification:
- Which production protocols already implement equivalent pause/re-price logic?
- Does Kamino's Chainlink-based xStocks oracle and risk system already make this redundant for Kamino positions?
- Can the guard be authoritative on-chain in the hackathon scope, or is it only UI middleware?

### Candidate C — Cross-issuer equity execution policy/router
Same company exposure can exist as multiple Solana tokens from different issuers. The product accepts an investment or liquidity intent and routes only among issuer representations approved by the user's policy.

Potential inputs:
- Pyth underlying-equity feed;
- Pyth token representation feeds;
- current DEX executable quote and depth;
- issuer allowlist chosen by user;
- downstream protocol support;
- market/session state;
- token-specific corporate-action behavior.

The product must preserve issuer distinctions. Never imply AAPLx and AAPLON are legally or economically identical.

Critical verification:
- Are there at least two genuinely tradable representations of the same underlying with Jupiter routes today?
- Does Jupiter's own stock interface already solve enough of this that an automatic router has little added value?
- Can we define objective, non-misleading routing rules without making legal/compliance claims?

### Candidate D — Tokenized-stock portfolio ledger/accounting
Wallet-native accounting that reconstructs economic balances, cost basis, realized/unrealized PnL and corporate actions correctly across Token-2022 scaled balances and trades.

This appears less flashy but has a real integration problem. `Multiplier` fixes displayed balance, not a complete transaction/cost-basis ledger.

Critical verification:
- Existing Solana portfolio/tax tools that already support xStocks/Ondo corporate actions correctly.
- Availability of transaction history and historical price data needed for deterministic accounting.
- Whether a credible MVP can be demonstrated from a real wallet in the remaining time.

### Candidate E — PreStocks exit/redemption router
For PreStocks only, compare available liquidity/secondary sale with issuer redemption/exit mechanics and show or execute the best permitted exit path.

This is attractive only if it produces a real financial action and uses PreStocks-specific mechanics, not another premium dashboard.

Critical verification:
- Exact current PreStocks redemption API/process and whether third-party apps can initiate it.
- Real Jupiter/DEX routes and liquidity for supported PreStocks.
- How `prestocks-pulse` and other public entries already handle redemption.

## Lower-priority candidate

### New Jupiter tokenized-equity perp basis/carry
Potentially novel because the venue is new, but integration surface and market availability are still uncertain. Validate only after A-E unless an official API makes the path unexpectedly simple.

## Current preference before validation

Do not select a winner yet.

The highest-value research target is Candidate A because it combines:
- a simple user sentence: "I need cash/payment without blindly selling my portfolio";
- an explicit Stocklana consumer wedge;
- a visible competitor whose real stock-liquidation path is unfinished;
- a natural Pyth decision mechanism;
- a feasible wallet-signed mainnet demo;
- human approval and clear safety boundaries.

Candidate B can potentially become the safety engine inside Candidate A instead of being a separate standalone product. That combination may be stronger than either alone:

`payment/drawdown request -> preservation policy -> Pyth + corporate-action safety -> executable Jupiter route -> user signs -> stablecoin settlement`

Do not merge them automatically. First validate whether the necessary data and Jupiter execution path work on mainnet.
