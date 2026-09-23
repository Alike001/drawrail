import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { readServerEnv } from "@/server/env";
import { readDecisionPortfolio, serializePortfolio } from "@/server/portfolio";
import { SolanaRpcClient } from "@/server/rpc";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "Enter a Solana wallet public key." }, { status: 400 });
  try {
    const env = readServerEnv();
    const snapshot = await readDecisionPortfolio(new SolanaRpcClient(env.SOLANA_RPC_URL), wallet);
    return NextResponse.json(serializePortfolio(snapshot), {
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
