# Opportunity Map (prepared 23 Sep 2026, for Codex handoff)

Method: web survey of \~20 public Stocklana repos + live Solana stock products. Evidence = README/search snippets, NOT code audits. Everything marked VERIFY must be checked before building.

## 0. Deadline warning

Official page (pasted brief): submissions close Fri 25 Sep 2026, 4pm ET. Two repos (StockPass, Stocklane) cite 18 Sep. VERIFY on hackathons.solana.com tonight; the site is the source of truth.

## 1. Live products (what a user can already do today)

| WorkflowLive productNotes |                                                                                                                                                                    |                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Buy/sell 24/7             | Jupiter, Raydium, Phantom, Solflare, Exodus Markets, Titan RFQ                                                                                                     | Ondo tokens trade 24/5 by session; xStocks and PreStocks 24/7 (per Phantom help)          |
| Issuers                   | xStocks (Backed, \~86% Solana issuance), Ondo (430+ assets), Backpack (SPCX), Securitize/Jump/Jupiter regulated venue, SHIFT leveraged tokens, PreStocks (pre-IPO) | Same company can exist as several tokens                                                  |
| Borrow                    | Kamino xStocks market (\~82.6% share; $31M of $53M collateral peak, late Jul), Jupiter Lend (#2)                                                                   | Kamino ran 92% utilization in April; mostly leveraged longs (SPYx/QQQx)                   |
| Yield                     | Kraken vaults for SPYx/QQQx/NVDAx on Kamino                                                                                                                        | CEX-fronted                                                                               |
| Leverage/short            | Kraken xStocks perps (20x), Jupiter perps added SPCX/SNDK/SKHYNIX on 22 Sep 2026 (GUM orderbook)                                                                   | Brand new; little tooling likely exists                                                   |
| Discovery                 | Jupiter stocks screener                                                                                                                                            | Shows price, volume, holders, discount to mark                                            |
| Pre-IPO                   | PreStocks: SpaceX, OpenAI, Anthropic, Anduril, xAI etc; redemption for USDC                                                                                        | Tokens carry no legal ownership rights; SpaceX conversions at discount noted by PreStocks |

## 2. Stocklana submissions found

| RepoWorkflowReal/mock statusSaturation                               |                                                                            |                                                    |                            |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------- |
| mpotter2002/stocklana                                                | custom baskets                                                             | localnet only                                      | baskets HIGH               |
| Kikeskr/stockforge                                                   | baskets                                                                    | in progress                                        | HIGH                       |
| MallorcaBCDays/stocklana-baskets                                     | basket token                                                               | unknown                                            | HIGH                       |
| elaris-xyz/bozBasket                                                 | recurring basket buys gated by Pyth/session                                | devnet mock market; mainnet Jupiter fill NOT built | DCA HIGH                   |
| KvngJamesII/stocklane                                                | DCA + portfolio                                                            | Jupiter lite APIs                                  | DCA HIGH                   |
| Vibeaman/StockPilot                                                  | NL rules -> trigger -> Jupiter swap; Pyth dual feed; PreStocks; DBC preset | DBC "documented, not faked"                        | rules/agents MED-HIGH      |
| martymedia/after-hours                                               | which tokens trade now, drift, cost after slippage                         | live site                                          | terminals/parity HIGH      |
| manuelfeb056-max/stocknine-terminal                                  | terminal + parity                                                          | live                                               | HIGH                       |
| NathanOyewole/stocksh                                                | keyboard TUI                                                               | dry-run default                                    | HIGH                       |
| kdai03/xpaper                                                        | paper trading                                                              | live prices, virtual                               | LOW-MED                    |
| GODGRACE07/multiplier                                                | corporate-action multiplier oracle for xStocks                             | scoped to Token-2022 scaled UI amount              | corp actions MED (claimed) |
| angelraph/gapguard                                                   | weekend gap radar, Kamino read, gap insurance via DBC                      | insurance pool NOT live on-chain                   | risk MED                   |
| Mgabal/Stock-Lend                                                    | borrow vs tokenized stock + DBC launch                                     | seeded price, NO oracle, NO liquidations           | lending LOW quality        |
| Henoch4/Stockulus                                                    | delta-neutral carry vault                                                  | concept-heavy                                      | carry LOW-MED              |
| himanshu-rawat77/xspend                                              | spend xStocks at merchants (Seeker)                                        | devnet tUSDC only; rewards simulated               | spend MED                  |
| Isaacava/stockpass                                                   | verified-ownership social profiles                                         | early                                              | social LOW-MED             |
| operatoruplift/lotline                                               | read-only contribution planner (832 assets)                                | deployed, not submitted                            | planner MED                |
| aralroca/prestocks-pulse                                             | PreStocks premium radar, PRE8 index, redemption flows, MCP server          | live                                               | PreStocks analytics HIGH   |
| swarly-agent/stocklana                                               | "401k for AI agents" (Backpack Securities)                                 | V1 manual ledger                                   | niche                      |
| GuTS805/Stocklana                                                    | research on wrapper premium vs dividends                                   | analysis                                           | n/a                        |
| unnamed "market & intelligence layer" (1,339 companies, all issuers) | aggregation/research/yield                                                 | live?                                              | discovery HIGH             |

Pattern: most entries are dashboards, baskets, DCA, or mocks. Nearly every "hard" workflow is stubbed (no oracle, no liquidations, no live pool, simulated rewards, devnet only).

## 3. Gap analysis (workflow-level)

Rated: user pain / competition / feasibility in \~48h.

1. **Loan protection for stock-collateral borrowers** (Kamino/Jupiter Lend). Pain HIGH (leveraged longs; market-close gaps, ex-dividend windows, corporate actions move risk; Kamino itself uses price bands). Competition: GapGuard shows risk + insurance (not live), Stock-Lend toy. NOBODY found that *acts* (monitor -> alert -> prepared deleverage/repay). Feasibility MED (Kamino SDK, execution authority is the hard part). Pyth-native (equity feed vs xStock feed, session state).
2. **True portfolio accounting/tax for xStocks/Ondo/PreStocks**. Pain HIGH but quiet. Scaled-balance tokens mean raw balances and tx history mislead (per Multiplier README). Nobody found doing cost basis, dividends, realized PnL, export. Feasibility HIGH. Weak "wow", but strong "real user". Pyth less central (historical price).
3. **Basis/carry with the new Jupiter SPCX perp**: spot token + perp hedge with live funding. Pain MED. Competition: Stockulus (concept). Feasibility LOW-MED (new venue API/SDK unknown). VERIFY integration surface first.
4. **PreStocks exit/arb desk**: compare Jupiter sale vs redemption request vs discount; execute the best route. Competition: prestocks-pulse covers analytics + creation/redemption flows; execution route is less covered. Feasibility MED. Natural PreStocks bounty ($10k).
5. **Equity-tuned DBC issuance + monitoring** (Meteora $5k). At least 3 entries touch DBC (StockPilot preset, GapGuard pool, Stock-Lend launch). Only wins with a REAL mainnet pool and a defensible curve design. Feasibility MED. Best as a *bolt-on* for a main idea, not the wedge.
6. **Non-US fiat on/off-ramp into stock tokens**: real user (issuers market to non-US), but partner/regulatory heavy. Skip for 48h; mention as roadmap.
7. **Crowded, avoid as the wedge**: baskets, DCA, terminals, parity dashboards, paper trading, natural-language rules.

## 4. Scoring (1-5; feasibility discounted for 48h)

| CandidateReal userSolana reasonUniquenessFeasibilityBounty fitNotes |   |   |   |   |               |                                                    |
| ------------------------------------------------------------------- | - | - | - | - | ------------- | -------------------------------------------------- |
| 1 Loan guard                                                        | 5 | 5 | 4 | 3 | Pyth (strong) | Highest upside; check Kamino/execution first       |
| 2 Portfolio ledger/tax                                              | 4 | 3 | 4 | 5 | Pyth (weak)   | Safest; pairs well with 1 as "risk + accounting"   |
| 3 Perp basis                                                        | 3 | 4 | 3 | 2 | Pyth          | Risky, new API                                     |
| 4 PreStocks exit desk                                               | 3 | 4 | 3 | 3 | PreStocks     | Cheap bounty stack, but avoid other pre-IPO tokens |
| 5 DBC tool                                                          | 2 | 4 | 2 | 3 | Meteora       | Use only as add-on                                 |

## 5. Recommendation

Primary: **1. Loan guard** (Pyth track falls out naturally: equity feed vs xStock feed vs session state is the core signal). Fallback if Kamino integration blocks by tomorrow midday: **2. Ledger/tax**, with a small real-price risk panel. Do not stack unnatural bounties; PreStocks and Tessera are mutually exclusive, and DBC only if it truly serves the product.
Win condition: LIVE MAINNET end-to-end on real assets with a real wallet. Competitors are mostly mocks; real execution is the differentiator.

## 6. VERIFY list for Codex (do first, timebox 60-90 min)

1. Official deadline on hackathons.solana.com (18 vs 25 Sep).
2. Does Kamino (or Jupiter Lend) already offer stop-loss/auto-deleverage/conditional repay for xStocks loans? If yes, drop candidate 1.
3. Kamino SDK: read obligation health for a wallet; build repay and withdraw transactions; xStocks market address.
4. Execution authority: can a keeper act without user signature? If no, design as alert + one-tap pre-built signed-by-user tx (still valid).
5. Pyth access: are Equity.US.\* and Crypto.\*X feeds available via free Hermes, or paywalled? (GapGuard claims paid $5k+/mo; StockPilot uses Hermes with optional key.) Confirm bounty grants access.
6. xStocks multiplier/scaled UI amount handling: fetch method for correct balances (Multiplier repo README; xStocks docs).
7. Ondo session calendar and status source (status.ondo.finance) for market-state logic.
8. Read the actual code of GapGuard, Multiplier, StockPilot to confirm what is real vs stubbed.
9. If candidate 3 considered: Jupiter perps SPCX API/SDK access.

## 7. Judging alignment checklist

- Real user + problem: named user (leveraged xStock borrower), quantified pain.
- Working end-to-end demo: mainnet tx signature in the README/video.
- Why Solana: 24/7 tokens vs market-hours reference, Token-2022 scaled amounts, Kamino on Solana.
- Execution quality: no fake data labels, disclosed limitations, clean UI, 2-3 min video.