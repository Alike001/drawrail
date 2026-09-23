# Stocklana ecosystem in layman terms

## The one-sentence version

Stocklana is about making stocks behave more like programmable internet assets on Solana, then building products that are useful because those assets can move through wallets, DEXs, lending protocols, automated strategies and smart contracts.

## Think of a tokenized stock as a digital receipt

Imagine Apple stock exists in the traditional financial system. A token issuer can create a Solana token that is designed to track that stock or represent some legal/economic claim connected to it. The token can then sit in a Solana wallet and interact with Solana programs.

That does not mean every tokenized stock is legally identical to owning the underlying share. The structure depends on the issuer.

Examples:

- xStocks are presented as 1:1 backed tokenized U.S. stocks/ETFs held with regulated custody.
- Ondo stock tokens are total-return trackers backed by corresponding securities, with economic effects such as dividends incorporated into the token model.
- PreStocks explicitly says its tokens give economic exposure to private companies but do not confer ownership, voting, dividend, information or other legal rights.
- Tessera says its T-Tokens represent loan participation rights and provides tokenized exposure to private companies under its own legal structure.

For a hackathon product, the UI and README should never flatten those different structures into “this token is literally a share.”

## Why Solana matters

Traditional brokerages are mostly closed systems. A stock position normally stays inside the broker and can only be used in the workflows that broker supports.

On Solana, a stock-linked token can potentially be:

1. held in a wallet;
2. swapped through a DEX or aggregator;
3. used as collateral;
4. put into a vault or basket;
5. read by an oracle-aware smart contract;
6. acted on by automation or an AI agent;
7. combined with stablecoins and other onchain assets;
8. settled and audited on a public ledger.

That composability is the main product design space.

## The Stocklana stack

### 1. Asset layer

This is where the stock-like token comes from.

Public-market examples include xStocks and Ondo stock tokens. Private-market / pre-IPO examples in the hackathon include PreStocks and Tessera.

### 2. Market-data layer

A program needs a trustworthy reference for what an underlying equity or onchain token is worth. Pyth provides equity and token feeds that can be consumed by applications and, where supported, verified onchain.

### 3. Liquidity and execution layer

Tokens need places to trade. Jupiter routes swaps, Raydium and other AMMs provide liquidity, and Meteora provides liquidity infrastructure including Dynamic Bonding Curves for launching and graduating markets.

### 4. Credit and portfolio layer

Once a stock is a token, lending markets, vaults, indexes, recurring investment strategies and collateral products become possible.

### 5. Agent and automation layer

Clawpump gives AI agents Solana wallets, tools, token-launch infrastructure, automations and market access. Its Stocklana bounty specifically wants stock-linked agents whose token has a stock-paired liquidity pool through Clawpump and Meteora.

## What Stocklana is really asking builders to answer

A weak answer is: “stocks are now on Solana, so I made a dashboard.”

A stronger answer is: “because stock exposure is now a programmable token, this workflow becomes possible or materially better.”

The main-track question is essentially:

> What can a user do with a stock position on Solana that a normal brokerage either cannot do, does poorly, or makes unnecessarily difficult?
