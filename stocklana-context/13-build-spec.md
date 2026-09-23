# Build Spec — Stocklana MVP

Date: 23 September 2026

Status: implementation-ready product specification; Milestone 1 complete, Milestone 2 not started

Selected direction: policy-preserving tokenized-stock portfolio drawdown

## 1. Objective

Build the smallest self-custodial web application that can turn a user's USDC liquidity target into one policy-compliant, multiplier-correct, reviewable, user-signed xStock → USDC transaction on Solana mainnet, then prove settlement.

The MVP succeeds through a real financial action. It does not require or claim autonomous enforcement outside the transaction path Stocklana constructs.

## 2. Exact MVP scope

### Included

- Connect one Solana wallet using a Wallet Standard-compatible adapter.
- Read the wallet's USDC, AAPLx, NVDAx, and TSLAx balances.
- Read each supported xStock mint's Token-2022 Scaled UI Amount state from mainnet.
- Accept a target USDC amount, a maximum slippage, and a minimum retained USD exposure for each supported xStock.
- Count existing USDC toward the target before considering a sale.
- Evaluate all supported xStock positions with non-zero balances.
- Treat displayed/economic amounts and raw integer token amounts as distinct types.
- Hard-block a candidate during the configured window around a pending multiplier activation.
- When Pyth is enabled and proven usable, enforce paired representation/reference divergence plus freshness, session, confidence, and publisher rules.
- Obtain live Jupiter Swap V2 ExactIn quotes and an assembled transaction.
- Select one eligible position deterministically and explain the selection and all rejected alternatives.
- Show the exact mint, displayed reduction, raw input, expected and minimum USDC output, post-trade exposure, policy checks, quote expiry, and destination.
- Require explicit wallet review and signature.
- Submit the signed transaction through Jupiter `/execute` without changing its message.
- Confirm the signature through mainnet RPC and reconcile pre/post token balances.
- Show a receipt containing the transaction signature and observed deltas.

### Definition of the retained-exposure rule

For V1, “retain at least X USD of an xStock” means:

> After the proposed sale, the remaining raw position must have a current conservative executable value of at least X USDC under a quote-only Jupiter V2 ExactIn order using the user's slippage limit.

The conservative value is the remaining-position quote's reviewed minimum output (`otherAmountThreshold`). Stocklana configures no integrator or referral fee in V1, but that does **not** make the route fee-free: Jupiter may return `feeBps`, `feeMint`, and `platformFee`, and those actual response fields must be retained and shown. This is deliberately stricter and more reproducible than a decorative spot-price mark. If the remaining position cannot receive a current quote, Stocklana cannot prove the floor and blocks that candidate. A zero floor does not require a quote for a zero remaining balance.

Jupiter Price V3 may be used for fast portfolio overview marks and initial quote sizing. It is not the sole authority for the retained-exposure safety decision.

## 3. Out of scope

- merchant receivers, checkout, QR codes, or exact invoice settlement;
- natural-language policies or AI-generated trades;
- autonomous, delegated, scheduled, recurring, or server-side signing;
- custody or storage of private keys;
- lending, leverage, Kamino obligation monitoring, or liquidation protection;
- a generic transaction firewall or wallet-wide enforcement claim;
- cross-issuer comparison, routing, or substitution;
- accounting, tax, cost basis, or historical portfolio reconstruction;
- PreStocks;
- buying xStocks, swaps between xStocks, baskets, rebalancing, DCA, or limit orders;
- assets other than AAPLx, NVDAx, TSLAx, and USDC;
- a database, user accounts, notifications, mobile application, or custom Solana program; and
- mocked Pyth behavior in the running product or public demo.

Test fixtures may reproduce Pyth payloads in automated tests, but the runtime must never present fixture data as live.

## 4. Architecture decision

Use one full-stack TypeScript web application, deployed as a single web service, with browser wallet integration and same-origin server endpoints. A Next.js App Router application is the default implementation shape because it can host the UI and server-only integrations without adding a separate backend deployment. No database and no custom on-chain program are required for V1.

```text
Browser
  wallet connection + policy form + review + explicit signature
         │ read requests / unsigned tx / signed tx
         ▼
Stocklana server
  asset registry ─ portfolio snapshot ─ policy engine ─ decision receipt
         │                 │                  │
         │                 │                  ├── Pyth Pro (gated)
         │                 │                  └── Jupiter Swap V2 / Price V3
         │                 └───────────────────── Solana mainnet RPC
         ▼
Jupiter /execute ──► Solana mainnet ──► RPC confirmation and balance evidence
```

### Component responsibilities

| Component | Responsibility | Must not do |
|---|---|---|
| Browser | Connect wallet, collect policies, display decisions, request wallet signature, render settlement evidence | Hold service API secrets, calculate authoritative raw amounts, alter the returned transaction |
| Stocklana server | Read and normalize current state, evaluate policy, call Pyth/Jupiter, bind the decision to the transaction, relay the signed transaction, verify settlement | Hold a user's private key, sign for the user, claim control of transactions created elsewhere |
| Wallet | Display/approve and add the user signature to the exact transaction message through `signTransaction` | Broadcast independently, mutate the message, or delegate signing to Stocklana |
| Jupiter V2 | Quote, construct the ExactIn swap, compete routes, execute/land the signed transaction | Decide Stocklana's portfolio policy |
| Solana RPC | Supply mint/account state and transaction evidence | Supply off-chain reference-price policy |
| Pyth Pro | Optionally supply paired representation/reference observations | Be treated as available without authenticated evidence |

### Why no custom Solana program

The required invariant is: **Stocklana must not offer or relay a transaction that fails its current policy checks, and the user must sign the exact reviewed action.** A server-side decision receipt, exact transaction-message binding, last-moment state checks, and wallet signature can enforce that invariant within Stocklana's controlled path.

Existing programs already enforce ownership and token movement: the wallet authorizes the transaction, Token-2022 controls the asset, and Jupiter invokes existing liquidity programs. A new program would not stop the user from trading through another application. It would add deployment, audit, oracle, compute, and upgrade-authority risk without providing a required V1 guarantee. A program should be reconsidered only if a later requirement demands protocol-wide or delegated enforcement that cannot be bypassed outside the app.

## 5. Supported asset registry

The server owns a closed, versioned registry. Unknown symbols or mints fail closed.

