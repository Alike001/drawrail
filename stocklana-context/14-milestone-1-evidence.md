# Milestone 1 Evidence — Read-Only Mainnet Correctness

Date: 23 September 2026

Status: complete

Documentation-lock commit: `cc3d760`

Financial action status: no transaction was constructed with a taker, signed, broadcast, or sent to `/execute`

## Implementation status

Milestone 1 is implemented as a minimal Next.js/TypeScript application with:

- a server-side validation pipeline;
- a CLI that accepts one Solana wallet public key and writes a local timestamped JSON report;
- a minimal read-only page and JSON route;
- a closed asset registry for AAPLx, NVDAx, TSLAx, and USDC;
- branded domain types for raw token amounts, USDC raw amounts, displayed amounts, multipliers, basis points, token decimals, and timestamps;
- live mint/program/decimal/extension verification;
- aggregation across every owner token account returned for each supported mint;
- official Token-2022 Scaled UI conversion parity checks;
- active-multiplier and inclusive ±900-second activation-window calculations;
- quote-only Jupiter Swap V2 parsing, including fee fields; and
- exact retained-position quote calculation.

The product policy engine, Pyth, wallet connection, transaction construction, signing, `/execute`, and settlement verification are intentionally not implemented.

## Files created

### Foundation

- `package.json` and `package-lock.json`
- `tsconfig.json`
- `next.config.ts`
- `next-env.d.ts`
- `eslint.config.mjs`
- `vitest.config.ts`
- `.env.example`
- `.gitignore`
- root `README.md`

### Application and domain

- `src/domain/assets.ts`
- `src/domain/types.ts`
- `src/domain/scaled-ui.ts`
- `src/server/env.ts`
- `src/server/rpc.ts`
- `src/server/jupiter.ts`
- `src/server/validation.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/styles.css`
- `src/app/api/validate/route.ts`
- `scripts/validate-mainnet.ts`

### Tests

- `src/domain/assets.test.ts`
- `src/domain/scaled-ui.test.ts`
- `src/server/rpc.test.ts`
- `src/server/jupiter.test.ts`

## Commands

```bash
cp .env.example .env.local
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
npm run validate:mainnet -- <wallet-public-key>
```

`SOLANA_RPC_URL` and `JUPITER_API_KEY` remain server-side. The CLI defaults to the public Solana mainnet endpoint and current Jupiter API base when values are not configured. A production RPC and Jupiter API key are still required for reliable deployment.

The validation command writes its timestamped JSON under `validation-artifacts/`. That directory is gitignored and created with restrictive local permissions. Environment files, common keypair filenames, PEM files, secret files, and local validation artifacts are gitignored. No private key is accepted by the application.

## Test results

Final verification commands:

```text
npm test        — 4 files, 28 tests passed
npm run typecheck — passed
npm run lint      — passed with no warnings
npm run build     — passed; / is static and /api/validate is dynamic
git diff --check  — passed
```

Coverage includes:

- active multiplier selection before, exactly at, and after activation;
- inclusive ±900-second activation boundaries and zero activation;
- raw-to-displayed conversion;
- displayed-to-conservative-raw conversion and back-conversion;
- parity with the official `@solana-program/token-2022` conversion helpers;
- boundary-shaped inputs and a `1,000,000,000,000,000` raw-unit balance;
- multiple token accounts aggregated for one mint;
- zero token-account balances;
- unsupported mint refusal;
- live-metadata program and decimal mismatches;
- missing and malformed Scaled UI extensions;
- RPC error propagation without fixture fallback;
- Jupiter fee/routing/mode/expiry/request parsing;
- missing Jupiter fee fields retained as null rather than rewritten to zero;
- exact retained-position quote input;
- zero retained positions; and
- Jupiter API errors/missing routes.

All automated fixtures are confined to `*.test.ts` files and are not runtime fallbacks.

## Timestamped mainnet report

Command used:

```bash
npm run validate:mainnet -- 8mha9DTRpy7XFX5oXpGJa5c8Gz5rDbi481bSTBuF3weh
```

Observed at `2026-09-23T21:21:08.654Z`, confirmed chain slot `449823605`, block time `1790198465`.

The address is a public mainnet address selected only to exercise the read-only balance path. No claim is made about its owner. The report requested no signature and no transaction.

## Current registry verification

