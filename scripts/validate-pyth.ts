import { loadEnvFile } from "node:process";
import { setDefaultResultOrder } from "node:dns";
import { basisPoints, usdcRawAmount } from "../src/domain/types";
import { evaluateDrawdown, type QuoteProvider } from "../src/domain/policy";
import { ASSET_REGISTRY } from "../src/domain/assets";
import { fetchLatestPyth, fetchPythCatalog } from "../src/server/pyth/client";
import { PYTH_SYMBOLS } from "../src/server/pyth/config";
import { readServerEnv } from "../src/server/env";
import { JupiterClient, type JupiterQuote } from "../src/server/jupiter";
import { readDecisionPortfolio } from "../src/server/portfolio";
import { SolanaRpcClient } from "../src/server/rpc";

try {
  loadEnvFile(".env.local");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const originalFetch = globalThis.fetch;
setDefaultResultOrder("ipv4first");
globalThis.fetch = retryingFetch as typeof fetch;

async function main() {
  const wallet = process.argv[2];
  const env = readServerEnv();
  if (!env.PYTH_PRO_API_KEY) throw new Error("PYTH_PRO_API_KEY is required in .env.local");

  const catalog = await fetchPythCatalog();
  const metadata = catalog.find((feed) => feed.symbol === PYTH_SYMBOLS.TSLAx.reference);
  if (!metadata) throw new Error("Equity.US.TSLA/USD was not found in the current Pyth catalog");
  const [observation] = await fetchLatestPyth(env.PYTH_PRO_API_KEY, [metadata]);
  if (!observation) throw new Error("The authenticated Tesla feed returned no observation");

  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    authenticatedFeed: {
      metadata,
      observation,
      feedAgeUs: (BigInt(observation.timestampUs) - BigInt(observation.feedUpdateTimestamp)).toString(),
      freshAggregate: observation.timestampUs === observation.feedUpdateTimestamp,
    },
    unavailableByCurrentEntitlement: [
      PYTH_SYMBOLS.AAPLx.reference,
      PYTH_SYMBOLS.NVDAx.reference,
      PYTH_SYMBOLS.AAPLx.representation,
      PYTH_SYMBOLS.NVDAx.representation,
      PYTH_SYMBOLS.TSLAx.representation,
    ],
  };

  if (wallet) {
    const portfolio = await readDecisionPortfolio(new SolanaRpcClient(env.SOLANA_RPC_URL), wallet);
    const cachedQuotes = new CachedQuoteProvider(new JupiterClient(env.JUPITER_BASE_URL, env.JUPITER_API_KEY));
    const base = {
      targetUsdc: usdcRawAmount(portfolio.usdc.rawBalance + 1_000_000n),
      retainedFloors: {
        AAPLx: usdcRawAmount(0n),
        NVDAx: usdcRawAmount(0n),
        TSLAx: usdcRawAmount(0n),
      },
      maxSlippageBps: basisPoints(50n),
    } as const;
    const referenceBase = {
      required: true,
      serviceStatus: "available" as const,
      serviceMessage: "Authenticated Tesla reference protection is available.",
      references: { TSLAx: { observation, metadata } },
      maxFeedAgeMs: env.PYTH_MAX_FEED_AGE_MS,
      maxConfidenceBps: basisPoints(env.PYTH_MAX_CONFIDENCE_BPS),
      clockSkewMs: env.PYTH_CLOCK_SKEW_MS,
    };
    const now = new Date();
    const off = await evaluateDrawdown(portfolio, base, cachedQuotes, { now });
    const configured = await evaluateDrawdown(portfolio, {
      ...base,
      referenceProtection: { ...referenceBase, maxDivergenceBps: basisPoints(100n) },
    }, cachedQuotes, { now });
    const observedDivergence = candidate(configured, "TSLAx")?.pyth?.divergenceBps;
    const blockingThreshold = thresholdBelow(observedDivergence);
    const strict = await evaluateDrawdown(portfolio, {
      ...base,
      referenceProtection: { ...referenceBase, maxDivergenceBps: basisPoints(blockingThreshold) },
    }, cachedQuotes, { now });
    report.walletValidation = {
      wallet,
      targetUsdcRaw: base.targetUsdc.toString(),
      existingUsdcRaw: portfolio.usdc.rawBalance.toString(),
      missingUsdcRaw: "1000000",
      tslaMint: ASSET_REGISTRY.TSLAx.mint,
      protectionOff: summarizeDecision(off),
      protectionAt100Bps: summarizeDecision(configured),
      blockingThresholdBps: blockingThreshold.toString(),
      protectionAtBlockingThreshold: summarizeDecision(strict),
      pythChangedEligibility: candidate(off, "TSLAx")?.status !== candidate(strict, "TSLAx")?.status,
      uniqueJupiterQuotes: cachedQuotes.size,
    };
  } else {
    report.walletValidation = "Not run. Pass a public wallet address to validate the live TSLAx/Jupiter policy path.";
  }

  process.stdout.write(`${JSON.stringify(report, jsonSafe, 2)}\n`);
}

class CachedQuoteProvider implements QuoteProvider {
  readonly cache = new Map<string, JupiterQuote>();
  constructor(private readonly client: JupiterClient) {}
  get size() { return this.cache.size; }
  async quote(inputMint: string, outputMint: string, amount: Parameters<QuoteProvider["quote"]>[2], slippage: Parameters<QuoteProvider["quote"]>[3]) {
    const key = `${inputMint}:${outputMint}:${amount}:${slippage}`;
    const existing = this.cache.get(key);
    if (existing) return existing;
    const result = await this.client.quote(inputMint, outputMint, amount, slippage);
    this.cache.set(key, result);
    return result;
  }
}

function summarizeDecision(decision: Awaited<ReturnType<typeof evaluateDrawdown>>) {
  return {
    outcome: decision.outcome,
    selected: decision.selected?.symbol ?? null,
    candidates: decision.candidates.map((item) => ({
      symbol: item.symbol,
      status: item.status,
      reasonCode: item.reasonCode,
      rawInput: item.rawInput?.toString(),
      displayedReduction: item.displayedReduction,
      expectedUsdcRaw: item.expectedUsdc?.toString(),
      minimumUsdcRaw: item.minimumUsdc?.toString(),
      router: item.quote?.router,
      requestId: item.quote?.requestId,
      pyth: item.pyth,
    })),
  };
}

function candidate(decision: Awaited<ReturnType<typeof evaluateDrawdown>>, symbol: "TSLAx") {
  return decision.candidates.find((item) => item.symbol === symbol);
}

function thresholdBelow(divergence: string | undefined) {
  if (!divergence || !/^\d+(?:\.\d+)?$/.test(divergence)) return 0n;
  const [whole, fraction = ""] = divergence.split(".");
  const floor = BigInt(whole);
  return fraction.replaceAll("0", "").length > 0 ? floor : floor > 0n ? floor - 1n : 0n;
}

function jsonSafe(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

async function retryingFetch(input: URL | RequestInfo, init?: RequestInit): Promise<Response> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await originalFetch(input, init);
    if (response.status !== 429 || attempt === 3) return response;
    await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
  }
  return response!;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Pyth validation failed: ${message}\n`);
  process.exitCode = 1;
});
