import Decimal from "decimal.js";
import type { XStockSymbol } from "./assets";
import type { BasisPoints } from "./types";
import type { ReasonCode } from "./reasons";

export const PYTH_MARKET_SESSIONS = ["regular", "preMarket", "postMarket", "overNight", "closed"] as const;
export type PythMarketSession = (typeof PYTH_MARKET_SESSIONS)[number];
export type PythServiceStatus = "disabled" | "available" | "unavailable" | "not_entitled" | "unhealthy" | "unit_unverified";

export type PythFeedMetadata = Readonly<{
  id: number;
  symbol: string;
  description: string;
  exponent: number;
  minPublishers: number;
  minChannel: string;
  state: string;
  quoteCurrency: string;
  marketSessionMinPublishers: Readonly<Record<string, number>>;
}>;

export type PythObservation = Readonly<{
  feedId: number;
  symbol: string;
  price: string;
  exponent: number;
  confidence: string;
  publisherCount: number;
  marketSession: string;
  timestampUs: string;
  feedUpdateTimestamp: string;
  channel: string;
}>;

export type PythPair = Readonly<{
  symbol: XStockSymbol;
  representation: PythObservation;
  reference: PythObservation;
  representationMetadata: PythFeedMetadata;
  referenceMetadata: PythFeedMetadata;
  unitAlignmentVerified: boolean;
}>;

export type PythPolicyConfig = Readonly<{
  maxFeedAgeMs: bigint;
  maxConfidenceBps: BasisPoints;
  clockSkewMs: bigint;
  maxDivergenceBps: BasisPoints;
}>;

export type PythPolicyEvidence = Readonly<{
  symbol: XStockSymbol;
  status: "valid" | "blocked";
  reasonCode: ReasonCode;
  message: string;
  divergenceBps?: string;
  thresholdBps: string;
  representation?: PythObservation;
  reference?: PythObservation;
  representationAgeUs?: string;
  referenceAgeUs?: string;
}>;

export function evaluatePythPair(pair: PythPair, config: PythPolicyConfig): PythPolicyEvidence {
  const common = {
    symbol: pair.symbol,
    thresholdBps: config.maxDivergenceBps.toString(),
    representation: pair.representation,
    reference: pair.reference,
  };
  if (!pair.unitAlignmentVerified) return blocked(common, "PYTH_UNIT_UNVERIFIED");

  const representationFreshness = validateFreshness(pair.representation, config);
  const referenceFreshness = validateFreshness(pair.reference, config);
  if (!representationFreshness.valid || !referenceFreshness.valid) {
    return blocked({
      ...common,
      representationAgeUs: representationFreshness.ageUs?.toString(),
      referenceAgeUs: referenceFreshness.ageUs?.toString(),
    }, "PYTH_STALE");
  }

  // xStock representation feeds are cataloged as always-open with only the
  // regular session. Equity references are regular-session-only for V1.
  if (pair.representation.marketSession !== "regular" || pair.reference.marketSession !== "regular") {
    return blocked({ ...common, representationAgeUs: representationFreshness.ageUs!.toString(), referenceAgeUs: referenceFreshness.ageUs!.toString() }, "PYTH_SESSION_INVALID");
  }
  if (!hasEnoughPublishers(pair.representation, pair.representationMetadata)
    || !hasEnoughPublishers(pair.reference, pair.referenceMetadata)) {
    return blocked(common, "PYTH_LOW_PUBLISHER_COUNT");
  }
  if (!confidenceAcceptable(pair.representation, config.maxConfidenceBps)
    || !confidenceAcceptable(pair.reference, config.maxConfidenceBps)) {
    return blocked(common, "PYTH_CONFIDENCE_TOO_WIDE");
  }

  const divergence = divergenceBasisPoints(pair.representation, pair.reference);
  if (divergence.comparisonNumerator > divergence.comparisonDenominator * config.maxDivergenceBps) {
    return blocked({ ...common, divergenceBps: divergence.display }, "PYTH_DIVERGENCE");
  }
  return {
    ...common,
    status: "valid",
    reasonCode: "PYTH_VALID",
    message: "Fresh stock and token references are within the selected price-gap limit.",
    divergenceBps: divergence.display,
    representationAgeUs: representationFreshness.ageUs!.toString(),
    referenceAgeUs: referenceFreshness.ageUs!.toString(),
  };
}

