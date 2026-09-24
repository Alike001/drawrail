# Milestone 4 Evidence — Wallet-bound Drawdown Review

Date: 24 September 2026

Status: implementation complete; signing, Jupiter `/execute`, broadcast, and funded transactions remain disabled.

## Implementation status

DrawRail now connects compatible injected Solana wallets through Wallet Standard, makes the connected public key authoritative for portfolio evaluation, constructs a fresh Jupiter Swap V2 order with that wallet as `taker`, validates the returned unsigned transaction, and binds the exact canonical message bytes to a short-lived server-authenticated decision receipt.

The application contains no call to wallet `signTransaction`, wallet `sendTransaction`, Jupiter `/execute`, or an RPC broadcast method. The review button is intentionally disabled at the signing boundary.

## Wallet integration

- Direct Wallet Standard discovery uses `@wallet-standard/app` and standard connect/events/disconnect features.
- Compatible wallets must advertise Solana mainnet and v0 `solana:signTransaction` support. The signing feature is capability-checked but never invoked in Milestone 4.
- Connection requests only account access. No sign-message or transaction signature is requested.
- The UI displays wallet name and shortened address, supports disconnect, and reloads live portfolio state after connection.
- A wallet account/change event invalidates the portfolio, decision, order, and receipt. A pasted public address remains a visibly separate read-only developer mode and cannot build a wallet-bound review.
- Automated tests use a Wallet Standard-compatible injected test adapter. Phantom-compatible Wallet Standard behavior is supported by architecture; a real Phantom extension was not automated in this environment.

## Final order and economic revalidation

`POST /api/drawdown/review` re-reads live state, confirms the deterministic selected symbol remains current, and then revalidates the exact raw input shown in the prior decision. It obtains a fresh final `/order` with the connected wallet as taker and no receiver, integrator, or referral override.

The server requires:

- exact input mint and USDC output mint;
- final `inAmount` equal to the reviewed raw input;
- `otherAmountThreshold` sufficient for the current missing USDC;
- response slippage within the user's maximum;
- the exact remaining raw position's fresh conservative quote to preserve the retained floor; and
- fresh TSLA Pyth executable-price validation when TSLA reference protection is requested.

Harmless movement in the quote-search-derived minimum raw amount does not itself invalidate review. The prior exact raw amount is instead revalidated directly against fresh final-order and remaining-position economics. A changed winning symbol, failed floor, insufficient minimum, changed policy, changed wallet, or failed Pyth rule requires refresh.

## Transaction validation and simulation

The server decodes the base64 wire transaction with `@solana/kit`, supports legacy/v0 messages, and fails closed on unsupported versions or malformed wire data. For v0 it resolves every address lookup table from mainnet RPC before account and instruction inspection.

Validated invariants include:

- connected wallet is fee payer and a required signer;
- the wallet signature slot is still empty;
- recent blockhash is structurally present and currently valid;
- allowlisted input/output mints and Token/Token-2022 programs are referenced;
- the wallet's derived input token account and USDC destination ATA are referenced;
- every outer instruction program account exists and is executable;
- no DrawRail-controlled signer is introduced; additional route signers are reported rather than incorrectly rejected; and
- unsigned RPC simulation debits exactly the reviewed raw xStock amount and credits at least the reviewed minimum USDC.

Simulation uses `sigVerify: false` with `replaceRecentBlockhash: true`; it does not sign, submit, or broadcast. If lookup resolution, simulation, exact debit, or minimum credit cannot be proven, review fails closed.

## Canonical binding and receipt

The canonical SHA-256 is calculated from the exact compiled transaction message bytes, not presentation JSON. A server-only HMAC receipt binds:

- wallet and target/existing/missing USDC;
- selected symbol/mint, raw input, and displayed reduction;
- expected/minimum output and retained-floor evidence;
- slippage and Jupiter fee fields;
- Jupiter request ID;
- canonical message hash;
- complete policy configuration and registry version;
- Pyth state/evidence hash when applicable; and
- creation/expiry timestamps.

`DECISION_RECEIPT_SECRET` must contain at least 32 bytes. Missing/weak secrets disable executable review. Jupiter `expireAt` is used when present and sooner; otherwise DrawRail uses the configured conservative local lifetime, default 30 seconds. The UI displays a live countdown and disables progression at expiry.

## Sanitized live mainnet read-only validation

Wallet public key used: `2QfBNK2WDwSLoUQRb1zAnp3KM12N9hQ8q6ApwUMnWW2T` (public address only).

Observed at slot `450016712`:

