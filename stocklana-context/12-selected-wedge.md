# Selected Wedge — Policy-Preserving Tokenized-Stock Portfolio Drawdown

Date: 23 September 2026

Status: product direction selected; implementation not started

## Decision

DrawRail will answer one question:

> I need liquidity from my stock portfolio. Which position can I safely reduce without breaking the investment rules I already chose?

The MVP is a self-custodial, user-signed **xStock → USDC portfolio drawdown**. The user states a USDC liquidity target. DrawRail counts existing USDC first, evaluates the user's supported xStock positions against deterministic preservation and execution rules, proposes one compliant reduction, obtains a current Jupiter quote, and lets the user review and sign the exact transaction.

Candidate A is the product. Candidate B is not a standalone firewall; its useful stock-specific checks are the internal policy engine for Candidate A.

## Exact user

The first user is a self-custody Solana wallet holder who:

- owns USDC plus one or more of AAPLx, NVDAx, or TSLAx;
- needs a defined amount of liquid USDC;
- wants to preserve minimum exposure to selected stock positions;
- wants the application to handle Token-2022 multiplier mechanics correctly; and
- will explicitly review and sign every proposed sale.

This is not initially a product for merchants, autonomous trading agents, lending users, tax accountants, or investors comparing token issuers.

## Problem

The user's intent is denominated in cash, but the action must be expressed as an exact integer amount of a particular token. A safe decision requires more than a swap button:

1. existing USDC must reduce the amount that needs to be raised;
2. each possible sale must respect the user's retained-exposure floor;
3. displayed xStock units must be converted through the current on-chain Token-2022 Scaled UI Amount multiplier;
4. a pending multiplier activation window must stop execution;
5. optional reference-price checks must use fresh, session-valid Pyth data rather than a recently received but carried-forward value;
6. the user must see the exact raw input, expected/minimum output, post-trade exposure, and reasons alternatives were rejected; and
7. the completed transaction must be verified against mainnet state.

Existing swap interfaces solve route discovery and execution. They do not translate a portfolio-level liquidity request into a transparent, policy-preserving reduction decision.

## Wedge

The wedge is the decision layer between a user's cash need and a real xStock sale:

**USDC target → portfolio-aware eligibility → multiplier-correct amount → current executable quote → explicit signature → verified settlement.**

The initial policy set is intentionally small:

- minimum retained exposure per supported stock;
- maximum slippage;
- a hard block around pending multiplier activation;
- correct raw/scaled amount handling;
- optional maximum token/reference divergence when valid paired Pyth data is available; and
- Pyth feed freshness, session, confidence, and publisher validation when that feature is enabled.

The product is differentiated by the combined decision and evidence trail, not by pretending the underlying swap is proprietary.

## Why Solana

Solana is necessary to this product rather than merely a deployment choice:

- xStocks use Solana Token-2022 Scaled UI Amount state, so their raw balances and displayed economic quantities can differ without a balance-changing transaction.
- AAPLx, NVDAx, and TSLAx currently have executable xStock → USDC liquidity through Jupiter Swap V2.
- A single wallet can expose the portfolio, sign the selected reduction, receive USDC, and provide an independently verifiable settlement signature.
- Token-2022 mint state, token-account balances, the Jupiter transaction, and post-transaction balance changes can be tied into one reviewable record.

## Differentiation

DrawRail is not another token swap screen. It adds the missing portfolio and stock-specific semantics:

- starts from a USDC need rather than a token input amount;
- considers existing USDC before selling an asset;
- chooses only among supported positions that can satisfy the request without violating the user's retained-exposure floors;
- makes Scaled UI Amount conversion part of transaction correctness;
- blocks, rather than warns, during a multiplier activation safety window;
- can refuse stale, out-of-session, uncertain, or divergent representation/reference data when authenticated Pyth Pro is available;
- explains why one position was selected and why alternatives were blocked; and
- verifies actual settlement after signing.

This remains meaningfully different from:

- Jupiter, which supplies execution but not the user's portfolio-preservation decision;
- generic transaction firewalls, which are broader but do not own this stock-specific workflow;
- Kamino obligation orders, which already solve owner-configured lending stop-loss/take-profit and deleveraging primitives;
- Henar-style cross-issuer comparison, which answers a different representation-selection question;
- portfolio accounting products, which report history rather than execute the drawdown; and
- PreStocks secondary-sale or event-conversion products.

## Competitive boundaries

DrawRail will not claim to:

- protect transactions submitted through other applications;
- enforce a universal wallet policy;
- replace Jupiter's router or landing infrastructure;
- automate Kamino obligations or lending positions;
- determine which issuer representation is legally or economically superior;
- provide tax or accounting correctness;
- provide PreStocks redemption; or
- guarantee a merchant an exact invoice amount.

The MVP controls only the transaction path it constructs. A user remains free to bypass DrawRail elsewhere. That is an explicit trust boundary, not a missing on-chain guarantee.

## Sponsor fit

### Jupiter

Jupiter Swap V2 supplies the real mainnet action: current route competition, an assembled ExactIn transaction, managed execution, and execution-result fields. DrawRail contributes a portfolio-policy layer that culminates in a real Jupiter trade.

### Pyth

Pyth Pro can add a stock-specific pre-trade refusal rule by comparing the xStock representation feed with the corresponding underlying-equity feed. This is sponsor-relevant only if an authenticated trial account can actually access the required pairs and fields. The feature will therefore be gated, never mocked, and described as unavailable when entitlement or unit validation fails.

### Solana and Token-2022

The core correctness problem depends on live Token-2022 Scaled UI Amount state. The product demonstrates why an on-chain extension must be interpreted correctly before a user signs a financial action.

## Non-goals

The MVP will not include:

- natural-language policy parsing;
- AI trading or autonomous signing;
- custody, delegated signing, or stored wallet keys;
- lending, leverage, liquidation protection, or Kamino integration;
- baskets, portfolio rebalancing, DCA, limit orders, or recurring execution;
- merchant QR, checkout, or exact-invoice settlement;
- cross-issuer routing or automatic issuer substitution;
- accounting, cost basis, tax reports, or historical portfolio reconstruction;
- PreStocks redemption or secondary-sale routing;
- assets beyond AAPLx, NVDAx, TSLAx, and USDC; or
- a custom Solana program unless a later requirement introduces an invariant that cannot be safely achieved with the user's signature and existing programs.

## Product principles

- **User intent first:** the request is a USDC target plus explicit preservation rules.
- **Raw and displayed are different types:** no amount shortcut may erase the Token-2022 multiplier.
- **Fail closed on safety data:** unsupported mints, invalid state, stale quotes, activation windows, and enabled-but-invalid Pyth checks block construction or execution.
- **No hidden substitution:** the reviewed mint, raw amount, destination, and transaction must remain the signed action.
- **No false automation:** the wallet owner reviews and signs every action.
- **Evidence over claims:** the receipt shows the signature and observed token-balance changes, not merely a success toast.

## 30-second story

“I need 80 USDC, and I already have 20. DrawRail checks the three tokenized-stock positions in my wallet against the minimum exposure rules I chose. It rejects NVDAx because selling enough would take me below my 600-dollar floor. It checks AAPLx's on-chain multiplier and activation state, optionally validates fresh Pyth representation and reference data, then converts the proposed displayed reduction into the exact raw Token-2022 amount. I see the expected and minimum USDC, the post-trade portfolio, and every passed or blocked rule. I sign once, Jupiter swaps my AAPLx to USDC, and DrawRail shows the confirmed mainnet evidence.”

The example explains the experience; asset selection and amounts are calculated from live state and are not hard-coded.

## MVP success definition

The wedge is proven when a funded mainnet wallet can complete one low-value AAPLx, NVDAx, or TSLAx → USDC drawdown in which:

- existing USDC is counted correctly;
- at least one alternative is evaluated with an intelligible reason;
- retained exposure is not violated under the documented valuation rule;
- the current on-chain multiplier determines the raw input;
- an activation-window violation cannot proceed;
- a live Jupiter V2 order is reviewed and signed by the user;
- the signed transaction is submitted without mutation; and
- the UI displays confirmed input/output balance deltas and the transaction signature.

Pyth-dependent success is a separate gated criterion: the product must either demonstrate valid authenticated paired-feed enforcement or state clearly that the feature is unavailable.

## Primary references

- [Candidate validation](./11-candidate-validation.md)
- [Jupiter Swap V2](https://developers.jup.ag/docs/swap)
- [Jupiter order and execute](https://developers.jup.ag/docs/swap/order-and-execute)
- [Jupiter build](https://developers.jup.ag/docs/swap/build)
- [Jupiter RFQ V2 streaming](https://developers.jup.ag/docs/swap/routing/rfq/v2/streaming)
- [xStocks multipliers](https://docs.xstocks.fi/developers/multipliers)
- [xStocks exchange integration](https://docs.xstocks.fi/docs/exchange-integration)
- [Solana Scaled UI Amount](https://solana.com/docs/tokens/extensions/scaled-ui-amount)
- [Pyth Pro](https://docs.pyth.network/price-feeds/pro)
