# Milestone 3 Evidence — Authenticated Pyth Reference Protection

Date: 24 September 2026

Status: TSLAx-only authenticated reference protection is implemented and validated read-only. AAPLx and NVDAx protection remain unavailable under the trial entitlement.

Financial action status: read-only only. No taker transaction was built, no wallet signature was requested, Jupiter `/execute` was not called, and no Solana transaction was sent.

## Product model selected after entitlement validation

The original six-feed paired model cannot run under the configured trial entitlement: Apple and Nvidia equity references and all three `Crypto.*X/USD` feeds return 403. DrawRail does not bypass that entitlement or relabel another source as Pyth.

The validated narrower model is:

```text
authenticated Pyth Tesla equity reference
                  ↕
exact TSLAx candidate raw input
→ official multiplier-correct displayed TSLAx amount
→ live Jupiter expected USDC output
→ expected executable USD price per displayed TSLAx
```

Pyth materially affects only TSLAx eligibility. AAPLx and NVDAx remain eligible for DrawRail's non-Pyth multiplier, slippage, retained-floor, quote, and transaction-correctness rules and are labeled unprotected.

## API surface and entitlement

- Catalog: `GET https://pyth.dourolabs.app/v1/symbols`.
- Authenticated observation: `POST https://pyth-lazer.dourolabs.app/v1/latest_price`.
- Authentication: server-only bearer token from `PYTH_PRO_API_KEY`.
- Channel: `fixed_rate@200ms`.
- Requested fields: price, exponent, confidence, publisher count, market session, and feed update timestamp; the envelope supplies `timestampUs`.

| Feed | Resolved ID | Trial result |
|---|---:|---|
| `Equity.US.TSLA/USD` | 1435 | accessible |
| `Equity.US.AAPL/USD` | 922 | 403, not entitled |
| `Equity.US.NVDA/USD` | 1314 | 403, not entitled |
| `Crypto.AAPLX/USD` | 1792 | 403, not entitled |
| `Crypto.NVDAX/USD` | 1833 | 403, not entitled |
| `Crypto.TSLAX/USD` | 1847 | 403, not entitled |

The public catalog is resolved by symbol at runtime. Historical IDs are not trusted without current catalog validation. No bearer token or authorization header appears in output, tests, or this document.

## Sessions and freshness

Pyth documents `regular`, `preMarket`, `postMarket`, `overNight`, and `closed`. Its US-equity schedule and carry-forward semantics distinguish genuine fresh extended-session aggregates from a recent envelope carrying an older price.

DrawRail accepts `regular`, `preMarket`, `postMarket`, and `overNight` only when the observation is genuinely fresh and meets the configured age, confidence, and session-specific publisher rules. It rejects `closed`, unknown sessions, and carried-forward/stale data. Freshness authority is `feedUpdateTimestamp` relative to `timestampUs`; receipt time is not substituted.

Two authenticated sessions were observed during validation:

- earlier: `overNight`, with `feedUpdateTimestamp == timestampUs`;
- final validation: `preMarket`, with `feedUpdateTimestamp == timestampUs`.

This confirms that regular-only enforcement would incorrectly discard current Pyth aggregates. It does not make closed or carried-forward data usable.

## Exact live observation

Final sanitized observation at `2026-09-24T10:39:18.962Z`:

- symbol/feed: `Equity.US.TSLA/USD`, ID `1435`;
- price: `37671504 × 10^-5` = **$376.71504**;
- confidence: `10704 × 10^-5` = **$0.10704**;
- publishers: **12**, catalog pre-market minimum **2**;
- session: **preMarket**;
- `timestampUs`: `1790246358400000`;
- `feedUpdateTimestamp`: `1790246358400000`;
- feed age: **0 microseconds**;
- result: fresh, session-valid, adequate publishers, confidence within the configured 100 bps ceiling.

Microsecond timestamps remain decimal strings at the HTTP boundary and `bigint` in authoritative arithmetic.

## Executable-price unit derivation

The live validator used public wallet `2QfBNK2WDwSLoUQRb1zAnp3KM12N9hQ8q6ApwUMnWW2T` only as a read-only source of funded positions. No private key was used.

For the exact TSLAx candidate:

- mint: `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB`;
- raw input: `267268`;
- active-multiplier/official-conversion displayed input: `0.00267268 TSLAx`;
- Jupiter router: `metis`;
- expected output (`outAmount`): `1005104` raw USDC = `1.005104 USDC`;
- minimum output (`otherAmountThreshold`): `1000078` raw USDC = `1.000078 USDC`;
- expected executable price: `1.005104 / 0.00267268` = **$376.065971234865378571321669635** per displayed TSLAx;
- minimum-output implied price: **$374.185461783677806546238232785**.