| Field | Observed value |
|---|---|
| Selected asset | AAPLx |
| Exact raw input | `118000` |
| Multiplier-correct displayed reduction | `0.00118386 AAPLx` |
| Router / mode | `metis` / `manual` |
| Expected output | `397874` raw USDC |
| Minimum output | `395884` raw USDC |
| Slippage | `50` bps |
| Jupiter fee | `10` bps, USDC |
| Platform fee | returned as 10 bps in USDC |
| Transaction version | v0 |
| Message SHA-256 | `98370ab5efd539f8c9edc6c1d7e54fe0af8074ed99494cffaa64738e64f7851f` |
| Lookup tables resolved | 2 |
| Required signers | connected wallet only |
| Simulated input debit | `118000` raw AAPLx |
| Simulated USDC credit | `397874` raw USDC |
| Jupiter `expireAt` | omitted |
| Local receipt lifetime | 30 seconds |
| HMAC receipt verification | passed |
| Pyth final-order result | not applied; this live selection was AAPLx with protection OFF |

Jupiter request ID was observed and bound into the receipt but is not necessary to reproduce here. No complete transaction blob, signature, key, or receipt MAC is included.

The anonymous Jupiter endpoint also returned HTTP 429 during the quote-heavy end-to-end UI review attempt. DrawRail now exposes that as `JUPITER_UNAVAILABLE` / `refresh_required`, not a generic transaction failure. A production Jupiter API credential remains required for dependable demo operation.

## UI and state model

Implemented states:

`decision_ready`, `building_transaction`, `validating_transaction`, `review_ready`, `quote_expired`, `policy_changed`, `wallet_changed`, `transaction_invalid`, and `refresh_required`.

The normal review emphasizes requested/existing/missing USDC, selected position, displayed reduction, expected/minimum USDC, remaining exposure, unchanged alternatives, applied rules, and the explicit statement: `Your wallet has not signed anything yet.` Technical details—including transaction version, blockhash, message hash, lookup tables, token accounts, simulated deltas, fee fields, request ID, registry version, and Pyth evidence hash—remain behind `Inspect transaction`.

## Screenshots and responsive checks

- `stocklana-context/screenshots/milestone-4-landing-desktop.png` — 1440 px
- `stocklana-context/screenshots/milestone-4-landing-mobile.png` — 390 px
- `stocklana-context/screenshots/milestone-4-connected-portfolio.png`
- `stocklana-context/screenshots/milestone-4-request-usdc.png`
- `stocklana-context/screenshots/milestone-4-actionable-decision.png`
- `stocklana-context/screenshots/milestone-4-blocked-alternative.png`
- `stocklana-context/screenshots/milestone-4-review-unavailable.png` — explicit Jupiter capacity failure state
- `stocklana-context/screenshots/milestone-4-connected-portfolio-mobile.png` — generated by the repeatable capture harness

The capture harness's test wallet implements connect/disconnect/events and advertises v0 signing capability, but its signing method deliberately throws if invoked. Screenshots therefore cannot accidentally authorize a transaction. Desktop was checked at 1440 px and mobile at 390 px. The decision remains understandable without opening Inspect.

An exact-review screenshot was not captured from the anonymous API path because the final UI attempt was rate-limited. The exact review UI is implemented and covered by production build/type tests; the sanitized live final-order, simulation, hash, and receipt evidence above was validated independently. This is a presentation/capacity blocker, not a transaction-correctness substitution.

## Tests and verification

Automated coverage includes wallet compatibility/connect/disconnect without signing, wallet and policy invalidation, final-order economic mismatches, Pyth final-order evaluation primitives, transaction decoding, v0 and lookup-table behavior, malformed/unsupported messages, canonical hash stability/mutation, simulated exact token deltas, HMAC creation/verification/tampering/expiry, wrong wallet/request/raw amount/message, missing receipt secret, and review expiry.

Final verification commands:

```text
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Final local verification:

- 15 test files passed;
- 121 tests passed;
- TypeScript typecheck passed;
- ESLint passed;
- Next.js production build passed with `/`, `/app`, and all read-only API routes;
- `git diff --check` passed; and
- the tracked-history/current-tree secret scan found no committed private keys or populated DrawRail credential assignments.

## Differences and blockers before signing

- DrawRail added unsigned RPC token-delta simulation because response fields plus structural message inspection alone do not prove that encoded transaction execution matches the reviewed raw input and minimum output.
- A production Jupiter Developer Platform key and reliable mainnet RPC endpoint are required to avoid anonymous/public capacity failures.
- A real extension-level Phantom connection remains a manual browser check; the implementation and automated adapter follow Wallet Standard rather than a Phantom-specific API.
- Milestone 5 must verify the wallet-added signature against the unchanged message hash and receipt, repeat all time-sensitive checks, relay only through Jupiter `/execute`, and reconcile final RPC wallet deltas.
- AAPLx/NVDAx Pyth protection remains unavailable under the current entitlement. TSLAx final-order Pyth revalidation is implemented and tested, but the live AAPLx proof above correctly records protection as not applied.
