import { describe, expect, it } from "vitest";
import { basisPoints } from "./types";
import {
  decimalPrice,
  divergenceBasisPoints,
  evaluatePythPair,
  validateFreshness,
  type PythFeedMetadata,
  type PythObservation,
} from "./pyth";

const metadata = (symbol: string, min = 3): PythFeedMetadata => ({
  id: symbol.startsWith("Crypto") ? 1 : 2,
  symbol,
  description: symbol,
  exponent: -5,
  minPublishers: min,
  minChannel: "fixed_rate@200ms",
  state: "stable",
  quoteCurrency: "USD",
  marketSessionMinPublishers: { regular: min, preMarket: 2, postMarket: 2, overNight: 2 },
});

const observation = (overrides: Partial<PythObservation> = {}): PythObservation => ({
  feedId: 1,
  symbol: "Crypto.AAPLX/USD",
  price: "25000000",
  exponent: -5,
  confidence: "1000",
  publisherCount: 4,
  marketSession: "regular",
  timestampUs: "1790228536200000",
  feedUpdateTimestamp: "1790228536200000",
  channel: "fixed_rate@200ms",
  ...overrides,
});

const config = {
  maxFeedAgeMs: 5_000n,
  maxConfidenceBps: basisPoints(100n),
  clockSkewMs: 1_000n,
  maxDivergenceBps: basisPoints(100n),
};

function pair(rep: Partial<PythObservation> = {}, ref: Partial<PythObservation> = {}, unit = true) {
  return {
    symbol: "AAPLx" as const,
    representation: observation(rep),
    reference: observation({ feedId: 2, symbol: "Equity.US.AAPL/USD", ...ref }),
    representationMetadata: metadata("Crypto.AAPLX/USD"),
    referenceMetadata: metadata("Equity.US.AAPL/USD"),
    unitAlignmentVerified: unit,
  };
}

describe("Pyth fixed-precision policy", () => {
  it("parses negative and positive exponents and large mantissas", () => {
    expect(decimalPrice(observation({ price: "1234567890123456789", exponent: -8 })).toString()).toBe("12345678901.23456789");
    expect(decimalPrice(observation({ price: "123", exponent: 2 })).toString()).toBe("12300");
  });

  it("handles microsecond timestamps beyond the JS safe integer domain as bigint strings", () => {
    const result = validateFreshness(observation({ timestampUs: "10000000000000000001", feedUpdateTimestamp: "10000000000000000000" }), config);
    expect(result).toEqual({ valid: true, ageUs: 1n });
  });

  it("accepts fresh data and rejects carried-forward, future, and missing timestamps", () => {
    expect(validateFreshness(observation(), config).valid).toBe(true);
    expect(validateFreshness(observation({ feedUpdateTimestamp: "1790228530199999" }), config).valid).toBe(false);
    expect(validateFreshness(observation({ feedUpdateTimestamp: "1790228537200001" }), config).valid).toBe(false);
    expect(validateFreshness(observation({ feedUpdateTimestamp: "missing" }), config).valid).toBe(false);
  });

  it.each(["preMarket", "postMarket", "overNight", "closed", "auction"])("rejects the %s reference session", (session) => {
    expect(evaluatePythPair(pair({}, { marketSession: session }), config).reasonCode).toBe("PYTH_SESSION_INVALID");
  });

  it("rejects non-regular representation sessions independently", () => {
    expect(evaluatePythPair(pair({ marketSession: "closed" }), config).reasonCode).toBe("PYTH_SESSION_INVALID");
  });

  it("uses the catalog session publisher minimum", () => {
    expect(evaluatePythPair(pair({ publisherCount: 2 }), config).reasonCode).toBe("PYTH_LOW_PUBLISHER_COUNT");
    expect(evaluatePythPair(pair({ publisherCount: 3 }), config).reasonCode).toBe("PYTH_VALID");
  });

  it("accepts confidence at the limit and rejects wider confidence", () => {
    expect(evaluatePythPair(pair({ confidence: "250000" }), config).reasonCode).toBe("PYTH_VALID");
    expect(evaluatePythPair(pair({ confidence: "250001" }), config).reasonCode).toBe("PYTH_CONFIDENCE_TOO_WIDE");
  });

  it("computes divergence below, equal to, and above the threshold exactly", () => {
    expect(evaluatePythPair(pair({ price: "25200000" }), config).reasonCode).toBe("PYTH_VALID");
    expect(evaluatePythPair(pair({ price: "25250000" }), config).reasonCode).toBe("PYTH_VALID");
    expect(evaluatePythPair(pair({ price: "25250001" }), config).reasonCode).toBe("PYTH_DIVERGENCE");
    expect(divergenceBasisPoints(observation({ price: "25200000" }), observation()).display).toBe("80");
  });

  it("normalizes differing exponents without floating point", () => {
    const result = divergenceBasisPoints(observation({ price: "252", exponent: 0 }), observation({ price: "25000", exponent: -2 }));
    expect(result.display).toBe("80");
  });

  it("rejects zero and malformed reference prices", () => {
    expect(() => divergenceBasisPoints(observation(), observation({ price: "0" }))).toThrow(/non-zero/);
    expect(() => decimalPrice(observation({ price: "2.5" }))).toThrow(/Malformed/);
  });

  it("fails closed when representation units are not verified", () => {
    expect(evaluatePythPair(pair({}, {}, false), config).reasonCode).toBe("PYTH_UNIT_UNVERIFIED");
  });
});