| Symbol | Mainnet mint | Token program | Decimals | Role |
|---|---|---|---:|---|
| AAPLx | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` | Token-2022 | 8 | sell candidate |
| NVDAx | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` | Token-2022 | 8 | sell candidate |
| TSLAx | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` | Token-2022 | 8 | sell candidate |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | Token Program | 6 | target/output asset |

Mint ownership, decimals, and required extension presence must also be checked against mainnet; the static registry is an allowlist, not a substitute for live validation. The on-chain mint is authoritative for multiplier state. Issuer APIs may supply display metadata only.

## 6. Amount model and conversion rules

### Required types

The codebase must use distinct branded/domain types rather than interchangeable numbers:

- `RawTokenAmount`: unsigned integer smallest units, represented as `bigint` or a decimal integer string at API boundaries;
- `UsdcRawAmount`: a distinct six-decimal raw integer type;
- `TokenDecimals`: validated non-negative integer;
- `Multiplier`: arbitrary-precision positive decimal;
- `UnscaledUiAmount`: arbitrary-precision token units before the multiplier;
- `DisplayedAmount`: arbitrary-precision economic/UI units after the multiplier;
- `UsdAmount`: fixed-point decimal with an explicit rounding policy;
- `UnixTimestampSeconds` and `UnixTimestampMicros`: different types; and
- `BasisPoints`: bounded integer.

JavaScript `number` must not be used for authoritative token arithmetic, multiplier arithmetic, timestamps in microseconds, or USD policy comparisons. Human strings are parsed into fixed/arbitrary precision before use.

### Active multiplier

Given the parsed Token-2022 Scaled UI Amount configuration:

- if `newMultiplierEffectiveTimestamp` is non-zero and current chain-aware time is at or after it, use `newMultiplier`;
- otherwise use `oldMultiplier`.

The server must retain both values and the activation timestamp in the decision evidence. It must not flatten the state to one number before evaluating the safety window.

### Conversions

For `d` mint decimals and active multiplier `m`, the high-precision application model is:

```text
unscaledUi = raw / 10^d
displayed  = unscaledUi × m
rawForDisplayedSale = floor(displayedSale / m × 10^d)
```

The transaction always receives `RawTokenAmount`. The shortcut `displayedAmount × 10^decimals` is forbidden.

The mathematical model alone is not treated as proof of parity with Token-2022. Solana's official Scaled UI conversion path uses floating-point multiplier semantics and documents that UI/raw conversions may not round-trip exactly. Milestone 1 must compare the high-precision implementation against the official Token-2022 helper or pinned reference implementation, including boundary values.

For a desired displayed reduction, Stocklana must:

1. calculate a conservative raw candidate with authoritative integer/fixed-precision application arithmetic;
2. convert that raw candidate back to a displayed amount through the official Token-2022 conversion behavior;
3. require the resulting displayed reduction to be less than or equal to the user's intended displayed reduction; and
4. decrement or reject the raw candidate if that invariant is not satisfied.

If the high-precision result and official helper differ at a tested boundary, the parity test fails and the difference must be investigated. The implementation must not silently select one behavior. Raw integer amount remains the transaction authority.

When a minimum displayed or USD amount must remain, rounding must favor preservation. A raw upper bound for a proposed sale is derived so the remaining amount rounds upward toward the required floor, then the retained-position Jupiter quote is the final policy check. Any conversion that overflows, produces a negative value, loses integer precision, or exceeds the live raw balance blocks the candidate.

### Activation safety window

Use a default symmetric window of 15 minutes before through 15 minutes after a non-zero pending activation timestamp:

```text
block when abs(authoritativeNow - activationTimestamp) <= 900 seconds
```

The boundary is inclusive. `authoritativeNow` uses the server clock only after validating normal clock skew against the current Solana block time. The mint state and window must be checked when evaluating the candidate and again immediately before the signed transaction is relayed. A violation is a hard refusal, never a warning override.

## 7. Portfolio and pricing data flow

1. The browser sends the connected wallet public key to the server.
2. The server validates it and reads all token accounts for the four allowlisted mints from mainnet RPC.
3. The server reads each present xStock mint account and parses the Scaled UI Amount extension.
4. It computes active displayed balances from raw balances with arbitrary-precision arithmetic.
5. It fetches Jupiter Price V3 marks for overview display and records each response's `blockId`.
6. It rejects stale overview marks using a configurable maximum slot lag from the RPC's current slot. A missing or filtered Price V3 result is shown as unavailable, not zero.
7. On a drawdown request, it calculates `missingUsdcRaw = max(0, targetUsdcRaw - walletUsdcRaw)`.
8. If no USDC is missing, it returns “target already met” and constructs no transaction.
9. For each funded xStock, it evaluates multiplier state, user policy, optional Pyth state, executable sale quotes, and the conservative value of the proposed remaining position.
10. It returns one immutable decision view with the selected candidate, rejected candidates, checks, timestamps, sources, and expiry.

Portfolio snapshot values and policy decisions are related but not identical: an overview mark may be available while a candidate is blocked because an executable remaining-position quote or another safety input is unavailable.

## 8. Policy engine

### Inputs

- wallet public key;
- target USDC raw amount;
- current raw USDC balance;
- each supported xStock's raw balance, mint data, decimals, and parsed multiplier state;
- minimum retained USD/USDC exposure for each stock;
- maximum slippage in basis points, capped by a system maximum of 100 bps for V1;
- Jupiter Price V3 overview marks and freshness metadata;
- quote-only Jupiter V2 orders for proposed sale and remaining position;
- Pyth service availability, the user's explicit `requiresReferenceProtection` policy, and validated paired observations when that policy is on;
- server/RPC time and current slot; and
- registry/config version.

### Candidate evaluation

Each funded xStock is evaluated independently:

1. Confirm the symbol/mint/program/decimals against the allowlist and live mint.
2. Parse the current and pending multiplier state.
3. Refuse if the pending activation is inside the safety window.
4. If the user requires reference protection, require the Pyth service to be available and run every Pyth rule in Section 9; unavailable or invalid data blocks the candidate. If the user does not require reference protection, record `not_applied` and continue with every non-Pyth rule.
5. Determine whether the position can cover the missing USDC with a raw ExactIn sale while preserving its retained-exposure floor.
6. Find a raw input whose sale quote has `otherAmountThreshold >= missingUsdcRaw`.
7. Quote the raw position that would remain after that input. Require its `otherAmountThreshold >= retainedFloorUsdcRaw`, unless both the remaining raw balance and floor are zero.
8. Re-run the sale quote at the final raw input and retain the request ID, expected output, reviewed minimum output, route metadata, price impact, transaction, expiry, and Jupiter's returned `feeBps`, `feeMint`, and `platformFee` fields.

The raw input search begins with a Price V3-based estimate only as an optimization. It brackets and refines against actual `/order` responses, uses integer raw amounts, and stops after a configured request bound. Failure to find a covering amount within the balance and retained-floor constraint rejects the candidate. The implementation must not assume linear pricing or derive the signed amount from a floating-point USD division.

### Selection rule

From candidates that pass all checks and cover the missing amount, choose deterministically by:

1. lowest percentage of the position's displayed balance reduced;
2. then lowest quoted price impact;
3. then fixed symbol order: AAPLx, NVDAx, TSLAx.

This is a transparent V1 heuristic, not an optimization or investment recommendation. The UI states the rule. It must not hard-code the illustrative AAPLx outcome.

### Output

The engine returns one of:

- `target_already_met`: no transaction;
- `actionable`: selected proposal plus all candidate results;
- `blocked`: no eligible candidate, with machine-readable and human-readable reasons; or
- `refresh_required`: previously valid state or quote expired before signing/submission.

An actionable decision contains:

- wallet, target, existing USDC, and missing USDC;
- selected mint/symbol and selection explanation;
- raw balance, displayed balance, displayed reduction, exact raw input, and displayed remainder;
- expected output, minimum output, slippage, and price impact;
- Jupiter `feeBps`, `feeMint`, and `platformFee` exactly as returned, including explicit null/absent states;
- conservative post-trade retained value;
- each policy check with pass/block/not-enabled status, source timestamp, and reason;
- every alternative with its rejection or ranking reason;
- Jupiter request ID and transaction-message hash;
- pre-trade token account snapshots;
- creation and expiry timestamps; and
- registry/config version.

## 9. Pyth service and reference-protection policy

### Service availability

The Pyth service is `available` only when all of the following are true:

- a server-side Pyth Pro API key is configured;
- an authenticated entitlement test succeeds for all six required feeds;
- the live payload contains the required fields;
- the representation and equity feeds' units have been validated against current executable/on-chain economics; and
- startup health checks confirm the configured rules can be evaluated.

Required pairs:

| Asset | Representation feed | Reference feed |
|---|---|---|
| AAPLx | `Crypto.AAPLX/USD` (Lazer ID 1792) | `Equity.US.AAPL/USD` (Lazer ID 922) |
| NVDAx | `Crypto.NVDAX/USD` (Lazer ID 1833) | `Equity.US.NVDA/USD` (Lazer ID 1314) |
| TSLAx | `Crypto.TSLAX/USD` (Lazer ID 1847) | `Equity.US.TSLA/USD` (Lazer ID 1435) |

If any requirement fails, the runtime reports the Pyth service as **unavailable**. It does not fall back to Hermes, Jupiter, a cached fixture, or a simulated pass under a Pyth label.

### User policy

`requiresReferenceProtection` is an explicit user policy and is separate from service availability:

- **ON:** Pyth service availability and fresh, session-valid paired observations are mandatory. A non-regular underlying-equity session, stale or carried-forward reference, excessive confidence interval, insufficient publisher count, or excessive divergence blocks the candidate. There is no automatic downgrade to an unprotected trade.
- **OFF:** the core drawdown may continue without the Pyth divergence rule. The decision receipt and UI must state `reference protection not applied`. Multiplier safety, retained exposure, slippage, transaction correctness, and every other policy remain enforced.

The UI may allow the policy to be turned on only when the service reports available. If a previously available service becomes unavailable after the user turned protection on, evaluation fails closed and requires a fresh user decision; it must not flip the policy off silently.

### Validation rules

When `requiresReferenceProtection` is ON, validate each paired observation:

- parse price as `mantissa × 10^exponent` with arbitrary precision;
- compare `feedUpdateTimestamp` to the envelope `timestampUs`, not merely receipt time;
- require both feeds' update ages to be no more than `PYTH_MAX_FEED_AGE_MS`, default 5,000 ms;
- reject future timestamps beyond a small configured clock-skew tolerance;
- require both the underlying-equity and representation observations' `marketSession` to be exactly `regular` for V1; pre-market, post-market, overnight, closed, missing, or unknown values block the candidate;
- require `publisherCount` to meet the catalog's current `min_publishers` for that feed;
- require `confidence / abs(price)` to be no greater than `PYTH_MAX_CONFIDENCE_BPS`, default 100 bps; and
- compute `abs(representationPrice - referencePrice) / referencePrice × 10,000` and require it not to exceed the user's configured divergence limit, default 100 bps.

The exact `marketSession` values currently documented are `regular`, `preMarket`, `postMarket`, `overNight`, and `closed`. Unknown values fail closed. A recent envelope with an old `feedUpdateTimestamp` is stale.

The selected Pyth observations and validation results are recorded in the decision receipt but not placed on-chain.

## 10. Jupiter V2 integration

### API choice

Use the current authenticated Jupiter Swap V2 API at `https://api.jup.ag`:

