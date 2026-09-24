import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type DecisionReceiptPayload = Readonly<{
  version: 1;
  wallet: string;
  targetUsdc: string;
  existingUsdc: string;
  missingUsdc: string;
  selectedSymbol: "AAPLx" | "NVDAx" | "TSLAx";
  selectedMint: string;
  rawInput: string;
  displayedReduction: string;
  expectedUsdc: string;
  minimumUsdc: string;
  retainedExecutableValue: string;
  retainedFloor: string;
  slippageBps: string;
  feeBps: string | null;
  feeMint: string | null;
  platformFee: Record<string, unknown> | null;
  requestId: string;
  messageHash: string;
  policy: Readonly<{
    retainedFloors: Readonly<Record<"AAPLx" | "NVDAx" | "TSLAx", string>>;
    maxSlippageBps: string;
    referenceProtectionRequired: boolean;
    maxDivergenceBps: string;
  }>;
  registryVersion: string;
  pyth: Readonly<{
    state: "not_applied" | "unavailable" | "valid" | "blocked";
    evidenceHash: string | null;
  }>;
  createdAt: string;
  expiresAt: string;
}>;

export type ReceiptExpectations = Readonly<{
  wallet?: string;
  requestId?: string;
  rawInput?: string;
  messageHash?: string;
}>;

export function hashCanonicalValue(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function createDecisionReceipt(payload: DecisionReceiptPayload, secret: string): string {
  assertReceiptSecret(secret);
  const encoded = Buffer.from(canonicalJson(payload)).toString("base64url");
  const mac = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${mac}`;
}

export function verifyDecisionReceipt(
  receipt: string,
  secret: string,
  expectations: ReceiptExpectations = {},
  now = new Date(),
): DecisionReceiptPayload {
  assertReceiptSecret(secret);
  const [encoded, suppliedMac, extra] = receipt.split(".");
  if (!encoded || !suppliedMac || extra !== undefined) throw new Error("Malformed decision receipt");
  const expectedMac = createHmac("sha256", secret).update(encoded).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(suppliedMac, "base64url");
  } catch {
    throw new Error("Malformed decision receipt authentication");
  }
  if (supplied.length !== expectedMac.length || !timingSafeEqual(supplied, expectedMac)) {
    throw new Error("Decision receipt authentication failed");
  }
  const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DecisionReceiptPayload;
  if (parsed.version !== 1 || Date.parse(parsed.expiresAt) <= now.getTime()) throw new Error("Decision receipt expired");
  if (expectations.wallet && parsed.wallet !== expectations.wallet) throw new Error("Decision receipt wallet mismatch");
  if (expectations.requestId && parsed.requestId !== expectations.requestId) throw new Error("Decision receipt request mismatch");
  if (expectations.rawInput && parsed.rawInput !== expectations.rawInput) throw new Error("Decision receipt raw amount mismatch");
  if (expectations.messageHash && parsed.messageHash !== expectations.messageHash) throw new Error("Decision receipt message mismatch");
  return parsed;
}

export function assertReceiptSecret(secret: string | undefined): asserts secret is string {
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("DECISION_RECEIPT_SECRET must contain at least 32 bytes");
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot canonicalize a non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  throw new Error("Cannot canonicalize this receipt value");
}
