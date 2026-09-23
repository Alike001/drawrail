# Pyth repo notes

Official GitHub org: https://github.com/pyth-network

Relevant repositories:
- `pyth-network/pyth-lazer-public`
- `pyth-network/pyth-crosschain`
- `pyth-network/pyth-sdk-rs`
- `pyth-network/pyth-examples`

Pyth Pro's current TypeScript examples use `@pythnetwork/pyth-lazer-sdk` and WebSocket subscriptions. Production integrations should inspect update timestamps so stale/carried-forward values are not silently treated as fresh.