- Price V3 for non-authoritative overview marks and initial sizing;
- `GET /swap/v2/order` without `taker` for quote-only searches;
- `GET /swap/v2/order` with the connected wallet as `taker` for the final assembled transaction; and
- `POST /swap/v2/execute` for the wallet-signed, unmodified transaction.

Use ExactIn only. The input `amount` is the exact raw xStock integer. The output mint is always the allowlisted USDC mint. Set the user's validated `slippageBps`. Do not set a separate receiver, payer, integrator fee, or referral account in V1.

`outAmount` is the expected pre-slippage output. `otherAmountThreshold` is the reviewed minimum output after slippage and is the amount used to determine whether a proposal can cover the missing USDC. The decision model records `feeBps`, `feeMint`, and `platformFee` exactly as Jupiter returns them. These may represent Jupiter fees even when Stocklana configures no referral or integrator fee; no fee rate is hard-coded and missing fields are not rewritten as zero.

Settlement authority is the wallet-level change observed through Solana RPC. Jupiter `/execute` fields `totalInputAmount`, `inputAmountResult`, `outputAmountResult`, and `totalOutputAmount` are recorded and reconciled with the RPC-observed changes; they do not replace them.

### `/build` and JupiterZ correction

Do not use `/build` for this MVP because no custom instruction is required. `/order` plus `/execute` keeps the recommended managed path and lets Metis, standalone JupiterZ, Dflow, and OKX compete where supported.

