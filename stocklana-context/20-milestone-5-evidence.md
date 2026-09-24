# Milestone 5 evidence — signing, execution, and settlement

Date: 24 September 2026  
Status: **Stage A complete; funded Stage B remains disabled and pending**

This document records the completed single low-value funded validation. No private key, seed phrase, API key, receipt secret, or complete signed transaction belongs here.

## Implemented safety path

- Browser wallets are called through Wallet Standard `solana:signTransaction`; DrawRail does not call `signAndSendTransaction` or wallet broadcast APIs.
- The server decodes the signed transaction, hashes its canonical message bytes, requires equality with the reviewed SHA-256, checks the bound wallet/request ID/receipt HMAC/expiry, preserves the reviewed non-wallet signature slots, and cryptographically verifies the user's Ed25519 signature.
- Sign-only validation consumes its receipt in the single-instance replay store and never calls Jupiter or Solana broadcast.
- Funded execution requires a configured non-public RPC, authenticated Jupiter key, receipt HMAC secret, `mainnet-funded` deployment mode, the explicit `FUNDED_EXECUTION_ENABLED=true` operator gate, and a request at or below `MAX_MAINNET_DRAWDOWN_USDC` (default 5 USDC).
- Metis/Dflow/OKX block-height expiry, JupiterZ RFQ expiry, and the local fallback expiry are checked without extending Jupiter validity.
- A server pre-sign endpoint repeats expiry and live safety checks before the browser is allowed to open the wallet prompt; the execution endpoint repeats them after signing and immediately before `/execute`.
- After signature verification, DrawRail re-reads multiplier state and chain time. A multiplier change or entry into the inclusive activation window makes the signed order unusable.
- Required TSLAx protection refreshes the authenticated Pyth observation and repeats session/freshness/confidence/publisher/divergence validation against the reviewed final-order economics.
- Exactly one `/swap/v2/execute` call is permitted per in-memory receipt reservation. HTTP ambiguity remains `unknown`; it never clears the reservation and never triggers a resend.
- RPC reconciliation aggregates owner token balances by supported mint, including output-account creation, then compares actual xStock debit and USDC credit with the reviewed raw input/minimum and Jupiter amount-result fields.

## Settlement states

- `confirmed`: the chain transaction has no error and all required balance reconciliation agrees.
- `confirmed_needs_investigation`: the chain succeeded but an input/output/Jupiter comparison differs, including actual USDC below the reviewed minimum.
- `failed`: RPC proves the landed transaction failed, or Jupiter returns a definite failure without a signature to reconcile.
- `unknown`: submission may have occurred but chain outcome cannot yet be established. `Check status` queries the same signature and never resubmits.

## Automated evidence

At the current implementation checkpoint:

- TypeScript typecheck: passed.
- Vitest: 23 files, 152 tests passed.
- ESLint: passed.
- Next.js production build: passed, including `/api/drawdown/pre-sign`, `/api/drawdown/sign-only`, `/api/drawdown/execute`, and `/api/drawdown/status`.
- `git diff --check`: passed.
- `npm audit --audit-level=high`: passed with zero vulnerabilities.

Covered behavior includes Wallet Standard sign-only invocation, exact-message Ed25519 verification, wrong signer/message/signature rejection, receipt tamper/expiry checks, block-height/RFQ/local expiry, multiplier change/window rejection, Jupiter execute parsing, HTTP ambiguity, replay refusal, RPC success/failure/unknown classification, ATA-creation-compatible token deltas, minimum-output investigation, and Jupiter result reconciliation.

## Stage A — real-wallet sign-only evidence

Completed manually with a real Phantom wallet on Solana Mainnet.

- wallet class/provider: Phantom through Wallet Standard `solana:signTransaction`;
- UI result: `Sign-only validation passed`;
- verified message-hash prefix: `50efe196b45f…` before and after the wallet;
- user Ed25519 signature verification: passed;
- Jupiter `/execute`: not called;
- RPC broadcast: not called;
- funds moved: none;
- receipt reuse: refused/consumed by the single-instance replay guard.

The observed UI confirmation was: “Signature verified. Message 50efe196b45f... was unchanged and was not broadcast. This expired test order cannot be reused.” No private wallet material or complete transaction bytes were recorded.

### Stage A timing trace

The successful server trace recorded:

- live policy evaluation: `8.6s`;
- exact final-order construction, v0 validation, lookup resolution and simulation: `11.9s`;
- pre-sign expiry/multiplier safety revalidation: `1.746s`;
- server signature/message verification: `0.250s`.

