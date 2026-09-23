import { afterEach, describe, expect, it, vi } from "vitest";
import { ASSET_REGISTRY } from "@/domain/assets";
import { basisPoints, rawTokenAmount } from "@/domain/types";
import { JupiterClient, parseJupiterQuote, quoteRetainedPosition } from "./jupiter";

const fixture = {
  inAmount: "1000000",
  outAmount: "3376324",
  otherAmountThreshold: "3376324",
  slippageBps: 0,
  priceImpact: -0.1209,
  router: "jupiterz",
  mode: "manual",
  swapMode: "ExactIn",
  feeBps: 10,
  feeMint: ASSET_REGISTRY.USDC.mint,
  platformFee: { feeBps: 10, feeMint: ASSET_REGISTRY.USDC.mint },
  expireAt: null,
  requestId: "request-1",
  transaction: null,
};

afterEach(() => vi.restoreAllMocks());

describe("Jupiter quote parsing", () => {
  it("retains fee, routing, mode, expiry and request fields", () => {
    expect(parseJupiterQuote(fixture)).toMatchObject({
      inAmount: "1000000",
      outAmount: "3376324",
      otherAmountThreshold: "3376324",
      slippageBps: "0",
      priceImpact: "-0.1209",
      router: "jupiterz",
      mode: "manual",
      feeBps: "10",
      feeMint: ASSET_REGISTRY.USDC.mint,
      platformFee: { feeBps: "10", feeMint: ASSET_REGISTRY.USDC.mint },
      expireAt: null,
      requestId: "request-1",
    });
  });

  it("preserves absent fee fields as null rather than zero", () => {
    const withoutFees: Record<string, unknown> = { ...fixture };
    delete withoutFees.feeBps;
    delete withoutFees.feeMint;
    delete withoutFees.platformFee;
    expect(parseJupiterQuote(withoutFees)).toMatchObject({
      feeBps: null, feeMint: null, platformFee: null,
    });
  });
});

describe("quote-only and retained-position behavior", () => {
  it("calculates and quotes the exact retained raw balance", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ...fixture, inAmount: "7500000",
    }), { status: 200 }));
    const result = await quoteRetainedPosition(
      new JupiterClient("https://api.test/swap/v2"),
      ASSET_REGISTRY.AAPLx.mint,
      ASSET_REGISTRY.USDC.mint,
      rawTokenAmount(10_000_000n),
      rawTokenAmount(2_500_000n),
      basisPoints(50n),
    );
    expect(result.retainedRaw).toBe("7500000");
    expect(result.quote?.inAmount).toBe("7500000");
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("amount=7500000");
  });

  it("does not quote a zero retained position", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await quoteRetainedPosition(
      new JupiterClient("https://api.test/swap/v2"),
      ASSET_REGISTRY.AAPLx.mint,
      ASSET_REGISTRY.USDC.mint,
      rawTokenAmount(10n),
      rawTokenAmount(10n),
    );
    expect(result.quote).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("fails on API errors and missing routes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("No routes found", { status: 404 }),
    );
    await expect(new JupiterClient("https://api.test/swap/v2").quote(
      ASSET_REGISTRY.AAPLx.mint,
      ASSET_REGISTRY.USDC.mint,
      rawTokenAmount(1n),
      basisPoints(50n),
    )).rejects.toThrow("No routes found");
  });
});
