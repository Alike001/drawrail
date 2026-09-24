# Milestone 3 Evidence — Authenticated Pyth Reference Protection

Date: 24 September 2026

Status: validation and fail-closed integration complete; live reference protection unavailable because the configured trial key does not entitle a complete pair and xStock units could not be verified

Financial action status: read-only only. No taker transaction was built, no wallet signature was requested, Jupiter `/execute` was not called, and no Solana transaction was sent.

## API surface used

- Public current symbol catalog: `GET https://pyth.dourolabs.app/v1/symbols`.
- Authenticated current observation: `POST https://pyth-lazer.dourolabs.app/v1/latest_price`.
- Authentication: server-only bearer token from `PYTH_PRO_API_KEY`.
- Channel: `fixed_rate@200ms`, which satisfies the catalog minimum for all six feeds.
- Requested fields: `price`, `publisherCount`, `exponent`, `confidence`, `marketSession`, and `feedUpdateTimestamp`; the parsed envelope supplies `timestampUs` and each result supplies `priceFeedId`.

The public catalog is resolved by symbol at runtime. Historical feed IDs are not trusted without that resolution. Neither the API key nor an authorization header is returned by an API route, printed by validation, placed in a fixture, or recorded here.

## Resolved feeds and trial entitlement

| Concept | Current symbol | Resolved Lazer ID | Catalog minimum channel | Authenticated result |
|---|---|---:|---|---|
| AAPLx representation | `Crypto.AAPLX/USD` | 1792 | `fixed_rate@200ms` | 403, not entitled |
| Apple reference | `Equity.US.AAPL/USD` | 922 | `fixed_rate@50ms` | 403, not entitled |
| NVDAx representation | `Crypto.NVDAX/USD` | 1833 | `fixed_rate@200ms` | 403, not entitled |
| Nvidia reference | `Equity.US.NVDA/USD` | 1314 | `fixed_rate@50ms` | 403, not entitled |
| TSLAx representation | `Crypto.TSLAX/USD` | 1847 | `fixed_rate@200ms` | 403, not entitled |
| Tesla reference | `Equity.US.TSLA/USD` | 1435 | `fixed_rate@50ms` | Accessible |

The all-six batch also returned 403. Individual probes establish that five feeds are denied and only the Tesla equity reference is accessible. Feed existence and entitlement are therefore recorded as separate facts.

## Accessible payload observation

The 24 September 2026 validation sample for `Equity.US.TSLA/USD` returned:

- feed ID `1435`;
- price mantissa `37819500`, exponent `-5`;
- confidence mantissa `500`;
- publisher count `5`;
- `marketSession: overNight`;
- envelope `timestampUs: 1790229109200000`;
- `feedUpdateTimestamp: 1790229109200000`;
- calculated age `0` microseconds; and
- channel `fixed_rate@200ms`.

This sample was fresh, not carried forward. It was not suitable for V1 protected comparison because the underlying-equity session was not `regular`, and the paired TSLAx representation was not entitled.

## Market-session semantics

The live catalog distinguishes the schedules:

- each `Crypto.*X/USD` representation is cataloged as always open and exposes only a `regular` session;
- each `Equity.US.*` reference exposes regular, pre-market, post-market, and overnight schedules; the payload vocabulary documented by Pyth is `regular`, `preMarket`, `postMarket`, `overNight`, and `closed`.

DrawRail therefore validates the two sides independently. For V1, the equity reference must be `regular`. The representation must match its own catalog-supported `regular` state. Missing or unknown states fail closed. The observed `overNight` Tesla equity result is deliberately rejected when protection is required.

## Freshness, confidence, and publisher rules

- All microsecond timestamps are parsed from decimal strings into `bigint`; JavaScript `number` is not authoritative.
- Feed age is `timestampUs - feedUpdateTimestamp`, not local receipt age.
- An age above `PYTH_MAX_FEED_AGE_MS`, a missing/malformed timestamp, or a future update beyond `PYTH_CLOCK_SKEW_MS` blocks.
- Confidence is compared as an exact integer ratio: `confidence × 10,000 <= abs(price) × maxConfidenceBps`.
- Publisher count uses the catalog's session-specific `market_sessions[session].min_pub` where present, falling back to top-level `min_publishers`.
- Price mantissa/exponent normalization and divergence comparison use bigint/Decimal arithmetic without binary floating point.

## Unit alignment and divergence

Unit alignment is not proven. All three representation feeds returned 403, so no authenticated representation price could be compared with the on-chain Scaled UI multiplier, displayed economic units, and current Jupiter execution economics. The catalog description alone is not treated as proof.

Consequently:

- all three pairs report `bothAccessible: false`;
- all three report displayed-unit alignment `unverified`;
- no live divergence basis-point result is claimed; and
- production health cannot become `available` in this commit.

