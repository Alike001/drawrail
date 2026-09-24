import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyDecisionReceipt } from "@/server/decision-receipt";
import { readServerEnv } from "@/server/env";
import { reserveExecution } from "@/server/execution-store";
import { verifySignedReviewedTransaction } from "@/server/signed-transaction";

export const dynamic = "force-dynamic";
const schema = z.object({ signedTransaction: z.string().min(1), receipt: z.string().min(1), requestId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const env = readServerEnv();
    if (!env.executionCredentialsConfigured || !env.DECISION_RECEIPT_SECRET) {
      return NextResponse.json({ state: "unavailable", error: "Sign-only validation requires complete execution credentials." }, { status: 503 });
    }
    const receipt = verifyDecisionReceipt(body.receipt, env.DECISION_RECEIPT_SECRET, { requestId: body.requestId });
    const evidence = await verifySignedReviewedTransaction({
      signedTransactionBase64: body.signedTransaction,
      wallet: receipt.wallet,
      expectedMessageHash: receipt.messageHash,
      expectedNonWalletSignaturesHash: receipt.nonWalletSignaturesHash,
    });
    // Consume the receipt without submitting it. A sign-only validation order
    // is deliberately unusable for the later funded path.
    reserveExecution(body.receipt);
    return NextResponse.json({
      state: "sign_only_verified",
      messageHashBeforeWallet: receipt.messageHash,
      messageHashAfterWallet: evidence.messageHash,
      signatureVerified: true,
      broadcast: false,
      instruction: "This order must be discarded. Build a fresh review before funded execution.",
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ state: "transaction_invalid", error: "The wallet signature could not be verified against the exact reviewed transaction." }, { status: 422 });
  }
}
