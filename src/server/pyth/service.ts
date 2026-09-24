import "server-only";
import { XSTOCK_SYMBOLS, type XStockSymbol } from "@/domain/assets";
import type { PythFeedMetadata, PythReferenceContext, PythServiceStatus } from "@/domain/pyth";
import { fetchLatestPyth, fetchPythCatalog, PythHttpError } from "./client";
import { PYTH_SYMBOLS } from "./config";

export type PythRuntimeConfig = Readonly<{
  enabled: boolean;
  apiKey?: string;
  maxFeedAgeMs: bigint;
  maxConfidenceBps: bigint;
  clockSkewMs: bigint;
}>;

export type PythFeatureStatus = Readonly<{
  service: PythServiceStatus;
  message: string;
  referenceProtection: "available" | "unavailable";
  assets: Readonly<Record<XStockSymbol, Readonly<{ status: "available" | "not_entitled" | "disabled" | "unhealthy"; message: string }>>>;
}>;

export async function getPythFeatureStatus(config: PythRuntimeConfig): Promise<PythFeatureStatus> {
  if (!config.enabled) return feature("disabled", "Reference protection is disabled in this deployment.", "disabled");
  if (!config.apiKey) return feature("unavailable", "Reference protection is not configured.", "unhealthy");
  try {
    const reference = await resolveTeslaReference();
    const observations = await fetchLatestPyth(config.apiKey, [reference]);
    if (!observations[0]) return feature("unhealthy", "The Tesla reference feed returned no observation.", "unhealthy");
    return {
      service: "available",
      message: "Authenticated Tesla reference protection is available for TSLAx.",
      referenceProtection: "available",
      assets: {
        AAPLx: { status: "not_entitled", message: "Apple reference protection is unavailable under the current entitlement." },
        NVDAx: { status: "not_entitled", message: "Nvidia reference protection is unavailable under the current entitlement." },
        TSLAx: { status: "available", message: "Tesla reference protection is available." },
      },
    };
  } catch (error) {
    if (error instanceof PythHttpError && error.status === 403) return feature("not_entitled", "The configured Pyth account cannot access the Tesla reference feed.", "not_entitled");
    return feature("unhealthy", "Tesla reference protection is currently unhealthy.", "unhealthy");
  }
}

export async function evaluatePythForPortfolio(
  config: PythRuntimeConfig,
): Promise<{ status: PythFeatureStatus; references: Readonly<Partial<Record<XStockSymbol, PythReferenceContext>>> }> {
  const status = await getPythFeatureStatus(config);
  if (status.service !== "available" || !config.apiKey) return { status, references: {} };
  const metadata = await resolveTeslaReference();
  const [observation] = await fetchLatestPyth(config.apiKey, [metadata]);
  return { status, references: observation ? { TSLAx: { observation, metadata } } : {} };
}

export async function resolveRequiredFeeds() {
  const catalog = await fetchPythCatalog();
  const bySymbol = new Map(catalog.map((feed) => [feed.symbol, feed]));
  const required = new Map<string, PythFeedMetadata>();
  for (const pair of Object.values(PYTH_SYMBOLS)) {
    for (const symbol of [pair.representation, pair.reference]) {
      const feed = bySymbol.get(symbol);
      if (!feed || feed.state !== "stable" || feed.quoteCurrency !== "USD") throw new Error(`Required Pyth feed missing: ${symbol}`);
      required.set(symbol, feed);
    }
  }
  return required;
}

async function resolveTeslaReference() {
  const catalog = await fetchPythCatalog();
  const feed = catalog.find((item) => item.symbol === PYTH_SYMBOLS.TSLAx.reference);
  if (!feed || feed.state !== "stable" || feed.quoteCurrency !== "USD") throw new Error("Required Tesla Pyth reference is missing");
  return feed;
}

function feature(service: PythServiceStatus, message: string, assetStatus: "not_entitled" | "disabled" | "unhealthy"): PythFeatureStatus {
  return {
    service,
    message,
    referenceProtection: "unavailable",
    assets: Object.fromEntries(XSTOCK_SYMBOLS.map((symbol) => [symbol, { status: assetStatus, message }])) as PythFeatureStatus["assets"],
  };
}
