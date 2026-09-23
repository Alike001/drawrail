# Competition map from public Stocklana GitHub activity

This is not a complete list of submissions. It is a pattern scan of public repositories discoverable by Stocklana/sponsor keywords as of 2026-09-23.

## Already crowded or clearly represented

### Basic analytics / premium-discount dashboards

Examples found:

- `Alex20Sas12/prestocks-terminal`
- `arisparrondobarrios-debug/prestocks-lens`
- `manuelfeb056-max/prestocks-radar`
- `kepler-ops-maker/prestocks-risk-brief`

Pattern: fetch PreStocks API, compare token price against mark price, rank dislocations, render charts/briefs.

Conclusion: a dashboard that only visualizes PreStocks data is unlikely to be differentiated enough.

### DCA / recurring investment

Example found:

- `krzysztofpazdyk/prestocks-dca-noir`

Conclusion: “weekly DCA into pre-IPO tokens” is already represented.

### Lending against pre-IPO stocks

Example found:

- `emmyCode4495/PreLendd`

Pattern: deposit PreStock collateral, borrow USDC, LTV/liquidation logic.

Conclusion: generic “Aave for PreStocks” is already represented.

### Baskets / indexes

Example found:

- `MallorcaBCDays/stocklana-baskets`

Pattern: weighted constituents, basket shares and allocation engine.

Conclusion: a simple index/basket builder is already represented.

### Yield-bearing stock vaults

Example found:

- `Bsh54/stax`

Pattern: deposit xStocks, use them as Kamino collateral, borrow stablecoins and deploy the stablecoins for yield.

Conclusion: “make idle tokenized stocks earn yield” is already represented.

### Robo portfolio / AI portfolio safety

Example found:

- `dren712/sentinel_finance`

Pattern: AI proposes trades, onchain policies enforce post-trade portfolio constraints; combines PreStocks, Meteora and Pyth concepts.

Conclusion: a generic AI stock portfolio manager or simple risk guard is already represented.

### Dividend/corporate-cashflow transformation

Example found:

- `notorious-d-e-v/dividendx-stocklana`

Pattern: splits stock/economic rights into instruments and builds extensive annual/dividend lifecycle tooling.

Conclusion: “tokenize dividends separately” is already represented and technically deep.

### Meteora DBC issuer tooling

Examples found:

- `startupcompliancekit/dbc-issuer-check`
- `AutoClawGPT/equitycurve-studio`
- `manuelfeb056-max/equitycurve`
- `sidsri14/equitycurve`

Pattern: configure/validate/monitor equity-oriented DBC pools.

Conclusion: a basic DBC configuration dashboard is already crowded.

### Stock-aware DBC price discovery

Example found:

- `ExpertVagabond/stockcurve`

This is a particularly strong public reference. It reports multiple mainnet DBC lifecycles, stock-token quote assets, Pyth/reference-price anchoring, anti-sniper fee logic, pre-IPO curves and keeper automation.

Conclusion: a shallow “stock DBC” clone would be hard to distinguish.

### Clawpump + Meteora agent launch studio

Example found:

- `AutoClawGPT/equitycurve-studio`

Pattern: agent token plus DBC tooling and monitoring.

Conclusion: the Clawpump bounty needs a stronger product story than merely launching an agent token against a stock pair.

## What this means for our idea search

Avoid choosing a concept because the sponsor lists it as an example. Many builders have already followed those prompts literally.

The next opportunity search should focus on a specific workflow failure that remains unsolved after tokenization, then ask which sponsor primitive makes the solution possible.
