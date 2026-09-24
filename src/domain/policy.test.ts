import { describe, expect, it } from "vitest";
import { ASSET_REGISTRY, XSTOCK_SYMBOLS, type XStockSymbol } from "./assets";
import { formatRawAmount } from "./money";
import type { PortfolioPosition, PortfolioSnapshot, UnavailablePosition } from "./portfolio";
import { evaluateDrawdown, type PolicyInputs, type QuoteProvider } from "./policy";
import { displayedAmount, multiplier, rawTokenAmount, unixTimestampSeconds, usdcRawAmount, basisPoints } from "./types";
import type { JupiterQuote } from "@/server/jupiter";

const NOW = new Date("2026-09-23T12:00:00.000Z");

function position(symbol: XStockSymbol, raw = 100_000_000n, blocked = false): PortfolioPosition {
  return {
    symbol,
    mint: ASSET_REGISTRY[symbol].mint,
    tokenProgram: ASSET_REGISTRY[symbol].expectedProgram,
    decimals: 8,
    rawBalance: rawTokenAmount(raw),
    displayedBalance: displayedAmount(formatRawAmount(raw, 8, 8)),
    tokenAccountCount: raw === 0n ? 0 : 1,
    tokenAccounts: raw === 0n ? [] : [{ address: `${symbol}-account`, raw: raw.toString() }],
    scaledUi: {
      oldMultiplier: multiplier("1"),
      newMultiplier: multiplier("1"),
      activeMultiplier: multiplier("1"),
      activationTimestamp: unixTimestampSeconds(0),
      activationWindowBlocked: blocked,
    },
    state: "verified",
  };
}

function snapshot(
  existingUsdc = 20_000_000n,
  positions: Array<PortfolioPosition | UnavailablePosition> = XSTOCK_SYMBOLS.map((symbol) => position(symbol)),
): PortfolioSnapshot {
  return {
    wallet: "11111111111111111111111111111111",
    generatedAt: NOW.toISOString(),
    chainSlot: 42,
    chainTime: unixTimestampSeconds(Math.floor(NOW.getTime() / 1000)),
    usdc: {
      mint: ASSET_REGISTRY.USDC.mint,
      tokenProgram: ASSET_REGISTRY.USDC.expectedProgram,
      decimals: 6,
      rawBalance: usdcRawAmount(existingUsdc),
      tokenAccountCount: existingUsdc === 0n ? 0 : 1,
      tokenAccounts: [],
    },
    positions,
  };
}

function policy(target = 80_000_000n, floors: Partial<Record<XStockSymbol, bigint>> = {}): PolicyInputs {
  return {
    targetUsdc: usdcRawAmount(target),
    maxSlippageBps: basisPoints(50n),
    retainedFloors: {
      AAPLx: usdcRawAmount(floors.AAPLx ?? 0n),
      NVDAx: usdcRawAmount(floors.NVDAx ?? 0n),
      TSLAx: usdcRawAmount(floors.TSLAx ?? 0n),
    },
  };
}

function quoteProvider(options: {
  factors?: Partial<Record<XStockSymbol, bigint>>;
  noRoute?: XStockSymbol;
  expireAt?: string | null;
  impacts?: Partial<Record<XStockSymbol, string>>;
  slippageBps?: string;
} = {}): QuoteProvider {
  const mintToSymbol = Object.fromEntries(XSTOCK_SYMBOLS.map((symbol) => [ASSET_REGISTRY[symbol].mint, symbol]));
  return {
    async quote(inputMint, _outputMint, amount): Promise<JupiterQuote> {
      const symbol = mintToSymbol[inputMint] as XStockSymbol;
      if (symbol === options.noRoute) throw new Error("No routes found");
      const factor = options.factors?.[symbol] ?? 1n;
      const output = amount * factor;
      return {
        inAmount: amount.toString(),
        outAmount: output.toString(),
        otherAmountThreshold: output.toString(),
        slippageBps: options.slippageBps ?? "50",
        priceImpact: options.impacts?.[symbol] ?? "0.1",
        router: "metis",
        mode: "manual",
        swapMode: "ExactIn",
        feeBps: "10",
        feeMint: ASSET_REGISTRY.USDC.mint,
        platformFee: { feeBps: "10", feeMint: ASSET_REGISTRY.USDC.mint },
        expireAt: options.expireAt ?? null,
        requestId: `${symbol}-${amount}`,
      };
    },
  };
}