Automated fixtures verify exact divergence behavior below, equal to, and above a threshold. Fixtures are labeled test-only and never enter runtime health or policy results.

## Policy-engine integration

Stable reasons now include:

- `PYTH_NOT_ENABLED`
- `PYTH_UNAVAILABLE`
- `PYTH_NOT_ENTITLED`
- `PYTH_FEED_MISSING`
- `PYTH_STALE`
- `PYTH_SESSION_INVALID`
- `PYTH_LOW_PUBLISHER_COUNT`
- `PYTH_CONFIDENCE_TOO_WIDE`
- `PYTH_UNIT_UNVERIFIED`
- `PYTH_DIVERGENCE`
- `PYTH_VALID`

Behavior is explicit:

- protection OFF performs no Pyth policy evaluation and records `Reference protection was not applied`;
- protection ON with complete, valid evidence lets the existing deterministic candidate evaluation continue;
- protection ON with unavailable, denied, stale, invalid-session, low-publisher, wide-confidence, unit-unverified, missing, or divergent evidence blocks the funded candidate before Jupiter quote selection;
- the engine never silently changes an ON request to OFF.

The core non-Pyth drawdown remains operational and retains multiplier, retained-floor, slippage, quote, and transaction-correctness rules.

## Server and UI changes

- `src/server/pyth/config.ts` owns conceptual symbols, endpoints, channel, and the fail-closed unit-verification state.
- `src/server/pyth/client.ts` owns catalog/latest-price HTTP parsing and sanitized errors.
- `src/server/pyth/service.ts` owns feed resolution, health, entitlement, and paired policy evaluation.
- `src/domain/pyth.ts` owns exact observation validation and divergence arithmetic.
- `/api/portfolio` returns only safe feature status: `disabled`, `available`, `unavailable`, `not_entitled`, `unhealthy`, or `unit_unverified`.
- `/api/drawdown/evaluate` accepts an explicit user requirement and divergence limit. OFF makes no Pyth request; ON cannot silently downgrade.
- `/app` replaces the static milestone placeholder with a health-aware protection control. The toggle and limit appear only when service status is genuinely `available`; otherwise the interface explains why protection is unavailable.
- Decision and Inspect surfaces show the safe policy result and, when available, feed evidence without credentials.

The current `.env.local` leaves the deployment gate off, so normal local UI shows `Disabled`. Even with `PYTH_POLICY_ENABLED=true`, the authenticated health check reports `not_entitled` before reaching the separate `unit_unverified` gate.

## Validation command

```text
npm run validate:pyth
```

The command loads the server-only key, resolves all six current feeds, probes entitlement individually, prints sanitized fields, records unit status, and reports `demoReady: false`. It requires no wallet and performs no financial action.

## Tests and verification

Test-only coverage includes positive/negative exponents, large mantissas, microsecond timestamps beyond JavaScript safe-integer assumptions, fresh/stale/future/missing timestamps, every documented session plus an unknown value, publisher minima, confidence boundaries, divergence below/equal/above the limit, zero/malformed reference prices, malformed payloads, missing feeds, entitlement/API failures, protection OFF, healthy ON, unhealthy ON, deterministic integration, and a Pyth block preventing otherwise eligible selection.

Final verification:

```text
npm test          — 10 files, 68 tests passed (previous 46 remain passing)
npm run typecheck — passed
npm run lint      — passed with no warnings
npm run build     — passed; / and /app static, API routes dynamic
git diff --check  — passed
secret scan       — no secret-like tracked value found; gitleaks was not installed, so tracked filenames and credential patterns were checked with git-native searches
```

## Differences from prior build-spec assumptions

1. The authenticated gate failed rather than remaining merely untested: five of six required feeds return 403.
2. Representation and equity schedules are not modeled identically. Representation feeds are cataloged always-open with only `regular`; equity references have multiple session schedules.
3. Publisher thresholds are session-specific in the catalog. For example, an equity feed's top-level minimum can differ from its regular-session minimum.
4. Pyth's current REST endpoint is `POST /v1/latest_price`; the integration does not use a browser WebSocket.

## Limitations and Milestone 4 blockers

- Obtain Pyth entitlement for all five denied feeds, then rerun `validate:pyth`.
- Prove each representation feed is priced per displayed economic xStock unit against the live Token-2022 multiplier and executable economics before changing the unit gate.
- Reference protection is not demo-ready and the Pyth bounty integration is not yet defensible as a working authenticated paired-feed product integration.
- Independently of Pyth, Milestone 4 still needs injected wallet connection, unsigned final transaction construction, message decoding/binding, simulation, and review security. It must continue to avoid signing, `/execute`, and broadcast until its own gates pass.
