# UX Product Plan — Stocklana Drawdown

Date: 23 September 2026

Status: approved product-surface plan for Milestone 2 onward; no visual or application implementation in this phase

## Product promise

Stocklana answers:

> I need liquidity from my stock portfolio. Which position can I safely reduce without breaking the investment rules I already chose?

Primary message:

> Turn tokenized-stock exposure into USDC without breaking the portfolio rules you already chose.

The application must be understandable without a wallet connection in under 30 seconds. The product experience must keep the causal order visible:

1. cash need;
2. cash already available;
3. portfolio rules;
4. eligible/rejected positions;
5. reviewed execution;
6. user signature;
7. verified settlement.

## User and primary job

The first user owns USDC and one or more supported xStocks in a self-custody Solana wallet. They want a specific amount of USDC and care more about preserving chosen stock exposure than manually deciding which token to sell.

Primary job:

> When I need a defined amount of USDC, evaluate my supported portfolio against my retained-exposure and execution rules, explain one safe proposed reduction, and let me sign only that exact action.

## Product principles

- **Need before asset:** never begin with “which token do you want to swap?”
- **Decision before transaction:** the selected position and rejected alternatives must be understood before wallet approval.
- **Consequences before mechanics:** show what leaves, what arrives, and what remains before raw bytes, mints, routers, and program details.
- **Safety blocks are final for that evaluation:** activation-window or enabled-reference-policy violations do not become warnings with an override button.
- **No false certainty:** unavailable data, expired quotes, unknown confirmation, and partial service failures are explicit states.
- **No silent downgrade:** requested Pyth reference protection either passes or blocks; turning it off requires a new explicit evaluation.
- **No fake financial proof:** devnet synthetic assets are labeled; mainnet execution success requires RPC-observed balance changes.
- **Self-custody stays visible:** Stocklana proposes and relays; only the connected wallet signs.

## Information architecture

### Public surface

- `/` — public landing page

### Product surface

- `/app` — connected product shell and portfolio start
- `/app/request` — request USDC and configure policies
- `/app/decision` — evaluated decision and alternatives
- `/app/review` — exact transaction review
- `/app/receipt/[id]` — settlement state and durable local receipt view

The routes may be implemented as URL-backed steps within one Next.js application. A browser refresh on decision/review must not silently reconstruct an executable action from stale client state. If its server-bound decision receipt is absent, invalid, or expired, return to fresh evaluation.

### Product navigation

The MVP product shell has only:

- Stocklana wordmark/home;
- current network/environment badge;
- Portfolio;
- Receipts, once at least one local receipt exists; and
- wallet control.

There is no Markets, Trade, Agents, Analytics, Earn, or Settings section. Policy setup belongs to the request flow because it is contextual to the drawdown.

## Public landing page (`/`)

The landing page is one focused explanation, not an alternate product dashboard. It does not require a wallet connection and contains only the sections below.

### 1. Hero

Required content:

- headline: “Turn tokenized-stock exposure into USDC without breaking the portfolio rules you already chose.”
- supporting line: “Tell Stocklana how much USDC you need. It counts the USDC you already hold, checks AAPLx, NVDAx, and TSLAx against your rules, and proposes one reviewable sale for you to sign.”
- primary CTA: `Launch App` → `/app`;
- concise trust line: `Self-custodial · You review and sign · No autonomous trading`.

The hero must not contain token price charts, a trading form, an AI motif, fake wallet balances, or rotating feature cards.

### 2. One simple $80 example

Show a single causal strip/card:

```text
Need                         Already have                  Stocklana finds
$80 USDC          −          $20 USDC          =           $60 from one eligible position
```

Then show the illustrative outcome:

```text
NVDAx rejected — would fall below your $600 retained floor
AAPLx selected — passes retained exposure and execution checks
```

Label it `Illustrative example`; never imply the app always selects AAPLx.

### 3. Three-step explanation

1. **Set the need and rules** — enter the target USDC, retained-exposure floors, maximum slippage, and optional reference protection.
2. **Review the decision** — see the selected position, rejected alternatives, reduction amount, expected/minimum USDC, and post-drawdown portfolio.
3. **Sign and verify** — approve the exact transaction in the wallet, then see confirmed wallet balance changes and the explorer evidence.

### 4. Why this is different from a swap

One short comparison, preferably two columns or one sentence pair:

- A swap asks: `Which token do you want to sell?`
- Stocklana asks: `How much USDC do you need, and which exposure must be preserved?`