export function decimalPrice(observation: Pick<PythObservation, "price" | "exponent">): Decimal {
  if (!/^-?\d+$/.test(observation.price) || !Number.isInteger(observation.exponent)) {
    throw new Error("Malformed Pyth price");
  }
  return new Decimal(observation.price).mul(new Decimal(10).pow(observation.exponent));
}

export function validateFreshness(observation: PythObservation, config: Pick<PythPolicyConfig, "maxFeedAgeMs" | "clockSkewMs">) {
  if (!/^\d+$/.test(observation.timestampUs) || !/^\d+$/.test(observation.feedUpdateTimestamp)) {
    return { valid: false as const, ageUs: undefined };
  }
  const envelope = BigInt(observation.timestampUs);
  const updated = BigInt(observation.feedUpdateTimestamp);
  const skewUs = config.clockSkewMs * 1_000n;
  if (updated > envelope + skewUs) return { valid: false as const, ageUs: updated - envelope };
  const ageUs = envelope >= updated ? envelope - updated : 0n;
  return { valid: ageUs <= config.maxFeedAgeMs * 1_000n, ageUs };
}

export function divergenceBasisPoints(representation: PythObservation, reference: PythObservation) {
  const commonExponent = Math.min(representation.exponent, reference.exponent);
  const representationMantissa = scaleMantissa(representation.price, representation.exponent, commonExponent);
  const referenceMantissa = scaleMantissa(reference.price, reference.exponent, commonExponent);
  if (referenceMantissa === 0n) throw new Error("Pyth reference price must be non-zero");
  const numerator = abs(representationMantissa - referenceMantissa) * 10_000n;
  const denominator = abs(referenceMantissa);
  return {
    comparisonNumerator: numerator,
    comparisonDenominator: denominator,
    display: new Decimal(numerator.toString()).div(denominator.toString()).toDecimalPlaces(4).toString(),
  };
}

function confidenceAcceptable(observation: PythObservation, limit: BasisPoints) {
  if (!/^\d+$/.test(observation.confidence) || !/^-?\d+$/.test(observation.price)) return false;
  const price = abs(BigInt(observation.price));
  return price > 0n && BigInt(observation.confidence) * 10_000n <= price * limit;
}

function hasEnoughPublishers(observation: PythObservation, metadata: PythFeedMetadata) {
  const minimum = metadata.marketSessionMinPublishers[observation.marketSession] ?? metadata.minPublishers;
  return Number.isSafeInteger(observation.publisherCount) && observation.publisherCount >= minimum;
}

function scaleMantissa(value: string, exponent: number, commonExponent: number) {
  if (!/^-?\d+$/.test(value)) throw new Error("Malformed Pyth mantissa");
  const power = exponent - commonExponent;
  if (!Number.isSafeInteger(power) || power < 0 || power > 30) throw new Error("Unsupported Pyth exponent range");
  return BigInt(value) * 10n ** BigInt(power);
}

function blocked(base: Omit<PythPolicyEvidence, "status" | "reasonCode" | "message">, reasonCode: ReasonCode): PythPolicyEvidence {
  const messages: Partial<Record<ReasonCode, string>> = {
    PYTH_STALE: "A required Pyth price is stale, carried forward, missing, or outside the allowed clock skew.",
    PYTH_SESSION_INVALID: "The underlying stock reference is not in the accepted regular session.",
    PYTH_LOW_PUBLISHER_COUNT: "A required Pyth feed has fewer publishers than its current catalog minimum.",
    PYTH_CONFIDENCE_TOO_WIDE: "A required Pyth confidence interval is wider than the configured limit.",
    PYTH_UNIT_UNVERIFIED: "The xStock representation price unit has not been proven against displayed on-chain units.",
    PYTH_DIVERGENCE: "The tokenized stock is outside the selected reference-price gap.",
  };
  return { ...base, status: "blocked", reasonCode, message: messages[reasonCode] ?? "Pyth reference protection could not be validated." };
}

function abs(value: bigint) { return value < 0n ? -value : value; }
