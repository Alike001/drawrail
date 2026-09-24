import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { readServerEnv } from "@/server/env";
import { readDecisionPortfolio, serializePortfolio } from "@/server/portfolio";
import { SolanaRpcClient } from "@/server/rpc";
import { getPythFeatureStatus } from "@/server/pyth/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "Enter a Solana wallet public key." }, { status: 400 });
  try {
    const env = readServerEnv();
    const [snapshot, pyth] = await Promise.all([
      readDecisionPortfolio(new SolanaRpcClient(env.SOLANA_RPC_URL), wallet),
      getPythFeatureStatus({
        enabled: env.PYTH_POLICY_ENABLED,
        apiKey: env.PYTH_PRO_API_KEY,
        maxFeedAgeMs: env.PYTH_MAX_FEED_AGE_MS,
        maxConfidenceBps: env.PYTH_MAX_CONFIDENCE_BPS,
        clockSkewMs: env.PYTH_CLOCK_SKEW_MS,
      }),
    ]);
    return NextResponse.json(serializePortfolio(snapshot, pyth), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: publicPortfolioError(error) }, { status: 422 });
  }
}

function publicPortfolioError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown portfolio read failure";
  if (/invalid|address/i.test(message)) return "That wallet public key is not valid.";
  if (/rate|429/i.test(message)) return "The Solana RPC is rate limited. Wait briefly and retry.";
  return "The live portfolio could not be read from Solana RPC. No balances were substituted.";
}