Supporting sentence: “Jupiter executes the route. Stocklana determines whether a proposed portfolio reduction obeys the rules you chose and explains the result before signing.”

### 5. Why Solana and these integrations

Keep this as a single connected explanation rather than sponsor-logo tiles:

- **Solana Token-2022 / xStocks:** the on-chain multiplier can make displayed economic units differ from raw transaction units.
- **Jupiter:** supplies the current xStock → USDC quote and executable route.
- **Pyth, when configured and explicitly required:** supplies session-aware representation/reference checks; if unavailable, the app does not pretend protection was applied.

The chain is essential because the portfolio state, multiplier state, transaction, and settlement evidence can be tied to the same wallet action.

### 6. Self-custody and safety statement

Required copy concepts:

- Stocklana never stores a private key.
- The wallet signs the reviewed transaction; the browser does not independently broadcast it.
- A multiplier activation-window violation blocks execution.
- A requested Pyth reference check never silently falls back.
- Settlement is shown only after RPC-observed balance changes are reconciled.

### 7. Closing CTA

One `Launch App` button and a small line: `Start by connecting a Solana wallet. No transaction is sent until you review and sign.`

### Landing page states

| State | Behavior |
|---|---|
| Normal | All static product explanation is available without APIs or wallet |
| JavaScript unavailable | Core message, example, safety statement, and CTA remain readable |
| Narrow/mobile | Sections stack; the $80 equation wraps in causal order; CTA stays visible without a sticky obstruction |
| Integration degraded | Landing stays static; do not show live-service status here unless there is a material outage affecting launch |

## Product shell (`/app`)

### Global persistent elements

- environment badge: `Devnet — synthetic assets`, `Mainnet — read only`, or `Mainnet — funded action enabled`;
- wallet control with shortened address and change/disconnect;
- Pyth service indicator separate from the request's reference-protection policy;
- quote/decision expiry only on surfaces where it matters;
- no global portfolio value if authoritative valuation is unavailable.

The environment badge must be visually persistent during signing and receipt flows. `Devnet` must always include `synthetic assets`; never label a devnet mirror as AAPLx/NVDAx/TSLAx without a test/synthetic qualifier.

## Screen 1 — Portfolio

### User goal

Understand available USDC and supported xStock exposure, then start a drawdown.

### Primary content hierarchy

1. `Available USDC` as the first balance.
2. Supported positions: AAPLx, NVDAx, TSLAx.
3. A single primary action: `Request USDC`.
4. Small data-as-of/freshness line.
5. `Inspect balances` disclosure for raw amounts, multipliers, token accounts, mint/program verification, and RPC slot.

### Position row/card data

- symbol and name;
- displayed/economic token balance;
- USD overview value only when its source/freshness is valid;
- current multiplier status: `Stable` or `Activation scheduled`;
- policy floor summary if a previous local preference exists, clearly labeled as a draft until applied to a request.

Raw amount is not the main balance. It appears under Inspect with token decimals, aggregate account count, current/next multiplier, activation timestamp, and safety-window result.

### States

| State | Required behavior |
|---|---|
| Disconnected | Explain what will be read; show `Connect wallet`; no sample portfolio masquerading as the user |
| Connecting | Keep context, show wallet progress, allow cancel through wallet UI |
| Loading | Skeleton USDC/three supported positions; do not flash zeros |
| Ready | Show live aggregate balances and action |
| Empty | “No supported xStocks found”; USDC may still show; no drawdown action if there is nothing eligible to reduce |
| Partial read | Identify affected asset; fail that asset closed; allow action only if complete data exists for at least one candidate and USDC |
| Unsupported/malformed mint | Show asset as unavailable with reason; never substitute registry metadata for failed live checks |
| RPC unavailable/rate limited | Preserve last view only if clearly stale and disable new evaluation; retry action |
| Wallet changed | Clear all decision state and reload for the new owner |

## Screen 2 — Request USDC

### User goal

State the desired liquidity and the small set of rules that must hold.

### Fields

- `Target USDC` — total wallet USDC desired after settlement, not merely swap output;
- read-only `Existing USDC`;
- calculated `Still needed`;
- per-supported-stock `Minimum exposure to retain` in USD, allowing zero;
- `Maximum slippage`, default 0.5%, bounded by the spec;
- `Reference protection` ON/OFF control with service availability explained separately.

### Copy and behavior

The target equation stays visible:

```text
Target 80 USDC − Existing 20 USDC = 60 USDC still needed
```

