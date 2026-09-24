import { describe, expect, it } from "vitest";
import { assertOrderNotExpired, assertWithinMainnetDrawdownCap, computeEffectiveReviewExpiry } from "./execution-safety";

const base = { router: "metis", lastValidBlockHeight: "200", expireAt: null, localExpiresAt: "2026-09-24T10:01:00Z" };
const start = BigInt(Date.parse("2026-09-24T10:00:00Z"));

describe("funded execution safety", () => {
  it("enforces the deployment drawdown cap with exact USDC arithmetic", () => {
    expect(() => assertWithinMainnetDrawdownCap("5000000", "5")).not.toThrow();
    expect(() => assertWithinMainnetDrawdownCap("5000001", "5")).toThrow("safety cap");
  });

  it("uses the aggregator block-height limit inclusively", () => {
    expect(() => assertOrderNotExpired(base, start, 199n)).not.toThrow();
    expect(() => assertOrderNotExpired(base, start, 200n)).toThrow("block-height");
  });

  it("uses JupiterZ expireAt and the local fallback", () => {
    const jupiterz = { ...base, router: "jupiterz", lastValidBlockHeight: null, expireAt: (start + 30_000n).toString() };
    expect(() => assertOrderNotExpired(jupiterz, start + 29_999n)).not.toThrow();
    expect(() => assertOrderNotExpired(jupiterz, start + 30_000n)).toThrow("RFQ");
    expect(() => assertOrderNotExpired({ ...base, router: null, lastValidBlockHeight: null }, start + 60_000n)).toThrow("review expiry");
  });

  it("uses the strictest approximate review deadline without extending Jupiter", () => {
    expect(computeEffectiveReviewExpiry({ nowMs: 1_000n, localTtlSeconds: 60n, router: "metis", jupiterExpireAt: null, currentBlockHeight: 100n, lastValidBlockHeight: "200" }))
      .toEqual({ expiresAtMs: 36_000n, source: "block_height_estimate", approximateBlockSeconds: "35" });
    expect(computeEffectiveReviewExpiry({ nowMs: 1_000n, localTtlSeconds: 60n, router: "jupiterz", jupiterExpireAt: "31000", currentBlockHeight: 100n, lastValidBlockHeight: null }))
      .toEqual({ expiresAtMs: 61_000n, source: "drawrail_local", approximateBlockSeconds: null });
    expect(computeEffectiveReviewExpiry({ nowMs: 1_000n, localTtlSeconds: 60n, router: "jupiterz", jupiterExpireAt: "1970-01-01T00:00:20.000Z", currentBlockHeight: 100n, lastValidBlockHeight: null }))
      .toEqual({ expiresAtMs: 20_000n, source: "jupiter_expire_at", approximateBlockSeconds: null });
  });
});
