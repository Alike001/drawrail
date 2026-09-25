# DrawRail deployment

DrawRail is deployed as one Next.js service. The public production environment must remain in Mainnet read-only mode unless the owner deliberately opens the funded gate for a controlled validation.

## Safe production defaults

```text
NEXT_PUBLIC_APP_MODE=mainnet-read-only
FUNDED_EXECUTION_ENABLED=false
MAX_MAINNET_DRAWDOWN_USDC=0.5
```

The first two settings independently keep the money-moving action unavailable. Never deploy a public preview or production build with `mainnet-funded` and an open funded gate by accident.

## Vercel environment variables

Add these as **Secret** values for Production only:

| Name | Purpose |
|---|---|
| `SOLANA_RPC_URL` | Authenticated production Solana Mainnet RPC URL |
| `JUPITER_API_KEY` | Jupiter Swap V2 authentication |
| `PYTH_PRO_API_KEY` | Authenticated Pyth Pro observation access |
| `DECISION_RECEIPT_SECRET` | At least 32 high-entropy bytes for review HMAC receipts |

Add these as non-secret **Config** values:

```text
PYTH_POLICY_ENABLED=true
PYTH_MAX_FEED_AGE_MS=5000
PYTH_MAX_CONFIDENCE_BPS=100
PYTH_CLOCK_SKEW_MS=1000
DECISION_RECEIPT_TTL_SECONDS=60
MAX_MAINNET_DRAWDOWN_USDC=0.5
FUNDED_EXECUTION_ENABLED=false
JUPITER_BASE_URL=https://api.jup.ag/swap/v2
MULTIPLIER_SAFETY_WINDOW_SECONDS=900
NEXT_PUBLIC_APP_MODE=mainnet-read-only
```

`NEXT_PUBLIC_APP_MODE` is intentionally public because it labels the environment. No API key, RPC credential, receipt secret, authorization header, private key, seed phrase, or signed transaction belongs in a `NEXT_PUBLIC_*` variable.

## Deploy

With the repository linked to Vercel:

```bash
vercel link --yes --project drawrail
vercel --prod
```

The GitHub repository is connected to the same Vercel project, so later pushes to `master` can deploy through the authorized integration.

## Clean-session verification

1. Open `/` in a private browser window and confirm the product is understandable without a wallet.
2. Check desktop and 390 px mobile layouts, `/validation`, and every README link.
3. Open `/app`; confirm `Mainnet — read only` and the safe-mode sentence remain visible.
4. Connect an injected Wallet Standard wallet. Connection must request neither a message nor transaction signature.
5. Confirm live portfolio reads, policy evaluation, decision explanations, and exact transaction review.
6. Confirm `Sign and execute drawdown` remains disabled and the UI states that the funded gate is closed.
7. Inspect browser JavaScript and API payloads for the names/values of server secrets. Only sanitized service state may reach the browser.
8. Expire an unsigned review and verify `Refresh transaction` appears while the decision is recent; older decisions require `Refresh decision`.
9. Do not perform a funded transaction as part of deployment verification. Use the recorded `/validation` evidence and Solscan link.

## Operational boundary

The current replay guard is process-local. This is adequate for the completed single-instance hackathon validation, but funded execution must stay disabled on a serverless/multi-instance public deployment until receipt submission state is stored durably with atomic uniqueness.