| Symbol | Mint | Live program owner | Live decimals | Registry result |
|---|---|---|---:|---|
| AAPLx | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` | Token-2022 | 8 | Passed |
| NVDAx | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` | Token-2022 | 8 | Passed |
| TSLAx | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` | Token-2022 | 8 | Passed |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | original Token Program | 6 | Passed |

The registry is only an allowlist. The runtime independently checked live owner-program and decimal data. Each xStock also had to contain a parseable `scaledUiAmountConfig`; absence or malformed state fails closed.

## Live xStock mint state

| Asset | Old multiplier | New multiplier | Activation timestamp | Active at report time | ±900-second block |
|---|---:|---:|---:|---:|---|
| AAPLx | `1.0026642075893797` | `1.0032690125398187` | `1786149000` | `1.0032690125398187` | No |
| NVDAx | `1.0009180758490996` | `1.001701196801074` | `1789000200` | `1.001701196801074` | No |
| TSLAx | `1` | `1` | `0` | `1` | No |

The new multiplier becomes active at exactly the effective timestamp. The safety window is inclusive at both `activation - 900` and `activation + 900` seconds. A zero activation timestamp does not create a window.

## Sample balances and conversion evidence

The sampled wallet had:

| Asset | Token accounts | Raw aggregate | Displayed/economic balance |
|---|---:|---:|---:|
| AAPLx | 0 | `0` | `0` |
| NVDAx | 1 | `6719605` | `0.06731036` |
| TSLAx | 0 | `0` | `0` |
| USDC | 1 | `154348009` | `154.348009` |

The runtime aggregates all returned accounts; the one-account live observation is not encoded as an ATA assumption. Automated coverage proves two accounts for the same mint are summed correctly.

For the current AAPLx multiplier, a desired displayed reduction of `0.01` produced a conservative raw candidate of `996741`. Converting `996741` raw back through the official helper did not exceed `0.01`. The common incorrect shortcut would produce `1000000` raw.

No mismatch was found between the high-precision implementation and official Token-2022 helper behavior for the tested live multiplier values, zero/small/boundary-shaped inputs, or the large-balance case. The tests fail rather than silently choosing a result if future parity differs.

## Live Jupiter quote evidence

Each request was quote-only: no `taker`, no returned transaction, no signature, and no `/execute` call. Input was `1,000,000` raw xStock units with requested maximum slippage `50` bps.

| Asset | Router | Mode | Output raw USDC | Reviewed minimum | Response slippage | Fee bps | Fee mint | Request ID |
|---|---|---|---:|---:|---:|---:|---|---|
| AAPLx | `jupiterz` | `manual` | `3375948` | `3375948` | `0` | `10` | USDC | `01a0d024-cb7b-758c-8615-66952611d0f1` |
| NVDAx | `metis` | `manual` | `2252702` | `2241438` | `50` | `10` | USDC | `01a0d024-cb7b-7694-b42a-290982ea6694` |
| TSLAx | `jupiterz` | `manual` | `3792051` | `3792051` | `0` | `10` | USDC | `01a0d024-cc9a-7495-a711-4e3bcfa8146e` |

Prices and routes are timestamped evidence, not stable expected values. `expireAt` was absent/null for all three responses. `swapMode` was `ExactIn`.

## Jupiter fee behavior observed

All three live responses returned:

- top-level `feeBps: 10`;
- `feeMint` equal to the USDC mint; and
- `platformFee: { feeBps: 10, feeMint: <USDC mint> }`.

This confirms the corrected specification: omitting an integrator/referral fee does not mean the `/order` path is fee-free. The application records Jupiter's returned fee fields and does not hard-code them.

JupiterZ returned guaranteed-price quote responses with `slippageBps: 0` and `otherAmountThreshold == outAmount`, despite the request containing `50` bps. The Metis response retained `slippageBps: 50` and returned a lower threshold. The implementation therefore records both the requested limit and Jupiter's actual response rather than assuming they are identical.

## Retained-position quote evidence

The sampled wallet's funded xStock was NVDAx:

- aggregate balance: `6719605` raw;
- illustrative proposed sale for this read-only test: `671960` raw;
- exact retained position: `6047645` raw;
- retained-position expected output: `13623644` raw USDC;
- retained-position reviewed minimum: `13555525` raw USDC;
- router: Metis;
- response slippage: `50` bps;
- returned Jupiter platform fee: `10` bps in USDC; and
- request ID: `01a0d024-cf8a-73fa-93b2-cadd11846b30`.

This proves the implementation quotes the exact raw remainder, not an estimated displayed or USD amount. It does not yet apply a user retained-exposure policy; that belongs to Milestone 2.

## Differences from build-spec assumptions

1. No amount-math mismatch was found, but the official helper's floating-point semantics remain the parity authority at boundaries. High-precision formula output alone is not accepted.
2. Jupiter fee fields were present and non-zero without an integrator/referral fee. The corrected build spec now requires dynamic fee recording.
3. The requested and returned slippage values can differ by router. JupiterZ returned zero response slippage for guaranteed quotes; Metis returned the requested 50 bps.
4. The public Solana RPC served required mint, owner-balance, slot, and block-time reads, but rate-limited a separate holder-discovery call used to find a sample address. The application does not need that discovery call.
5. The quote-only Jupiter endpoint was reachable without an API key during this run. This is observed availability, not a production credential guarantee.

## Unresolved blockers for Milestone 2

- Obtain and configure a reliable production Solana mainnet RPC endpoint.
- Obtain and configure a Jupiter Developer Platform API key.
- Define the bounded quote-search request budget/backoff behavior for converting a missing USDC target into raw input.
- Decide how to present router-returned slippage differing from the user's maximum while keeping `otherAmountThreshold` as the reviewed minimum.
- Confirm whether the retained-exposure policy should use the exact full remaining-position quote when route size is large or use a documented bounded/liquidity-aware method. Milestone 1 proves the exact calculation but does not solve every large-position market-depth case.
- Pyth remains intentionally unimplemented until Milestone 3; its service availability and user reference-protection policy remain separate.
- `/execute` amount fields and RPC wallet-delta reconciliation remain untested because no funded transaction was authorized.

## Exit-criteria result

**Passed.** Milestone 1 provides the typed read-only mainnet correctness slice, required automated coverage, current registry/multiplier/route evidence, an exact retained-position quote, and a timestamped local report. No funded action occurred. Work must stop here and not advance to Milestone 2 automatically.