The prior blanket assumption that `/build` necessarily loses all JupiterZ liquidity is incorrect. Current Jupiter RFQ V2 documentation states that JupiterZ RFQ V2 liquidity is integrated into Metis; therefore a Metis-only `/build` route can include that RFQ V2 liquidity. `/build` still does not provide the same all-router Meta-Aggregator competition or standalone JupiterZ V1/direct path as `/order`. Current documentation verifies the capability; the read-only sample `/build` routes checked during this phase used AMM venues and did not independently observe an RFQ V2 fill.

This distinction does not affect the selected architecture: `/order` is the smaller and more capable path for an unmodified, user-signed drawdown transaction.

### Quote validity and mutation rules

- Treat the order as short-lived and display its expiry/countdown.
- Refresh rather than reuse an expired order.
- Accept that `/order` may return a v0 versioned transaction and that JupiterZ routes can require an additional market-maker signature during `/execute`.
- Decode the returned transaction server-side and verify its network, fee payer/taker relationship, allowlisted input/output mints, raw input, and absence of an unexpected recipient or authority.
- Hash the canonical transaction message and bind it to the policy decision.
- The browser wallet uses `signTransaction` to add the user's signature and must not call wallet `sendTransaction` or independently broadcast the transaction.
- The browser returns the user-signed transaction to Stocklana's server.
- Before `/execute`, the server verifies the signed transaction has the same canonical message bytes/hash, then sends it with the original `requestId`.
- The user signature must be added without mutating the transaction message. Stocklana does not require the locally signed transaction to already contain every signature a JupiterZ route needs; Jupiter may add the market-maker signature during `/execute`.
- Never append instructions to a JupiterZ transaction or submit a modified `/order` transaction.

## 11. Decision binding and API boundaries

No database is required. The server issues a short-lived decision receipt containing the actionable decision fields and transaction-message hash. It signs the receipt with an HMAC using a server-only secret.

Conceptual same-origin endpoints:

- `GET /api/portfolio?wallet=...` → current normalized snapshot and feature availability;
- `POST /api/drawdown/evaluate` → selected/rejected candidates and, when actionable, the unsigned Jupiter transaction plus signed receipt;
- `POST /api/drawdown/execute` → signed transaction plus decision receipt;
- `GET /api/transactions/:signature` → confirmation and reconciled evidence.

The HMAC is not user authentication and does not authorize funds. It prevents a browser or network client from altering the server's decision fields between review and relay. The wallet signature remains the only user authorization.

Before relay, the server verifies the receipt, expiry, wallet, message hash, raw amount, mints, and destination; reloads multiplier state; repeats the activation-window check; and, when enabled, repeats the time-sensitive Pyth checks. If a changed state affects the decision, it refuses relay and requires a fresh evaluation and wallet signature.

## 12. Transaction flow

1. User connects the wallet; no signature is requested merely to view the portfolio.
2. Server returns a mainnet portfolio snapshot and policy-feature status.
3. User enters the USDC target and deterministic policies.
4. Server counts existing USDC and evaluates every funded supported xStock.
5. Server obtains quote-only orders, computes the selected raw input, and checks the remaining-position floor.
6. Server obtains a final `/order` transaction with the user's wallet as `taker`.
7. Server validates/decodes the possibly-v0 transaction, binds its canonical message hash to a signed decision receipt, and returns the review model plus transaction.
8. User reviews the exact proposal and explicitly clicks Sign and swap.
9. Browser calls wallet `signTransaction`; the wallet displays the transaction and adds the user's signature without broadcasting it. The application never receives a private key.
10. Browser returns the signed transaction and decision receipt to the server.
11. Server verifies the canonical message binding and all last-moment checks. It does not require a JupiterZ market-maker signature to be present locally.
12. Server submits the user-signed, message-unchanged transaction to Jupiter `/execute` using the original request ID; Jupiter may add the route's required market-maker signature.
13. Server records the returned signature and execution response in the client-visible session state.
14. Server polls mainnet RPC for a finalized or confirmed result within the configured timeout and loads the transaction metadata.
15. Server compares the user's pre/post xStock raw balance and USDC raw balance, accounting for token-account creation where applicable.
16. UI shows confirmed, failed, expired, or needs-investigation evidence. It never retries a financial transaction automatically.

## 13. Wallet and signature boundaries

- Support standard injected Solana wallets through Wallet Standard.
- V1 supports one connected owner/taker and sends USDC back to that same wallet.
- No wallet private key, seed phrase, session key, keypair file, or server signer is accepted or stored.
- The wallet must explicitly sign each financial transaction.
- Signing uses `signTransaction`, not `sendTransaction`; the browser wallet must not broadcast the `/order` transaction.
- The returned transaction may be v0 and partially signed. The required local invariant is the correct user signature over unchanged canonical message bytes, not the presence of every possible JupiterZ signature before `/execute`.
- A connection signature is not reusable authorization for a swap.
- Changing the wallet, mint, raw amount, slippage, USDC destination, transaction message, or expired quote invalidates the review and requires a new decision.
- The server may relay a signed transaction but cannot create the user's signature.
- Client policy values in local storage are convenience preferences only; the server validates every value and embeds the applied policy in the decision receipt.

## 14. Settlement verification

Jupiter `/execute` success is necessary but not sufficient for the receipt. Verification uses Solana RPC:

1. confirm the returned signature refers to the signed message;
2. require no transaction error at the selected commitment;
3. inspect pre/post token balances for the connected owner and exact mint accounts;
4. calculate the actual xStock raw debit and USDC raw credit;
5. convert the raw xStock debit to the displayed amount using the multiplier state bound to the decision, while also recording whether a later multiplier state has changed;
6. require the actual USDC credit to be at least the reviewed minimum output; and
7. record Jupiter's `totalInputAmount`, `inputAmountResult`, `outputAmountResult`, and `totalOutputAmount`; and
8. reconcile those Jupiter fields with RPC-observed wallet deltas, treating the RPC-observed deltas as final evidence.

The receipt displays:

- Solana signature with explorer link;
- confirmation status and slot;
- input/output mints;
- exact raw input debit;
- displayed reduction under the reviewed multiplier;
- actual USDC credit;
- reviewed expected and minimum output;
- reviewed Jupiter `feeBps`, `feeMint`, and `platformFee` as returned;
- Jupiter execution `totalInputAmount`, `inputAmountResult`, `outputAmountResult`, and `totalOutputAmount` alongside RPC-observed deltas;
- post-trade raw/displayed balances and retained exposure estimate; and
- any discrepancy flag.

