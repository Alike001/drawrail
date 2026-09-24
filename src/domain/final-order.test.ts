import { describe, expect, it } from "vitest";
import { ASSET_REGISTRY } from "./assets";
import { FinalOrderValidationError, validateFinalOrderEconomics } from "./final-order";
import { basisPoints, rawTokenAmount, usdcRawAmount } from "./types";
import type { JupiterFinalOrder } from "@/server/jupiter";

const order = (overrides: Partial<JupiterFinalOrder> = {}): JupiterFinalOrder => ({
  inputMint: ASSET_REGISTRY.AAPLx.mint,
  outputMint: ASSET_REGISTRY.USDC.mint,
  inAmount: "1000000",
  outAmount: "60410000",
  otherAmountThreshold: "60020000",
  slippageBps: "50",
  priceImpact: "0.1",
  router: "metis",
  mode: "manual",
  swapMode: "ExactIn",
  feeBps: "10",
  feeMint: ASSET_REGISTRY.USDC.mint,
  platformFee: { feeBps: "10", feeMint: ASSET_REGISTRY.USDC.mint },
  expireAt: null,
  requestId: "request-1",
  transaction: "AQID",
  ...overrides,
});

const expected = {
  inputMint: ASSET_REGISTRY.AAPLx.mint,
  outputMint: ASSET_REGISTRY.USDC.mint,
  rawInput: rawTokenAmount(1_000_000n),
  missingUsdc: usdcRawAmount(60_000_000n),
  maxSlippageBps: basisPoints(50n),
  retainedExecutableValue: usdcRawAmount(420_000_000n),
  retainedFloor: usdcRawAmount(400_000_000n),
};

describe("final wallet-bound order economics", () => {
  it("accepts changed route economics when every policy invariant still passes", () => {
    expect(validateFinalOrderEconomics(order({ outAmount: "60300000", router: "jupiterz" }), expected)).toHaveLength(6);
  });

  it.each([
    [{ inputMint: ASSET_REGISTRY.TSLAx.mint }, "transaction_invalid"],
    [{ outputMint: ASSET_REGISTRY.TSLAx.mint }, "transaction_invalid"],
    [{ inAmount: "1000001" }, "policy_changed"],
    [{ otherAmountThreshold: "59999999" }, "refresh_required"],
    [{ slippageBps: "51" }, "policy_changed"],
  ] as const)("rejects invalid final order field %#", (override, code) => {
    try {
      validateFinalOrderEconomics(order(override), expected);
      throw new Error("expected validation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(FinalOrderValidationError);
      expect((error as FinalOrderValidationError).code).toBe(code);
    }
  });

  it("rejects a changed retained-floor result", () => {
    expect(() => validateFinalOrderEconomics(order(), {
      ...expected,
      retainedExecutableValue: usdcRawAmount(399_999_999n),
    })).toThrow("retained floor");
  });
});