Retained floors use plain language: `After this drawdown, keep at least $600 of NVDAx exposure.`

Reference-protection states:

- service available + OFF: `Not required for this request; the decision will be marked unprotected.`
- service available + ON: `Fresh, regular-session paired feeds are mandatory. Failure blocks the request.`
- service unavailable + OFF: `Reference protection unavailable and not applied. Other checks still run.`
- service unavailable + ON attempt: do not enable it; explain the missing credential/service.
- service becomes unavailable after ON: keep the policy ON and block evaluation; never flip it OFF.

### Primary action

`Evaluate portfolio`.

### States

| State | Required behavior |
|---|---|
| Invalid target | Explain positive/precision bounds inline |
| Target already met | “You already have enough USDC”; no sale; return to portfolio or start a different request |
| No xStock positions | Explain that no supported position can supply the gap |
| Editing | No quotes or selection presented as current |
| Evaluating | Show named phases: balances → multipliers → policies → quotes; allow safe cancel |
| Service/rate failure | Preserve entered policy; no fixture fallback; retry creates a fresh evaluation |
| Reference protection blocked | Keep ON, name failed feed/session/freshness condition, and offer `Retry` or `Start a new request without reference protection` |

## Screen 3 — Decision

This is Stocklana's most important surface.

### Comprehension test

Without opening Inspect, a non-technical user must be able to answer within ten seconds:

- How much USDC do I want?
- How much do I already have?
- How much more is needed?
- Which stock will be reduced?
- Why was it selected?
- Why were the others rejected or ranked lower?
- How much stock exposure will remain?
- How much USDC should arrive at minimum?

### Above-the-fold decision summary

```text
Your request
80 USDC target
20 USDC already available
60 USDC still needed

Proposed reduction
Reduce AAPLx by 0.1784 displayed units
Expected: 60.34 USDC
Minimum: 60.00 USDC

Why AAPLx
Passes your retained-exposure floor and all required execution checks.
```

Amounts above are illustrative data shapes, not hard-coded values.

### Alternatives section

Every supported position appears exactly once:

- `Selected` — one asset only, with selection reason.
- `Rejected` — reason code plus plain sentence, such as `Would leave $592.14, below your $600 NVDAx floor`.
- `Eligible, not selected` — state the deterministic ranking reason, such as lower post-trade retained buffer or inferior quote.
- `Unavailable` — malformed state, no route, stale data, activation block, or service failure.
- `Not held` — neutral, not a rejection.

The UI must not rely on red/green alone. Use label, icon, and sentence.

### Post-drawdown portfolio

Show a compact before/after view:

| Asset | Before | After | Rule |
|---|---:|---:|---|
| USDC | 20.00 | at least 80.00 | Target met |
| AAPLx | $420.00 | $359.66 | Above floor |
| NVDAx | $650.00 | $650.00 | Preserved |
| TSLAx | — | — | Not held |

Use `at least` for the minimum-output scenario and distinguish expected from guaranteed/reviewed minimum.

### Policy checklist

Small deterministic list:

- retained exposure;
- multiplier parsed and raw/displayed conversion verified;
- outside inclusive ±15-minute activation block;
- maximum slippage/minimum output;
- reference protection `Passed`, `Not requested`, or blocking failure;
- current quote and expiry.

### Inspect disclosure

Collapsed by default. Contains:

- exact raw token input and decimals;
- displayed reduction and official-helper back-conversion;
- current/next multiplier and activation timestamp;
- mint addresses and live owner programs;
- token-account aggregation count;
- Jupiter router, mode, request ID, quote timestamps/expiry, input/output raw amounts, `otherAmountThreshold`, price impact, response slippage, `feeBps`, `feeMint`, and `platformFee`;
- Pyth timestamps/session/confidence/publisher/divergence when applied;
- decision receipt ID/hash and data-as-of slots.

### Actions

- primary: `Continue to transaction review`;
- secondary: `Change request`;
- tertiary: `Refresh decision`.

There is no sign button on this screen. Decision comprehension and exact transaction review are separate consent moments.

### States

| State | Required behavior |
|---|---|
| Actionable | One selected candidate, all required checks passed, current quote |
| No eligible position | Keep alternatives/reasons visible; suggest lower target or changed floors, not an unsafe override |
| Activation blocked | Prominent hard block with activation time and earliest safe reevaluation time |
| Quote unavailable | Explain no route/API error per candidate; retry fresh evaluation |
| Quote expiring | Countdown; disable continue at expiry and require refresh |
| Reference required but invalid | Block; keep ON; show exact failed condition |
| Data changed | Invalidate the selection and return to evaluating/fresh decision |

