# Candidate Validation — Blockers First

Date: 23 September 2026

Research cutoff: 19:00 UTC
Stage: opportunity validation only; no product architecture or implementation selected

## Decision summary

The blocker tests leave two candidates worth discussing, both in narrower forms than their original descriptions:

- **A remains technically viable as a policy-preserving portfolio drawdown.** Current Jupiter V2 returns live mainnet AAPLx, NVDAx and TSLAx → USDC routes, and its `receiver` parameter can send output to another wallet. It is not yet proven as an exact-value merchant payment because V2 supports only ExactIn: the receiver gets the variable swap output. A custom atomic swap plus exact USDC transfer is possible through `/build`, but that path is Metis-only and gives up JupiterZ/RFQ liquidity.
- **B remains technically viable only as a stock-specific execution guard inside a transaction path it controls.** It is not a generic Kamino loan guard and cannot honestly be called a universal firewall if it is only UI middleware. Kamino already implements owner-set, on-chain, permissionlessly executable stop-loss/take-profit and deleveraging orders.
- **C is technically feasible but eliminated as a standalone wedge.** xStocks and Ondo representations of the same companies have live Jupiter routes, but Henar already implements company-first representation comparison, market execution and extensive routing/safety machinery. Backpack catalog membership did not produce executable Jupiter quotes in the live sample.
- **D is technically constructible but eliminated for this hackathon wedge.** It does not produce the required financial action, Koinly already imports xStocks for tax/P&L treatment, and deterministic cost basis cannot be reconstructed from the chain for arbitrary inbound transfers without off-chain acquisition data.
- **E is eliminated in its proposed redemption-router form.** PreStocks have live secondary-sale routes, but no public third-party issuer redemption/conversion API was found. The documented IPO/M&A conversions are event-specific issuer processes with deadlines, not a general redemption rail. A secondary-sale-only product collapses into functionality already exposed by Jupiter and PreStocks Pulse.

No transaction was signed, submitted or funded in this research. “Executable” below means that current primary documentation and live read-only mainnet quote/build surfaces support constructing the action; it does not mean that this research produced a confirmed signature.

## Evidence standard

Labels used below:

- **Verified — live:** observed through a read-only production API or mainnet RPC on 23 September 2026.
- **Verified — code:** present in repository code at the pinned commit, not merely described in a README.
- **Documented:** stated by the protocol/issuer in primary documentation but not exercised with funds here.
- **Claim only:** stated by a project README or site without enough code or transaction evidence to verify it.
- **Unknown:** the evidence required to decide was inaccessible in this research environment.

Repository inspections were pinned to:

| Repository | Commit inspected |
|---|---|
| `himanshu-rawat77/xspend` | `36d864fa759a47d6ceb5b1fd183392ffa1a29568` |
| `Vibeaman/StockPilot` | `72694db9474f9431798fbe7e853960a7035fa838` |
| `GODGRACE07/multiplier` | `c0b5ad3793e6066e1e19e50ee4bd4f4bf8b3ec87` |
| `angelraph/gapguard` | `0c77f80ba8b02021275ad832dc1f33eb9d60543c` |
| `aramzcrypto/henar` | `c20e8b54dd3a18822b525f50ad2a6b5a3bbf1ab4` |
| `aralroca/prestocks-pulse` | `ee65b5dc9a409d591b778a42b6beaa98956da77e` |
| `Kamino-Finance/klend-sdk` | `38845294447623f6de3afc9dec29875f959f6f48` |
| `Kamino-Finance/klend` | `a08760976f51a3a58c4a0c6ea27b4a0e565bca79` |
| `solana-program/token-2022` | `bc9c3fa987807021549b41a884fcada35dc8e79e` |

## Phase 1 — blocker tests

### 1. Jupiter mainnet xStock execution

#### Current assets and routes

