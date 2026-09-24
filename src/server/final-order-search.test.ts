import { describe, expect, it, vi } from "vitest";
import { basisPoints, rawTokenAmount, usdcRawAmount } from "@/domain/types";
import type { JupiterFinalOrder } from "./jupiter";
import { findCoveringFinalOrder } from "./final-order-search";

function order(raw: bigint, minimum: bigint): JupiterFinalOrder {
  return {
    inputMint: "input", outputMint: "output", inAmount: raw.toString(), outAmount: (minimum + 2_500n).toString(),
    otherAmountThreshold: minimum.toString(), slippageBps: "50", priceImpact: "0.01", router: "metis",
    mode: "manual", swapMode: "ExactIn", feeBps: "10", feeMint: "output", platformFee: { feeBps: "10" },
    expireAt: null, lastValidBlockHeight: "1000", requestId: `request-${raw}`, transaction: "AQID",
  };
}

describe("wallet-bound final-order sizing", () => {
  it("increases raw input until the final minimum—not expected output—covers the request", async () => {
    const finalOrder = vi.fn(async (_in: string, _out: string, raw: bigint) => {
      const minimum = raw === 148_477n ? 497_138n : 500_020n;
      return order(raw, minimum);
    });
    const result = await findCoveringFinalOrder({
      provider: { finalOrder }, inputMint: "input", outputMint: "output",
      initialRawInput: rawTokenAmount(148_477n), maximumRawInput: rawTokenAmount(307_981n),
      requiredMinimumOutput: usdcRawAmount(500_000n), slippageBps: basisPoints(50n), taker: "wallet",
    });
    expect(result.attempts).toBe(2);
    expect(result.rawInput).toBeGreaterThan(148_477n);
    expect(result.order.otherAmountThreshold).toBe("500020");
    expect(finalOrder).toHaveBeenCalledTimes(2);
  });

  it("returns the first exact order when it already covers the minimum", async () => {
    const finalOrder = vi.fn(async (_in: string, _out: string, raw: bigint) => order(raw, 500_000n));
    const result = await findCoveringFinalOrder({
      provider: { finalOrder }, inputMint: "input", outputMint: "output",
      initialRawInput: rawTokenAmount(150_000n), maximumRawInput: rawTokenAmount(300_000n),
      requiredMinimumOutput: usdcRawAmount(500_000n), slippageBps: basisPoints(50n), taker: "wallet",
    });
    expect(result.attempts).toBe(1);
  });

  it("fails closed when the bounded balance cannot cover the final minimum", async () => {
    const finalOrder = vi.fn(async (_in: string, _out: string, raw: bigint) => order(raw, 499_000n));
    await expect(findCoveringFinalOrder({
      provider: { finalOrder }, inputMint: "input", outputMint: "output",
      initialRawInput: rawTokenAmount(299_000n), maximumRawInput: rawTokenAmount(300_000n),
      requiredMinimumOutput: usdcRawAmount(500_000n), slippageBps: basisPoints(50n), taker: "wallet", maxAttempts: 2,
    })).rejects.toThrow("bounded search");
  });
});