## Screen 4 — Transaction review

### User goal

Consent to the exact wallet action after seeing its consequences.

### Main content

- `You send`: displayed xStock reduction, with exact raw amount available inline/Inspect;
- `You receive`: expected USDC and reviewed minimum (`otherAmountThreshold`);
- destination: connected wallet;
- after-trade retained exposure and floor;
- Jupiter fee fields exactly as returned, including a clear `not returned` state;
- reference protection status;
- quote expiry/countdown;
- one-line self-custody statement: `Your wallet signs this exact transaction. Stocklana cannot sign for you.`

### Message binding statement

`If the wallet, quote, amount, route, blockhash/message, or policy inputs change, this review expires and Stocklana will ask you to review again.`

### Inspect disclosure

Canonical message hash/bytes identifier, v0 transaction version, accounts/programs, request ID, raw amounts, fee fields, quote fields, and decision receipt hash. This is inspection, not a second wall of warnings.

### Actions

- primary: `Sign in wallet`;
- secondary: `Back to decision`.

### States

| State | Required behavior |
|---|---|
| Building | Bind fresh final Jupiter order to the reviewed decision |
| Ready | Enable signing only after canonical message verification and policy recheck |
| Build mismatch | Hard block and return to a fresh decision |
| Simulation failed | Hard block with readable reason; no signing |
| Quote expired | Disable signing; requote and re-review |
| Wallet mismatch/disconnected | Disable signing and invalidate review |

## Screen 5 — Wallet signing state

### State sequence

1. `Waiting for wallet` — the app has requested `signTransaction`.
2. `Signature received` — user signature returned; Stocklana is verifying the message was not mutated.
3. `Sending through Jupiter` — server submits the user-signed transaction plus original `requestId` to `/execute`; the browser does not broadcast.
4. `Submitted` — signature known; link can appear, but this is not settlement success.
5. `Confirming` — poll Jupiter/RPC and balances.

### Rejection and interruption

- wallet rejected: `You declined the signature. Nothing was sent.` Return to review if still valid.
- wallet closed/timeout: `No signature received. Nothing was sent.`
- message mismatch: hard block; never submit.
- execute response unknown: preserve the original signature/request ID and inspect before allowing any retry.

No confetti, green success toast, or portfolio mutation occurs at `Submitted`.

## Screen 6 — Settlement and receipt

### Status model

- `Confirming` — submitted but wallet deltas not final;
- `Confirmed` — successful chain transaction and reconciled wallet deltas;
- `Failed` — confirmed program/transaction failure;
- `Unknown` — timeout or unavailable evidence; continue checking the same signature;
- `Needs investigation` — Jupiter totals, reviewed minimum, or RPC deltas do not reconcile.

### Confirmed receipt content

1. outcome sentence: `You raised 60.31 USDC by reducing AAPLx.`
2. request reconciliation: target, existing USDC, required gap, actual USDC credit, final wallet USDC.
3. position reconciliation: actual raw xStock debit and displayed/economic reduction at the bound multiplier state.
4. post-trade portfolio and retained-floor result.
5. Jupiter reconciliation: `totalInputAmount`, `inputAmountResult`, `outputAmountResult`, `totalOutputAmount`, and fee fields versus RPC deltas.
6. policy receipt: each check and its outcome; reference protection explicitly `Passed` or `Not applied`.
7. signature, explorer link, timestamps, slot, request ID, and local receipt ID.
8. action: `Start a new drawdown` from fresh state.

### Failure/unknown recovery

- Never submit a second transaction merely because confirmation timed out.
- `Check status again` queries the same signature/request ID.
- If failure is confirmed, refresh balances and start a new evaluation.
- `Needs investigation` disables one-click retry and keeps all evidence exportable/copyable without secrets.

## End-to-end flow

```text
Landing
  → Launch App
  → Connect wallet
  → Portfolio
  → Request USDC
  → Policy setup
  → Evaluate
  → Decision
      ├─ no candidate / hard block → explain → edit or retry
      └─ selected candidate → Transaction review
            ├─ stale/mismatch/simulation failure → fresh decision
            └─ Sign in wallet
                  ├─ rejected → review
                  └─ signed → server verifies → Jupiter execute
                        → submitted → confirming
                              ├─ confirmed + reconciled → Receipt
                              ├─ confirmed failure → Failure receipt
                              └─ timeout → Unknown receipt → check same signature
```

