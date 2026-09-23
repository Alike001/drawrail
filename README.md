# Stocklana

Stocklana is a policy-preserving tokenized-stock portfolio drawdown product. The repository is
currently stopped at **Milestone 1: read-only mainnet correctness**.

Milestone 1 validates the closed asset registry, aggregates wallet token accounts, parses xStocks'
Token-2022 Scaled UI Amount state, checks official conversion parity and activation windows, and
obtains quote-only Jupiter Swap V2 orders. It contains no wallet signing or transaction submission.

## Run locally

```bash
cp .env.example .env.local
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm run validate:mainnet -- <wallet-public-key>
```

`SOLANA_RPC_URL` and `JUPITER_API_KEY` are server-side only. The Jupiter key is optional for the
currently reachable quote-only endpoint but should be configured for reliable production use.
Never add a wallet keypair, seed phrase, or private key to this repository.
