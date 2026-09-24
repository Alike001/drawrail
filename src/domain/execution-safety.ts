import { parseUsdc } from "./money";

export type OrderExpiry = Readonly<{
  router: string | null;
  lastValidBlockHeight: string | null;
  expireAt: string | null;
  localExpiresAt: string;
}>;

export type ReviewExpiry = Readonly<{
  expiresAtMs: bigint;
  source: "jupiter_expire_at" | "block_height_estimate" | "drawrail_local";
  approximateBlockSeconds: string | null;
}>;

const CONSERVATIVE_BLOCK_TIME_MS = 350n;

export function computeEffectiveReviewExpiry(input: Readonly<{
  nowMs: bigint;
  localTtlSeconds: bigint;
  router: string | null;
  jupiterExpireAt: string | null;
  currentBlockHeight: bigint;
  lastValidBlockHeight: string | null;
}>): ReviewExpiry {
  const candidates: Array<{ expiresAtMs: bigint; source: ReviewExpiry["source"] }> = [
    { expiresAtMs: input.nowMs + input.localTtlSeconds * 1_000n, source: "drawrail_local" },
  ];
  const jupiterExpiry = input.jupiterExpireAt === null ? null : parseExpiry(input.jupiterExpireAt);
  if (jupiterExpiry !== null) candidates.push({ expiresAtMs: jupiterExpiry, source: "jupiter_expire_at" });
  const router = input.router?.toLowerCase() ?? "";
  let approximateBlockSeconds: string | null = null;
  if (["metis", "dflow", "okx"].includes(router) && input.lastValidBlockHeight !== null) {
    const remainingBlocks = BigInt(input.lastValidBlockHeight) - input.currentBlockHeight;
    const remainingMs = remainingBlocks > 0n ? remainingBlocks * CONSERVATIVE_BLOCK_TIME_MS : 0n;
    approximateBlockSeconds = (remainingMs / 1_000n).toString();
    candidates.push({ expiresAtMs: input.nowMs + remainingMs, source: "block_height_estimate" });
  }
  const effective = candidates.reduce((earliest, candidate) => candidate.expiresAtMs < earliest.expiresAtMs ? candidate : earliest);
  return { ...effective, approximateBlockSeconds };
}

export function assertWithinMainnetDrawdownCap(missingUsdcRaw: string, capUsdc: string): void {
  if (BigInt(missingUsdcRaw) > parseUsdc(capUsdc)) {
    throw new Error(`Drawdown exceeds the deployment safety cap of ${capUsdc} USDC`);
  }
}

export function assertOrderNotExpired(
  expiry: OrderExpiry,
  nowMs: bigint,
  currentBlockHeight?: bigint,
): void {
  const router = expiry.router?.toLowerCase() ?? "";
  if (["metis", "dflow", "okx"].includes(router) && expiry.lastValidBlockHeight !== null) {
    if (currentBlockHeight === undefined) throw new Error("Current block height is required for this Jupiter route");
    if (currentBlockHeight >= BigInt(expiry.lastValidBlockHeight)) throw new Error("Jupiter order block-height expiry has passed");
  }
  if (router === "jupiterz" && expiry.expireAt !== null && parseExpiry(expiry.expireAt) <= nowMs) {
    throw new Error("JupiterZ RFQ expiry has passed");
  }
  if (Date.parse(expiry.localExpiresAt) <= Number(nowMs)) throw new Error("DrawRail review expiry has passed");
}

function parseExpiry(value: string): bigint {
  if (/^\d+$/.test(value)) {
    const raw = BigInt(value);
    return raw < 10_000_000_000n ? raw * 1_000n : raw;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Jupiter expiry is malformed");
  return BigInt(parsed);
}