## Exact two-minute demo journey

The wallet and market determine the actual candidate. The familiar values below are a narrative setup, not hard-coded logic.

| Time | Surface | Judge-visible proof |
|---:|---|---|
| 0:00–0:12 | Landing | One sentence explains the problem; the $80 example shows cash need minus existing USDC |
| 0:12–0:25 | Portfolio | Connect pre-funded wallet; mainnet badge; real USDC/AAPLx/NVDAx/TSLAx balances; optional quick Inspect of raw/displayed distinction |
| 0:25–0:40 | Request | Enter 80 target; app shows 20 existing and 60 needed; set $600 NVDAx floor and 0.5% max slippage; state reference-protection choice |
| 0:40–1:00 | Decision | Show selected asset, NVDAx rejection reason, other alternatives, displayed reduction, expected/minimum USDC, and before/after portfolio |
| 1:00–1:14 | Inspect | Briefly reveal exact raw input, multiplier/window result, Jupiter route/fees/request ID, and Pyth evidence or `Not applied` |
| 1:14–1:27 | Review | Show send/receive/minimum, destination wallet, retained floor, fee fields, and expiry; press `Sign in wallet` |
| 1:27–1:40 | Signing | Wallet signs; UI shows signature verification and Jupiter submission stages |
| 1:40–2:00 | Receipt | Show RPC-observed xStock debit/USDC credit, reconciled Jupiter totals, final exposure, signature, and explorer link |

Demo failure rule: if a live quote, multiplier window, or enabled Pyth rule blocks the planned action, demonstrate the real block and use a prepared safe alternative wallet/amount only through a fresh evaluation. Never switch to fixtures or prerecorded success.

## Environment and network UX

### Localnet/devnet

Purpose: complete non-value end-to-end testing.

- synthetic Token-2022 xStock mirrors with deliberately testable multipliers and pending activations;
- fake/test USDC;
- wallet signing and server relay;
- exact review/message binding;
- activation-window hard blocks at inclusive boundaries;
- Pyth policy fixtures only in automated/local service tests, never presented as real Pyth or mainnet market data;
- execution, failure, timeout, and receipt UI;
- visible badge: `Devnet — synthetic assets`.

The synthetic symbols should be visibly prefixed or suffixed in Inspect and user-facing labels, for example `Test AAPLx`, even if their mint configuration mirrors mainnet.

### Mainnet read-only

Purpose: prove current real-world inputs without risking funds.

- real supported mints and owner balances;
- live Token-2022 multiplier and activation state;
- real Jupiter quotes;
- optional real Pyth feeds when credentialed;
- no wallet signature, `/execute`, or broadcast;
- visible badge: `Mainnet — read only`.

### Mainnet funded

Purpose: one smallest-practical validation and the final judge demo.

- dedicated low-value demo wallet;
- full policy decision and review;
- user `signTransaction` only;
- server canonical-message verification and Jupiter `/execute`;
- RPC settlement reconciliation;
- visible badge: `Mainnet — real transaction` plus a clear monetary-action confirmation.

### Testnet

Not used for ordinary development. Devnet is the shared non-value environment; localnet is for deterministic/fault cases.

## Responsive behavior

- Design mobile-first because wallet approval often shifts attention to a mobile wallet even when the app is desktop.
- On narrow screens, preserve causal order: request summary → selected action → alternatives → after portfolio → policies → CTA.
- Tables collapse into labeled rows/cards; values keep labels adjacent.
- The primary CTA may be sticky only if it does not cover quote expiry, blocking reasons, or the minimum-output statement.
- Inspect content may scroll horizontally for hashes/raw data, while user-facing amounts never require horizontal scrolling.
- Desktop may place request summary beside proposed reduction, but reading order and DOM order remain logical.

## Accessibility and plain-language rules

- Minimum status communication uses text plus icon, never color alone.
- Focus moves to the blocking summary after evaluation errors and to the receipt heading after confirmation.
- Every disclosure and dialog is keyboard accessible and returns focus to its trigger.
- Quote-expiry countdown has a non-live textual expiry time; do not announce every second to screen readers.
- Use `expected` and `minimum` consistently; do not call a quote `guaranteed` unless Jupiter's current semantics explicitly support that wording.
- Use `displayed amount` in normal copy and `raw token amount` under Inspect; explain each once.
- Never call Pyth “enabled” when only service credentials exist; say `Reference protection: On/Off` separately from `Pyth service: Available/Unavailable`.
- Error messages state what did not happen: `Nothing was signed`, `Nothing was submitted`, or `Submission is known but settlement is not yet proven`.

