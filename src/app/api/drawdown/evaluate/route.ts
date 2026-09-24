import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readServerEnv } from "@/server/env";
import { jsonSafe } from "@/server/serialize";
import { drawdownRequestSchema, DrawdownInputError, evaluateLiveDrawdown, LiveEvaluationError } from "@/server/drawdown";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = drawdownRequestSchema.parse(await request.json());
    const env = readServerEnv();
    const { decision } = await evaluateLiveDrawdown(body, env);
    return NextResponse.json(jsonSafe(decision), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof DrawdownInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof LiveEvaluationError) {
      const copy = {
        RPC_UNAVAILABLE: "The fresh Solana portfolio read failed. No cached balance was substituted.",
        JUPITER_AUTH: "Jupiter rejected the server quote credential. No decision was produced.",
        JUPITER_RATE_LIMIT: "Jupiter rate-limited the live quote request. No decision was produced; retry shortly.",
        JUPITER_UNAVAILABLE: "Jupiter could not complete the live quote evaluation. No route or price was substituted.",
      } as const;
      return NextResponse.json({ error: copy[error.code], code: error.code }, { status: 422 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Check the wallet, USDC target, retained floors, and slippage values." }, { status: 400 });
    }
    return NextResponse.json({ error: "The live portfolio decision could not be completed. No quote or balance was substituted.", code: "EVALUATION_INTERNAL" }, { status: 422 });
  }
}
