import "server-only";
import { ASSET_REGISTRY } from "@/domain/assets";
import { assertOrderNotExpired } from "@/domain/execution-safety";
import { evaluateExecutableReference } from "@/domain/pyth";
import { activeMultiplier, isInActivationWindow, scaledUiState } from "@/domain/scaled-ui";
import { basisPoints, unixTimestampSeconds } from "@/domain/types";
import type { DecisionReceiptPayload } from "./decision-receipt";
import type { readServerEnv } from "./env";
import { evaluatePythForPortfolio } from "./pyth/service";
import { readAndVerifyMint, readChainTime, SolanaRpcClient } from "./rpc";

export async function revalidateImmediatelyBeforeExecution(
  receipt: DecisionReceiptPayload,
  env: ReturnType<typeof readServerEnv>,
): Promise<Readonly<{ blockHeight: string; pythStatus: "not_applied" | "valid" }>> {
  const rpc = new SolanaRpcClient(env.SOLANA_RPC_URL);
  const currentBlockHeight = BigInt(await rpc.call<number>("getBlockHeight", [{ commitment: "confirmed" }]));
  assertOrderNotExpired({
    router: receipt.router,
    lastValidBlockHeight: receipt.lastValidBlockHeight,
    expireAt: receipt.jupiterExpireAt,
    localExpiresAt: receipt.expiresAt,
  }, BigInt(Date.now()), currentBlockHeight);

  const asset = ASSET_REGISTRY[receipt.selectedSymbol];
  const [mint, chainTime] = await Promise.all([readAndVerifyMint(rpc, asset), readChainTime(rpc)]);
  if (!mint.scaledUi) throw new Error("Scaled UI Amount state is unavailable");
  const state = scaledUiState(mint.scaledUi.oldMultiplier, mint.scaledUi.newMultiplier, unixTimestampSeconds(mint.scaledUi.activationTimestamp));
  const current = activeMultiplier(state, chainTime.timestamp);
  assertMultiplierUnchangedAndSafe(receipt.multiplier, {
    active: current,
    old: state.oldMultiplier,
    next: state.newMultiplier,
    activationTimestamp: state.activationTimestamp.toString(),
  }, chainTime.timestamp);

  if (!receipt.policy.referenceProtectionRequired) return { blockHeight: currentBlockHeight.toString(), pythStatus: "not_applied" };
  if (receipt.selectedSymbol !== "TSLAx") throw new Error("Requested reference protection is unavailable for this asset");
  const pyth = await evaluatePythForPortfolio({
    enabled: env.PYTH_POLICY_ENABLED,
    apiKey: env.PYTH_PRO_API_KEY,
    maxFeedAgeMs: env.PYTH_MAX_FEED_AGE_MS,
    maxConfidenceBps: env.PYTH_MAX_CONFIDENCE_BPS,
    clockSkewMs: env.PYTH_CLOCK_SKEW_MS,
  });
  const reference = pyth.references.TSLAx;
  if (pyth.status.service !== "available" || !reference) throw new Error("Fresh authenticated Tesla reference is unavailable");
  const evidence = evaluateExecutableReference({
    symbol: "TSLAx",
    reference,
    displayedSaleAmount: receipt.displayedReduction,
    expectedUsdcRaw: receipt.expectedUsdc,
    minimumUsdcRaw: receipt.minimumUsdc,
    config: {
      maxFeedAgeMs: env.PYTH_MAX_FEED_AGE_MS,
      maxConfidenceBps: basisPoints(env.PYTH_MAX_CONFIDENCE_BPS),
      clockSkewMs: env.PYTH_CLOCK_SKEW_MS,
      maxDivergenceBps: basisPoints(receipt.policy.maxDivergenceBps),
    },
  });
  if (evidence.status !== "valid") throw new Error(evidence.message);
  return { blockHeight: currentBlockHeight.toString(), pythStatus: "valid" };
}

export function assertMultiplierUnchangedAndSafe(
  reviewed: DecisionReceiptPayload["multiplier"],
  current: DecisionReceiptPayload["multiplier"],
  chainTimestamp: ReturnType<typeof unixTimestampSeconds>,
): void {
  if (current.active !== reviewed.active || current.old !== reviewed.old || current.next !== reviewed.next
    || current.activationTimestamp !== reviewed.activationTimestamp) {
    throw new Error("Multiplier state changed after review");
  }
  if (isInActivationWindow(unixTimestampSeconds(current.activationTimestamp), chainTimestamp, 900n)) {
    throw new Error("The transaction entered the multiplier activation safety window");
  }
}