## Data shapes required by the UI

### Decision summary

```ts
type DecisionView = {
  targetUsdc: UsdcRawAmount;
  existingUsdc: UsdcRawAmount;
  missingUsdc: UsdcRawAmount;
  selected: CandidateView | null;
  alternatives: CandidateView[];
  postPortfolio: PositionView[];
  policies: PolicyCheckView[];
  referenceProtection: "passed" | "not-requested" | "blocked";
  expiresAt: UnixTimestampMs;
  decisionReceiptId: string;
};
```

### Candidate row

```ts
type CandidateView = {
  symbol: "AAPLx" | "NVDAx" | "TSLAx";
  status: "selected" | "eligible" | "rejected" | "unavailable" | "not-held";
  reasonCode: string;
  reason: string;
  displayedReduction?: DisplayedTokenAmount;
  rawInput?: RawTokenAmount;
  expectedUsdc?: UsdcRawAmount;
  minimumUsdc?: UsdcRawAmount;
  retainedExposureUsd?: DecimalAmount;
  retainedFloorUsd?: DecimalAmount;
};
```

### Receipt

```ts
type ReceiptView = {
  status: "confirming" | "confirmed" | "failed" | "unknown" | "needs-investigation";
  signature?: string;
  reviewed: DecisionView;
  actualInputRaw?: RawTokenAmount;
  actualInputDisplayed?: DisplayedTokenAmount;
  actualUsdcCredit?: UsdcRawAmount;
  finalUsdcBalance?: UsdcRawAmount;
  jupiterTotals?: JupiterExecutionTotals;
  reconciliation?: ReconciliationView;
  slot?: bigint;
  confirmedAt?: UnixTimestampMs;
};
```

These are UI requirements, not authorization to collapse branded domain types into strings or numbers in the implementation.

## Analytics and proof events

If privacy-respecting product analytics are later enabled, the MVP event vocabulary is limited to non-financial metadata:

- landing CTA opened;
- wallet connected/failed;
- evaluation started/completed/blocked by reason code;
- decision Inspect opened;
- review reached;
- wallet signature requested/rejected/received;
- execute submitted;
- receipt confirmed/failed/unknown/investigation.

Never log wallet private data, exact balances, exact transaction message bytes, Pyth/Jupiter credentials, or unsigned/signed transaction payloads to third-party analytics.

## Traceability to product constraints

| Constraint | UX enforcement |
|---|---|
| Understandable in 30 seconds | Hero + one $80 equation + three steps |
| Product, not demo | Separate public landing, durable app flow, full error/receipt states |
| Real user problem | USDC need is the first input and first line of the decision |
| Solana essential | Token-2022 raw/displayed correctness and wallet/chain evidence are visible |
| Working end to end | Decision → review → sign-only → execute → wallet-delta receipt |
| No fake financial actions | Devnet synthetic label; mainnet success only after reconciliation |
| No bounty stacking | Integrations appear only where they enforce or execute the core flow |
| No trading terminal | No market navigation/charts/order book; technical details live under Inspect |
| No generic firewall | All checks are scoped to this Stocklana-constructed xStock drawdown |

## Explicit UX non-goals

- merchant QR or checkout;
- trading charts, watchlists, order books, or market discovery;
- AI chat, natural-language policies, agents, or automated recommendations;
- broad analytics, performance history, tax lots, or accounting;
- issuer comparison or substitution;
- lending, leverage, DCA, baskets, recurring actions, or autonomous execution;
- custom wallet or generic transaction-inspection product;
- social proof, points, rewards, referral mechanics, or gamification;
- a feature-card-heavy marketing page.

## Acceptance checks for design and implementation

Before Milestone 2+ UX is accepted:

1. A first-time tester can describe the product after seeing only the hero and $80 example.
2. A tester can state why the selected asset won and why each held alternative did not.
3. Expected output and minimum output are never visually conflated.
4. Pyth service availability and reference-protection policy are never visually conflated.
5. Raw amounts never appear as the primary economic quantity, but remain inspectable before signing.
6. No actionable state survives wallet, message, policy, quote, or expiry changes.
7. Devnet synthetic assets cannot be mistaken for issuer assets.
8. Submission cannot be mistaken for settlement.
9. Unknown settlement offers status inspection, not blind resubmission.
10. A confirmed receipt proves RPC-observed wallet changes and links the chain transaction.
