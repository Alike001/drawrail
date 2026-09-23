import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createMainnetCorrectnessReport } from "@/server/validation";
import { readServerEnv } from "@/server/env";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet query parameter is required" }, { status: 400 });
  try {
    const env = readServerEnv();
    const report = await createMainnetCorrectnessReport({
      wallet,
      rpcUrl: env.SOLANA_RPC_URL,
      jupiterBaseUrl: env.JUPITER_BASE_URL,
      jupiterApiKey: env.JUPITER_API_KEY,
    });
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown validation failure";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
