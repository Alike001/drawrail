import "server-only";
import { z } from "zod";
import { XSTOCK_SYMBOLS } from "@/domain/assets";
import { parseUsdc } from "@/domain/money";
import { evaluateDrawdown } from "@/domain/policy";
import { basisPoints } from "@/domain/types";
import type { readServerEnv } from "./env";
import { JupiterClient } from "./jupiter";
import { readDecisionPortfolio } from "./portfolio";
import { evaluatePythForPortfolio } from "./pyth/service";
import { SolanaRpcClient } from "./rpc";

const decimal = z.string().regex(/^\d+(?:\.\d{1,6})?$/);

export const drawdownRequestSchema = z.object({
  wallet: z.string().min(32).max(64),
  targetUsdc: decimal,
  maxSlippageBps: z.union([z.string(), z.number().int()]).transform(String),
  retainedFloors: z.object({ AAPLx: decimal, NVDAx: decimal, TSLAx: decimal }),
  referenceProtection: z.object({
    required: z.boolean(),
    maxDivergenceBps: z.union([z.string(), z.number().int()]).transform(String),
  }),
});

export type DrawdownRequest = z.infer<typeof drawdownRequestSchema>;

export async function evaluateLiveDrawdown(
  body: DrawdownRequest,
  env: ReturnType<typeof readServerEnv>,
) {
  const targetUsdc = parseUsdc(body.targetUsdc);
  if (targetUsdc <= 0n || targetUsdc > parseUsdc("1000000")) throw new DrawdownInputError("Target USDC must be greater than zero and no more than 1,000,000.");
  const maxSlippageBps = basisPoints(body.maxSlippageBps);
  if (maxSlippageBps > 100n) throw new DrawdownInputError("Maximum slippage cannot exceed 1%.");
  const maxDivergenceBps = basisPoints(body.referenceProtection.maxDivergenceBps);
  if (maxDivergenceBps > 1_000n) throw new DrawdownInputError("Maximum reference-price gap cannot exceed 10%.");
  const snapshot = await readDecisionPortfolio(new SolanaRpcClient(env.SOLANA_RPC_URL), body.wallet);
  const retainedFloors = Object.fromEntries(XSTOCK_SYMBOLS.map((symbol) => [
    symbol,
    parseUsdc(body.retainedFloors[symbol]),
  ])) as Record<(typeof XSTOCK_SYMBOLS)[number], ReturnType<typeof parseUsdc>>;
  const pyth = body.referenceProtection.required
    ? await evaluatePythForPortfolio({
      enabled: env.PYTH_POLICY_ENABLED,
      apiKey: env.PYTH_PRO_API_KEY,
      maxFeedAgeMs: env.PYTH_MAX_FEED_AGE_MS,
      maxConfidenceBps: env.PYTH_MAX_CONFIDENCE_BPS,
      clockSkewMs: env.PYTH_CLOCK_SKEW_MS,
    })
    : { status: {
      service: env.PYTH_POLICY_ENABLED ? "unavailable" as const : "disabled" as const,
      message: "Reference protection was not requested.",
      referenceProtection: "unavailable" as const,
    }, references: {} };
  const policy = {
    targetUsdc,
    retainedFloors,
    maxSlippageBps,
    referenceProtection: {
      required: body.referenceProtection.required,
      maxDivergenceBps,
      serviceStatus: pyth.status.service,
      serviceMessage: pyth.status.message,
      references: pyth.references,
      maxFeedAgeMs: env.PYTH_MAX_FEED_AGE_MS,
      maxConfidenceBps: basisPoints(env.PYTH_MAX_CONFIDENCE_BPS),
      clockSkewMs: env.PYTH_CLOCK_SKEW_MS,
    },
  } as const;
  const decision = await evaluateDrawdown(
    snapshot,
    policy,
    new JupiterClient(env.JUPITER_BASE_URL, env.JUPITER_API_KEY),
  );
  return { snapshot, policy, decision };
}

export class DrawdownInputError extends Error {}