If RPC confirmation succeeds but reconciliation is ambiguous, show **settled — needs investigation**, not failed and not safe to retry. The app never automatically sends a replacement transaction after an unknown or timed-out result.

## 15. Failure and recovery states

| State | User-visible meaning | Recovery |
|---|---|---|
| Wallet disconnected or changed | No stable owner for the decision | Reconnect and refresh |
| Unsupported/malformed mint state | Asset correctness cannot be proven | Block asset; refresh or investigate |
| No liquidity needed | Existing USDC already meets target | No transaction |
| Insufficient eligible portfolio | No position can cover the gap while preserving floors | Lower target or change explicit policies |
| Multiplier activation window | Corporate-action transition is too close | Show activation/window end; retry afterward |
| Stale RPC/price/quote | Decision inputs are no longer current | Refresh all state |
| Pyth unavailable, protection OFF | Reference protection was not requested or applied | Continue only with an explicit `not applied` disclosure; all other checks remain active |
| Pyth unavailable, protection ON | Required reference protection cannot run | Block and obtain service access or let the user explicitly start a new unprotected evaluation |
| Pyth invalid/stale/out of session, protection ON | Required reference policy failed | Block; wait for valid data/session and reevaluate |
| Quote search exhausted/rate-limited | A safe input was not resolved | Back off and retry evaluation; do not guess |
| Quote expired | Reviewed transaction is stale | Requote and require a new review/signature |
| Wallet rejected signing | User declined | Return to review; no retry |
| Transaction-message mismatch | Signed action differs from reviewed action | Hard block and rebuild from fresh state |
| Simulation/execute error | Jupiter or route rejected the transaction | Surface exact error, refresh, and require a new signature |
| Confirmation timeout/unknown | Submission outcome is not yet proven | Query the same signature; never blindly resubmit |
| Confirmed failure | Transaction landed with an error | Show chain evidence; reevaluate from current balances |
| Settled below reviewed minimum or reconciliation mismatch | Unexpected result requiring investigation | Freeze retry UX, display evidence, and require manual review |

## 16. Frontend screens

The complete UX contract is in [16-ux-product-plan.md](./16-ux-product-plan.md). This section fixes the architecture-level surface boundaries.

### 1. Public landing (`/`)

The landing page works without a wallet or live API response and makes the product understandable in under 30 seconds. It contains only:

- hero and `Launch App` CTA;
- one illustrative 80 USDC need showing existing USDC counted first;
- three-step explanation;
- why this is different from a swap;
- one connected Solana/xStocks/Jupiter/Pyth explanation;
- self-custody and safety statement; and
- closing `Launch App` CTA.

No market charts, terminal, feature-card grid, wallet-gated explanation, AI imagery, or live balance facsimile belongs on `/`.

### 2. Product shell and portfolio (`/app`)

- persistent environment badge: `Devnet — synthetic assets`, `Mainnet — read only`, or `Mainnet — real transaction`;
- connected wallet and change/disconnect control;
- USDC first, then AAPLx/NVDAx/TSLAx balances;
- displayed/economic balance as the primary quantity;
- raw balance, token-account count, live mint metadata, multiplier state, and RPC slot under `Inspect balances`;
- Pyth service availability displayed separately from the user's reference-protection policy; and
- one clear `Request USDC` action.

States: disconnected, connecting, loading, empty portfolio, partial/malformed asset, stale data, RPC rate limit/error, wallet changed, ready. Loading must not flash zero balances, and malformed live mint state must never be replaced with registry metadata.

### 3. Request USDC and policy setup (`/app/request`)

- total target USDC;
- existing USDC and calculated amount still needed in a persistent equation;
- per-stock minimum retained USD exposure;
- maximum slippage, default 50 bps and maximum 100 bps;
- explicit reference-protection policy switch; and
- concise definition of the conservative retained-exposure rule.

Pyth service availability and the user's policy are independent UI states. If protection was ON and service/data becomes invalid, evaluation blocks with protection still ON. The user must start a new explicitly unprotected evaluation to proceed without it.

States: invalid input, target already met, no supported positions, editing, evaluating by named phases, service/rate failure, reference-policy block, actionable.

### 4. Decision (`/app/decision`)

This is the product's primary surface. Without opening technical details, it shows:

- target, existing USDC, and remaining need;
- selected position and deterministic reason;
- every held alternative as selected, rejected, eligible-not-selected, or unavailable, with a plain reason;
- displayed amount being reduced;
- expected and minimum USDC output;
- pre/post portfolio exposure and retained floors; and
- concise policy checklist.

`Inspect` contains exact raw input, decimals, account aggregation, active/pending multiplier and activation time, mint/program checks, Jupiter route/mode/request/fee fields, Pyth evidence when applied, quote timestamps, and decision receipt/hash.

States: actionable, no eligible position, activation hard block, quote unavailable/expiring/expired, required reference protection blocked, and invalidated by changed state. Any refresh-changing field invalidates the decision.

### 5. Transaction review (`/app/review`)

- `You send` displayed xStock reduction;
- expected and reviewed minimum USDC received;
- destination wallet;
- post-trade retained exposure;
- Jupiter `feeBps`, `feeMint`, and `platformFee` exactly as returned, including `not returned`;
- reference-protection result; and
- quote expiry plus self-custody/message-binding statement.

Exact raw input, v0 message hash, program/accounts, and request ID remain available under Inspect. Signing is enabled only after the final order matches the reviewed decision and simulation/policy rechecks pass. A build mismatch, failed simulation, expired quote, wallet change, or disconnection hard-blocks signing and requires fresh review.

### 6. Wallet signing and execution state

- waiting for wallet;
- user rejected/closed wallet, explicitly stating nothing was sent;
- signature received;
- canonical message verified;
- sending signed transaction and original `requestId` to Jupiter `/execute`;
- submitted with persistent signature; and
- confirming against Jupiter and RPC.

The browser never broadcasts. No celebratory success or portfolio mutation appears at `submitted`.

### 7. Settlement/receipt (`/app/receipt/[id]`)

- confirming/confirmed/failed/unknown/needs-investigation status;
- request reconciliation: target, existing USDC, gap, actual credit, final balance;
- reviewed versus actual raw/displayed input;
- Jupiter execution totals and fee fields reconciled against RPC wallet deltas;
- post-trade portfolio and policy evidence;
- signature, slot, timestamps, request ID, and explorer link; and
- `Start a new drawdown`, always from fresh state.

