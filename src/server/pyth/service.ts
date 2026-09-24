import "server-only";
import { XSTOCK_SYMBOLS, type XStockSymbol } from "@/domain/assets";
import { evaluatePythPair, type PythFeedMetadata, type PythPolicyEvidence, type PythServiceStatus } from "@/domain/pyth";
import { basisPoints, type BasisPoints } from "@/domain/types";
import { fetchLatestPyth, fetchPythCatalog, PythHttpError } from "./client";
import { PYTH_SYMBOLS, PYTH_UNIT_ALIGNMENT_VERIFIED } from "./config";

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
}>;

export async function getPythFeatureStatus(config: PythRuntimeConfig): Promise<PythFeatureStatus> {
  if (!config.enabled) return feature("disabled", "Reference protection is disabled in this deployment.");
  if (!config.apiKey) return feature("unavailable", "Reference protection is not configured.");
  try {
    const resolved = await resolveRequiredFeeds();
    await fetchLatestPyth(config.apiKey, [...resolved.values()]);
    if (XSTOCK_SYMBOLS.some((symbol) => !PYTH_UNIT_ALIGNMENT_VERIFIED[symbol])) {
      return feature("unit_unverified", "Reference protection is unavailable until xStock price units are verified.");
    }
    return { service: "available", message: "Authenticated Pyth reference protection is available.", referenceProtection: "available" };
  } catch (error) {
    if (error instanceof PythHttpError && error.status === 403) return feature("not_entitled", "The configured Pyth account lacks one or more required feeds.");
    return feature("unhealthy", "Pyth reference protection is currently unhealthy.");
  }
}

export async function evaluatePythForPortfolio(
  config: PythRuntimeConfig,
  maxDivergenceBps: BasisPoints,
): Promise<{ status: PythFeatureStatus; evaluations: Readonly<Partial<Record<XStockSymbol, PythPolicyEvidence>>> }> {
  const status = await getPythFeatureStatus(config);
  if (status.service !== "available" || !config.apiKey) return { status, evaluations: {} };
  const resolved = await resolveRequiredFeeds();
  const observations = await fetchLatestPyth(config.apiKey, [...resolved.values()]);
  const byId = new Map(observations.map((feed) => [feed.feedId, feed]));
  const evaluations: Partial<Record<XStockSymbol, PythPolicyEvidence>> = {};
  for (const symbol of XSTOCK_SYMBOLS) {
    const names = PYTH_SYMBOLS[symbol];
    const representationMetadata = resolved.get(names.representation)!;
    const referenceMetadata = resolved.get(names.reference)!;
    const representation = byId.get(representationMetadata.id);
    const reference = byId.get(referenceMetadata.id);
    if (!representation || !reference) continue;
    evaluations[symbol] = evaluatePythPair({
      symbol, representation, reference, representationMetadata, referenceMetadata,
      unitAlignmentVerified: PYTH_UNIT_ALIGNMENT_VERIFIED[symbol],
    }, {
      maxFeedAgeMs: config.maxFeedAgeMs,
      maxConfidenceBps: basisPoints(config.maxConfidenceBps),
      clockSkewMs: config.clockSkewMs,
      maxDivergenceBps,
    });
  }
  return { status, evaluations };
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

function feature(service: PythServiceStatus, message: string): PythFeatureStatus {
  return { service, message, referenceProtection: "unavailable" };
}
