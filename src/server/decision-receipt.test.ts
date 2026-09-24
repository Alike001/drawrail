import { describe, expect, it } from "vitest";
import {
  createDecisionReceipt,
  hashCanonicalValue,
  verifyDecisionReceipt,
  type DecisionReceiptPayload,
} from "./decision-receipt";

const SECRET = "test-only-receipt-secret-with-at-least-32-bytes";
const payload: DecisionReceiptPayload = {
  version: 1,
  wallet: "wallet-a",
  targetUsdc: "80000000",
  existingUsdc: "20000000",
  missingUsdc: "60000000",
  selectedSymbol: "AAPLx",
  selectedMint: "mint-a",
  rawInput: "1234",
  displayedReduction: "0.18",
  expectedUsdc: "60410000",
  minimumUsdc: "60020000",
  retainedExecutableValue: "420000000",
  retainedFloor: "400000000",
  slippageBps: "50",
  feeBps: "10",
  feeMint: "usdc",
  platformFee: { feeBps: "10" },
  requestId: "request-a",
  messageHash: "a".repeat(64),
  nonWalletSignaturesHash: "b".repeat(64),
  router: "metis",
  lastValidBlockHeight: "123456",
  jupiterExpireAt: null,
  multiplier: { active: "1", old: "1", next: "1.01", activationTimestamp: "2000000000" },
  policy: {
    retainedFloors: { AAPLx: "400000000", NVDAx: "0", TSLAx: "0" },
    maxSlippageBps: "50",
    referenceProtectionRequired: false,
    maxDivergenceBps: "100",
  },
  registryVersion: "registry-v1",
  pyth: { state: "not_applied", evidenceHash: null },
  createdAt: "2026-09-24T10:00:00.000Z",
  expiresAt: "2026-09-24T10:00:30.000Z",
};

describe("decision receipt binding", () => {
  it("creates and verifies a short-lived authenticated receipt", () => {
    const receipt = createDecisionReceipt(payload, SECRET);
    expect(verifyDecisionReceipt(receipt, SECRET, {}, new Date("2026-09-24T10:00:10Z"))).toEqual(payload);
  });

  it("rejects payload or MAC tampering", () => {
    const receipt = createDecisionReceipt(payload, SECRET);
    expect(() => verifyDecisionReceipt(`${receipt.slice(0, -1)}x`, SECRET, {}, new Date("2026-09-24T10:00:10Z"))).toThrow("authentication");
  });

  it("rejects an expired receipt", () => {
    const receipt = createDecisionReceipt(payload, SECRET);
    expect(() => verifyDecisionReceipt(receipt, SECRET, {}, new Date(payload.expiresAt))).toThrow("expired");
  });

  it.each([
    [{ wallet: "wallet-b" }, "wallet mismatch"],
    [{ requestId: "request-b" }, "request mismatch"],
    [{ rawInput: "1235" }, "raw amount mismatch"],
    [{ messageHash: "b".repeat(64) }, "message mismatch"],
  ] as const)("rejects altered binding expectation %#", (expectations, message) => {
    const receipt = createDecisionReceipt(payload, SECRET);
    expect(() => verifyDecisionReceipt(receipt, SECRET, expectations, new Date("2026-09-24T10:00:10Z"))).toThrow(message);
  });

  it("fails closed when DECISION_RECEIPT_SECRET is missing or weak", () => {
    expect(() => createDecisionReceipt(payload, "")).toThrow("at least 32 bytes");
    expect(() => createDecisionReceipt(payload, "short-test-secret")).toThrow("at least 32 bytes");
  });

  it("canonicalizes object key order for evidence hashes", () => {
    expect(hashCanonicalValue({ b: 2, a: 1 })).toBe(hashCanonicalValue({ a: 1, b: 2 }));
  });
});