At that point DrawRail used a 30-second local receipt lifetime. Receipt creation occurred after order validation and simulation, so the 11.9-second construction time did not consume that local lifetime. The browser observation of approximately 16 seconds means roughly 14 seconds of the local review allowance had elapsed while the review was being read. The exact successful response's `lastValidBlockHeight` was not logged, and no claim is made otherwise.

A same-wallet follow-up read-only order returned `router=metis`, no `expireAt`, and `lastValidBlockHeight=428151205`; the observed confirmed height shortly afterward was `428151142`, leaving 63 blocks. This verifies that block height, not an RFQ timestamp, is the real upstream hard limit for the sampled route.

### Review-expiry correction

- DrawRail's local review allowance is now 60 seconds rather than 30 seconds.
- The displayed effective expiry is the minimum of Jupiter `expireAt`, a conservative estimate derived from Metis/Dflow/OKX remaining block height, and the DrawRail local allowance.
- Block height is re-read after simulation because simulation time consumes blockhash validity.
- Program-account validation, blockhash validation and token-delta simulation now run concurrently after message/account resolution, reducing post-order latency without dropping any invariant.
- Under ten seconds, the UI shows an explicit expiry warning.
- An expired final order can show `Refresh transaction` while the policy snapshot is under two minutes old. This explicit action re-runs the full live policy evaluation, builds a new final order, resolves/simulates/revalidates it, and creates a new message hash and receipt. If the selected candidate changes, the server returns `policy_changed` instead. Older policy snapshots require `Refresh decision`.
- No transaction is replaced while a wallet dialog is open. An expired signed receipt fails closed.

## Funded mainnet evidence

Stage B completed exactly once through the owner-controlled Phantom wallet. No retry or second financial transaction was attempted.

During Stage B preparation, repeated evaluation requests exposed an intermittent second Solana portfolio-read failure even when the preceding portfolio screen read had succeeded. The funded-mode request itself was valid: identical requests returned `actionable`, selected AAPLx, and exactly `500000` raw USDC missing. The deployment cap, Jupiter authentication, and policy engine were not the cause. The API now fails closed with sanitized stage-specific codes (`RPC_UNAVAILABLE`, `JUPITER_AUTH`, `JUPITER_RATE_LIMIT`, `JUPITER_UNAVAILABLE`, or `EVALUATION_INTERNAL`) rather than collapsing every upstream failure into one generic 422. No cached balance, quote, or route is substituted, and no financial retry was added. After restart, three consecutive identical read-only evaluations returned HTTP 200 with AAPLx selected.

### Stage B final-order minimum diagnosis

The first funded-review attempt was stopped before signing because the final wallet-bound order did not satisfy the minimum-output invariant. Repeated read-only comparisons established that this was structural sizing behavior, not ordinary elapsed-time quote drift:

- quote-only decision raw input: `148477` AAPLx raw units;
- quote-only expected/minimum output: `500001 / 500001` raw USDC;
- quote-only router/slippage/fee: `jupiterz / 0 bps / 10 bps`;
- wallet-bound final raw input: `148477` (unchanged);
- wallet-bound router/slippage/fee: `metis / 50 bps / 10 bps`;
- sampled final expected outputs: `499637`, `499622`, `499537`, and `499563` raw USDC;
- sampled final minimum outputs: `497138`, `497123`, `497039`, and `497065` raw USDC;
- decision-to-final-order delays: `310ms`, `313ms`, `658ms`, and `337ms`.

The quote-only JupiterZ result had no slippage deduction and was sized almost exactly to the requested `500000` raw USDC. The taker-bound order switched to Metis and applied the user's 50 bps slippage, so its reviewed minimum was approximately 2,900 raw USDC short even when constructed in 310ms. No `/execute`, signature, or broadcast occurred.

DrawRail now performs a bounded unsigned wallet-bound final-order sizing search. It starts from the policy decision's raw input, increases the raw input proportionally when—and only when—the returned final `otherAmountThreshold` is below the full missing amount, and accepts only an order whose actual minimum covers the request. The search is capped at five attempts (hard implementation maximum eight) and at the wallet's live raw balance. The adjusted input is then passed through multiplier conversion parity, retained-position quotation/floor enforcement, final-order economics, transaction decoding, simulation, message binding, and expiry checks. Search exhaustion fails closed and creates no review. The deployment cap remains based on the unchanged `500000` raw-USDC request; expected output is never substituted for minimum output.

