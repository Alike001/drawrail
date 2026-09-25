# DrawRail — submission copy

## Project name

DrawRail

## One-line description

DrawRail turns tokenized-stock exposure into USDC without breaking the portfolio rules the user already chose.

## Short description

DrawRail starts with a cash need instead of a token to sell. It counts existing USDC, evaluates AAPLx, NVDAx, and TSLAx against retained-exposure and execution rules, handles Token-2022 multiplier state, obtains live Jupiter liquidity, and explains one exact wallet-bound drawdown before the user signs. Settlement is proven from Solana RPC wallet balance changes.

## Problem

A person who needs USDC from a tokenized-stock portfolio must normally decide which position to sell, calculate how much exposure will remain, account for unusual token amount semantics, inspect a swap quote, and trust that the final transaction still matches that plan. A normal swap interface solves execution but not the portfolio-level decision.

## Solution

The user enters a target USDC balance and a small set of explicit rules. DrawRail counts existing USDC first, evaluates every supported position, blocks candidates that violate retained exposure or execution safety, and deterministically selects one eligible reduction. It then builds and validates the exact wallet-bound transaction, shows expected and minimum USDC, and lets only the owner authorize it.

## Why Solana

Solana makes the full evidence chain possible in one wallet action: xStocks provide tokenized-stock exposure; Token-2022 Scaled UI Amount requires live multiplier-aware raw/displayed conversion; Jupiter Swap V2 supplies executable xStock → USDC routes; Wallet Standard keeps authorization self-custodial; and RPC token balance deltas prove what the wallet actually lost and received.

## What is working

- Wallet Standard connection and wallet-change invalidation.
- Aggregated Mainnet balances for USDC, AAPLx, NVDAx, and TSLAx.
- Live Token-2022 Scaled UI multiplier parsing, conversion parity, and inclusive activation-window blocking.
- USDC-first policy evaluation, retained floors, bounded final-order sizing, deterministic ranking, and reason-coded alternatives.
- Live Jupiter Swap V2 quote and wallet-bound v0 order validation, lookup resolution, simulation, fee capture, expiry, and canonical message binding.
- Explicit wallet `signTransaction`, server-side Ed25519/message verification, one-shot Jupiter execution, and RPC settlement reconciliation.
- Authenticated TSLAx-only Pyth reference protection.
- Public responsive landing, product flow, exact review, recorded validation evidence, and explicit safe deployment state.

## Mainnet evidence

DrawRail completed one low-value Mainnet AAPLx → USDC validation. The wallet’s raw AAPLx debit was `149435`; reviewed expected/minimum output was `502515 / 500002` raw USDC; actual RPC wallet credit was `502515`; gross route output was `503018`; output-mint fee was `503`; Jupiter returned `Success / 0` through Metis; Solana finalized at slot `450156253`; and no retry occurred.

Transaction:

`4fk7YBSP2pjGoxbW91CHZZaU9dStZ5y2M73j3UTbdYefk5ESjTmnYvwQx2gwnEAnctorjzX58KASAvx2PULdM2uN`

## Pyth bounty section

TSLAx reference protection uses authenticated Pyth Pro `Equity.US.TSLA/USD`, feed ID `1435`. DrawRail validates `feedUpdateTimestamp`, envelope time, market session, confidence, and publisher count, then compares the reference with the executable price derived from the exact Jupiter output and multiplier-correct displayed TSLAx amount. The same live candidate passed at 100 bps and was blocked at 17 bps, proving Pyth changes eligibility. AAPLx and NVDAx protection remain unavailable under the current trial entitlement.

## GitHub

https://github.com/Alike001/drawrail

## Demo/live app

https://drawrail.vercel.app

Recorded Mainnet evidence: https://drawrail.vercel.app/validation

## Technical architecture

One Next.js/TypeScript application separates browser wallet/UI concerns from server-only RPC, Jupiter, Pyth, receipt, transaction-validation, and settlement modules. Authoritative amounts use branded bigint/fixed-precision types. No custom Solana program is required; DrawRail binds its deterministic off-chain policy result to existing wallet, Token-2022, and Jupiter program execution.

## Safety model

DrawRail is self-custodial and fail-closed. It verifies live mint/multiplier state, blocks activation windows, enforces final minimum output and retained floors, requires the wallet to sign the exact reviewed message, never automatically retries a financial submission, and treats RPC-observed wallet deltas as settlement authority. Public production runs with funded execution disabled.

## Future work

Add durable atomic submission state before multi-instance funded operation, expand authenticated Pyth entitlement only when evidence standards can be preserved, and complete a professional security review. Assets and policies remain intentionally narrow until those foundations are ready.
