import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ASSET_REGISTRY } from "@/domain/assets";
import { assertWithinMainnetDrawdownCap } from "@/domain/execution-safety";
import { verifyDecisionReceipt } from "@/server/decision-receipt";
import { readServerEnv } from "@/server/env";
import { recordSubmission, reserveExecution } from "@/server/execution-store";
import { JupiterClient } from "@/server/jupiter";
import { revalidateImmediatelyBeforeExecution } from "@/server/pre-execution";
import { reconcileSettlement } from "@/server/settlement";
import { verifySignedReviewedTransaction } from "@/server/signed-transaction";

export const dynamic = "force-dynamic";
const schema = z.object({ signedTransaction: z.string().min(1), receipt: z.string().min(1), requestId: z.string().min(1) });

export async function POST(request: NextRequest) {
  let receiptToken: string | null = null;
  let reserved = false;
  try {
    const body = schema.parse(await request.json());
    receiptToken = body.receipt;
    const env = readServerEnv();
    if (!env.executionCredentialsConfigured || !env.DECISION_RECEIPT_SECRET || !env.JUPITER_API_KEY) {
      return NextResponse.json({ state: "execution_unavailable", error: "Execution unavailable — deployment credentials incomplete." }, { status: 503 });
    }
    if (!env.FUNDED_EXECUTION_ENABLED) {
      return NextResponse.json({ state: "execution_unavailable", error: "Funded execution is closed until the operator completes sign-only validation and explicitly enables it." }, { status: 503 });
    }
    if (env.NEXT_PUBLIC_APP_MODE !== "mainnet-funded") {
      return NextResponse.json({ state: "execution_unavailable", error: "Funded execution is disabled in this deployment mode." }, { status: 503 });
    }
    const receipt = verifyDecisionReceipt(body.receipt, env.DECISION_RECEIPT_SECRET, { requestId: body.requestId });
    assertWithinMainnetDrawdownCap(receipt.missingUsdc, env.MAX_MAINNET_DRAWDOWN_USDC);
    const signed = await verifySignedReviewedTransaction({
      signedTransactionBase64: body.signedTransaction,
      wallet: receipt.wallet,
      expectedMessageHash: receipt.messageHash,
      expectedNonWalletSignaturesHash: receipt.nonWalletSignaturesHash,
    });
    const safety = await revalidateImmediatelyBeforeExecution(receipt, env);
    reserveExecution(body.receipt);
    reserved = true;
    let execution;
    try {
      execution = await new JupiterClient(env.JUPITER_BASE_URL, env.JUPITER_API_KEY).execute(signed.signedTransaction, receipt.requestId);
    } catch {
      recordSubmission(body.receipt, { signature: null, outcome: "unknown" });
      return NextResponse.json({ state: "unknown", error: "Execution status unknown. DrawRail will not submit this transaction again.", signature: null }, { status: 502 });
    }
    if (!execution.signature) {
      const outcome = execution.status.toLowerCase() === "failed" ? "failed" : "unknown";
      recordSubmission(body.receipt, { signature: null, outcome, jupiter: execution });
      return NextResponse.json({ state: outcome, execution, safety, signatureVerified: true });
    }
    let settlement;
    try {
      settlement = await reconcileSettlement({
        rpcUrl: env.SOLANA_RPC_URL,
        signature: execution.signature,
        wallet: receipt.wallet,
        inputMint: receipt.selectedMint,
        outputMint: ASSET_REGISTRY.USDC.mint,
        reviewedRawInput: receipt.rawInput,
        reviewedMinimumOutput: receipt.minimumUsdc,
        feeMint: receipt.feeMint,
        jupiter: execution,
      });
    } catch {
      settlement = { status: "unknown" as const, signature: execution.signature, slot: null, blockTime: null, inputDebit: null, usdcCredit: null, jupiterFeeAmount: null, discrepancies: [] };
    }
    recordSubmission(body.receipt, { signature: execution.signature, outcome: settlement.status, jupiter: execution });
    return NextResponse.json({ state: settlement.status, execution, settlement, safety, signatureVerified: true, messageHash: signed.messageHash });
  } catch (error) {
    if (reserved && receiptToken) recordSubmission(receiptToken, { signature: null, outcome: "unknown" });
    const replay = error instanceof Error && /already been submitted/.test(error.message);
    return NextResponse.json({
      state: replay ? "unknown" : "refresh_required",
      error: replay ? "This reviewed transaction was already submitted or reserved. DrawRail will not submit it again." : "The signed transaction failed a required verification or last-moment safety check. Build and sign a fresh review.",
    }, { status: replay ? 409 : 422 });
  }
}
