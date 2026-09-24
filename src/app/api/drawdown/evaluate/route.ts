import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { XSTOCK_SYMBOLS } from "@/domain/assets";
import { parseUsdc } from "@/domain/money";
import { evaluateDrawdown } from "@/domain/policy";
import { basisPoints } from "@/domain/types";
import { readServerEnv } from "@/server/env";
import { JupiterClient } from "@/server/jupiter";
import { readDecisionPortfolio } from "@/server/portfolio";
import { SolanaRpcClient } from "@/server/rpc";
import { jsonSafe } from "@/server/serialize";
import { evaluatePythForPortfolio } from "@/server/pyth/service";

export const dynamic = "force-dynamic";

const decimal = z.string().regex(/^\d+(?:\.\d{1,6})?$/);
const requestSchema = z.object({
  wallet: z.string().min(32).max(64),
  targetUsdc: decimal,
  maxSlippageBps: z.union([z.string(), z.number().int()]).transform(String),
  retainedFloors: z.object({ AAPLx: decimal, NVDAx: decimal, TSLAx: decimal }),
  referenceProtection: z.object({
    required: z.boolean(),
    maxDivergenceBps: z.union([z.string(), z.number().int()]).transform(String),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const targetUsdc = parseUsdc(body.targetUsdc);
    if (targetUsdc <= 0n || targetUsdc > parseUsdc("1000000")) {
      return NextResponse.json({ error: "Target USDC must be greater than zero and no more than 1,000,000." }, { status: 400 });
    }
    const maxSlippageBps = basisPoints(body.maxSlippageBps);
    if (maxSlippageBps > 100n) {
      return NextResponse.json({ error: "Maximum slippage cannot exceed 1%." }, { status: 400 });
    }
    const env = readServerEnv();
    const maxDivergenceBps = basisPoints(body.referenceProtection.maxDivergenceBps);
    if (maxDivergenceBps > 1_000n) {
      return NextResponse.json({ error: "Maximum reference-price gap cannot exceed 10%." }, { status: 400 });
    }
    const snapshot = await readDecisionPortfolio(new SolanaRpcClient(env.SOLANA_RPC_URL), body.wallet);
    const floors = Object.fromEntries(XSTOCK_SYMBOLS.map((symbol) => [
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
    const decision = await evaluateDrawdown(snapshot, {
      targetUsdc,
      retainedFloors: floors,
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
    }, new JupiterClient(env.JUPITER_BASE_URL, env.JUPITER_API_KEY));
    return NextResponse.json(jsonSafe(decision), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Check the wallet, USDC target, retained floors, and slippage values." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown evaluation failure";
    const publicMessage = /rate|429/i.test(message)
      ? "A live data service is rate limited. No decision was produced; retry shortly."
      : "The live portfolio decision could not be completed. No quote or balance was substituted.";
    return NextResponse.json({ error: publicMessage }, { status: 422 });
  }
}
