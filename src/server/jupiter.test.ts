import { afterEach, describe, expect, it, vi } from "vitest";
import { ASSET_REGISTRY } from "@/domain/assets";
import { basisPoints, rawTokenAmount } from "@/domain/types";
import { JupiterClient, parseJupiterFinalOrder, parseJupiterQuote, quoteRetainedPosition } from "./jupiter";

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
  it("builds a taker-bound final order without receiver or referral overrides", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ...fixture,
      inputMint: ASSET_REGISTRY.AAPLx.mint,
      outputMint: ASSET_REGISTRY.USDC.mint,
      transaction: "AQID",
    }), { status: 200 }));
    const result = await new JupiterClient("https://api.test/swap/v2").finalOrder(
      ASSET_REGISTRY.AAPLx.mint,
      ASSET_REGISTRY.USDC.mint,
      rawTokenAmount(1_000_000n),
      basisPoints(50n),
      "11111111111111111111111111111111",
    );
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get("taker")).toBe("11111111111111111111111111111111");
    expect(url.searchParams.has("receiver")).toBe(false);
    expect(url.searchParams.has("referralAccount")).toBe(false);
    expect(result.transaction).toBe("AQID");
  });

  it("requires final order transaction-binding fields", () => {
    expect(() => parseJupiterFinalOrder(fixture)).toThrow("transaction-binding fields");
  });

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

describe("Jupiter execution", () => {
  it("posts the exact signed transaction and request ID with authentication", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: "Success", signature: "sig", slot: 123, code: 0,
      totalInputAmount: "100", totalOutputAmount: "200", inputAmountResult: "100", outputAmountResult: "200",
    }), { status: 200 }));
    const result = await new JupiterClient("https://api.test/swap/v2", "key").execute("signed", "request-1");
    expect(result).toMatchObject({ status: "Success", signature: "sig", slot: "123", totalOutputAmount: "200" });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ signedTransaction: "signed", requestId: "request-1" }));
    expect(init.headers).toMatchObject({ "x-api-key": "key" });
  });

  it("preserves failed status, code and a returned signature", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "Failed", signature: "sig", code: 6001 }), { status: 200 }));
    await expect(new JupiterClient("https://api.test/swap/v2", "key").execute("signed", "request-1"))
      .resolves.toMatchObject({ status: "Failed", signature: "sig", code: "6001" });
  });

  it("fails closed without credentials or on HTTP failure", async () => {
    await expect(new JupiterClient("https://api.test/swap/v2").execute("signed", "request-1")).rejects.toThrow("JUPITER_API_KEY");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("timeout", { status: 504 }));
    await expect(new JupiterClient("https://api.test/swap/v2", "key").execute("signed", "request-1")).rejects.toThrow("HTTP 504");
  });
});
