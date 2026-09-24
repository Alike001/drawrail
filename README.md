# DrawRail

**Draw liquidity from your tokenized-stock portfolio within the rules you set.**

DrawRail turns tokenized-stock exposure into USDC without breaking your portfolio rules.

Illustrative request:

- Need 80 USDC.
- Already have 20 USDC.
- Need 60 more.
- NVDAx is rejected because selling enough would violate the user's retained-exposure floor.
- AAPLx is eligible under the same preservation and execution checks.
- The user reviews the proposed drawdown and, in the later transaction milestone, signs it explicitly.

![DrawRail landing page showing a policy-preserving liquidity decision](stocklana-context/screenshots/milestone-2-landing-desktop.png)

### Why this exists

A manual swap asks which token to sell. That is the wrong first question for someone who needs cash
but wants to preserve chosen stock exposure. DrawRail starts with the USDC need, counts existing USDC
first, and evaluates supported positions against deterministic retained-exposure and execution rules.

It is not an investment advisor or trading bot. It applies rules the user already chose and explains
why each position is selected, rejected, unavailable, or ranked lower.

### How it works

```text
USDC need → portfolio policy → xStock evaluation → Jupiter quote → review → wallet signature → settlement evidence
```

The application now supports an explicitly reviewed, wallet-signed drawdown through Jupiter and verifies
the resulting wallet balance changes through Solana RPC. Funded execution remains disabled by default.

### Why Solana

- **xStocks** provide tokenized-stock exposure in a self-custody wallet.
- **Token-2022 Scaled UI Amount** means displayed economic units can differ from raw transaction units;
  DrawRail reads the live multiplier and hard-blocks its activation window.
- **Jupiter Swap V2** supplies current ExactIn xStock → USDC liquidity and conservative minimum output.
- **Wallet signing** keeps authorization with the user rather than an autonomous service.
- **RPC settlement evidence** will prove the actual wallet debit and credit in the transaction milestone.

### Current status

Completed:

- closed registry for AAPLx, NVDAx, TSLAx, and USDC;
- aggregate balance reads across multiple token accounts;
- live mainnet Token-2022 multiplier parsing and official conversion-parity tests;
- inclusive ±15-minute multiplier activation hard block;
- live quote-only Jupiter Swap V2 evaluation;
- deterministic retained-floor policy engine and candidate ranking;
- public landing page, read-only portfolio, request, decision, and review surfaces;
- live mainnet read-only actionable and blocked decision evidence;
- authenticated TSLAx reference protection using a fresh Pyth Tesla equity feed and multiplier-correct Jupiter executable-price evidence;
- Wallet Standard connection without a connection signature;
- a fresh Jupiter wallet-bound final order, v0 decoding, lookup-table resolution, and unsigned simulation;
- exact raw-input and minimum-USDC token-delta validation; and
- canonical transaction-message hashing with a short-lived HMAC decision receipt.
- Wallet Standard `signTransaction` integration that never asks the wallet to broadcast;
- server verification of the exact reviewed message and the user's Ed25519 signature;
- router-aware order expiry, last-moment multiplier/Pyth checks, and a capped operator-gated `/execute` path;
- single-instance replay refusal and RPC token-balance settlement reconciliation; and
- confirmed, failed, investigation, and unknown settlement receipt states.

Validated manually:

- Phantom Wallet Standard sign-only flow on Mainnet;
- exact message hash preserved across the wallet boundary;
- user signature verified server-side;
- the Stage A transaction was not broadcast and moved no funds; and
- one explicitly approved low-value AAPLx → USDC Mainnet transaction, with exact-message signature verification and RPC-reconciled settlement.

Not currently available:

- Pyth reference protection for AAPLx and NVDAx, which remain unavailable under the current trial entitlement.

DrawRail has completed one low-value Mainnet AAPLx → USDC validation transaction. This proves the end-to-end path; it does not imply broad production usage. The funded control remains disabled by default and requires production RPC/Jupiter/receipt configuration, `mainnet-funded` mode, and an explicit operator gate.

### Supported assets

- AAPLx
- NVDAx
- TSLAx
- USDC

### Safety model

- Self-custodial: DrawRail never accepts or stores a wallet private key.
- User-authorized: every financial action requires an explicit wallet signature.
- Closed assets: no hidden issuer or mint substitution.
- Deterministic: no AI trading, autonomous portfolio management, or investment recommendation.
- Multiplier-safe: activation-window violations hard-block rather than warn.
- Amount-correct: raw integers and displayed Token-2022 amounts remain separate typed concepts.
- Conservative: retained floors use the exact remaining-position quote's minimum output.

### Run locally

Requirements: Node.js 20.9 or newer.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Verification:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run validate:mainnet -- <wallet-public-key>
npm run validate:pyth
```

`SOLANA_RPC_URL`, `JUPITER_API_KEY`, and `DECISION_RECEIPT_SECRET` are server-side only. The public RPC
and keyless Jupiter path are suitable for limited read-only checks, but the quote-heavy decision-to-review
flow can be rate-limited and reliable deployment requires production credentials. Never add a wallet
keypair, seed phrase, private key, or real secret to this repository.

`PYTH_PRO_API_KEY` is also server-only. `validate:pyth` prints only sanitized feed metadata and observations; pass a public wallet address to exercise the complete read-only TSLAx/Pyth/Jupiter policy path. TSLAx protection compares the authenticated Tesla equity reference with the expected Jupiter output per multiplier-correct displayed TSLAx unit. AAPLx and NVDAx are explicitly unprotected under the current entitlement, while the core non-Pyth drawdown remains usable.

### Hackathon

Built for the Solana Foundation Stocklana hackathon.