The [xStocks public asset API](https://api.xstocks.fi/api/v2/public/assets/AAPLx) supplied the current Solana mints. Jupiter's Token API reported eight decimals for all three. A read-only `GET https://api.jup.ag/swap/v2/order` request then quoted 1,000,000 raw units, or 0.01 unscaled tokens, into USDC:

| Asset | Official/current Solana mint | Live V2 result at sample time | Status |
|---|---|---:|---|
| AAPLx | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` | 3.378023 USDC via JupiterZ | **Verified — live route** |
| NVDAx | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` | approximately 2.255 USDC via JupiterZ | **Verified — live route** |
| TSLAx | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` | approximately 3.786 USDC via JupiterZ | **Verified — live route** |

Quotes move continuously; their significance is route existence, not the sampled prices. The quote-only response has `transaction: null` when no `taker` is supplied, as documented. To test construction without controlling or signing another party's funds, a mainnet RPC read located a public AAPLx token account with sufficient balance and its owner was supplied as `taker`. `/order` returned a non-empty 944-character base64 transaction and request ID. Repeating the call with a different public wallet as `receiver` returned a non-empty 1,044-character transaction without an API error. This verifies that the current production API will assemble both the swap and recipient-output forms against real mainnet state; it does **not** verify the owner's ability to sign, simulation, `/execute`, landing or settlement. Nothing was signed or submitted.

#### Which Jupiter API is current

The current integration surface is [Swap API V2](https://developers.jup.ag/docs/swap), based at `https://api.jup.ag/swap/v2`:

- `/order` + `/execute` is Jupiter's recommended Meta-Aggregator path. Metis, JupiterZ, Dflow and OKX compete, and Jupiter manages landing.
- `/build` returns raw instructions for a custom transaction, but uses Metis only. The integrator submits through its RPC or Jupiter's transaction submission service; `/execute` cannot accept a modified `/build` transaction.
- Jupiter explicitly says JupiterZ transactions cannot be modified after return. A product needing an extra instruction must use `/build` and accept the routing trade-off.

The live AAPLx `/build` check returned three setup instructions, a swap instruction, cleanup instruction and four address lookup tables for a four-venue Metis route, with `swapMode: ExactIn` and no API error. This verifies that raw instructions are currently obtainable for manual composition; the unsigned transaction was not assembled, simulated or submitted in this research. The older Swap V1/lite endpoint still returned quotes in one compatibility check, but V2 is the documented September 2026 surface. `quote-api.jup.ag/v6`, which xSpend hard-codes, no longer resolved during this test.

#### Recipient settlement and the ExactIn blocker

The V2 [OpenAPI specification](https://github.com/jup-ag/docs/blob/main/openapi-spec/swap/v2/swap.yaml) documents `receiver` as a wallet address distinct from the taker. For a non-SOL output, Jupiter sends output to the receiver's associated token account and adds ATA creation when needed. The routing matrix says `receiver` is supported by Metis, JupiterZ, Dflow and OKX. This means a user can sell an exact raw xStock input and direct the resulting USDC to a merchant or other recipient without appending a transfer instruction.

The blocker is the amount convention: current `/order` and `/build` take an amount in the smallest unit of the **input**, and `swapMode` currently allows only `ExactIn`. Therefore:

- **Portfolio drawdown:** viable. The user approves selling a disclosed raw amount subject to a minimum output, then receives the realized USDC.
- **Fixed invoice using `receiver`:** not exact. The merchant receives the swap's variable output, not a guaranteed invoice amount.
- **Atomic exact merchant transfer:** technically composable through `/build` by swapping into the user's USDC account and appending an exact USDC transfer, provided the minimum output covers the invoice. However, `/build` is Metis-only; it excludes the JupiterZ RFQ route that won all three sampled xStock quotes.
- **Two transactions:** possible but introduces intermediate-custody, partial-completion and recovery UX that weakens the 30-second payment story.

This does not block Candidate A as a drawdown product. It does block claiming a reliable exact-invoice, best-route, one-signature payment until a concrete settlement choice is validated.

### 2. Pyth Pro access and paired feeds

#### Exact self-serve trial steps

Primary Pyth documentation says to:

1. Open [Pyth Terminal](https://pythdata.app) and create a free account.
2. Log in and choose **View your API key**.
3. Use the token server-side as `Authorization: Bearer {key}` for Pyth Pro WebSocket and authenticated REST endpoints.
4. For a browser client, issue short-lived JWTs rather than embedding the API key.

The [Pyth Terminal documentation](https://docs.pyth.network/price-feeds/pro/pyth-terminal) describes this as an instant Pyth Pro trial token with no credit card and no sales contact. The [API-key guide](https://docs.pyth.network/price-feeds/pro/acquire-api-key) confirms the authentication pattern.

#### What was and was not verified

The unauthenticated public symbol catalog at `https://pyth.dourolabs.app/v1/symbols` returned these stable entries:

| Feed | Lazer ID | Minimum channel | Published schedule |
|---|---:|---|---|
| `Equity.US.AAPL/USD` | 922 | fixed-rate 50 ms | US regular/pre/post/overnight schedules |
| `Crypto.AAPLX/USD` | 1792 | fixed-rate 200 ms | open schedule |
| `Crypto.AAPLON/USD` | 3132 | fixed-rate 200 ms | open schedule |
| `Equity.US.NVDA/USD` | 1314 | fixed-rate 50 ms | US regular/pre/post/overnight schedules |
| `Crypto.NVDAX/USD` | 1833 | fixed-rate 200 ms | open schedule |

This is **verified feed existence**, not verified trial entitlement. An unauthenticated `latest_price` request was correctly rejected with HTTP 403 and `no token specified`. No Pyth API token was available in the environment, and creating one requires an interactive account login. Consequently, the brief's test “a trial key reads one `Equity.US.*` plus one `Crypto.*X` pair” remains **unknown**, not passed.

StockPilot's deployed endpoint is not substitute evidence. Its code first attempts Pro history, then falls back to Hermes and Jupiter, merges the result under a Pyth-facing response, and does not expose the Pro `marketSession`/`feedUpdateTimestamp` proof needed here. A successful StockPilot response therefore does not demonstrate trial entitlement to the paired Pro feeds.

#### Freshness and session semantics

Pyth Pro's current payload/reference documentation exposes:

- `timestampUs`: time of the returned update;
- per-feed `feedUpdateTimestamp`: last time that feed received a fresh aggregate;
- `marketSession`: session classification;
- `publisherCount` and confidence fields.

Pyth documents that, since 23 March 2026, a last value may be carried forward when a fresh aggregate is unavailable. A policy must therefore compare `feedUpdateTimestamp` with `timestampUs` and enforce a maximum age; receipt of a recent envelope alone is not proof of a fresh stock print. `marketSession` and the published session schedule must also affect whether underlying-equity divergence is a valid blocker outside regular hours.

Hermes is not treated as equivalent to Pyth Pro in this validation.

### 3. xStocks raw/scaled multiplier handling

The [xStocks multiplier guide](https://docs.xstocks.fi/developers/multipliers) and [exchange integration guide](https://docs.xstocks.fi/docs/exchange-integration) establish the required semantics:

- raw Token-2022 balances do not change for the corporate action;
- displayed/economic amount = unscaled human amount × active multiplier;
- a transaction amount is still a raw integer;
- to sell a desired displayed amount, first divide that amount by the active multiplier, then apply mint decimals and truncate consistently;
- a pending multiplier is published with an activation time;
- xStocks recommends pausing interactions for approximately 15 minutes before and after activation, which occurs at 00:30 UTC on the day after the ex-date under the current process.

Mainnet `getAccountInfo(..., encoding: "jsonParsed")` calls verified that the AAPLx, NVDAx and TSLAx mints are owned by Token-2022, have eight decimals, and expose `scaledUiAmountConfig`. At the sample time:

| Asset | On-chain old multiplier | On-chain new multiplier | activation timestamp | Effective current value |
|---|---:|---:|---|---:|
| AAPLx | 1.0026642075893797 | 1.0032690125398187 | 8 Aug 2026 00:30 UTC | 1.0032690125398187 |
| NVDAx | 1.0009180758490996 | 1.001701196801074 | 10 Sep 2026 00:30 UTC | 1.001701196801074 |
| TSLAx | 1 | 1 | 0 | 1 |

The xStocks public multiplier endpoint matched the active AAPLx and NVDAx values and returned historical dividend events. The on-chain mint remains the authority for current/pending state.

The official Token-2022 implementation confirms the activation rule and conversion behavior in [`scaled_ui_amount/mod.rs`](https://github.com/solana-program/token-2022/blob/bc9c3fa987807021549b41a884fcada35dc8e79e/interface/src/extension/scaled_ui_amount/mod.rs) and [`amountToUiAmount.ts`](https://github.com/solana-program/token-2022/blob/bc9c3fa987807021549b41a884fcada35dc8e79e/clients/js/src/amountToUiAmount.ts): use the new multiplier at or after its timestamp; otherwise use the old one. UI-to-raw conversion divides by the multiplier and truncates.

Example: with AAPLx multiplier `1.0032690125398187` and eight decimals, selling 0.01 displayed AAPLx requires `trunc(0.01 / 1.0032690125398187 × 10^8) = 996,741` raw units, not 1,000,000. Supplying 1,000,000 raw units sells approximately 0.0100326901 displayed AAPLx. This is transaction correctness, not cosmetic formatting.

**Blocker result:** the required data and conversion are available, but every candidate that builds xStock amounts must treat raw and scaled amounts as separate typed concepts. A float-only implementation or `displayed × 10^8` shortcut is unsafe.

### 4. Kamino obligation orders: exact overlap and remaining gap

Both the SDK and current on-chain program were inspected. The implementation is stronger than a README-level “planned automation” claim.

#### Already solved by Kamino

The [`klend` order state](https://github.com/Kamino-Finance/klend/blob/a08760976f51a3a58c4a0c6ea27b4a0e565bca79/programs/klend/src/state/obligation.rs) gives every obligation two order slots. [`obligation_order_operations.rs`](https://github.com/Kamino-Finance/klend/blob/a08760976f51a3a58c4a0c6ea27b4a0e565bca79/programs/klend/src/state/obligation_order_operations.rs) supports:

- user LTV above a threshold;
- user LTV below a threshold;
- debt/collateral oracle price ratio above or below a threshold for a single-debt, single-collateral obligation;
- “always” and distance-to-liquidation conditions;
- repay a specified amount of the single debt or deleverage all debt;
- minimum and maximum executor bonuses, capped by validation and risk rules.

[`handler_set_obligation_order.rs`](https://github.com/Kamino-Finance/klend/blob/a08760976f51a3a58c4a0c6ea27b4a0e565bca79/programs/klend/src/handlers/handler_set_obligation_order.rs) requires the obligation owner to sign when setting the on-chain order. When a condition is hit, [`liquidation_operations.rs`](https://github.com/Kamino-Finance/klend/blob/a08760976f51a3a58c4a0c6ea27b4a0e565bca79/programs/klend/src/state/liquidation_operations.rs) treats the order as a liquidation/deleveraging reason and explicitly enables the liquidator to use the opportunity. The execution instruction's accounts require a `liquidator: Signer`, not the obligation owner. That is real permissionless executor machinery, not a notification bot.

The SDK's `ltv_based.ts` and `price_based.ts` map those primitives to stop-loss/take-profit semantics and full/partial repay opportunities. Generic “watch xStock collateral and auto-repay before liquidation” is therefore eliminated.

#### What Kamino orders do not encode

The serialized condition contains a numeric threshold and one of the condition enums above. There is no order field or condition enum for:

- an xStocks pending multiplier or its activation window;
- Pyth `marketSession` or `feedUpdateTimestamp` freshness;
- a separate underlying-equity feed versus token-representation feed;
- an external divergence ceiling;
- issuer status or a user-approved issuer allowlist.

This leaves a real information gap, but not automatically a product gap. Kamino's own reserve oracle and risk configuration protect its lending market according to Kamino's chosen prices and parameters. An external stock-specific guard cannot override permissionless Kamino order execution or transactions submitted through other clients unless Kamino itself or an authoritative on-chain program adopts that condition. In a user-controlled Jupiter flow, by contrast, an app can refuse to construct/sign its own action when the stock-specific policy fails.

**Blocker result:** B survives only as a transaction-specific safety policy. It is not an open-ended Kamino auto-deleveraging product, and “firewall” overstates its authority unless enforcement is demonstrably in the controlled transaction path.

### 5. Competitor reality check

#### xSpend

- **README claim, accurately qualified:** the verified transaction is a 50 tUSDC devnet transfer; it is not a Jupiter xStock swap, and StockBack is simulated ([README](https://github.com/himanshu-rawat77/xspend/blob/36d864fa759a47d6ceb5b1fd183392ffa1a29568/README.md)).
- **Verified — code:** [`src/services/jupiter.ts`](https://github.com/himanshu-rawat77/xspend/blob/36d864fa759a47d6ceb5b1fd183392ffa1a29568/src/services/jupiter.ts) attempts an atomic swap-instructions transaction followed by merchant transfer. That is relevant engineering, not merely a mock.
- **Current blocker:** it targets the retired/unresolved `quote-api.jup.ag/v6`, derives sale amount from displayed dollars and eight decimals without the active multiplier, and its mainnet flow catches Jupiter failure and constructs a direct-payment fallback. Its own README calls for removing any fallback that changes settlement asset.
- **Gap left:** a current V2, multiplier-correct, policy-preserving mainnet drawdown is still materially different. A generic QR spending clone is not.

#### StockPilot

- **Verified — code:** it parses natural-language rules into deterministic conditions and builds wallet-signed Jupiter orders through the legacy lite Ultra endpoint.
- **Verified limitation:** its price service attempts Pyth history and falls back through Hermes/Jupiter. It does not consume `marketSession` or `feedUpdateTimestamp`, and the merged source labeling can imply stronger Pyth provenance than the actual fallback.
- **Planned/mock:** its special demo trigger is explicit, and Meteora DBC is not a verified live product path.
- **Consequence:** generic natural-language conditional trading is occupied. It does not close the corporate-action/raw-amount safety gap.

#### Multiplier

- **Verified — code:** the backend calls the xStocks current/history endpoints, stores snapshots, and returns `raw × currentMultiplier` corrected balances.
- **Verified limitation:** the balance endpoint accepts a raw amount supplied by the caller; it does not read a wallet or build a financial transaction. The landing-page AAPL history is a committed static array, even though the console/backend can fetch live data.
- **Consequence:** a display/API multiplier tracker is occupied. B must enforce or refuse an actual action.

#### GapGuard

- **Verified — code:** current live price selection uses Jupiter plus Yahoo; Pyth code exists but is not the active default. The README's “$5,000+/month, no free tier” statement is outdated relative to Pyth's current self-serve trial documentation.
- **Verified limitation:** insurance settlement is computed off-chain, recorded in a memo, and paid through a backend/treasury SPL transfer. Its end-to-end evidence is devnet; there is no verified live mainnet protection pool.
- **Consequence:** simple after-hours divergence monitoring or insurance is occupied. It does not make Kamino automation or a corporate-action-aware execution guard redundant.

#### Henar — strongest cross-issuer competitor

- **Verified — code/docs:** Henar groups xStocks, Backpack and Ondo representations by company, keeps issuer identities separate, compares route/liquidity/fees, and has a live mainnet market-swap path. Its code uses Jupiter V2 `/build` and validates the resulting instruction.
- **Verified qualification:** Henar's [`LIVE_VALIDATION.md`](https://github.com/aramzcrypto/henar/blob/c20e8b54dd3a18822b525f50ad2a6b5a3bbf1ab4/docs/router/LIVE_VALIDATION.md) says its first live native-router trade and signature reconciliation are still pending; protected submission is wired but unexercised.
- **Verified gaps in its current external market path:** [`EXECUTION_SAFETY_PARITY.md`](https://github.com/aramzcrypto/henar/blob/c20e8b54dd3a18822b525f50ad2a6b5a3bbf1ab4/docs/router/EXECUTION_SAFETY_PARITY.md) lists reference-price divergence, market-session awareness and price-impact ceilings as missing there, with freshness/status only partial. Its internal guard has some of these controls but is not yet unified across paths.
- **Consequence:** C's discovery/routing premise is already strongly occupied. Henar's incomplete safety parity is evidence for B as a component, not enough differentiation for another general cross-issuer router.

#### PreStocks Pulse

- **Verified — code:** it fetches the PreStocks catalog, reads Token-2022 multipliers, requests Jupiter buy/sell quotes and links to Jupiter.
- **Verified limitation:** it does not sign or submit a swap. Its “flows” are inferred supply changes between snapshots, not issuer redemption records.
- **Consequence:** premium/discount and secondary-exit discovery are occupied; no issuer redemption execution was found.

## Phase 2 — candidate validation

## A. Policy-preserving portfolio drawdown / spending

**Exact user.** A self-custody xStock holder who needs USDC without manually deciding which position to sell, and who has explicit constraints such as minimum retained exposure, no sale during a corporate-action window, and no sale at abnormal token/reference divergence.

**Painful workflow.** The user must inspect existing USDC, translate scaled xStock balances into raw units, compare executable prices to an underlying reference with session/freshness context, avoid a multiplier activation window, choose an asset, request a quote, and transfer the proceeds. Existing interfaces make the user decide position-by-position and can silently treat a displayed xStock unit as one raw unit.

**Current workaround.** Manually sell an xStock on Jupiter, then send USDC; or use xSpend's demo/devnet path. The user carries the portfolio-selection and stock-specific safety burden.

**Closest public competitors.** xSpend is the closest spending interface; StockPilot is the closest rule-driven trade product; Henar is the closest guarded execution infrastructure. xSpend's verified settlement is direct devnet tUSDC, not mainnet xStock liquidation. StockPilot can sign swaps but occupies natural-language price rules, not portfolio-preserving drawdown. Henar has a live market route and a sophisticated guard, but does not present this bounded cash-need workflow as its product wedge.

**Evidence the gap still exists.** Current Jupiter routes remove xSpend's largest technical unknown. xSpend's actual implementation is stale and multiplier-unaware; its README explicitly says the production xStock route is unfinished. Henar's own parity document says reference/session checks are not applied uniformly to its live external execution path. No inspected product combined existing-USDC-first, exposure floors, active-multiplier conversion, activation-window refusal and paired-feed policy into one reviewed drawdown.

**Exact product mechanism.** Accept a requested USDC drawdown and explicit preservation rules; count existing USDC first; identify only positions permitted by exposure floors and issuer policy; convert displayed sale quantities into raw Token-2022 amounts using current on-chain multiplier state; refuse/requote around pending activation or stale/invalid reference data; request a current Jupiter quote; show the exact raw input, displayed economic amount, minimum USDC output, resulting exposure and policy decisions; obtain one explicit wallet approval.

This describes behavior, not a selected architecture. The unresolved settlement branch is whether the product should deliver the variable ExactIn result directly to a recipient, compose an exact transfer through Metis-only `/build`, or remain a drawdown-to-self product.

**Required APIs/protocols.** Solana mainnet RPC; Token-2022 mint/account parsing; xStocks asset and multiplier/history API as supporting metadata; Jupiter Swap V2; Pyth Pro paired feeds if the reference-divergence rule is included. A production RPC and Jupiter API key are prudent even though quote-only tests were reachable without credentials.

**Exact on-chain action.** User-authorized xStock Token-2022 input is swapped to USDC through Jupiter. Output either arrives at the user's USDC ATA or, with V2 `receiver`, at a named recipient's ATA. No custody or autonomous sale is required.

**How Pyth changes the action.** It is a pre-signing allow/refuse/requote input, not a chart. The action is refused when the token feed is too far from a sufficiently fresh underlying-equity feed under the user's rule. `marketSession` and `feedUpdateTimestamp` determine whether the comparison is valid; a carried-forward equity value cannot be treated as a fresh reference. Until paired trial access is tested, this sponsor-critical branch remains unverified.

**Why Solana is necessary.** The positions, USDC settlement and Jupiter liquidity are on Solana; xStocks' Token-2022 Scaled UI Amount makes chain state part of amount correctness; one wallet approval can atomically settle the chosen on-chain route within the limits described above.

**30-second judge demo.** “This wallet needs 80 USDC and refuses to reduce NVDA below $500. It already has 20 USDC. The product rejects one position because its reference is stale or its multiplier is in the activation window, converts the eligible AAPLx displayed amount to the correct raw amount, receives a live Jupiter mainnet quote, shows the post-trade exposure, and asks the user to sign. The resulting action is xStock → USDC, not a mock transfer.” During research, the quote/build should be shown without actually sending funds.

**Mainnet feasibility.** **Viable for drawdown; conditionally viable for payment.** Live routes exist for all three tested xStocks. Direct recipient settlement exists, but only ExactIn. An exact invoice plus swap can be composed with `/build`, at the cost of Metis-only routing and additional validation. No end-to-end funded transaction has yet been executed.

**API/key requirements.** Pyth Terminal account/trial or paid Pro key; Jupiter production API key; reliable Solana RPC. xStocks public endpoints were keyless in the test. Server-side key custody and short-lived client authorization are required for Pyth.

**Security/trust boundaries.** Wallet remains final authority. The product must bind displayed policy decisions to the exact unsigned transaction; independently verify mints, raw input, destination, minimum output, fees, signer set, recent blockhash and allowed programs; never let a failed route fall back to a different settlement asset; treat issuer allowlists as user policy rather than equivalence claims; never expose Pyth/Jupiter keys client-side.

**Failure/recovery path.** If a feed is stale, session-invalid, divergent, the multiplier is pending/in-window, the quote expires, output falls below the invoice/minimum, or transaction simulation fails, do not sign or submit. Preserve the request and explain the failed rule. Re-read chain/feed state and requote. If using two transactions, explicitly surface the intermediate USDC and make the transfer independently retryable; that is why the one-action drawdown is currently cleaner.

**Why it is a product rather than a demo.** The durable value is a repeatable, user-authored liquidation policy and an auditable explanation tied to real wallet positions and real settlement—not the QR surface. It can support recurring cash needs and different recipients without inventing autonomous custody.

**Top three reasons to reject.** (1) Pyth trial entitlement to the exact paired feeds is not yet proven. (2) Exact-value payment conflicts with V2's ExactIn-only Meta-Aggregator and best RFQ path. (3) Henar's execution guard and xSpend's UX reduce novelty unless portfolio-preservation and multiplier correctness are exceptionally clear.

**Validation status: still technically viable, narrowed to drawdown first.**

## B. Corporate-action-aware transaction firewall

**Exact user.** An application or self-custody user about to execute an xStock transaction who needs the action refused or repriced when Token-2022 corporate-action state, feed freshness/session or token/reference divergence makes the proposed amount unsafe.

**Painful workflow.** Every integrating app must reconcile pending/current multiplier state, activation timing, raw units, reference freshness and market session before building an action. A UI can display a corrected balance yet still submit the wrong raw amount or execute through xStocks' advised pause window.

**Current workaround.** Individual apps implement fragments: Multiplier exposes corrected balances; Henar has an execution guard but inconsistent parity across execution paths; Kamino enforces its own oracle/LTV rules; users manually avoid events. No inspected shared component was proven authoritative across unrelated protocols.

**Closest public competitors.** Multiplier, Henar's `execution-guard`, GapGuard and Kamino obligation orders. Multiplier does not control a transaction. Henar already covers much of the general guard surface and is the strongest overlap. GapGuard monitors divergence/insurance. Kamino already executes LTV/price-ratio deleveraging.

**What they execute versus simulate.** Henar's legacy market swaps are mainnet-capable, while its first native-router trade remains pending. Kamino's order machinery is real on-chain program code. Multiplier executes no financial action. GapGuard's protection settlement evidence is devnet and custodial/backend-driven.

**Evidence the gap still exists.** xStocks explicitly recommends an activation pause. Kamino's condition enum has no corporate-action, external dual-feed or session/freshness condition. Henar's own current parity audit says its live external path lacks reference divergence and market-session enforcement. The gap is therefore real at the transaction edge, though substantially narrower than a generic firewall.

**Exact product mechanism.** Given a proposed xStock action, bind verified mint/issuer identity, current and pending multiplier state, raw/displayed quantities, activation-window state, paired-feed timestamps/session/divergence and quote limits into an allow/refuse/requote decision. The decision must control transaction construction or signing; a warning-only widget fails the brief.

**Required APIs/protocols.** Solana RPC and Token-2022; xStocks public metadata/history; Pyth Pro for dual-feed policy; the controlled action's protocol API, with Jupiter V2 the immediately verified example.

**Exact on-chain action.** B has no valuable action by itself. The smallest valid action is a guarded Jupiter xStock swap that is constructed only after policy passes. A Kamino-specific version would need a real integration point beyond duplicating obligation orders; none was established here.

**How Pyth changes the action.** It can make the decision refuse or require requote based on an independently timestamped underlying/token relationship. A current envelope with an old `feedUpdateTimestamp` must fail freshness. Session status changes whether divergence is enforceable or merely informational.

**Why Solana is necessary.** The risk arises from Solana Token-2022 multiplier semantics and Solana transaction amounts. An authoritative version must bind the decision to the exact Solana instruction or transaction being signed.

**30-second judge demo.** Show the same displayed 0.01 AAPLx request yielding a corrected 996,741 raw units. Then show a pending activation or stale/carried-forward reference causing the real Jupiter action button/build to be refused; after state becomes valid, rebuild a current quote and expose the exact transaction for signature.

**Mainnet feasibility.** **Viable only inside a controlled mainnet action.** Data and Jupiter routing exist. A universal on-chain firewall is not established and a UI layer cannot stop a user, bot or other client from bypassing it.

**API/key requirements.** Same Pyth/Jupiter/RPC requirements as A. A generic library can read public chain state, but Pyth Pro authentication and action-specific transaction decoding remain trust boundaries.

**Security/trust boundaries.** Fail closed on unknown mint, parse failure, stale RPC/feed data, unrecognized instruction or quote mutation. Bind decision inputs to the exact transaction hash/message. Make clear that issuer and oracle assurances come from their sources. Do not imply control over Kamino or external transactions that bypass the guard.

**Failure/recovery path.** Refuse with a machine-readable reason; wait out the activation window or refresh stale data; rebuild rather than mutate a JupiterZ transaction; preserve user intent but require fresh approval for changed raw amounts or destinations.

**Why it is a product rather than a demo.** Only if multiple real transaction surfaces can adopt the same decision contract and the integration prevents unsafe submission. One hard-coded warning screen is not a product.

**Top three reasons to reject.** (1) Henar already has substantial execution-guard code, making differentiation difficult. (2) Without protocol adoption or an on-chain enforcement point, “firewall” is bypassable UI middleware. (3) Pyth trial entitlement and a second real adopting action are unverified.

**Validation status: still technically viable only as a narrow safety engine, likely strongest as a component of A rather than an independent generic product; no merge is selected here.**

## C. Cross-issuer equity execution policy/router

**Exact user.** A buyer who chooses a company exposure but has an explicit issuer allowlist and wants execution compared across legally/economically distinct token representations without falsely treating them as fungible.

**Painful workflow.** Discover issuer-specific mints, understand different rights/redemption constraints, check wallet/protocol compatibility and compare executable routes while retaining provenance.

**Current workaround.** Choose an issuer token manually in Jupiter or use Henar's company-first comparison/trade interface.

**Closest public competitor.** Henar is direct and strong, not adjacent. It already catalogs xStocks, Backpack and Ondo, separates representations, compares execution and issuer information, and exposes market trading.

**What executes versus simulates.** Henar's existing `/api/market` path builds mainnet Jupiter V2 market swaps. Its newer native router has extensive live quote/simulation validation, but its first live native-router signature and protected submission remain pending. That distinction prevents overstating the entire router while still recognizing the live product overlap.

**Evidence and live route test.** Official/current catalog data plus Jupiter produced live xStocks and Ondo routes for AAPL, NVDA and TSLA representations. Ondo mints used nine decimals and returned JupiterZ USDC quotes. Backpack's corresponding AAPL/NVDA/TSLA mints were recognized by Jupiter Token API with six decimals but returned `Failed to get quotes` in the sample. Thus at least two tradable representations exist for the same company, but not every listed representation is executable.

**Exact product mechanism.** Preserve a per-issuer object; filter it through a user allowlist and downstream compatibility; compare current executable net output, depth/freshness, session/reference conditions and representation-specific mechanics; have the user approve one named issuer token and route. Never auto-substitute a different issuer on failure.

**Required APIs/protocols.** Issuer catalogs/legal metadata, Pyth equity and representation feeds where available, Jupiter V2, Solana RPC/Token APIs, and potentially native venue APIs.

**Exact on-chain action.** USDC → one explicitly named issuer representation, or that representation → USDC. The output cannot be described as generic “AAPL”; it is AAPLx or AAPLon with the issuer disclosed.

**How Pyth changes the action.** It can reject a route whose representation diverges beyond policy from a fresh underlying reference, but must not be used to assert that issuer claims are equivalent.

**Why Solana is necessary.** Multiple issuer representations and their liquidity coexist on Solana, enabling one wallet to compare and execute while keeping mint identity explicit.

**30-second judge demo.** Choose “Apple exposure,” show xStocks and Ondo as separate legal/economic objects, filter by the user's issuer allowlist, compare current Jupiter output, then sign the chosen named mint. Backpack is shown as unavailable rather than silently omitted or simulated.

**Mainnet feasibility.** **Technically feasible for xStocks/Ondo; partial across the full issuer set.** Current routes exist, but no transaction was submitted. Backpack route failure proves the need for explicit unavailability handling.

**API/key requirements.** Jupiter API key/RPC; issuer data; Pyth Pro if the guard is included; Ondo/private issuer endpoints may require keys for richer metadata.

**Security/trust boundaries.** Issuer allowlist must be user-visible and immutable for a signed intent. Validate mints and token programs. Never describe representations as fungible or promise redemption. Do not reroute to another issuer after approval.

**Failure/recovery path.** If the chosen representation loses liquidity or fails policy, cancel/requote the same issuer or return to selection. Never substitute a different representation automatically.

**Why it is a product rather than a demo.** A maintained representation registry, explicit policies, execution and post-trade provenance could be durable—but Henar already demonstrates that product direction.

**Top three reasons to reject.** (1) Henar substantially occupies the exact company-first wedge. (2) issuer/legal metadata is difficult to normalize without misleading users. (3) route availability is uneven; Backpack failed all sampled quotes.

**Validation status: technically possible, strategically eliminated as a standalone candidate.**

## D. Correct tokenized-stock portfolio ledger/accounting

**Exact user.** A self-custody tokenized-stock holder or accountant who needs economic balances, realized/unrealized P&L and a corporate-action audit trail across raw Token-2022 balances and issuer representations.

**Painful workflow.** Standard transaction histories record raw token amounts; displayed economic units change through multipliers. Transfers between wallets lack acquisition-basis metadata, and different issuer representations cannot be merged as one asset.

**Current workaround.** Spreadsheets, generic crypto tax tools, issuer statements and manual basis entry. Koinly's current support documentation explicitly says xStocks are handled as standard digital assets and their trades feed capital-gains calculations. Birdeye supports scaled UI responses, while `solanarwa.app` advertises xStock tracking/tax features but its implementation could not be independently verified.

**Closest public competitors.** Koinly is the credible established competitor; Multiplier solves balance/event display; generic Solana explorers provide transfers; SolanaRWA makes overlapping marketing claims.

**What executes versus simulates.** None of these accounting functions needs to execute a financial action. Multiplier's data path is real, but its wallet amount is supplied by the caller. SolanaRWA's claimed swaps/tax features were not verified from public code.

**Evidence the gap still exists.** Token-2022 and xStocks expose enough data to reconstruct point-in-time displayed units, and xStocks publishes multiplier history. No verified competitor evidence established corporate-action-correct lots across issuers. However, chain history alone cannot determine basis for an inbound transfer acquired elsewhere, and historical tax truth depends on jurisdiction and off-chain facts.

**Exact product mechanism.** Index wallet transactions per mint; preserve raw amounts; apply the multiplier active at each timestamp; attach issuer identity and historical market value; derive lots only where acquisition evidence supports it; require manual basis/import for unexplained inbound transfers; export an audit trail rather than claim universal tax correctness.

**Required APIs/protocols.** Archival Solana RPC/indexer, Token-2022, xStocks multiplier history, issuer catalogs, historical price service and user-supplied basis records. Pyth history may help valuation but does not supply acquisition basis.

**Exact on-chain action.** None. It reads history and produces records.

**How Pyth changes the action.** Pyth could improve historical valuation and confidence provenance, but does not change an on-chain financial action. That fails the brief's strongest sponsor/action criterion.

**Why Solana is necessary.** The ledger bug is specific to Solana Token-2022 scaled amounts and Solana transaction history, but the product is still reporting rather than execution.

**30-second judge demo.** Import a wallet with an AAPLx dividend multiplier change, show raw balance unchanged while economic units and lot records adjust, then identify an inbound transfer whose basis is unknown instead of inventing P&L.

**Mainnet feasibility.** Read-only MVP is feasible. Credible complete cost basis is not deterministic for arbitrary wallets without user/imported data, and remaining time makes broad historical indexing risky.

**API/key requirements.** Archival/indexed RPC, historical prices and likely paid data infrastructure; Pyth key if used; no signer key.

**Security/trust boundaries.** Treat tax output as records, not legal advice. Preserve issuer separation. Never fabricate basis. User imports are sensitive financial data.

**Failure/recovery path.** Mark missing prices/basis as unresolved, allow explicit user correction with provenance, and recalculate deterministically. Do not silently average unlike issuer assets.

**Why it is a product rather than a demo.** Persistent reconciliation, imports, audit logs and exports could form a product, but that scope exceeds a polished main-track action demo.

**Top three reasons to reject.** (1) no real financial action; (2) Koinly already supports xStocks at a broad level; (3) complete basis is impossible from chain data alone and tax claims add jurisdictional risk.

**Validation status: eliminated for the current main-track wedge.**

## E. PreStocks exit/redemption router

**Exact user.** A PreStocks holder seeking the best permitted way to exit a private-company token, especially around an IPO or M&A event.

**Painful workflow.** Compare thin secondary liquidity, token price versus issuer mark, and any issuer event-conversion process and deadline without confusing a DEX sale with redemption.

**Current workaround.** Obtain a Jupiter quote/use its swap UI and separately read PreStocks event terms. PreStocks Pulse already shows quotes, premiums and Jupiter links.

**Closest public competitor.** PreStocks Pulse directly covers catalog, multiplier, premium and secondary quote discovery. Jupiter supplies the executable secondary sale.

**What executes versus simulates.** Pulse does not sign or submit swaps. Its “flows” are supply deltas, not redemptions. Jupiter V2 returned live sell quotes for OPENAI, SPACEX and ANTHROPIC PreStocks in the sample, proving a secondary action exists. No public third-party redemption transaction/API was found.

**Evidence about issuer exits.** Current PreStocks FAQ material says holders may sell through on-chain liquidity, with price/speed dependent on liquidity. For IPO events it describes an on-chain conversion window into the public-stock equivalent; for M&A it describes pro-rata net cash in USDC or a new-company equity token, with deadlines after which the PreStock may become worthless. These are event-specific conversions. The public site/docs inspected did not expose a general redemption API that a third-party router can invoke now.

**Exact product mechanism.** In the proposed form, compare an executable secondary quote with a verified issuer conversion/redemption route and let the holder execute the chosen path. Because the second path is not currently integrable, the mechanism degrades to secondary quote comparison plus instructions—a crowded dashboard/deep-link product.

**Required APIs/protocols.** PreStocks catalog/official event state, Jupiter V2, Token-2022 multiplier state, Solana RPC, and a future issuer conversion API/program if one is made public.

**Exact on-chain action.** Currently verified: PreStock → USDC secondary swap. Not verified: third-party issuer redemption or IPO/M&A conversion initiation.

**How Pyth changes the action.** Pyth does not currently supply a necessary PreStocks-specific redemption mechanism. A reference/mark divergence rule could affect a secondary sale, but that becomes another premium/discount guard.

**Why Solana is necessary.** PreStocks and secondary liquidity are on Solana, and event conversions are described as on-chain. The missing public conversion integration is the blocker.

**30-second judge demo.** The desired demo would show “sell now for X USDC versus verified issuer conversion Y by deadline Z” and execute one. Today only the sell-now branch is verifiable, so the demo would overpromise the product's differentiator.

**Mainnet feasibility.** **Secondary sale feasible; redemption-router product infeasible on current public evidence.** Sample quote-only outputs for 1,000,000 raw units were approximately 1.958713 USDC for OPENAI, 0.583348 for SPACEX and 1.043604 for ANTHROPIC. Those values are route evidence only and are affected by each token's multiplier/liquidity.

**API/key requirements.** Jupiter/RPC; public PreStocks data; issuer authorization/API for the missing branch. No such public third-party credential flow was found.

**Security/trust boundaries.** Never label a DEX sale “redemption.” Verify event status and deadlines from the issuer. Make liquidity/slippage explicit. Do not imply ownership rights beyond the issuer's terms.

**Failure/recovery path.** If no secondary route exists, show unavailable rather than a mark-price payout. If an issuer event path cannot be verified, link to official instructions and do not construct a transaction. Requote before any sale.

**Why it is a product rather than a demo.** It would become a product only with machine-readable issuer event state and executable conversions. Without them it is a quote dashboard and deep link.

**Top three reasons to reject.** (1) no public general redemption/conversion API was found; (2) the only real action is an ordinary Jupiter sale; (3) PreStocks Pulse already covers quote/premium discovery and multiplier-aware links.

**Validation status: eliminated in the proposed form.**

## Comparison and action reality

| Candidate | Technical result | Real mainnet financial action available now? | Validation disposition |
|---|---|---|---|
| A — policy drawdown/spending | Live xStock → USDC routes; direct receiver; ExactIn-only constraint | **Yes:** user-approved xStock → USDC drawdown. Exact invoice settlement remains conditional. | Keep, narrowed |
| B — transaction firewall | Stock-specific checks are real; authority only inside controlled path | **Only when attached to an action**, e.g. the A/Jupiter swap; B alone moves no funds | Keep, narrow component/product question unresolved |
| C — cross-issuer router | xStocks and Ondo routes live; Backpack sample unavailable | **Yes:** named xStocks/Ondo representation ↔ USDC routes | Eliminate as standalone due direct Henar overlap |
| D — ledger/accounting | Read-only reconstruction feasible with important basis gaps | **No** | Eliminate for this track |
| E — PreStocks exit/redemption | Secondary sales live; issuer redemption integration absent | **Yes for secondary sale; no for redemption/conversion** | Eliminate in proposed form |

## Blockers that must not be papered over

1. **Pyth paired-feed trial entitlement is still unverified.** Documentation promises a self-serve Pro trial and the catalog contains the required feeds, but only an owner-created authenticated token can prove that the trial reads both sides with the needed fields.
2. **Jupiter V2 is ExactIn-only.** Direct recipient settlement does not guarantee a fixed invoice value. Custom exact-transfer composition uses Metis-only `/build` and loses JupiterZ/RFQ competition.
3. **Multiplier correctness changes the transaction amount.** Current/pending on-chain state, activation time and truncating UI-to-raw conversion are mandatory; the pause window must refuse action, not merely warn.
4. **A generic Kamino loan guard is duplicated.** Kamino already has on-chain owner orders, price/LTV triggers, full/partial deleveraging and permissionless executor bonuses.
5. **A standalone “firewall” is not authoritative by default.** It controls only transactions constructed through its integration unless adopted by the protocol or enforced by a program.
6. **Cross-issuer breadth is uneven and the product wedge is occupied.** xStocks/Ondo quoted; sampled Backpack variants did not; Henar already owns the company-first framing.
7. **No public PreStocks redemption rail was found.** Secondary sale is not redemption.

## Strongest unresolved question

Can a newly issued self-serve Pyth Pro trial token actually return both `Equity.US.AAPL/USD` and `Crypto.AAPLX/USD` (and preferably the NVDA pair) with `marketSession`, `timestampUs`, per-feed `feedUpdateTimestamp`, confidence and publisher data at a rate suitable for a pre-transaction decision?

That single authenticated test determines whether the strongest sponsor-dependent safety claim in A/B is real. If it fails, A can still execute a multiplier-correct Jupiter drawdown, but the paired-feed refusal rule must be removed or sourced elsewhere rather than mocked.

## Primary source index

- Jupiter: [Swap V2 overview](https://developers.jup.ag/docs/swap), [order/execute](https://developers.jup.ag/docs/swap/order-and-execute), [build/custom transactions](https://developers.jup.ag/docs/swap/build), [V2 OpenAPI](https://github.com/jup-ag/docs/blob/main/openapi-spec/swap/v2/swap.yaml)
- xStocks: [multipliers](https://docs.xstocks.fi/developers/multipliers), [exchange integration](https://docs.xstocks.fi/docs/exchange-integration), [public API](https://api.xstocks.fi/api/v2/public/assets/AAPLx)
- Solana Token-2022: [Scaled UI Amount documentation](https://solana.com/docs/tokens/extensions/scaled-ui-amount), [program implementation](https://github.com/solana-program/token-2022/tree/bc9c3fa987807021549b41a884fcada35dc8e79e/interface/src/extension/scaled_ui_amount)
- Pyth: [Terminal/free trial](https://docs.pyth.network/price-feeds/pro/pyth-terminal), [API key](https://docs.pyth.network/price-feeds/pro/acquire-api-key), [Pro documentation](https://docs.pyth.network/price-feeds/pro)
- Kamino: [`klend-sdk`](https://github.com/Kamino-Finance/klend-sdk/tree/38845294447623f6de3afc9dec29875f959f6f48/src/obligation_orders), [`klend` order implementation](https://github.com/Kamino-Finance/klend/tree/a08760976f51a3a58c4a0c6ea27b4a0e565bca79/programs/klend/src/state)
- Competitors: [xSpend](https://github.com/himanshu-rawat77/xspend/tree/36d864fa759a47d6ceb5b1fd183392ffa1a29568), [StockPilot](https://github.com/Vibeaman/StockPilot/tree/72694db9474f9431798fbe7e853960a7035fa838), [Multiplier](https://github.com/GODGRACE07/multiplier/tree/c0b5ad3793e6066e1e19e50ee4bd4f4bf8b3ec87), [GapGuard](https://github.com/angelraph/gapguard/tree/0c77f80ba8b02021275ad832dc1f33eb9d60543c), [Henar](https://github.com/aramzcrypto/henar/tree/c20e8b54dd3a18822b525f50ad2a6b5a3bbf1ab4), [PreStocks Pulse](https://github.com/aralroca/prestocks-pulse/tree/ee65b5dc9a409d591b778a42b6beaa98956da77e)
- PreStocks: [FAQ](https://prestocks.com/faq)
- Koinly: [xStocks support](https://support.koinly.io/en/articles/15516605-does-koinly-support-stocks)
