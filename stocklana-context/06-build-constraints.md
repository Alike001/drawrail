# Build constraints and caveats

## Hackathon constraints

- One submission per team.
- Original work required.
- Open-source components are allowed when disclosed.
- A public demo, repository or video is needed for submission.
- Main judging rewards a real app and end-to-end execution, not a slide-only concept.

## PreStocks

- For the PreStocks bounty, do not integrate competing/non-PreStocks pre-IPO tokens.
- Their public API currently provides eight products and useful mark/market fields.
- Their own site says the tokens do not grant ownership, voting or dividend rights.

## Tessera

- The bounty wording specifically calls for OpenAI or Kalshi T-Tokens.
- Public API data is available without authentication at the token-details endpoint.
- Legal/economic wording should follow Tessera's actual T-Token structure.

## Clawpump

- Stocklana bounty hard requirement: launch a token with a stock-paired liquidity pool using Clawpump and Meteora.
- Current API uses `cpk_` bearer keys for partner access.
- Keep keys server-side.
- Agent chat turns can invoke tools and create onchain side effects. Use narrow skills/permissions.
- Current docs say `/portfolio` is non-functional. Do not make it a dependency.

## Meteora

- Current DBC package: `@meteora-ag/dynamic-bonding-curve-sdk`.
- DBC config determines curve, fee behavior, quote token and migration policy.
- New configs should target DAMM v2 rather than deprecated DAMM v1 paths.
- The bounty explicitly prefers working mainnet code.
- Stock quote mints may require Token Badge handling in the current SDK/program flow.

## Pyth

- Pyth Pro's streaming SDK uses an access token.
- If Pyth is entered as a bounty, live data should control a real product behavior, such as risk checks, execution, valuation, collateral health or market state.
- Treat feed freshness and availability as part of the design, not only the happy path.

## Security/product constraints

- Never put sponsor/API keys in client bundles or Git.
- If an agent can move value, include explicit limits and pause/revoke controls.
- Separate reference price from executable price. A stock can have a “fair/reference” value while the onchain pool has insufficient depth to execute near that value.
- Keep token identity by mint address, not ticker alone.
- Avoid floating-point arithmetic for critical onchain quantities.
