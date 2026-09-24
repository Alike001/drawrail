# Milestone 2 Evidence — Deterministic Drawdown Decision Flow

Date: 24 September 2026

Status: complete

Financial action status: read-only only; no taker transaction was constructed, no wallet signature was requested, `/execute` was not called, and no transaction was broadcast

## Policy engine implementation

Milestone 2 adds a deterministic policy engine over the verified Milestone 1 mainnet layer. It:

- calculates `max(target USDC - existing USDC, 0)` in branded bigint units;
- rejects invalid targets and caps maximum slippage at 100 basis points;
- evaluates every funded supported xStock and keeps zero/unavailable positions in the explanation;
- refuses a candidate before quoting when its live Token-2022 multiplier is inside the inclusive ±900-second safety window;
- requests live quote-only Jupiter Swap V2 ExactIn orders;
- derives a conservative raw candidate from a full-position executable quote, then accepts it only after a separate live quote proves `otherAmountThreshold >= missing USDC`;
- limits each candidate to five Jupiter requests and preserves one request for the exact remaining-position quote;
- uses the exact remaining raw position's `otherAmountThreshold` as the retained-exposure authority;
- records current-position, sale, and retained-position quote evidence;
- ranks valid candidates by smallest raw-balance percentage reduced, then lowest absolute quoted price impact, then fixed `AAPLx`, `NVDAx`, `TSLAx` order; and
- returns `actionable`, `blocked`, `target-already-met`, or `refresh-required` without producing a transaction.

The live decision needed three Jupiter calls for its funded candidate: full-position quote, proposed-input quote, and exact remaining-position quote. No JavaScript `number` participates in authoritative token or USDC arithmetic.

## Stable reason codes

The machine-readable vocabulary is centralized in `src/domain/reasons.ts` and covered by a completeness test:

- `TARGET_ALREADY_MET`
- `ZERO_BALANCE`
- `UNSUPPORTED_ASSET_STATE`
- `MULTIPLIER_WINDOW`
- `INSUFFICIENT_POSITION`
- `RETAINED_FLOOR`
- `NO_JUPITER_ROUTE`
- `QUOTE_EXPIRED`
- `SLIPPAGE_LIMIT`
- `RPC_STALE`
- `QUOTE_SEARCH_EXHAUSTED`
- `ELIGIBLE`
- `SELECTED`
- `LOWER_RANKED`
- `PYTH_NOT_ENABLED`

Each code maps to concise product copy. Internal service exceptions are not returned as candidate explanations.

## Frontend routes and surfaces

### Public route: `/`

The static landing page contains only:

- the locked product sentence and one Launch App action;
- a clearly labeled illustrative `80 - 20 = 60 USDC` example;
- the NVDAx retained-floor rejection and AAPLx eligibility example;
- three steps;
- the manual-swap versus DrawRail distinction;
- one connected Solana / Token-2022 / xStocks / Jupiter / optional-Pyth explanation;
- a self-custody and safety statement; and
- one closing Launch App action.

The landing test renders without a wallet, asserts the product sentence and `/app` link, and requires the marketing example to carry both visible `Illustrative example` copy and `data-kind="illustrative"`. The example object is local to the landing module and is never imported by the live policy engine or API.

### Product route: `/app`

Milestone 2 uses URL-local screen states inside the approved `/app` product shell:

1. explicit developer/read-only public-key control;
2. live portfolio;
3. USDC request and policy setup;
4. decision and all alternatives;
5. complete read-only review boundary.

The product shell keeps `Mainnet — Read only` visible. It displays USDC first, then AAPLx/NVDAx/TSLAx displayed balances and multiplier status. Raw balances, account counts, mint/program data, multiplier details, Jupiter fields, fees, request IDs, and RPC slot remain under Inspect disclosures.

Pyth is shown as `Not enabled yet`; there is no functional-looking toggle, fallback, or mock result.

The review action is available only for an actionable, unexpired decision. The review surface explicitly says signing is unavailable in Milestone 2 and contains no wallet popup, signature, success receipt, or transaction payload.

## Loading and failure states

Implemented product states include:

- no read-only wallet loaded;
- loading live portfolio;
- invalid wallet;
- RPC unavailable/rate limited;
- no supported xStock balance;
- per-asset unavailable/malformed state;
- evaluating balances, multipliers, policies, and quotes;
- target already met;
- no eligible position;
- multiplier activation hard block;
- no Jupiter route;
- Jupiter/search unavailable;
- quote expired/refresh required;
- actionable selected decision; and
- read-only review with signing explicitly disabled.

## Screenshots and responsive checks

Captured from the production build through local Chrome:

- `stocklana-context/screenshots/milestone-2-landing-desktop.png` — 1440 × 1100
- `stocklana-context/screenshots/milestone-2-landing-mobile.png` — 390 × 844
- `stocklana-context/screenshots/milestone-2-app-read-only.png` — 1440 × 1000

The desktop landing keeps the product sentence and illustrative decision above the fold. At 390 px, navigation, headline, trust statement, CTA, and example preserve causal order without horizontal scrolling. Application layouts collapse from paired/grid surfaces to single-column cards; technical values remain inside horizontally safe Inspect rows. Reduced-motion preferences disable meaningful transition duration.

## Live mainnet read-only evidence

Public read-only wallet used:

`8mha9DTRpy7XFX5oXpGJa5c8Gz5rDbi481bSTBuF3weh`

No claim is made about its owner. No private key was available or requested.

Portfolio observation:

- confirmed slot: `449843311` on the first Milestone 2 portfolio read;
- USDC: `154348009` raw = `154.348009` USDC, one token account;
- AAPLx: zero raw/displayed, live mint state verified, outside activation window;
- NVDAx: `6719605` raw = `0.06731036` displayed, one token account, live mint state verified, outside activation window; and
- TSLAx: zero raw/displayed, live mint state verified, outside activation window.

### Actionable decision

Inputs:

- target: `155000000` raw = 155 USDC;
- existing: `154348009` raw = 154.348009 USDC;
- missing: `651991` raw = 0.651991 USDC;
- retained floors: 0 USDC for all three positions;
- maximum slippage: 50 bps; and
- Pyth reference protection: not enabled.

Result:

- outcome: `actionable`;
- selected: NVDAx;
- AAPLx: `ZERO_BALANCE`;
- TSLAx: `ZERO_BALANCE`;
- proposed input: `290625` raw NVDAx;
- displayed reduction under the official multiplier path: `0.00291119` NVDAx;
- expected output: `663596` raw = 0.663596 USDC;
- reviewed minimum: `660279` raw = 0.660279 USDC;
- exact remaining raw position: `6428980`;
- conservative remaining-position value: `14422884` raw = 14.422884 USDC; and
- quote requests for NVDAx: 3.

The proposed quote used router `okx`, mode `manual`, `ExactIn`, response slippage 50 bps, and reported price impact `1.231754705888748`. Its request ID was `01a0d079-57f0-727e-b83a-254658893fa5`. The exact remaining-position quote used Metis and independently returned its conservative output.

### Live retained-floor rejection

The same 155 USDC request was reevaluated with an NVDAx retained floor of 14.50 USDC:

- outcome: `blocked`;
- NVDAx proposed input: `290597` raw;
- NVDAx minimum proposed output: `651993` raw USDC;
- exact remaining-position conservative value: `14424328` raw = 14.424328 USDC;
- retained floor: `14500000` raw = 14.50 USDC; and
- reason: `RETAINED_FLOOR`.

This is live evidence that the floor is enforced from the executable quote for the exact remaining raw position rather than a rounded displayed price estimate.

## Jupiter behavior observed

- Quote-only `/swap/v2/order` without a taker continued to return current xStock → USDC pricing with `transaction: null`; no final order was requested.
- Jupiter returned non-zero platform fee data: `feeBps: 10`, USDC as `feeMint`, and matching `platformFee` fields. DrawRail recorded the response rather than hard-coding it.
- The selected quote was routed by OKX while the retained-position quote was routed by Metis. The decision preserves each quote separately.
- Jupiter returned `expireAt: null`. DrawRail therefore applied a conservative local 30-second decision lifetime and required refresh after expiry.
- An initial 18-call binary-refinement implementation hit HTTP 429 on the unauthenticated endpoint. The final bounded strategy needs three live calls in the observed case and caps each candidate at five, while still requiring a separately quoted proposed raw input and exact remainder. Reliable deployment still requires a Jupiter API key.

