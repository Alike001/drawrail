# DrawRail — final readiness evidence

Date: 25 September 2026
Milestone: 6 — deployment, product polish, demo, and submission readiness

## Outcome

DrawRail is submission-ready at [https://drawrail.vercel.app](https://drawrail.vercel.app). The public deployment is Mainnet read-only by default, exposes no funded execution action, and presents live portfolio evaluation plus exact unsigned transaction review. Recorded evidence—not a fabricated or resubmittable transaction—is available at `/validation`.

GitHub: [https://github.com/Alike001/drawrail](https://github.com/Alike001/drawrail)

## Safe deployment state

- `NEXT_PUBLIC_APP_MODE=mainnet-read-only`
- `FUNDED_EXECUTION_ENABLED=false`
- `MAX_MAINNET_DRAWDOWN_USDC=0.5`
- RPC, Jupiter, Pyth, and receipt credentials are server-only Vercel secrets.
- A production bundle/HTML scan found none of the configured secret values.
- The recorded validation page cannot connect a wallet, build an order, sign, call Jupiter, or broadcast.

The deployment and environment checklist is in `DEPLOYMENT.md`.

## Deployment verification

Verified from a clean automated browser/API session:

- landing, application, and recorded-validation routes load successfully;
- responsive desktop and 390 px mobile layouts render without horizontal overflow;
- Wallet Standard discovery and read-only wallet connection work;
- a live Mainnet portfolio read returns all three supported positions;
- a live 0.50-USDC policy evaluation selected AAPLx;
- a fresh exact wallet-bound review reached `review_ready` through Metis with a `500002` raw-USDC minimum;
- the public deployment reported funded execution and operator enablement as false;
- an initial transient Jupiter-unavailable review failed closed and a newly evaluated review succeeded;
- transaction-only and decision refresh paths remain distinct.

No funded transaction was performed during Milestone 6.

## Mainnet financial evidence

DrawRail completed one low-value AAPLx → USDC Mainnet validation during Milestone 5:

- transaction: `4fk7YBSP2pjGoxbW91CHZZaU9dStZ5y2M73j3UTbdYefk5ESjTmnYvwQx2gwnEAnctorjzX58KASAvx2PULdM2uN`
- router/status/code: Metis / Success / `0`
- raw AAPLx debit: `149435`
- reviewed expected output: `502515` raw USDC
- reviewed minimum output: `500002` raw USDC
- gross route output: `503018` raw USDC
- output-mint fee: `503` raw USDC / 10 bps
- RPC-observed wallet credit: `502515` raw USDC
- Solana slot: `450156253`
- automatic retries: none

RPC wallet deltas matched the fee-aware Jupiter totals, and actual output exceeded the reviewed minimum. This proves one controlled end-to-end flow; it is not a claim of production-scale usage.

## Pyth sponsor evidence

TSLAx reference protection is implemented with authenticated Pyth Pro `Equity.US.TSLA/USD`, feed ID `1435`. DrawRail validates feed freshness, session, confidence, and publisher count, then compares the reference with the multiplier-correct executable TSLAx price derived from Jupiter. The same live candidate passed at a 100-bps limit and was blocked at 17 bps (`17.229701` bps observed), proving the Pyth result changes eligibility.

AAPLx and NVDAx reference protection remain unavailable under the current trial entitlement. DrawRail does not imply otherwise.

## Final screenshots

- `stocklana-context/screenshots/final-landing-desktop.png`
- `stocklana-context/screenshots/final-landing-mobile.png`
- `stocklana-context/screenshots/final-connected-portfolio.png`
- `stocklana-context/screenshots/final-request-usdc.png`
- `stocklana-context/screenshots/final-actionable-decision.png`
- `stocklana-context/screenshots/final-blocked-retained-floor.png`
- `stocklana-context/screenshots/final-recorded-transaction-review.png`
- `stocklana-context/screenshots/final-mainnet-receipt.png`
- `stocklana-context/screenshots/final-mainnet-receipt-mobile.png`
- `stocklana-context/screenshots/final-pyth-pass-block.png`

The transaction review and settlement screenshots are visibly identified as recorded validation evidence and cannot trigger financial actions.

## Submission materials

- Demo script: `stocklana-context/21-final-demo-script.md`
- Submission copy: `stocklana-context/22-submission-copy.md`
- Public README: `README.md`
- Deployment guide: `DEPLOYMENT.md`

## Verification

- tests: **153 passed** across 23 files
- typecheck: passed
- lint: passed
- production build: passed; all static and dynamic routes compiled
- `git diff --check`: passed
- `npm audit --audit-level=moderate`: zero vulnerabilities
- repository secret scan: passed; only `.env.example` is tracked, historical sensitive-filename review found only `.env.example`, credential markers resolve to safety prose/placeholders, and no configured secret value appears in public HTML or JavaScript
- public links: landing, `/app`, `/validation`, and GitHub returned HTTP 200
- Solscan evidence: the transaction link is valid for interactive browsers; Solscan returned HTTP 403 to the automated curl check

## Known limitations

- Public funded execution is intentionally disabled.
- Only TSLAx has authenticated Pyth reference protection under the current entitlement.
- A multi-instance funded service requires durable atomic idempotency rather than the current process-local replay guard.
- Production-scale operation requires a professional security review and monitoring.
- The supported set remains intentionally limited to AAPLx, NVDAx, TSLAx, and USDC.
- Jupiter/RPC availability can cause a fail-closed refresh requirement; DrawRail never substitutes fixtures into live decisions.

## Readiness decision

DrawRail is ready for Stocklana submission. Its product story is understandable without a wallet, the working application demonstrates live read-only decision and exact-review behavior, and its financial and sponsor claims are supported by recorded Mainnet evidence.
