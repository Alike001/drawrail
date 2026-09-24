import { describe, expect, it } from "vitest";
import { canBuildWalletReview, isReviewExpired, reviewIdentityChanged, type ReviewIdentity } from "./review-state";

const identity = (overrides: Partial<ReviewIdentity> = {}): ReviewIdentity => ({
  wallet: "wallet-a",
  targetUsdc: "80",
  retainedFloors: { AAPLx: "10", NVDAx: "20", TSLAx: "30" },
  maxSlippageBps: "50",
  referenceProtectionRequired: false,
  maxDivergenceBps: "100",
  selectedSymbol: "AAPLx",
  selectedRawInput: "123",
  ...overrides,
});

describe("transaction review state", () => {
  it("invalidates the review when the wallet changes", () => {
    expect(reviewIdentityChanged(identity(), identity({ wallet: "wallet-b" }))).toBe(true);
  });

  it.each([
    ["target", { targetUsdc: "81" }],
    ["slippage", { maxSlippageBps: "25" }],
    ["Pyth setting", { referenceProtectionRequired: true }],
    ["Pyth limit", { maxDivergenceBps: "50" }],
    ["candidate", { selectedSymbol: "TSLAx" }],
    ["raw amount", { selectedRawInput: "124" }],
    ["retained floor", { retainedFloors: { AAPLx: "11", NVDAx: "20", TSLAx: "30" } }],
  ] as const)("invalidates the review after a %s change", (_label, change) => {
    expect(reviewIdentityChanged(identity(), identity(change))).toBe(true);
  });

  it("keeps an identical review identity current", () => {
    expect(reviewIdentityChanged(identity(), identity())).toBe(false);
  });

  it("treats an exact expiry boundary and malformed expiry as expired", () => {
    const now = Date.parse("2026-09-24T12:00:00.000Z");
    expect(isReviewExpired("2026-09-24T12:00:00.000Z", now)).toBe(true);
    expect(isReviewExpired("2026-09-24T12:00:00.001Z", now)).toBe(false);
    expect(isReviewExpired("not-a-date", now)).toBe(true);
  });

  it("keeps pasted-address mode separate from a sign-capable connected wallet", () => {
    expect(canBuildWalletReview("read-only", "wallet-a", "wallet-a")).toBe(false);
    expect(canBuildWalletReview("connected", "wallet-b", "wallet-a")).toBe(false);
    expect(canBuildWalletReview("connected", "wallet-a", "wallet-a")).toBe(true);
  });
});
