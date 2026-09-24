export type ReviewState =
  | "decision_ready"
  | "building_transaction"
  | "validating_transaction"
  | "review_ready"
  | "quote_expired"
  | "policy_changed"
  | "wallet_changed"
  | "transaction_invalid"
  | "refresh_required";

export type ReviewIdentity = Readonly<{
  wallet: string;
  targetUsdc: string;
  retainedFloors: Readonly<Record<"AAPLx" | "NVDAx" | "TSLAx", string>>;
  maxSlippageBps: string;
  referenceProtectionRequired: boolean;
  maxDivergenceBps: string;
  selectedSymbol: string;
  selectedRawInput: string;
}>;

export function reviewIdentityChanged(previous: ReviewIdentity, next: ReviewIdentity): boolean {
  return previous.wallet !== next.wallet
    || previous.targetUsdc !== next.targetUsdc
    || previous.maxSlippageBps !== next.maxSlippageBps
    || previous.referenceProtectionRequired !== next.referenceProtectionRequired
    || previous.maxDivergenceBps !== next.maxDivergenceBps
    || previous.selectedSymbol !== next.selectedSymbol
    || previous.selectedRawInput !== next.selectedRawInput
    || previous.retainedFloors.AAPLx !== next.retainedFloors.AAPLx
    || previous.retainedFloors.NVDAx !== next.retainedFloors.NVDAx
    || previous.retainedFloors.TSLAx !== next.retainedFloors.TSLAx;
}

export function isReviewExpired(expiresAt: string, nowMs = Date.now()): boolean {
  const parsed = Date.parse(expiresAt);
  return !Number.isFinite(parsed) || parsed <= nowMs;
}

export function canBuildWalletReview(
  mode: "connected" | "read-only" | null,
  connectedWallet: string | null,
  decisionWallet: string,
): boolean {
  return mode === "connected" && connectedWallet === decisionWallet;
}

export function canRefreshTransactionOnly(decisionCreatedAt: string, nowMs = Date.now(), maxPolicyAgeMs = 120_000): boolean {
  const createdAt = Date.parse(decisionCreatedAt);
  return Number.isFinite(createdAt) && nowMs >= createdAt && nowMs - createdAt < maxPolicyAgeMs;
}
