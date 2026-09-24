import { afterEach, describe, expect, it, vi } from "vitest";
import { reconcileSettlement } from "./settlement";

afterEach(() => vi.restoreAllMocks());
const jupiter = { status: "Success", signature: "sig", slot: "4", code: "0", inputAmountResult: "100", outputAmountResult: "61", totalInputAmount: "100", totalOutputAmount: "61" };
const base = { rpcUrl: "https://rpc.test", signature: "sig", wallet: "w", inputMint: "x", outputMint: "u", reviewedRawInput: "100", reviewedMinimumOutput: "60", feeMint: "u" };

function rpc(value: unknown) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: value }), { status: 200 }));
}

describe("RPC settlement reconciliation", () => {
  it("confirms owner token deltas, including a newly created output account", async () => {
    rpc({ slot: 99, blockTime: 10, meta: { err: null, preTokenBalances: [{ mint: "x", owner: "w", uiTokenAmount: { amount: "150" } }], postTokenBalances: [{ mint: "x", owner: "w", uiTokenAmount: { amount: "50" } }, { mint: "u", owner: "w", uiTokenAmount: { amount: "61" } }] } });
    await expect(reconcileSettlement({ ...base, jupiter }))
      .resolves.toMatchObject({ status: "confirmed", inputDebit: "100", usdcCredit: "61", slot: "99" });
  });

  it("classifies below-minimum or accounting differences for investigation", async () => {
    rpc({ slot: 99, meta: { err: null, preTokenBalances: [{ mint: "x", owner: "w", uiTokenAmount: { amount: "150" } }], postTokenBalances: [{ mint: "x", owner: "w", uiTokenAmount: { amount: "49" } }, { mint: "u", owner: "w", uiTokenAmount: { amount: "59" } }] } });
    const result = await reconcileSettlement({ ...base, jupiter });
    expect(result.status).toBe("confirmed_needs_investigation");
    expect(result.discrepancies).toContain("OUTPUT_BELOW_REVIEWED_MINIMUM");
  });

  it("distinguishes confirmed failure from unknown", async () => {
    rpc({ slot: 99, meta: { err: { InstructionError: [1, "Custom"] } } });
    await expect(reconcileSettlement({ ...base, jupiter })).resolves.toMatchObject({ status: "failed" });
    vi.restoreAllMocks(); rpc(null);
    await expect(reconcileSettlement({ ...base, jupiter })).resolves.toMatchObject({ status: "unknown" });
  });

  it("reconciles the funded Metis response using route output before fee and wallet output after fee", async () => {
    rpc({
      slot: 450156253,
      blockTime: 1790286882,
      meta: {
        err: null,
        preTokenBalances: [
          { mint: "x", owner: "w", uiTokenAmount: { amount: "307981" } },
          { mint: "u", owner: "w", uiTokenAmount: { amount: "0" } },
        ],
        postTokenBalances: [
          { mint: "x", owner: "w", uiTokenAmount: { amount: "158546" } },
          { mint: "u", owner: "w", uiTokenAmount: { amount: "502515" } },
        ],
      },
    });
    const captured = {
      status: "Success", signature: "4fk7…M2uN", slot: "450156253", code: "0",
      inputAmountResult: "149435", outputAmountResult: "503018",
      totalInputAmount: "149435", totalOutputAmount: "502515",
    };
    const result = await reconcileSettlement({
      ...base,
      reviewedRawInput: "149435",
      reviewedMinimumOutput: "500002",
      feeMint: "u",
      jupiter: captured,
    });
    expect(result).toMatchObject({
      status: "confirmed",
      slot: "450156253",
      inputDebit: "149435",
      usdcCredit: "502515",
      jupiterFeeAmount: "503",
      discrepancies: [],
    });
  });

  it("keeps impossible Jupiter fee accounting in the investigation state", async () => {
    rpc({ slot: 99, meta: { err: null, preTokenBalances: [{ mint: "x", owner: "w", uiTokenAmount: { amount: "150" } }], postTokenBalances: [{ mint: "x", owner: "w", uiTokenAmount: { amount: "50" } }, { mint: "u", owner: "w", uiTokenAmount: { amount: "61" } }] } });
    const result = await reconcileSettlement({
      ...base,
      jupiter: { ...jupiter, outputAmountResult: "60", totalOutputAmount: "61" },
    });
    expect(result.status).toBe("confirmed_needs_investigation");
    expect(result.discrepancies).toContain("JUPITER_FEE_ACCOUNTING_MISMATCH");
  });
});
