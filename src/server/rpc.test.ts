import { afterEach, describe, expect, it, vi } from "vitest";
import { ASSET_REGISTRY } from "@/domain/assets";
import { readAggregatedBalance, readAndVerifyMint, SolanaRpcClient } from "./rpc";

const wallet = "11111111111111111111111111111111";

function rpcFetch(result: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ jsonrpc: "2.0", result, id: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

function tokenAccount(address: string, amount: string) {
  return {
    pubkey: address,
    account: {
      owner: ASSET_REGISTRY.AAPLx.expectedProgram,
      data: { parsed: { type: "account", info: {
        mint: ASSET_REGISTRY.AAPLx.mint,
        owner: wallet,
        tokenAmount: { amount, decimals: 8 },
      } } },
    },
  };
}

function mintResult(
  extensions: unknown,
  owner: string = ASSET_REGISTRY.AAPLx.expectedProgram,
  decimals = 8,
) {
  return { context: { slot: 10 }, value: {
    owner,
    executable: false,
    data: { program: "spl-token-2022", parsed: { type: "mint", info: { decimals, extensions } } },
  } };
}

afterEach(() => vi.restoreAllMocks());

describe("owner balance aggregation", () => {
  it("aggregates multiple token accounts for one mint", async () => {
    rpcFetch({ context: { slot: 10 }, value: [tokenAccount("a", "7"), tokenAccount("b", "11")] });
    const result = await readAggregatedBalance(
      new SolanaRpcClient("https://rpc.test"), wallet, ASSET_REGISTRY.AAPLx,
    );
    expect(result.raw).toBe(18n);
    expect(result.tokenAccountCount).toBe(2);
  });

  it("returns a zero balance when no token accounts exist", async () => {
    rpcFetch({ context: { slot: 10 }, value: [] });
    const result = await readAggregatedBalance(
      new SolanaRpcClient("https://rpc.test"), wallet, ASSET_REGISTRY.AAPLx,
    );
    expect(result.raw).toBe(0n);
    expect(result.tokenAccountCount).toBe(0);
  });

  it("surfaces RPC failures without substituting fixture data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      jsonrpc: "2.0", id: 1, error: { code: -32005, message: "rate limited" },
    }), { status: 200 }));
    await expect(readAggregatedBalance(
      new SolanaRpcClient("https://rpc.test"), wallet, ASSET_REGISTRY.AAPLx,
    )).rejects.toThrow("rate limited");
  });
});

describe("closed registry mint validation", () => {
  const scaledExtension = [{ extension: "scaledUiAmountConfig", state: {
    multiplier: "1.1",
    newMultiplier: "1.2",
    newMultiplierEffectiveTimestamp: 2_000,
  } }];

  it("parses complete Scaled UI state", async () => {
    rpcFetch(mintResult(scaledExtension));
    const mint = await readAndVerifyMint(
      new SolanaRpcClient("https://rpc.test"), ASSET_REGISTRY.AAPLx,
    );
    expect(mint.scaledUi).toEqual({
      oldMultiplier: "1.1", newMultiplier: "1.2", activationTimestamp: 2_000n,
    });
  });

  it("fails closed on program or decimal mismatch", async () => {
    rpcFetch(mintResult(scaledExtension, ASSET_REGISTRY.USDC.expectedProgram));
    await expect(readAndVerifyMint(
      new SolanaRpcClient("https://rpc.test"), ASSET_REGISTRY.AAPLx,
    )).rejects.toThrow("program mismatch");

    vi.restoreAllMocks();
    rpcFetch(mintResult(scaledExtension, ASSET_REGISTRY.AAPLx.expectedProgram, 6));
    await expect(readAndVerifyMint(
      new SolanaRpcClient("https://rpc.test"), ASSET_REGISTRY.AAPLx,
    )).rejects.toThrow("decimals mismatch");
  });

  it("fails closed on missing or malformed Scaled UI state", async () => {
    rpcFetch(mintResult([]));
    await expect(readAndVerifyMint(
      new SolanaRpcClient("https://rpc.test"), ASSET_REGISTRY.AAPLx,
    )).rejects.toThrow("missing Scaled UI Amount");

    vi.restoreAllMocks();
    rpcFetch(mintResult([{ extension: "scaledUiAmountConfig", state: { multiplier: "bad" } }]));
    await expect(readAndVerifyMint(
      new SolanaRpcClient("https://rpc.test"), ASSET_REGISTRY.AAPLx,
    )).rejects.toThrow();
  });
});