Unknown offers status inspection for the same signature, never blind resubmission. Needs-investigation freezes retry and preserves inspectable evidence.

## 17. Exact two-minute demo journey

The wallet is pre-funded on mainnet with approximately 420 USD of AAPLx, 650 USD of NVDAx, 20 USDC, enough SOL for fees, and optionally TSLAx. The values are live; no selection is hard-coded.

| Time | Demo action |
|---:|---|
| 0:00–0:12 | On `/`, state the one-sentence product and use the 80 target − 20 existing = 60 needed example; launch the app. |
| 0:12–0:25 | Connect the pre-funded wallet and show the real portfolio under the persistent mainnet environment badge. Briefly expose raw/displayed inspectability. |
| 0:25–0:40 | Enter an 80 USDC target, 600 USD NVDA retained floor, and 0.5% maximum slippage. State the reference-protection choice separately from Pyth service availability. |
| 0:40–1:00 | Evaluate. The decision surface shows 20 existing, 60 needed, one selected position, NVDAx's retained-floor rejection, other alternatives, and the before/after portfolio. |
| 1:00–1:14 | Open Inspect briefly: exact raw input, active/pending multiplier, activation-window result, Jupiter route/fees/request ID, and Pyth evidence or `Not applied`. |
| 1:14–1:27 | Continue to exact transaction review: send amount, expected/minimum receive, wallet destination, retained exposure, fee fields, and expiry. Click `Sign in wallet`. |
| 1:27–1:40 | Wallet signs; show canonical-message verification and server submission through Jupiter rather than browser broadcast. |
| 1:40–2:00 | Show RPC-observed xStock debit and USDC credit, Jupiter-total reconciliation, post-trade portfolio, policies, signature, and explorer evidence. |

If Pyth trial access is unavailable, the demo says so plainly and shows the Pyth service as unavailable. Reference protection must be OFF and visibly `not applied`; it is never silently downgraded after being requested. The demo does not substitute mock data. If current live balances or quotes make the illustrative AAPLx choice invalid, the demo follows the engine's real decision.

## 18. Test plan

### Unit and property tests

- raw ↔ unscaled ↔ displayed conversions across multiplier values and decimal counts;
- official Token-2022 fixture parity before, exactly at, and after activation;
- truncation for displayed-sale-to-raw conversion;
- conservative raw-candidate back-conversion that never exceeds the intended displayed reduction;
- parity with the official Token-2022 helper/reference behavior, including floating-point boundary and non-round-trip cases;
- conservative rounding for retained floors;
- large balances and high-precision multipliers without `number` precision loss;
- USDC-first missing-liquidity calculation;
- inclusive activation-window boundaries;
- Pyth exponent, timestamp-microsecond, confidence, publisher, session, and divergence calculations;
- deterministic candidate ordering and tie-breaks; and
- decision receipt canonicalization, expiry, HMAC, and message hashing.

Property tests must establish that converting a displayed sale to raw never sells more raw units than the chosen floor conversion permits and that the final retained-position quote, not a rounded display value, decides floor compliance.

### Contract/schema tests

- Solana parsed mint/account fixtures, including missing and malformed Scaled UI extensions;
- Jupiter Price V3 responses, omitted prices, slot metadata, `/order` quote-only and transaction responses, and `/execute` outcomes;
- Pyth live-shape fixtures containing carried-forward feeds, every session value, stale/future timestamps, low publisher count, and wide confidence; and
- schema drift must fail closed and emit an operator-visible error.

### Policy tests

- target already met with USDC;
- one eligible asset, multiple eligible assets, and none eligible;
- retained floor blocks a candidate;
- candidate cannot cover missing output;
- multiplier window blocks despite an otherwise valid quote;
- reference protection OFF with Pyth available/unavailable, and protection ON with Pyth valid, unavailable, stale, carried-forward, out of session, divergent, and unit-unverified;
- alternatives expose stable reason codes; and
- live-state change between review and relay forces reevaluation.

### Transaction security tests

- wallet mismatch;
- altered input amount, destination, mint, recent blockhash/message, or instruction set;
- expired/tampered decision receipt;
- unsupported token program or mint;
- changed signed message with a valid unrelated signature;
- replay after expiry; and
- execute response/RPC delta disagreement.

### Integration tests

- read current balances and all three xStock mint extensions from mainnet RPC;
- obtain read-only AAPLx/NVDAx/TSLAx → USDC V2 quotes;
- prove raw/displayed conversion against official Token-2022 semantics;
- validate Jupiter Price V3 freshness and unit interpretation;
- with a real Pyth key, read all six feeds and validate required fields/units; and
- assemble a final `/order` transaction for a funded wallet without signing it.

### End-to-end tests

- automated UI tests may use a test wallet adapter and deterministic API fixtures for non-financial states;
- localnet/devnet tests use explicitly synthetic Token-2022 xStock mirrors and fake/test USDC for wallet signing, multiplier transitions, hard blocks, failure states, and receipt UX;
- no devnet mirror may be presented as a real issuer asset;
- runtime feature gating must be tested with Pyth absent and unhealthy;
- a manual, low-value mainnet transaction is required before the product is called demo-ready; and
- the final rehearsal uses the actual demo wallet and live services, with an explicit maximum loss budget.

## 19. Environment and mainnet validation plan

### Environment strategy

| Environment | Purpose | Assets/data | Financial action rule |
|---|---|---|---|
| Localnet | Deterministic unit/integration/E2E and fault injection | Synthetic Token-2022 mirrors, fake USDC, controlled multiplier clocks, explicit API fixtures | Non-value only |
| Devnet | Shared wallet-signing, relay, failure, and receipt validation | Synthetic Token-2022 xStock mirrors and fake/test USDC, always labeled synthetic | Non-value only |
| Mainnet read-only | Continuous real-input correctness | Real mints, wallet balances, multipliers, Jupiter quotes, optional real Pyth feeds | No signature, `/execute`, or broadcast |
| Mainnet funded | Final smallest-practical validation and judge demo | Dedicated low-value wallet and live services | Explicit user review/signature; one bounded action at a time |

Ordinary development uses localnet and Devnet, not Solana Testnet. Synthetic devnet mirrors may reproduce mainnet mint-extension configuration but are never described as issuer xStocks. Environment selection is deployment/configuration-bound and shown persistently in the product shell; it is not a casual control that can change underneath a reviewed decision.

### Mainnet validation gates

Run these gates in order. Record timestamps, request IDs, RPC slots, signatures where applicable, and sanitized responses.

