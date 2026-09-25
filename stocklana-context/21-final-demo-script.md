# DrawRail — final two-minute demo script

Target: approximately 2 minutes. Use the live public deployment in Mainnet read-only mode and the recorded validation page. Do not perform another funded transaction.

## Main Track

### 0:00–0:15 — The need

**Screen:** `/`

> I need liquidity from my portfolio, but I do not want to manually decide what to sell. DrawRail turns tokenized-stock exposure into USDC without breaking the portfolio rules I already chose.

Point to the illustrative `80 − 20 = 60` example.

> A normal swap starts by asking which token I want to sell. DrawRail starts with how much liquidity I need and what exposure I refuse to break.

### 0:15–0:35 — The portfolio

**Screen:** `/app`, connected wallet, `Mainnet — read only` visible.

> DrawRail reads existing USDC first, then the supported AAPLx, NVDAx, and TSLAx positions. These are live wallet balances. Displayed xStock units stay separate from raw Token-2022 transaction units.

Briefly open `Inspect balances` only if the judge needs proof of the multiplier distinction.

### 0:35–0:55 — The request and rules

**Screen:** Request USDC.

> I enter the target wallet balance, not a token to sell. Existing USDC is counted automatically. I can set a retained-exposure floor for each stock and a maximum slippage.

Use the prepared scenario: 80 USDC target, 20 already available, 60 needed, 600 USD NVDAx floor, 0.5% slippage. Explain that the numbers are a scenario, not hard-coded selection.

### 0:55–1:15 — The decision

**Screen:** actionable Decision.

> DrawRail evaluates every supported position. Here one candidate is selected because it can cover the need while preserving the rules. NVDAx is blocked because selling enough would leave it below the retained floor. The decision shows displayed reduction, expected output, reviewed minimum, and remaining exposure before transaction mechanics.

Do not call this an investment recommendation. It is the deterministic V1 policy rule.

### 1:15–1:35 — Exact review

**Screen:** fresh exact Transaction Review.

> DrawRail now obtains a wallet-bound Jupiter v0 transaction. It sizes against the final minimum output, converts the selected xStock amount using the live multiplier, simulates the exact raw debit and USDC credit, and binds the canonical message hash to the review.

Point to expected/minimum output, destination wallet, Jupiter fee, countdown, and the `Mainnet — read only` gate. Do not read hashes aloud.

### 1:35–1:50 — Recorded Mainnet proof

**Screen:** `/validation`.

> We already completed one low-value Mainnet end-to-end validation, so this public demo does not send another transaction. The wallet reduced 149435 raw AAPLx and received 502515 raw USDC—above the reviewed 500002 minimum. Jupiter reported success, Solana finalized at slot 450156253, RPC wallet deltas reconciled, and no retry occurred.

Open Solscan if time permits.

### 1:50–2:00 — Close

**Screen:** recorded receipt or landing close.

> DrawRail starts with the cash you need, preserves the rules you chose, and only then constructs the transaction you sign.

## Pyth bounty addendum — 15–20 seconds

**Screen:** `/validation`, Pyth sponsor evidence.

> Pyth says what Tesla is worth. Jupiter says what TSLAx can actually sell for. DrawRail compares the fresh authenticated Tesla reference—feed 1435—with the multiplier-correct executable TSLAx price. The same live candidate passed at a 1% limit and was blocked at 0.17%, so Pyth materially changes eligibility. Apple and Nvidia protection are not claimed under the current trial entitlement.

## Demo recovery rules

- If a live portfolio or quote API is slow, name the real state and retry only the read-only evaluation.
- If an unsigned review expires, use `Refresh transaction` while the policy decision is recent; otherwise use `Refresh decision`.
- Never open the funded gate, sign, call `/execute`, or broadcast during the submission demo.
- Use `/validation` for the completed transaction evidence; it is visibly labeled recorded evidence and cannot submit anything.
