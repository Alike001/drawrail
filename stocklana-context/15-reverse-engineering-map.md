# Reverse-Engineering Map — Product and UX References

Date: 23 September 2026

Status: final pre-Milestone-2 product/UX research; the DrawRail product direction remains locked

## Research boundary and evidence standard

This pass asks only how existing products communicate, structure, and prove a financial action. It does not reopen DrawRail's product choice.

Eight repositories were cloned with `--depth 1` into the sibling directory `../stocklana-reference-repos/`. No code, branding, proprietary assets, or design assets were copied into DrawRail.

| Repository | Inspected commit | Clone result |
|---|---|---|
| [xspend](https://github.com/himanshu-rawat77/xspend) | `36d864fa759a47d6ceb5b1fd183392ffa1a29568` | Success |
| [henar](https://github.com/aramzcrypto/henar) | `c20e8b54dd3a18822b525f50ad2a6b5a3bbf1ab4` | Success |
| [multiplier](https://github.com/GODGRACE07/multiplier) | `c0b5ad3793e6066e1e19e50ee4bd4f4bf8b3ec87` | Success |
| [rambu](https://github.com/PugarHuda/rambu) | `8677adce4c0830ab19cc21eea90386f3d5b8306a` | Success |
| [StockPilot](https://github.com/Vibeaman/StockPilot) | `72694db9474f9431798fbe7e853960a7035fa838` | Success |
| [offhrs](https://github.com/solomonadzape95/offhrs) | `998631599b6165115bf3a2cc4ab35f41e4429e67` | Success |
| [wallie-prestocks](https://github.com/fskroes/wallie-prestocks) | `f4f53b101986ea3481ec98bd9454d9753f0d86c8` | Success |
| [samui-wallet](https://github.com/samui-build/samui-wallet) | `56ddcaaaf9fe8bd20e60846888433781aa0e96fe` | Success |

Evidence labels used below:

- **Verified in code:** behavior visible in executable source or tests at the pinned commit.
- **Repository claim:** stated in a README or product copy but not independently executed in this pass.
- **Planned/mock:** explicitly simulated, fixture-backed, dry-run, disabled, or described as future work.
- **Inference:** a product lesson derived from the verified evidence, not a claim made by the source.

## Executive conclusion

No inspected product implements DrawRail's exact workflow:

> cash need first → existing USDC first → preservation policy second → one multiplier-correct xStock reduction → current execution third → explicit signature → wallet-delta receipt.

The nearest overlaps are fragmented:

- xSpend starts from a payment amount and has unusually clear environment and receipt states, but the verified live path is a direct devnet test-token transfer, not policy-preserving xStock liquidation.
- Henar has the strongest quote/build/simulation boundaries and honest unavailable states, but it is company/representation-first market infrastructure rather than cash-need-first drawdown.
- Multiplier makes Scaled UI Amount understandable, but its implementation reads the xStocks HTTP API and performs read-only floating-point display math rather than authoritative on-chain conversion or execution.
- Wallie PreStocks has deterministic refusal reasons and a unified decision ledger, but it is an autonomous private-market buyer using an older Jupiter surface and a local key.
- Samui has the best reusable pre-signing pattern: simulate, show expected balance changes, disable confirmation on simulation failure, then show an explorer-backed completion state.

The wedge therefore remains differentiated. The research changes presentation and environment strategy, not product scope or architecture.

## Reference repository maps

### 1. xSpend

**Problem**

Make tokenized-stock value spendable at a merchant and reward spending with “StockBack.”

**Target user**

A mobile wallet user who wants to pay a merchant from a stock-themed portfolio.

**30-second pitch**

Select a purchase, choose a portfolio asset, review the route, approve in a mobile wallet, and receive a payment receipt plus a simulated stock reward.

**Core workflow**

Home → scan/select merchant or enter recipient → enter amount → choose asset → review route/slippage/settlement → mobile wallet approval → submitted/confirming/confirmed receipt.

**Routes/surfaces and responsiveness**

This is a native mobile Expo application rather than a web route tree. `App.tsx` switches among Home, Markets, Portfolio, History, Rewards, Profile, Settings, and Stock Detail; spending and receipts are modal flows. Touch sizing, bottom navigation, safe areas, and vertically stacked review states are first-class.

**Strongest product idea**

The requested cash/payment amount is primary; the funding asset is selected afterward.

**Strongest UX idea**

An always-visible environment pill distinguishes `Demo Sandbox`, `Solana Devnet`, and `Solana Mainnet`. The receipt models submitted, confirming, confirmed, failed, and unknown states and provides an explorer link and retry-status action.

**Technical pattern worth learning from**

Local portfolio effects are delayed until RPC confirmation rather than triggered by the wallet returning a signature. The code also treats confirmation timeout as a state to inspect rather than immediate proof of failure.

**What overlaps DrawRail**

Amount-first interaction, asset selection after the request, wallet approval, live confirmation, and evidence-oriented receipts.

**What DrawRail must NOT copy/build**

Merchant QR/checkout framing, StockBack, rewards, a sandbox ledger mixed into the product path, legacy Jupiter v6 construction, direct client broadcast of the signed transaction, or route fallbacks that silently change settlement behavior.

**Implementation reality**

- **Verified in code:** Expo/React Native app; mobile-wallet `signTransactions`; independent client broadcast; RPC confirmation; mock-stock/merchant seeded store; explicit mode/network UI; receipt states.
- **Repository claim with bounded proof:** the README links a real 50 tUSDC devnet transfer.
- **Planned/mock:** the verified transfer is direct tUSDC, not xStock → USDC through Jupiter; StockBack is simulated; the repository itself says the production Jupiter liquidation path is planned.
- **Token-2022:** no authoritative Scaled UI Amount conversion/safety-window path was found.

**Decision: ADAPT**

Adapt the environment labeling, pending receipt, explorer evidence, and confirmation discipline. Reject the merchant and reward product.

Evidence: `README.md`, `src/components/SpendModal.tsx`, `src/components/ReceiptModal.tsx`, `src/screens/HomeScreen.tsx`, `src/services/wallet.ts`, `src/services/jupiter.ts`, `src/store/useStockStore.ts`.

### 2. Henar

**Problem**

One underlying company can have several tokenized representations with different issuers, mechanics, liquidity, and execution availability.

**Target user**

A Solana tokenized-stock researcher/trader comparing companies and issuer representations.

**30-second pitch**

Choose the company, compare every verified representation and route, then research, trade, earn, or manage positions from one market layer.

**Core workflow**

Public narrative landing → company-first markets → representation comparison → route quote → simulated transaction review → wallet sign → protected submission/history. Portfolio also supports connected-wallet and read-only address views.

**Routes/surfaces and responsiveness**

Next.js routes include `/`, `/markets`, `/trade`, `/portfolio`, `/earn`, `/packs`, `/stockfolio`, `/collection`, `/studio`, and `/admin`, plus detail/API routes. Landing sections and application tables use responsive CSS and overflow handling, but the breadth and density target research/trading users rather than a one-task mobile flow.

**Strongest product idea**

Normalize around the user's conceptual object (the company) while preserving issuer differences instead of pretending mints are interchangeable.

**Strongest UX idea**

“Unavailable,” “Coming soon,” and “External opportunity” are designed states. The interface does not fill missing live data with reassuring estimates.

**Technical pattern worth learning from**

The router separates quote, guarded build, simulation, wallet signing, and protected submission. Read-only router responses expose why a candidate is unavailable, while executable candidates must survive build/simulation checks.

**What overlaps DrawRail**

Closed registry discipline, live quote comparison, Token-2022 awareness, exact integer accounting, wallet-bound authorization, transaction simulation, and honest data availability.

**What DrawRail must NOT copy/build**

Cross-issuer routing, a universal stock market/research terminal, DCA, packs, yield products, large catalog, custom protocol, or the information density of a professional terminal.

**Implementation reality**

- **Verified in code:** substantial Next.js routes and API boundaries; wallet adapters; read-only wallet viewing; quote and route APIs; versioned-transaction build/submit paths; simulation gates; Token-2022 Scaled UI tests; multiple explicit unavailable states.
- **Repository claim:** broad market/data coverage and a candidate V1 protocol manifest.
- **Planned/disabled:** README says the public site is a development preview and funded public mainnet deposits are not enabled; several strategies are read-only or explicitly coming soon; local program tests include mock Jupiter/Kamino fixtures and captured mainnet packets.

**Decision: ADAPT**

Adapt the fail-honestly states, evidence hierarchy, simulation gate, and separation of observed versus executable routes. Reject the scope and terminal density.

Evidence: `README.md`, `src/app/page.tsx`, `src/components/stockroom.tsx`, `src/components/landing-trade.tsx`, `src/app/api/market/route.ts`, `src/app/api/router/build/route.ts`, `src/app/api/router/submit/route.ts`, `programs/stockroom/tests/runtime.rs`.

### 3. Multiplier

**Problem**

Wallets can show the raw token quantity while xStock economic/displayed quantity changes through the Scaled UI Amount multiplier.

**Target user**

xStock holders and builders who need to understand multiplier changes and corporate-action history.

**30-second pitch**

Enter an xStock and raw amount to see the naive balance, corrected balance, current multiplier, and corporate-action timeline.

**Core workflow**

Problem-first landing with animated AAPLx drift example → live console → choose symbol and raw amount → compare naive/corrected values → inspect event ledger and API endpoints.

**Routes/surfaces and responsiveness**

The shipped frontend is one Vite SPA rather than separate product routes; an older `Landing.tsx`/`Console.tsx` hash-route split remains in source while `App.tsx` combines the narrative and console. CSS collapses cards/controls on narrow screens, but the ledger remains a data-heavy secondary section.

**Strongest product idea**

One concrete before/after number makes an obscure Token-2022 mechanism understandable immediately.

**Strongest UX idea**

The hero demonstrates the problem rather than describing a feature list: “wallet shows” versus “you actually own,” then the multiplier event that caused the gap.

**Technical pattern worth learning from**

The polling service retains snapshots and derives an event ledger instead of showing only the current value.

**What overlaps DrawRail**

Multiplier visibility, old/new values, activation timing, and plain-language explanation.

**What DrawRail must NOT copy/build**

A standalone multiplier-monitoring product, an off-chain API as transaction authority, corporate-action classification, or JavaScript-number arithmetic for authoritative amounts.

**Implementation reality**

- **Verified in code:** Express poller reads the xStocks public HTTP API every five minutes; SQLite stores snapshots/events; frontend calls a live hosted API; balance calculations use `number` and `rawAmount * multiplier`.
- **Repository claim that overstates the implementation:** copy attributes the behavior to the on-chain Token-2022 extension, but the implemented service does not read the live mint extension. “Nothing simulated” refers to fetched API data, while the hero history is a hard-coded `REAL_HISTORY` array.
- **Execution:** intentionally read-only; no wallet or trade path.

**Decision: TAKE/REJECT split**

Take the two-number explanation and activation timeline. Reject its arithmetic and source-of-truth model.

Evidence: `README.md`, `frontend/src/App.tsx`, `frontend/src/Landing.tsx`, `backend/src/xstocks/client.ts`, `backend/src/xstocks/poller.ts`, `backend/src/routes/events.ts`.

### 4. Rambu

**Problem**

Tokenized-stock protocols and LPs need session-aware fair prices, corporate-action status, and an honest measure of LP economics.

**Target user**

Protocol builders/lenders and sophisticated Raydium LPs, not a general retail trader.

**30-second pitch**

Read a session-aware fair price/status for an xStock, prove a lender gate on devnet, or audit a live SPYx/USDC LP position against historical LVR.

**Core workflow**

Evidence-dense board → mainnet fair-price/lender snapshots → devnet on-chain status and simulated verdict → keeper history → paste wallet/position NFT for LP audit.

**Routes/surfaces and responsiveness**

The public frontend is a single static `web/index.html` with anchored sections plus JSON/action endpoints rather than application routes. It includes horizontal table overflow and narrow-screen layout rules, but remains an expert data board on mobile.

**Strongest product idea**

Status is as important as price: `Open`, `Closed`, `Halted`, `Stale`, or `CorpActionPending` is a first-class output.

**Strongest UX idea**

Every section labels provenance and network. Real mainnet reads, daily snapshots, devnet program state, and simulated verdicts are not visually collapsed into one “live” claim.

**Technical pattern worth learning from**

Use synthetic Token-2022 mirrors on devnet to test multiplier-dependent program behavior while clearly naming them as mirrors, and keep real issuer assets/mainnet reads separate.

**What overlaps DrawRail**

Pyth session/freshness handling, multiplier state, corporate-action blocks, explicit reason codes, synthetic devnet mirrors, and fail-closed status.

**What DrawRail must NOT copy/build**

A lender oracle, keeper, custom program, LP accounting/LVR product, public data board, or dense protocol-facing UI.

**Implementation reality**

- **Verified in code/repository artifacts:** devnet Anchor program and mirror workflow; browser reads devnet accounts and mainnet LP accounts; transaction simulation for verdicts; explicit RPC-rate-limit states; static snapshot files.
- **Repository claim:** named mainnet observations and devnet deployments are documented with addresses and commands; they were not independently replayed in this pass.
- **Known limits:** single trusted keeper, partial Pyth Pro entitlement, fallback sources, current-position replay bias.

**Decision: TAKE**

Take the environment/provenance separation and synthetic-mirror test strategy. Do not take the protocol architecture.

Evidence: `README.md`, `web/index.html`, `programs/rambu/src/lib.rs`, `keeper/verify-chain.ts`.

### 5. StockPilot

**Problem**

Turn a natural-language stock-trading condition into a deterministic rule and a wallet-approved swap when it triggers.

**Target user**

A trader who wants conditional xStock alerts/strategies while retaining signing control.

**30-second pitch**

Type a trading rule, review the parsed condition, optionally simulate its trigger, then approve the resulting Jupiter swap.

**Core workflow**

Market terminal → natural-language input → parsed rule preview → save to local agents → demo-trigger or live condition → transaction action → activity/Solscan link.

**Routes/surfaces and responsiveness**

Next.js routes include `/`, `/terminal`, `/agents`, `/activity`, `/prestocks`, `/launch`, and `/stocks/[symbol]`. Tailwind `sm`/`md`/`lg` breakpoints make grids and table columns collapse, but the information architecture remains a multi-tool trading terminal.

**Strongest product idea**

The product repeatedly separates rule creation from signing authority: the parser can propose; the wallet decides.

**Strongest UX idea**

A compact structured preview turns an opaque prompt into asset/action/amount/condition before the user confirms it.

**Technical pattern worth learning from**

Feature availability is surfaced directly: missing Pyth configuration leaves the UI up and explains what is unavailable rather than inventing quotes.

**What overlaps DrawRail**

Deterministic decision explanation, Pyth representation/reference framing, wallet approval, Jupiter execution, and explicit no-route errors.

**What DrawRail must NOT copy/build**

Natural-language policy parsing, AI, agents, autonomous monitoring, demo-trigger controls in the main action, PreStocks paper trading, DCA, or Meteora launch tooling.

**Implementation reality**

- **Verified in code:** Next.js routes; localStorage strategies/activity; optional local/Gemini parsing; demo trigger; Jupiter Ultra `/order`; wallet `sendTransaction`; an activity row is written as success immediately after submission.
- **Correctness gaps for DrawRail:** human-to-raw conversion uses `Math.floor(amount * 10 ** decimals)`; the xStock multiplier is not applied; the wallet broadcasts directly; no Jupiter `/execute` boundary or wallet-delta reconciliation is present.
- **Planned/mock:** PreStocks fills are paper-only; Meteora creation is documented rather than falsely executed.

**Decision: REJECT with one adapted disclosure pattern**

Reject the product and execution model. Adapt only the clear “service unavailable but app remains honest” state.

Evidence: `README.md`, `src/app/page.tsx`, `src/app/terminal/page.tsx`, `src/lib/jupiter.ts`, `src/lib/store.ts`.

### 6. Offhrs

**Problem**

Private-share tokens can trade around a stale/frozen reference mark after hours; the project wraps fee-bearing PreStocks for DBC use and streams agent proceeds.

**Target user**

Backers/traders of after-hours arbitrage agents and wrapped PreStock vault positions.

**30-second pitch**

When the reference market closes but the token keeps trading, agents trade the gap and stream resulting wrapped shares to holders.

**Core workflow**

Narrative landing → live “right now” evidence → dislocation board → explore agent → connect wallet → multi-leg trade/stake/claim flow → per-leg signatures and position evidence.

**Routes/surfaces and responsiveness**

Next.js separates the public site (`/`, `/explore`, agent pages, waitlist) from wallet-connected `/app` routes and operator surfaces. Tailwind layouts progressively stack, tables scroll, and primary actions become full-width on mobile. The separation of public narrative and connected product directly informs DrawRail's `/` and `/app` boundary.

**Strongest product idea**

The landing page states one memorable market fact, immediately proves it with live evidence, then explains mechanics.

**Strongest UX idea**

Multi-transaction routes are shown as named steps with active/done/failed states and individual signatures. Devnet mock assets use an `off` prefix and are explicitly called mocks.

**Technical pattern worth learning from**

Server-built transaction → browser `signTransaction` → signed bytes returned to server relay is a clean self-custody boundary. The app also distinguishes signing from sending and invalidates cached reads after confirmed writes.

**What overlaps DrawRail**

Server-built/client-signed/server-relayed boundary, Pyth reference/session concepts, evidence-first landing, devnet synthetic assets, and explicit transaction stages.

**What DrawRail must NOT copy/build**

Autonomous agents, PreStocks, wrappers, DBC pools, staking, streaming rewards, custom programs, or multi-leg portfolio actions.

**Implementation reality**

- **Verified in code:** Next.js 16 app; server actions; `signTransaction` then server relay for program writes; explicit signing/sending/done/error state; devnet faucet and mock naming; live/empty chain states; per-leg route UX.
- **Repository claim:** the whole loop is deployed on devnet; mainnet deployment is prepared but unfunded.
- **Correctness caution:** parts of trade display/conversion use JavaScript `number`, so the pattern is architectural/UX only, not amount-math authority.

**Decision: TAKE/REJECT split**

Take the signing boundary, per-stage status, live-proof landing structure, and honest synthetic-asset labeling. Reject the market thesis and protocol surface.

Evidence: `README.md`, `web/app/(site)/page.tsx`, `web/app/app/page.tsx`, `web/lib/use-write-tx.ts`, `web/components/app/agent-trade.tsx`, `web/components/app/devnet-faucet.tsx`, `web/lib/mock.ts`.

### 7. Wallie PreStocks

**Problem**

An automated agent should be able to buy discounted PreStocks without exceeding a fixed allowance or execution constraints.

**Target user**

An operator delegating a tightly bounded PreStocks buying budget to an agent.

**30-second pitch**

Pay for a premium report, detect a discount, pass the buy through allowance and fill-price policies, then execute or record exactly why it was blocked.

**Core workflow**

Static public board → recorded polling run → discount/premium alerts → deterministic buy checks → dry-run by default or explicitly armed mainnet execution → unified report/swap ledger.

**Routes/surfaces and responsiveness**

The frontend is one static `web/index.html` with `#board`, `#run`, and `#rails` anchors. Media queries stack statistics, policy rails, and run timeline while wide tables use horizontal scrolling. There is no connected-wallet transaction UI.

**Strongest product idea**

Every refusal is a product output, not an exception: the ledger explains which policy stopped the action.

**Strongest UX idea**

The recorded-run timeline visually connects source data, alert, policy result, quote, and ledger entry.

**Technical pattern worth learning from**

Closed mint admission, multiple independent execution checks, exact raw balance aggregation across token accounts, live quote failure as refusal, and dry-run-first command boundaries.

**What overlaps DrawRail**

Deterministic policy results, blocked-reason visibility, quote/fill constraints, Token-2022 multiplier awareness, and evidence ledger.

**What DrawRail must NOT copy/build**

Autonomous/local-key execution, x402, spending allowances, PreStocks, discount trading, session agents, old Jupiter v1 endpoints, or “armed” CLI mainnet trading.

**Implementation reality**

- **Verified in code:** policy functions; dry-run/live switch; key loader; exact bigint aggregate balance; parsed Scaled UI state; Jupiter v1 quote/swap; confirmed transaction; recorded static demo output.
- **Correctness gaps for DrawRail:** Scaled UI calculations and pay-token conversions cross into `number`; missing/malformed Scaled UI extension returns multiplier `1` instead of failing closed; no activation safety-window hard block; autonomous key ownership violates DrawRail's wallet boundary.
- **Planned/mock:** the public page renders a recorded run; the README's example is explicitly dry-run unless a dangerous flag and funded key are supplied.

**Decision: ADAPT**

Adapt reason-coded refusal and decision-ledger storytelling. Reject autonomy, PreStocks, and its conversion/error defaults.

Evidence: `README.md`, `web/index.html`, `web/prestocks.js`, `src/agent.ts`, `src/jupiter.ts`, `demo/run.ts`.

### 8. Samui Wallet

**Problem**

Solana builders need an open-source wallet/toolbox with strong localnet/devnet workflows and inspectable transactions.

**Target user**

Solana developers who want a self-custody wallet, network switching, token tools, and transaction details without leaving the wallet.

**30-second pitch**

An open-source Solana wallet for builders that makes local/devnet work first-class and shows high-detail transaction information in-wallet.

**Core workflow**

Onboard/unlock → portfolio tokens/activity → select send action → amount/destination → prepare and simulate → expected-change review → confirm → completion/explorer.

**Routes/surfaces and responsiveness**

React Router modules separate onboarding, portfolio token/activity tabs, send/burn/receive modals, explorer, settings, tools, and external dApp request approval. Shared responsive components support web and browser-extension windows; the product is optimized for compact wallet surfaces rather than a public marketing funnel.

**Strongest product idea**

Developer networks and transaction inspection are product features, not hidden debugging settings.

**Strongest UX idea**

The send confirmation displays expected per-address token changes from simulation, blocks confirmation while loading or when simulation fails, and replaces stale changes when the simulation becomes invalid.

**Technical pattern worth learning from**

Simulation result is a typed gate: loading, transport error, program failure, and success are distinct. Tests specifically assert that confirmation is disabled and stale change rows are hidden when the simulation cannot be trusted.

**What overlaps DrawRail**

Self-custody, sign-only wallet support, transaction preview, expected balance changes, confirmation gating, receipt/explorer, and localnet/devnet priority.

**What DrawRail must NOT copy/build**

A wallet, key vault, extension, generic transaction debugger, token/NFT toolkit, or generic instruction explorer as the core product.

**Implementation reality**

- **Verified in code/tests:** monorepo with web/extension/background/vault; Wallet Standard `signTransaction`; portfolio send simulation and expected-change rows; confirmation disabled on simulation failure; explorer-backed completion; broad automated tests.
- **Boundary:** the generic dApp `signTransaction` request UI itself is sparse; the richer preview exists in Samui's internal portfolio-send flow. DrawRail must render its own reviewed decision before invoking any external wallet.
- **Public evidence:** Colosseum named Samui the 2025 Cypherpunk Public Good Award winner for an open-source ecosystem benefit.

**Decision: TAKE**

Take simulation-gated expected changes and precise status modeling. Do not expand into wallet infrastructure.

Evidence: `README.md`, `apps/site/src/content/docs/index.mdx`, `apps/site/src/content/docs/cypherpunk.mdx`, `packages/feature-portfolio/src/ui/portfolio-ui-send-confirm.tsx`, `packages/feature-portfolio/src/ui/portfolio-ui-send-confirm-changes.tsx`, `packages/feature-portfolio/test/portfolio-ui-send-confirm.test.tsx`, `packages/feature-request/src/ui/request-ui-sign-transaction.tsx`.

## Non-Solana product patterns

These are conceptual references only. DrawRail will not import their chain model, protocols, or infrastructure.

### CoW Protocol — intent plus enforceable constraints

Current CoW documentation describes an intent as a signed message specifying assets and amounts. The signed order carries a sell amount, minimum buy amount/limit, receiver, validity, fill mode, and other constraints; solvers compete to execute within them.

**Adapt:** separate what the user intends from how a route executes it. DrawRail's reviewed decision should bind the USDC target context, selected mint, exact raw input, reviewed minimum output, expiry, wallet, and policy results before signing.

**Reject:** batch auctions, off-chain solver competition, delegated fill semantics, partial fills, EVM approvals, and a custom intent protocol.

Source: [CoW Protocol intents](https://cowswap.mintlify.app/cow-protocol/explanation/introduction/intents), [CoW order API integration](https://cowswap.mintlify.app/cow-protocol/howto/integrate/api).

### Enso — intent to signer-ready transaction

Enso route requests describe a desired position change using sender/receiver, token in/out, amount, route strategy, and slippage. The API returns route data containing a transaction for the user's signer. The route can hide several protocol steps while the requested outcome remains legible.

**Adapt:** the product should first explain “raise 60 more USDC while preserving these floors,” then expose the one signer-ready Jupiter action that satisfies it. Execution mechanics belong under Inspect.

**Reject:** cross-protocol zaps, multi-chain routing, vault migrations, arbitrary intent graphs, and hidden multi-step portfolio management.

Source: [Enso position migration](https://docs.enso.build/pages/use-cases/deposits/position-migration), [Enso position rebalancing](https://docs.enso.build/pages/use-cases/strategies/position-rebalancing).

### Rabby and Tenderly — preview consequences before consent

Rabby's open-source wallet positions transaction simulation and security analysis before signing. Tenderly documents simulation results containing success/failure, asset and balance changes, state changes, logs, and human-readable errors.

**Adapt:** lead with consequences rather than instructions: xStock displayed reduction, expected/minimum USDC received, retained exposure, rejected alternatives, destination wallet, and policy checks. Keep raw amount, message hash, router, fee fields, mint addresses, and program details under Inspect.

**Reject:** a generic transaction firewall, universal risk engine, or EVM-style simulation service dependency. Solana simulation can supplement the DrawRail decision but cannot replace Jupiter terms or post-settlement RPC deltas.

Sources: [Rabby open-source wallet](https://github.com/RabbyHub/Rabby), [Tenderly Transaction Preview](https://docs.tenderly.co/simulations/transaction-preview).

### Traditional portfolio withdrawals — cash amount first

Betterment's public withdrawal flow asks the user to choose an account and cash amount; available operational cash is generally used before securities are sold, and the platform determines trades in light of the portfolio allocation. It also exposes processing status and a pre-confirmation impact preview.

**Adapt:** ask for USDC, count USDC first, then make the reduction decision from the remaining portfolio. Show the resulting portfolio before confirmation.

**Reject:** bank transfer, delayed market-hours processing, tax-lot optimization, tax preview, automated advisory, target-allocation rebalancing, and custody.

Sources: [Betterment withdrawal flow](https://www.betterment.com/help/withdraw-funds), [Betterment investing transactions](https://www.betterment.com/help/investing-transactions).

## Open-source Solana hackathon presentation patterns

### Samui Wallet

Colosseum awarded Samui the Cypherpunk Public Good Award, explicitly recognizing an open-source project that benefits Solana developers. The implementation supports that story with a real monorepo, functioning wallet surfaces, tests, a hosted app, and a documentation page that puts demo and pitch side by side.

Presentation lessons:

- one audience and one category are obvious immediately: an open-source wallet/toolbox for builders;
- the repository contains the working product, not only a landing-page facsimile;
- Solana is essential through Wallet Standard, local/devnet workflows, token tooling, transaction simulation, and explorer integration;
- demo and pitch are separate artifacts; and
- proof comes from working screens, source, tests, and a transaction path rather than a bounty-logo list.

### Unruggable

Colosseum named Unruggable the 2025 Cypherpunk Grand Champion and summarized it in one sentence: a hardware wallet and companion app built for Solana. Public source exists for the Rust/Dioxus app; Colosseum later reported that the firmware and app are public, keys stay offline/encrypted, the device does not connect directly to the internet, and the companion app is sandboxed. By 2026 the product had pre-orders and shipped its initial run, moving beyond a demo.

Presentation lessons:

- the problem, product, and Solana specificity fit in one sentence;
- the physical/software proof makes the claim tangible;
- a real security boundary is the center of the story, not a feature card;
- open source, cross-platform builds, partners, pre-orders, and shipments make it feel like a company/product; and
- the landing page can stay minimal because product evidence exists elsewhere.

Sources: [Cypherpunk winners](https://blog.colosseum.com/announcing-the-winners-of-the-solana-cypherpunk-hackathon/), [Colosseum Unruggable update](https://blog.colosseum.com/unruggable-hardware-wallet-wormhole-sunrise-umbra-sdk/), [Unruggable app source](https://github.com/hogyzen12/unruggable-app), [Solana wallet directory](https://solana.com/wallets).

### Official winner writeups

Official Solana/Colosseum winner posts consistently compress each winner into a plain problem/product sentence and then link to working proof. Historical judging criteria explicitly include functionality, potential impact, novelty, design/UX, and composability. Recent winner pages foreground the live pitch/demo rather than lengthy architecture prose.

For DrawRail, this means the judge-facing story should prove, in order:

1. a recognizable need: “I need 80 USDC”;
2. a visible constraint: “keep at least 600 dollars of NVDA exposure”;
3. a non-obvious Solana correctness issue: the xStock multiplier and activation window;
4. a working decision: NVDAx rejected, another eligible position selected for a stated reason;
5. a real self-custodial Jupiter action; and
6. chain evidence showing what the wallet actually lost and received.

Sources: [Cypherpunk winners](https://blog.colosseum.com/announcing-the-winners-of-the-solana-cypherpunk-hackathon/), [Radar winners](https://solana.com/news/solana-radar-winners), [Solana Season judging criteria](https://solana.com/news/announcing-winners-of-the-solana-season-hackathon).

## Patterns selected for DrawRail

### TAKE

1. **Cash need as the first input** — traditional withdrawal products and xSpend.
2. **One live example above the fold** — Multiplier and Offhrs make the problem visible before explaining mechanics.
3. **Reason-coded selection and rejection** — Wallie and Henar turn refusal into a useful output.
4. **Simulation/expected-change gate** — Samui and Tenderly preview consequences and block confirmation on invalid simulation.
5. **Explicit network/provenance states** — xSpend, Rambu, and Offhrs clearly label sandbox/devnet/mainnet and mock/live boundaries.
6. **Sign-only browser boundary with server relay** — Offhrs's shape aligns with DrawRail's JupiterZ requirement, with DrawRail additionally binding canonical message bytes and `requestId`.
7. **Pending/confirmed/unknown receipt lifecycle** — xSpend and Samui avoid treating submission as settlement.

### ADAPT

1. Henar's rich comparison becomes one decision card plus rejected alternatives, not a terminal.
2. Multiplier's raw-versus-economic explanation becomes an Inspect disclosure, not the main task.
3. Wallie's ledger becomes a compact policy receipt without autonomous execution.
4. CoW's signed constraints become DrawRail's reviewed decision binding, without solver infrastructure.
5. Enso's intent-to-transaction separation becomes “liquidity request → one reviewed Jupiter transaction.”

### REJECT

1. Merchant QR, checkout, rewards, and StockBack.
2. AI/NL strategies, agents, autonomous keys, DCA, baskets, or recurring execution.
3. Cross-issuer routing, broad market terminals, and portfolio analytics dashboards.
4. Custom protocols, lending/oracle products, wrappers, vaults, and solver/batch-auction infrastructure.
5. Mock/live blending, prerecorded success, fake signatures, silent API fallbacks, and success before wallet-delta reconciliation.
6. JavaScript-number token authority or `displayed * 10^decimals` shortcuts.
7. Technical chrome dominating the review: raw addresses and program details belong behind Inspect.

## Final product implication

The most important competitive discovery is not a direct competitor. It is a presentation gap: several projects possess strong primitives but ask the user to think like a trader, protocol operator, merchant, or agent operator. DrawRail should feel like a withdrawal product with a policy explanation—not a swap terminal with extra warnings.

The locked differentiation remains:

> cash need first → portfolio policy second → execution third.

The decision screen, not the swap widget, is the core product surface.