The transaction Inspect view records the attempt count, initial/final raw input, and initial/final minimum output. Funded execution remained operator-disabled throughout diagnosis.

A post-fix authenticated, unsigned live `/order` validation demonstrated the bounded search against the same wallet and 50 bps policy: `148470 → 149339 → 149340 → 149344` raw AAPLx over four attempts. The respective final-order minimums were `497092`, `499999`, `499989`, and `500029` raw USDC. Only the fourth order qualified. It used Metis, returned `502542` expected raw USDC, retained the observed 10 bps Jupiter fee, and exceeded the full request by 29 raw USDC. These orders were not signed, executed, or broadcast.

- asset: AAPLx;
- displayed input: approximately `0.001499` AAPLx using the live Token-2022 multiplier;
- raw input and RPC-observed debit: `149435`;
- reviewed expected/minimum USDC: `502515 / 500002` raw;
- actual RPC-observed USDC credit: `502515` raw;
- router: Metis;
- order fee: 10 bps, collected in output-mint USDC;
- authenticated `/execute` response, sanitized: `status=Success`, `code=0`, `inputAmountResult=149435`, `outputAmountResult=503018`, `totalInputAmount=149435`, `totalOutputAmount=502515`;
- derived output-mint fee: `503` raw USDC (`503018 - 502515`);
- request ID: bound and verified by the authenticated decision receipt; omitted from public evidence because it is not needed to prove settlement;
- transaction signature: `4fk7YBSP2pjGoxbW91CHZZaU9dStZ5y2M73j3UTbdYefk5ESjTmnYvwQx2gwnEAnctorjzX58KASAvx2PULdM2uN`;
- Solana slot: `450156253`;
- chain error: none; RPC confirmation status observed as finalized;
- wallet AAPLx balance: `307981 → 158546` raw;
- wallet USDC balance: `0 → 502515` raw;
- Pyth: not applied, as explicitly selected for this AAPLx validation;
- actual output exceeded the reviewed minimum by `2513` raw USDC;
- no automatic retry occurred.

### Settlement reconciliation diagnosis

The initial receipt was conservatively classified `confirmed_needs_investigation` with `JUPITER_OUTPUT_RESULT_MISMATCH`. The chain transaction itself was successful and economically acceptable. Current Jupiter Swap V2 semantics distinguish route accounting from wallet accounting:

- `outputAmountResult` is output produced by the swap route before an output-mint fee;
- `totalOutputAmount` is final output reflected in the user's wallet after that fee;
- `totalInputAmount` and `totalOutputAmount` are therefore the fields comparable to RPC wallet deltas.

DrawRail incorrectly compared both output fields directly with the wallet credit. In this transaction the route produced `503018` raw USDC, Jupiter collected `503` raw USDC, and the wallet received `502515`. Thus `outputAmountResult != wallet credit` was expected fee accounting, while `totalOutputAmount == wallet credit` proved correct settlement. Onchain parsed transfers independently show a `503018` raw-USDC route transfer followed by a `503` raw-USDC fee transfer.

Reconciliation now keeps RPC owner/mint deltas authoritative, compares wallet deltas only with Jupiter totals, and separately validates route/total relationships according to the receipt-bound `feeMint`. Impossible direction or wrong-side differences produce `JUPITER_FEE_ACCOUNTING_MISMATCH`; they are not silently ignored. The exact sanitized response and RPC balance shape are preserved as an automated regression fixture. Replaying that evidence produces `confirmed`, a derived `503` raw-USDC fee, and no discrepancy.

## Screenshots

Existing Milestone 4 review screenshots remain valid only for unsigned review. Milestone 5 wallet prompt, submitting, confirmation, desktop receipt, and mobile receipt screenshots are pending genuine manual validation. No success image has been fabricated.

## Known deployment boundary

The replay store is intentionally conservative but process-local. This is sufficient only for the current single-instance hackathon validation. Before multi-instance or production financial use, receipt reservation and submission outcome must be stored with durable atomic uniqueness. A restart can lose the in-memory reservation, so the funded validation must run on one controlled instance without redeployment during the flow.

## Exit criteria

Stage A and the single owner-approved Stage B transaction have passed. The exact reviewed message was signed once, Jupiter reported success, Solana confirmed without error, the RPC-observed debit matched the reviewed raw input, and the RPC-observed credit exceeded the reviewed minimum. After correcting the route-versus-wallet Jupiter field semantics with a regression fixture, Milestone 5 is complete. Funded execution is closed and the application is back in Mainnet read-only mode.
