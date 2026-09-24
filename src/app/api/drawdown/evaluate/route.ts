import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readServerEnv } from "@/server/env";
import { jsonSafe } from "@/server/serialize";
import { drawdownRequestSchema, DrawdownInputError, evaluateLiveDrawdown } from "@/server/drawdown";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = drawdownRequestSchema.parse(await request.json());
    const env = readServerEnv();
    const { decision } = await evaluateLiveDrawdown(body, env);
    return NextResponse.json(jsonSafe(decision), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof DrawdownInputError) return NextResponse.json({ error: error.message }, { status: 400 });
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
