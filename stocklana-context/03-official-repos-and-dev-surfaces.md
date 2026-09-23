# Official repos and developer surfaces

## Important finding: there is no single Stocklana protocol repo

Stocklana is a Solana Foundation hackathon. The implementation surfaces come from Solana and the individual sponsors.

## Meteora

Verified public GitHub organization: `MeteoraAg`

Most relevant repositories:

- `MeteoraAg/dynamic-bonding-curve-sdk`
  - TypeScript SDK.
  - Package: `@meteora-ag/dynamic-bonding-curve-sdk`.
  - Pool/config builders, state reads, quotes, migration helpers and tests.
- `MeteoraAg/dynamic-bonding-curve`
  - Anchor/Rust onchain program source and tests.
- `MeteoraAg/meteora-invent`
  - Operational tooling and agent-friendly references.
- `MeteoraAg/docs`
  - Current program-account/instruction documentation.

Key DBC mental model:

1. create a reusable configuration containing curve, fee and migration policy;
2. create a virtual pool using that config;
3. users trade along the curve;
4. quote reserves accumulate;
5. once the configured threshold is met, the market migrates/graduates to DAMM v2.

Current docs say new configurations should use DAMM v2 and note stock-token quote pairs in mainnet migration-keeper logic.

## Clawpump

Verified public GitHub organization: `Clawpump`

Relevant repositories:

- `Clawpump/ClawpumpSDK`
  - Official TypeScript SDK.
  - Agent creation/lifecycle, chat, market intelligence, automations and unsigned swap execution.
- `Clawpump/agents-skills`
  - Open skill registry where each skill is a `SKILL.md` plus metadata.
- `Clawpump/claw-agent`
  - Public agent codebase.

Developer API base URL: `https://clawpump.tech/api/v1`.

Important API notes from current docs:

- authenticated partner calls use a `cpk_` bearer key;
- custom Pump.fun quote pairs are discoverable through `/pump-pairs`;
- launch requests can specify a supported quote mint;
- agents can have tools with side effects, so skill scope and safety controls matter;
- the public docs warn that `/portfolio` is currently non-functional and should not be integrated.

## Pyth Network

Verified public GitHub organization: `pyth-network`

Relevant repositories:

- `pyth-network/pyth-lazer-public` — Pyth Pro SDKs/contracts/tools.
- `pyth-network/pyth-crosschain` — Pyth protocol monorepo and target-chain integrations.
- `pyth-network/pyth-sdk-rs` — Rust SDK with Solana support.
- `pyth-network/pyth-examples` — examples.

For Pyth Pro, the current getting-started flow uses `@pythnetwork/pyth-lazer-sdk` and a token for streaming updates.

## PreStocks

No verified official public GitHub organization found in this pass.

Developer/product surfaces:

- Product API: `https://prestocks.com/api/prestocks`
- Products: `https://prestocks.com/products`

The API is unusually hackathon-friendly because it returns product identity, mint address, mark price, token price, valuation and supply without requiring a private API key.

Do not misrepresent the asset structure. PreStocks states that its products provide economic exposure and do not confer ownership, voting, dividend, information or other legal rights.

## Tessera

No verified official public GitHub organization found in this pass.

Developer/product surfaces:

- Docs: `https://docs.tessera.pe`
- Public token details: `https://rest-api.tessera.pe/v1/public/token-details`

The endpoint currently returns T-OpenAI, T-Kalshi and T-SpaceX with mint, mark price, holder count and mark valuation.

Tessera documentation describes T-Tokens as loan participation rights under its structure. Avoid calling them direct company shares unless the terms support that claim.