## Tests and verification

Final command results:

```text
npm test          — 8 files, 46 tests passed
npm run typecheck — passed
npm run lint      — passed with no warnings
npm run build     — passed
git diff --check  — passed
```

Milestone 1's 28 tests remain passing. Added coverage includes:

- USDC-first calculation and target already met;
- one and multiple eligible positions;
- percentage, price-impact, and symbol tie-break ranking;
- retained-floor, insufficient-position, no-route, expiry, slippage, RPC-stale, unsupported-state, and activation-window rejection;
- bounded-search exhaustion;
- all-zero portfolio;
- stable reason-code completeness;
- policy target/slippage validation;
- bigint formatting above JavaScript's safe-integer range;
- rendered landing-page message, CTA, illustrative-data label, and environment labels.

Existing coverage continues to prove multiple token-account aggregation, zero balances, mint/program/decimal validation, malformed Scaled UI state rejection, official conversion parity, inclusive activation-window boundaries, Jupiter fee parsing, and large-balance precision.

## Files added or materially updated

- domain: `money.ts`, `policy.ts`, `portfolio.ts`, `reasons.ts`, and tests;
- server: `portfolio.ts`, `serialize.ts`, environment parsing, existing Jupiter/RPC reuse;
- APIs: `GET /api/portfolio`, `POST /api/drawdown/evaluate`;
- UI: landing page, persistent environment badge, `/app` multi-step read-only product, shared responsive styling;
- operations: `.env.example`, README, Next.js configuration; and
- evidence: this document and three local screenshots.

## Differences from build-spec assumptions

1. Milestone 2 keeps request, decision, and read-only review as explicit states within `/app` rather than committing stale decisions to separately reloadable URLs. URL-backed executable review remains a later transaction milestone concern.
2. Browser wallet connection is not implemented yet. The allowed, explicitly labeled public-key-only developer control is used for this read-only milestone.
3. No overview Price V3 mark is used. Portfolio USD values appear only when a current executable Jupiter quote exists during evaluation.
4. Jupiter omitted `expireAt` for the observed quote-only orders, so a conservative local 30-second decision expiry is applied and disclosed.
5. The initially contemplated deeper binary search was too request-heavy for the unauthenticated live endpoint. The implemented bounded proportional refinement still accepts only a separately live-quoted raw amount and retains a strict request cap.

## Remaining UX weaknesses

- The product does not yet connect an injected wallet; the read-only public-key field is deliberately developer-facing.
- Request/decision/review state is in memory and is cleared on refresh; this is safer than reviving stale decisions but not yet durable.
- Expiry is shown as a timestamp rather than a live countdown.
- The demo wallet holds only NVDAx, so live multi-candidate ranking is proven by tests rather than a three-funded-position screenshot.
- The selected quote's price impact can be high for very small xStock liquidity. The app displays the returned field but does not add a separate price-impact policy beyond the locked MVP rules.
- Screenshots cover landing desktop/mobile and the disconnected read-only app shell; decision-state screenshots still need a browser E2E harness or manual capture.

## Blockers for the next milestone

- obtain a production Solana RPC endpoint;
- obtain a Jupiter Developer Platform API key to avoid public rate limits;
- obtain and validate Pyth Pro trial access before implementing the optional reference-protection milestone;
- fund a dedicated demonstration wallet with small AAPLx, NVDAx, and TSLAx positions plus USDC and SOL when funded mainnet work is explicitly authorized;
- add browser wallet connection, transaction construction/message validation, and simulation only in their specified later milestones; and
- do not enable signing or `/execute` until the later security and transaction milestones pass.

## Exit-criteria result

**Passed.** A visitor can understand the product from the public landing page without connecting a wallet, and a supplied read-only mainnet wallet can produce an explainable live drawdown decision or live retained-floor refusal. The implementation remains within the no-signing, no-transaction Milestone 2 boundary.