The expected executable price uses `outAmount` for Pyth divergence because it represents the route's expected economics. The minimum output remains DrawRail's conservative coverage and slippage floor. Comparing Pyth with `otherAmountThreshold` would make the reference gap mechanically depend on the user's chosen slippage, so DrawRail records that implied minimum price but does not use it as the market/reference divergence basis.

No floating-point token arithmetic is authoritative. The raw input remains transaction authority, displayed amount uses the official Token-2022 conversion path, and Decimal/bigint arithmetic derives prices and basis points.

## Live divergence and policy effect

For the final sample:

```text
abs(376.065971234865378571321669635 - 376.71504)
÷ 376.71504 × 10,000
= 17.229701 bps (0.17229701%) below reference
```

- At the normal **100 bps (1.00%)** limit, TSLAx was valid and lower-ranked behind AAPLx under the existing deterministic selection rule.
- At a user-configured **17 bps (0.17%)** limit, the same cached quote/evidence made TSLAx `rejected` with `PYTH_DIVERGENCE`.
- AAPLx remained selected and explicitly unprotected; DrawRail did not disable the whole product.
- `pythChangedEligibility` was `true`.

This is live read-only evidence that authenticated Pyth data materially changes a real TSLAx candidate's eligibility.

## Implementation

- `src/server/pyth/config.ts`: endpoints, channel, and current conceptual symbols.
- `src/server/pyth/client.ts`: current catalog and authenticated payload parsing, including catalog-session normalization.
- `src/server/pyth/service.ts`: server-only TSLA entitlement/health and per-asset availability.
- `src/domain/pyth.ts`: exact freshness, session, publisher, confidence, executable-price, and divergence rules.
- `src/domain/policy.ts`: evaluates Pyth only after bounded quote search has produced the exact TSLAx raw candidate; a failed rule rejects that otherwise eligible candidate.
- `/api/portfolio` exposes sanitized feature/per-asset status.
- `/api/drawdown/evaluate` keeps the API key server-side and passes only validated reference context into the deterministic engine.
- `/app` exposes an honest Tesla-only opt-in, unavailable Apple/Nvidia labels, plain-language pass/block results, and detailed Inspect evidence.
- `scripts/validate-pyth.ts` performs a sanitized authenticated check and, when given a public wallet, runs live protection-OFF, 100-bps, and observed-gap-blocking evaluations with cached Jupiter quotes.

Stable reason codes remain: `PYTH_NOT_ENABLED`, `PYTH_UNAVAILABLE`, `PYTH_NOT_ENTITLED`, `PYTH_FEED_MISSING`, `PYTH_STALE`, `PYTH_SESSION_INVALID`, `PYTH_LOW_PUBLISHER_COUNT`, `PYTH_CONFIDENCE_TOO_WIDE`, `PYTH_UNIT_UNVERIFIED`, `PYTH_DIVERGENCE`, and `PYTH_VALID`.

## Validation commands

```text
npm run validate:pyth
npm run validate:pyth -- <public-wallet-address>
```

The command never prints the API key and never constructs, signs, executes, or broadcasts a transaction.

## Tests

The suite covers exponent signs, large mantissas, microsecond timestamps outside JavaScript safe-integer range, fresh regular/pre-market/post-market/overnight observations, closed and stale carried-forward observations, future/missing timestamps, publisher and confidence failures, exact/below/above divergence thresholds, zero/near-zero displayed amounts, expected-output versus minimum-output semantics, enabled/disabled behavior, AAPLx/NVDAx unavailability, TSLAx rejection with another candidate eligible, and every Pyth-protected candidate blocked. All previous tests remain present.

Final verification:

```text
npm test          — 10 files, 80 tests passed (all previous 68 remain passing)
npm run typecheck — passed
npm run lint      — passed with no warnings
npm run build     — passed; / and /app static, API routes dynamic
git diff --check  — passed
secret scan       — passed; no tracked secret environment file or populated credential assignment found; gitleaks is not installed
```

## Bounty and next-milestone status

The Pyth integration is defensible as a **TSLAx-only DrawRail protection** because:

1. authenticated feed 1435 access works;
2. freshness/session/confidence/publisher checks use live Pyth fields and current catalog minima;
3. the exact Jupiter candidate input is converted to multiplier-correct displayed units;
4. expected Jupiter output produces a unit-correct executable TSLAx price;
5. the Pyth comparison changes candidate eligibility in a live read-only evaluation.

It is not defensible to claim AAPLx/NVDAx protection or an all-assets paired-feed integration. Those remain entitlement blockers, not blockers to DrawRail's core product or the verified TSLAx feature.

Milestone 4 remains blocked only on its own scope: injected wallet connection, final unsigned Jupiter transaction construction, message decoding/binding, simulation, and review security. No wallet-signing work was started here.