describe("portfolio drawdown policy", () => {
  it("counts existing USDC first", async () => {
    const result = await evaluateDrawdown(snapshot(), policy(), quoteProvider(), { now: NOW });
    expect(result.missingUsdc).toBe(60_000_000n);
    expect(result.selected?.minimumUsdc).toBeGreaterThanOrEqual(60_000_000n);
  });

  it("returns target already met without requesting quotes", async () => {
    let calls = 0;
    const provider: QuoteProvider = { quote: async () => { calls += 1; throw new Error("unexpected"); } };
    const result = await evaluateDrawdown(snapshot(80_000_000n), policy(), provider, { now: NOW });
    expect(result.outcome).toBe("target-already-met");
    expect(result.selected).toBeNull();
    expect(calls).toBe(0);
  });

  it("selects the only funded eligible position", async () => {
    const result = await evaluateDrawdown(
      snapshot(20_000_000n, [position("AAPLx"), position("NVDAx", 0n), position("TSLAx", 0n)]),
      policy(), quoteProvider(), { now: NOW },
    );
    expect(result.selected?.symbol).toBe("AAPLx");
    expect(result.candidates.map((item) => item.reasonCode)).toContain("ZERO_BALANCE");
  });

  it("ranks multiple eligible positions by smallest percentage, then price impact, then symbol", async () => {
    const byPercentage = await evaluateDrawdown(snapshot(), policy(), quoteProvider({
      factors: { AAPLx: 1n, NVDAx: 2n, TSLAx: 1n },
    }), { now: NOW });
    expect(byPercentage.selected?.symbol).toBe("NVDAx");

    const byImpact = await evaluateDrawdown(snapshot(), policy(), quoteProvider({
      impacts: { AAPLx: "0.2", NVDAx: "0.1", TSLAx: "0.3" },
    }), { now: NOW });
    expect(byImpact.selected?.symbol).toBe("NVDAx");

    const bySymbol = await evaluateDrawdown(snapshot(), policy(), quoteProvider(), { now: NOW });
    expect(bySymbol.selected?.symbol).toBe("AAPLx");
  });

  it("rejects a retained-floor violation using the exact remainder quote", async () => {
    const result = await evaluateDrawdown(snapshot(), policy(80_000_000n, { AAPLx: 50_000_000n }), quoteProvider(), { now: NOW });
    expect(result.candidates.find((item) => item.symbol === "AAPLx")?.reasonCode).toBe("RETAINED_FLOOR");
  });

  it("maps no-route and expired quotes to stable reasons", async () => {
    const noRoute = await evaluateDrawdown(snapshot(), policy(), quoteProvider({ noRoute: "AAPLx" }), { now: NOW });
    expect(noRoute.candidates.find((item) => item.symbol === "AAPLx")?.reasonCode).toBe("NO_JUPITER_ROUTE");
    const expired = await evaluateDrawdown(snapshot(), policy(), quoteProvider({ expireAt: "2026-09-23T11:59:59.000Z" }), { now: NOW });
    expect(expired.outcome).toBe("refresh-required");
    expect(expired.candidates[0].reasonCode).toBe("QUOTE_EXPIRED");
  });

  it("rejects insufficient positions and response slippage above the user limit", async () => {
    const insufficient = await evaluateDrawdown(
      snapshot(0n, [position("AAPLx", 10_000_000n), position("NVDAx", 0n), position("TSLAx", 0n)]),
      policy(), quoteProvider(), { now: NOW },
    );
    expect(insufficient.candidates[0].reasonCode).toBe("INSUFFICIENT_POSITION");
    const slippage = await evaluateDrawdown(snapshot(), policy(), quoteProvider({ slippageBps: "51" }), { now: NOW });
    expect(slippage.candidates[0].reasonCode).toBe("SLIPPAGE_LIMIT");
  });

  it("fails an unavailable asset closed and marks lower-ranked candidates", async () => {
    const unavailable = { symbol: "AAPLx" as const, mint: ASSET_REGISTRY.AAPLx.mint, state: "unavailable" as const, error: "fixture" };
    const result = await evaluateDrawdown(
      snapshot(20_000_000n, [unavailable, position("NVDAx"), position("TSLAx")]),
      policy(), quoteProvider(), { now: NOW },
    );
    expect(result.candidates[0].reasonCode).toBe("UNSUPPORTED_ASSET_STATE");
    expect(result.selected?.reasonCode).toBe("SELECTED");
    expect(result.candidates.some((candidate) => candidate.reasonCode === "LOWER_RANKED")).toBe(true);
    expect(result.candidates.every((candidate) => candidate.reasonCodes.includes("PYTH_NOT_ENABLED"))).toBe(true);
  });

  it("requires refresh for stale RPC state", async () => {
    const stale = { ...snapshot(), chainTime: unixTimestampSeconds(BigInt(Math.floor(NOW.getTime() / 1000)) - 121n) };
    const result = await evaluateDrawdown(stale, policy(), quoteProvider(), { now: NOW });
    expect(result.outcome).toBe("refresh-required");
    expect(result.candidates.every((candidate) => candidate.reasonCode === "RPC_STALE")).toBe(true);
  });

  it("bounds quote search and reports exhaustion", async () => {
    const result = await evaluateDrawdown(snapshot(), policy(), quoteProvider(), {
      now: NOW,
      maxQuoteRequestsPerCandidate: 1,
    });
    expect(result.outcome).toBe("refresh-required");
    expect(result.candidates[0].reasonCode).toBe("QUOTE_SEARCH_EXHAUSTED");
  });

  it("hard-blocks the activation window before requesting quotes", async () => {
    let calls = 0;
    const provider: QuoteProvider = { quote: async () => { calls += 1; throw new Error("unexpected"); } };
    const result = await evaluateDrawdown(
      snapshot(20_000_000n, [position("AAPLx", 100_000_000n, true), position("NVDAx", 0n), position("TSLAx", 0n)]),
      policy(), provider, { now: NOW },
    );
    expect(result.candidates[0].reasonCode).toBe("MULTIPLIER_WINDOW");
    expect(calls).toBe(0);
  });

  it("keeps reference protection explicitly off without changing candidate selection", async () => {
    const result = await evaluateDrawdown(snapshot(), {
      ...policy(),
      referenceProtection: {
        required: false,
        maxDivergenceBps: basisPoints(100n),
        serviceStatus: "available",
        serviceMessage: "available fixture",
        evaluations: {},
      },
    }, quoteProvider(), { now: NOW });
    expect(result.outcome).toBe("actionable");
    expect(result.pyth.reasonCode).toBe("PYTH_NOT_ENABLED");
  });

  it("accepts healthy required Pyth evidence deterministically", async () => {
    const valid = (symbol: XStockSymbol) => ({
      symbol, status: "valid" as const, reasonCode: "PYTH_VALID" as const,
      message: "fixture-only valid reference", divergenceBps: "24", thresholdBps: "100",
    });
    const result = await evaluateDrawdown(snapshot(), {
      ...policy(),
      referenceProtection: {
        required: true,
        maxDivergenceBps: basisPoints(100n),
        serviceStatus: "available",
        serviceMessage: "available fixture",
        evaluations: { AAPLx: valid("AAPLx"), NVDAx: valid("NVDAx"), TSLAx: valid("TSLAx") },
      },
    }, quoteProvider(), { now: NOW });
    expect(result.selected?.symbol).toBe("AAPLx");
    expect(result.selected?.reasonCodes).toContain("PYTH_VALID");
  });

  it("blocks an otherwise eligible candidate when required Pyth is unhealthy without quoting", async () => {
    let calls = 0;
    const provider: QuoteProvider = { quote: async () => { calls += 1; throw new Error("unexpected"); } };
    const result = await evaluateDrawdown(
      snapshot(20_000_000n, [position("AAPLx"), position("NVDAx", 0n), position("TSLAx", 0n)]),
      {
        ...policy(),
        referenceProtection: {
          required: true,
          maxDivergenceBps: basisPoints(100n),
          serviceStatus: "not_entitled",
          serviceMessage: "The configured Pyth account lacks required feeds.",
          evaluations: {},
        },
      },
      provider,
      { now: NOW },
    );
    expect(result.outcome).toBe("blocked");
    expect(result.candidates[0].reasonCode).toBe("PYTH_NOT_ENTITLED");
    expect(calls).toBe(0);
  });

  it("handles an all-zero portfolio", async () => {
    const result = await evaluateDrawdown(
      snapshot(0n, XSTOCK_SYMBOLS.map((symbol) => position(symbol, 0n))),
      policy(), quoteProvider(), { now: NOW },
    );
    expect(result.outcome).toBe("blocked");
    expect(result.candidates.every((candidate) => candidate.reasonCode === "ZERO_BALANCE")).toBe(true);
  });

  it("validates policy target and system slippage maximum", async () => {
    await expect(evaluateDrawdown(snapshot(), { ...policy(), targetUsdc: usdcRawAmount(0n) }, quoteProvider(), { now: NOW }))
      .rejects.toThrow("greater than zero");
    await expect(evaluateDrawdown(snapshot(), { ...policy(), maxSlippageBps: basisPoints(101n) }, quoteProvider(), { now: NOW }))
      .rejects.toThrow("100 basis points");
  });
});
