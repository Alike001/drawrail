import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyDecisionReceipt } from "@/server/decision-receipt";
import { readServerEnv } from "@/server/env";
import { getSubmission, recordSubmission } from "@/server/execution-store";
import { reconcileSettlement } from "@/server/settlement";
import { ASSET_REGISTRY } from "@/domain/assets";

export const dynamic = "force-dynamic";
const schema = z.object({ receipt: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const env = readServerEnv();
    if (!env.DECISION_RECEIPT_SECRET) throw new Error("Receipt verification unavailable");
    // An expired receipt cannot authorize a new submission, but its authenticated
    // binding remains valid evidence for querying the already-submitted signature.
    const receipt = verifyDecisionReceipt(body.receipt, env.DECISION_RECEIPT_SECRET, {}, new Date(0));
    const submitted = getSubmission(body.receipt);
    if (!submitted?.signature || !submitted.jupiter) {
      return NextResponse.json({ state: submitted?.outcome ?? "unknown", signature: submitted?.signature ?? null });
    }
    const settlement = await reconcileSettlement({
      rpcUrl: env.SOLANA_RPC_URL,
      signature: submitted.signature,
      wallet: receipt.wallet,
      inputMint: receipt.selectedMint,
      outputMint: ASSET_REGISTRY.USDC.mint,
      reviewedRawInput: receipt.rawInput,
      reviewedMinimumOutput: receipt.minimumUsdc,
      feeMint: receipt.feeMint,
      jupiter: submitted.jupiter,
    });
    recordSubmission(body.receipt, { signature: submitted.signature, outcome: settlement.status, jupiter: submitted.jupiter });
    return NextResponse.json({ state: settlement.status, execution: submitted.jupiter, settlement });
  } catch {
    return NextResponse.json({ state: "unknown", error: "The existing submission status could not be established. No transaction was resent." }, { status: 422 });
  }
}