1. **Registry gate:** reverify the four mints, program owners, decimals, and Scaled UI extension presence.
2. **Conversion gate:** compare the high-precision local conversion against the official Token-2022 client/reference helper for live old/new multiplier state and boundary/non-round-trip cases; verify conservative raw candidates by converting them back through official behavior.
3. **Activation gate:** exercise synthetic boundary tests and confirm the live parser exposes pending state even when activation is in the future.
4. **Price-unit gate:** prove how Jupiter Price V3 `usdPrice` maps to the multiplier-adjusted displayed unit; until proven, use it only for non-authoritative display/initial sizing.
5. **Quote gate:** obtain current quote-only V2 orders for all three xStocks and verify `amount`, `outAmount`, `otherAmountThreshold`, slippage, and expiry behavior.
6. **Retained-floor gate:** quote a proposed sale and its exact remaining raw position, then prove the engine accepts/rejects the USD floor using `otherAmountThreshold`.
7. **Transaction gate:** use a funded wallet public key to obtain and decode a final `/order` transaction; verify exact raw input, output mint, owner, and message binding.
8. **Pyth entitlement gate:** with a self-serve trial token, retrieve all representation/equity pairs and confirm `timestampUs`, `feedUpdateTimestamp`, `marketSession`, confidence, publisher count, update rate, and unit alignment. If this fails, keep Pyth disabled.
9. **Low-value execution gate:** with explicit wallet approval, execute the smallest practical xStock → USDC drawdown through `/execute` and save the signature.
10. **Settlement gate:** reconcile Jupiter's reported totals with RPC pre/post token balances and verify the actual USDC credit is at least the reviewed minimum.
11. **Failure gate:** intentionally let a quote expire and reject a modified-message fixture to prove the app requires a fresh review rather than silently rebuilding.
12. **Demo gate:** rehearse the complete two-minute path on the funded mainnet demo wallet without relying on hard-coded selection or mock Pyth data.

No live transaction should be attempted until gates 1–7 pass. Pyth-dependent controls additionally require gate 8.

## 20. Environment variables and manual credentials

| Variable | Required | Purpose |
|---|---|---|
| `SOLANA_RPC_URL` | Yes | Server-only paid/reliable Solana mainnet RPC |
| `JUPITER_API_KEY` | Yes | Jupiter Developer Platform authentication |
| `PYTH_PRO_API_KEY` | Only for Pyth feature | Server-only Pyth Pro/Terminal authentication |
| `PYTH_SERVICE_ENABLED` | Yes | Explicit service-availability gate; defaults to `false` and does not express the user's policy |
| `PYTH_MAX_FEED_AGE_MS` | When Pyth enabled | Default `5000` |
| `PYTH_MAX_CONFIDENCE_BPS` | When Pyth enabled | Default `100` |
| `PYTH_CLOCK_SKEW_MS` | When Pyth enabled | Small allowed timestamp skew |
| `JUPITER_PRICE_MAX_SLOT_LAG` | Yes | Overview-price freshness bound |
| `MULTIPLIER_SAFETY_WINDOW_SECONDS` | Yes | Fixed/default `900`; do not expose as a casual user override |
| `DECISION_RECEIPT_SECRET` | Yes | High-entropy server-only HMAC secret |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | Yes | Deployment-bound `devnet` or `mainnet-beta`; never Testnet for ordinary development and never changed during a reviewed flow |
| `NEXT_PUBLIC_APP_MODE` | Yes | `synthetic-devnet`, `mainnet-read-only`, or `mainnet-funded`; drives the persistent environment label and action gate |
| `NEXT_PUBLIC_EXPLORER_BASE_URL` | Optional | Transaction evidence link |

The user must manually obtain:

- a Jupiter Developer Platform API key;
- a reliable Solana mainnet RPC endpoint/key;
- a Pyth Terminal/Pro trial API key if the Pyth policy is to be demonstrated; and
- a dedicated demo wallet funded with enough SOL for fees, USDC, and the desired low-value AAPLx/NVDAx/TSLAx positions.

`DECISION_RECEIPT_SECRET` is generated during deployment; it is not an external credential. No wallet secret belongs in an environment variable.

## 21. Security boundaries

- **Self-custody:** only the wallet can authorize the sale.
- **Controlled-path policy:** Stocklana can refuse its own construction/relay path; it cannot stop trades made elsewhere.
- **Server-only secrets:** Jupiter, Pyth, RPC, and HMAC secrets never ship in the browser bundle or logs.
- **Closed asset set:** verify static allowlist and live mint/program metadata.
- **Fail-closed parsing:** unknown extensions, response fields, session values, instructions, destinations, or price units block the affected action.
- **Transaction binding:** a short-lived authenticated receipt binds policy inputs to the canonical transaction message.
- **No blind retries:** unknown confirmation status is reconciled by signature, not by submitting another financial action.
- **Freshness:** quote expiry, RPC slot lag, multiplier activation, and Pyth per-feed age are separate checks.
- **Source honesty:** Jupiter overview prices, executable quotes, Pyth observations, and on-chain multiplier state are labeled separately.
- **Logging:** redact API keys, authorization headers, full signed transaction blobs, and any unnecessary wallet-linked telemetry. Request IDs, slots, signatures, reason codes, and hashes may be logged.
- **Rate and abuse controls:** validate public keys and amounts, bound quote-search iterations, rate-limit evaluation/execute endpoints, and cap target/slippage values.
- **Content and investment boundary:** selection follows a disclosed deterministic user-policy rule and is not presented as individualized investment advice.

## 22. Acceptance criteria

The MVP is complete only when:

1. all four supported assets are read from a real mainnet wallet;
2. raw and displayed xStock balances are demonstrably distinct domain values;
3. official multiplier semantics and activation boundaries pass tests;
4. a safety-window candidate cannot reach wallet signing;
5. existing USDC reduces the requested drawdown correctly;
6. all funded candidates receive a visible passed, blocked, or ranked reason;
7. a retained floor is enforced by a current conservative remaining-position quote;
8. the final raw input is derived through multiplier-correct integer handling and live Jupiter ExactIn quotes;
9. the review shows expected/minimum USDC and post-trade exposure;
10. the wallet signs the exact reviewed transaction and the server detects message mutation;
11. one low-value mainnet xStock → USDC transaction confirms and reconciles against RPC balances;
12. failures and unknown settlement do not trigger an automatic retry; and
13. the Pyth service and the user's reference-protection policy are shown separately: protection ON is authentically enforced or blocks, while protection OFF is visibly `not applied`—never mocked or silently downgraded.

