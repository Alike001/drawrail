import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyDecisionReceipt } from "@/server/decision-receipt";
import { readServerEnv } from "@/server/env";
import { revalidateImmediatelyBeforeExecution } from "@/server/pre-execution";

export const dynamic = "force-dynamic";
const schema = z.object({ receipt: z.string().min(1), requestId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const env = readServerEnv();
    if (!env.executionCredentialsConfigured || !env.DECISION_RECEIPT_SECRET) {
      return NextResponse.json({ state: "execution_unavailable", error: "Signing validation requires complete execution credentials." }, { status: 503 });
    }
    const receipt = verifyDecisionReceipt(body.receipt, env.DECISION_RECEIPT_SECRET, { requestId: body.requestId });
    const safety = await revalidateImmediatelyBeforeExecution(receipt, env);
    return NextResponse.json({ state: "ready_to_sign", safety }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ state: "refresh_required", error: "The reviewed order failed its pre-signing expiry or safety recheck. Refresh the decision." }, { status: 409 });
  }
}