## 23. Implementation order

### Milestone 1 — read-only mainnet correctness slice

Build the typed asset/amount domain and a server-side validation harness that, for one supplied wallet public key:

- reads USDC and AAPLx/NVDAx/TSLAx raw balances;
- parses live Scaled UI Amount state;
- calculates displayed balances with official semantics;
- proves high-precision conversion parity against the official Token-2022 helper/reference implementation and checks conservative raw candidates by converting them back to displayed units;
- reports pending activation state and hard-block status;
- retrieves quote-only Jupiter V2 xStock → USDC orders and records `inAmount`, `outAmount`, `otherAmountThreshold`, `slippageBps`, `priceImpact`, `router`, `mode`, `feeBps`, `feeMint`, `platformFee`, `expireAt`, and `requestId` when present; and
- proves the remaining-position retained-floor calculation without constructing or signing a transaction.

Exit evidence: automated conversion/parity/boundary tests plus one timestamped read-only mainnet report for all funded supported assets. Any boundary mismatch between local arithmetic and official Token-2022 behavior fails the milestone pending investigation. This is the exact first implementation milestone.

### Milestone 2 — deterministic policy engine

Implement USDC-first calculation, retained floors, bounded raw quote search, rejection reason codes, deterministic selection, quote expiry, and the complete review model. Test all no-action and blocked cases.

### Milestone 3 — optional Pyth gate

Obtain the trial key, run the entitlement/unit test, and implement the authenticated paired-feed validator only if it passes. Keep the production feature off otherwise.

### Milestone 4 — unsigned transaction and review UI

Add wallet connection, portfolio/request/review screens, final Jupiter `/order`, transaction decoding, message hashing, and short-lived signed decision receipts. Stop before relay until mutation/security tests pass.

### Milestone 5 — signing, execute, and verification

Add explicit wallet signing, last-moment rechecks, unchanged `/execute` relay, confirmation polling, balance reconciliation, and the evidence receipt. Run one explicitly approved low-value mainnet transaction.

### Milestone 6 — demo hardening

Exercise failure states, rate limits, stale data, wallet changes, quote expiry, and unknown confirmation; fund the dedicated demo wallet; rehearse the live two-minute journey; and freeze the supported asset/config set.

## 24. Unresolved blockers and validation questions

### Blocking only the optional Pyth feature

1. **Trial entitlement:** no authenticated trial key has yet proven access to all required `Equity.US.*` and `Crypto.*X` feeds with the needed fields and usable update rate.
2. **Feed-unit alignment:** the `Crypto.*X/USD` price must be proven to correspond to the multiplier-adjusted displayed economic unit used by the portfolio calculation before divergence can block a trade.

Until both pass, Pyth remains disabled and the product must not make a Pyth-backed safety claim.

### Blocking demo readiness, not architecture

3. **Funded end-to-end evidence:** `/order` construction is verified read-only, but an owner-signed `/execute` and RPC-reconciled xStock → USDC mainnet settlement has not yet been performed.
4. **Jupiter fee and output semantics:** validate on a later low-value transaction that `otherAmountThreshold` is the reviewed conservative output floor, record the actual fee fields Jupiter returns, and reconcile all `/execute` amount-result fields with RPC wallet deltas.
5. **Price V3 unit semantics for scaled xStocks:** validate whether `usdPrice` is per displayed economic unit. Until then, it cannot be the authoritative retained-floor measure.

None of these requires a custom program or a different architecture. The core product can proceed through the read-only correctness milestone while credentials and the funded validation wallet are prepared.

## 25. Verified facts versus remaining claims

### Verified live or in code during research

- AAPLx, NVDAx, and TSLAx mints are Token-2022, have eight decimals, and expose Scaled UI Amount state.
- Current Jupiter Swap V2 returns xStock → USDC routes for all three supported xStocks and can assemble a transaction for a funded public taker.
- Token-2022's official implementation switches to the new multiplier at/after its effective timestamp and divides by the multiplier when converting UI input to raw units.
- The Pyth public catalog contains all six intended feeds.
- Kamino obligation orders already implement owner-set on-chain lending triggers and permissionless execution; that is not this product.
- Current Jupiter documentation says RFQ V2 liquidity is consumed by Metis, correcting the assumption that Metis-only `/build` excludes every form of JupiterZ liquidity.

### Documented but not yet exercised with funds or credentials

- Jupiter `/execute` managed landing and its result fields for this exact xStock flow;
- authenticated Pyth Pro trial access and paired-feed payloads; and
- RFQ V2 actually appearing inside a sampled `/build` Metis route.

### Product rules selected here

- conservative executable value as the retained-exposure definition;
- 15-minute symmetric multiplier window;
- explicit opt-in reference protection, with `regular`-session-only enforcement for both paired Pyth observations when that policy is ON;
- deterministic smallest-percentage-reduction selection; and
- no custom program, database, receiver, or integrator fee for the MVP.

## 26. Primary references

- [Selected wedge](./12-selected-wedge.md)
- [Candidate validation](./11-candidate-validation.md)
- [Jupiter Swap V2](https://developers.jup.ag/docs/swap)
- [Jupiter order and execute](https://developers.jup.ag/docs/swap/order-and-execute)
- [Jupiter build](https://developers.jup.ag/docs/swap/build)
- [Jupiter RFQ V2 streaming](https://developers.jup.ag/docs/swap/routing/rfq/v2/streaming)
- [Jupiter Price V3](https://developers.jup.ag/docs/price/v3)
- [Jupiter Swap V2 OpenAPI](https://github.com/jup-ag/docs/blob/main/openapi-spec/swap/v2/swap.yaml)
- [xStocks multiplier guide](https://docs.xstocks.fi/developers/multipliers)
- [xStocks exchange integration](https://docs.xstocks.fi/docs/exchange-integration)
- [Solana Scaled UI Amount](https://solana.com/docs/tokens/extensions/scaled-ui-amount)
- [Token-2022 Scaled UI Amount implementation](https://github.com/solana-program/token-2022/tree/bc9c3fa987807021549b41a884fcada35dc8e79e/interface/src/extension/scaled_ui_amount)
- [Pyth Pro](https://docs.pyth.network/price-feeds/pro)
- [Pyth Terminal trial](https://docs.pyth.network/price-feeds/pro/pyth-terminal)
- [Pyth API key guide](https://docs.pyth.network/price-feeds/pro/acquire-api-key)
