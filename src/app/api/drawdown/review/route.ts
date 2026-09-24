import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ASSET_REGISTRY, ASSET_REGISTRY_VERSION } from "@/domain/assets";
import { FinalOrderValidationError, validateFinalOrderEconomics } from "@/domain/final-order";
import { parseExpiryMs } from "@/domain/policy";
import { evaluateExecutableReference, type PythPolicyEvidence } from "@/domain/pyth";
import { assertRawDisplayParity } from "@/domain/scaled-ui";
import { basisPoints, rawTokenAmount, tokenDecimals, usdcRawAmount } from "@/domain/types";
import { createDecisionReceipt, hashCanonicalValue } from "@/server/decision-receipt";
import { drawdownRequestSchema, DrawdownInputError, evaluateLiveDrawdown } from "@/server/drawdown";
import { readServerEnv } from "@/server/env";
import { JupiterClient } from "@/server/jupiter";
import { evaluatePythForPortfolio } from "@/server/pyth/service";
import { jsonSafe } from "@/server/serialize";
import { validateUnsignedJupiterTransaction } from "@/server/transaction-validator";

export const dynamic = "force-dynamic";

const reviewRequestSchema = drawdownRequestSchema.extend({
  expectedDecision: z.object({
    createdAt: z.string().datetime(),
    selectedSymbol: z.enum(["AAPLx", "NVDAx", "TSLAx"]),
    selectedRawInput: z.string().regex(/^\d+$/),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = reviewRequestSchema.parse(await request.json());
    const env = readServerEnv();
    if (!env.DECISION_RECEIPT_SECRET) {
      return NextResponse.json({
        state: "transaction_invalid",
        code: "RECEIPT_SECRET_MISSING",
        error: "Executable transaction review is disabled until the server receipt secret is configured.",
      }, { status: 503 });
    }

    const { snapshot, policy, decision } = await evaluateLiveDrawdown(body, env);
    const selected = decision.selected;
    if (decision.outcome !== "actionable" || !selected?.rawInput) {
      throw new FinalOrderValidationError("refresh_required", "The refreshed portfolio no longer has an actionable candidate.");
    }
    if (selected.symbol !== body.expectedDecision.selectedSymbol) {
      throw new FinalOrderValidationError("policy_changed", "The selected position changed during refresh.");
    }

    const jupiter = new JupiterClient(env.JUPITER_BASE_URL, env.JUPITER_API_KEY);
    const exactRawInput = rawTokenAmount(body.expectedDecision.selectedRawInput);
    const position = snapshot.positions.find((item) => item.symbol === selected.symbol);
    if (!position || position.state !== "verified") throw new FinalOrderValidationError("refresh_required", "Selected live mint state is no longer verified.");
    if (exactRawInput === 0n || exactRawInput > position.rawBalance) {
      throw new FinalOrderValidationError("policy_changed", "The exact reviewed raw input is no longer fundable by this wallet.");
    }
    const displayedReduction = assertRawDisplayParity(
      exactRawInput,
      tokenDecimals(position.decimals),
      position.scaledUi.activeMultiplier,
    );
    const remainingRaw = rawTokenAmount(position.rawBalance - exactRawInput);
    const retainedQuote = remainingRaw === 0n
      ? null
      : await jupiter.quote(selected.mint, ASSET_REGISTRY.USDC.mint, remainingRaw, policy.maxSlippageBps);
    if (retainedQuote && BigInt(retainedQuote.slippageBps) > policy.maxSlippageBps) {
      throw new FinalOrderValidationError("policy_changed", "The refreshed retained-position quote exceeds the selected slippage limit.");
    }
    const retainedExpiry = retainedQuote ? parseExpiryMs(retainedQuote.expireAt) : null;
    if (retainedExpiry !== null && retainedExpiry <= BigInt(Date.now())) {
      throw new FinalOrderValidationError("refresh_required", "The refreshed retained-position quote is already expired.");
    }
    const retainedExecutableValue = usdcRawAmount(retainedQuote?.otherAmountThreshold ?? "0");
    const retainedFloor = policy.retainedFloors[selected.symbol];
    const order = await jupiter.finalOrder(
      selected.mint,
      ASSET_REGISTRY.USDC.mint,
      exactRawInput,
      policy.maxSlippageBps,
      body.wallet,
    );
    const economicInvariants = validateFinalOrderEconomics(order, {
      inputMint: selected.mint,
      outputMint: ASSET_REGISTRY.USDC.mint,
      rawInput: exactRawInput,
      missingUsdc: decision.missingUsdc,
      maxSlippageBps: policy.maxSlippageBps,
      retainedExecutableValue,
      retainedFloor,
    });

    const transaction = await validateUnsignedJupiterTransaction({
      transactionBase64: order.transaction,
      wallet: body.wallet,
      inputMint: selected.mint,
      outputMint: ASSET_REGISTRY.USDC.mint,
      inputTokenProgram: position.tokenProgram,
      outputTokenProgram: snapshot.usdc.tokenProgram,
      expectedRawInput: exactRawInput,
      minimumOutput: BigInt(order.otherAmountThreshold),
      rpcUrl: env.SOLANA_RPC_URL,
    });
    const source = position.tokenAccounts.find((account) => account.address === transaction.inputTokenAccount);
    if (!source || BigInt(source.raw) < exactRawInput) {
      throw new FinalOrderValidationError("transaction_invalid", "The wallet's transaction source account cannot fund the exact selected raw input.");
    }

    const finalPyth = await revalidateFinalPyth(body, env, selected.symbol, displayedReduction, order.outAmount, order.otherAmountThreshold);
    if (finalPyth?.status === "blocked") {
      throw new FinalOrderValidationError("policy_changed", finalPyth.message);
    }

    const createdAtMs = BigInt(Date.now());
    const localExpiryMs = createdAtMs + env.DECISION_RECEIPT_TTL_SECONDS * 1_000n;
    const jupiterExpiryMs = parseExpiryMs(order.expireAt);
    const expiryMs = jupiterExpiryMs && jupiterExpiryMs < localExpiryMs ? jupiterExpiryMs : localExpiryMs;
    if (expiryMs <= createdAtMs) throw new FinalOrderValidationError("refresh_required", "The final Jupiter order is already expired.");
    const createdAt = new Date(Number(createdAtMs)).toISOString();
    const expiresAt = new Date(Number(expiryMs)).toISOString();
    const pythState = !body.referenceProtection.required
      ? "not_applied" as const
      : selected.symbol === "TSLAx" ? "valid" as const : "unavailable" as const;
    const receiptPayload = {
      version: 1 as const,
      wallet: body.wallet,
      targetUsdc: decision.targetUsdc.toString(),
      existingUsdc: decision.existingUsdc.toString(),
      missingUsdc: decision.missingUsdc.toString(),
      selectedSymbol: selected.symbol,
      selectedMint: selected.mint,
      rawInput: exactRawInput.toString(),
      displayedReduction,
      expectedUsdc: order.outAmount,
      minimumUsdc: order.otherAmountThreshold,
      retainedExecutableValue: retainedExecutableValue.toString(),
      retainedFloor: retainedFloor.toString(),
      slippageBps: order.slippageBps,
      feeBps: order.feeBps,
      feeMint: order.feeMint,
      platformFee: order.platformFee,
      requestId: order.requestId,
      messageHash: transaction.messageHash,
      policy: {
        retainedFloors: Object.fromEntries(Object.entries(policy.retainedFloors).map(([key, value]) => [key, value.toString()])) as Record<"AAPLx" | "NVDAx" | "TSLAx", string>,
        maxSlippageBps: policy.maxSlippageBps.toString(),
        referenceProtectionRequired: body.referenceProtection.required,
        maxDivergenceBps: policy.referenceProtection.maxDivergenceBps.toString(),
      },
      registryVersion: ASSET_REGISTRY_VERSION,
      pyth: { state: pythState, evidenceHash: finalPyth ? hashCanonicalValue(finalPyth) : null },
      createdAt,
      expiresAt,
    };
    const receipt = createDecisionReceipt(receiptPayload, env.DECISION_RECEIPT_SECRET);

    return NextResponse.json(jsonSafe({
      state: "review_ready",
      wallet: body.wallet,
      walletNameRequiredFromClient: true,
      decision: {
        ...decision,
        selected: {
          ...selected,
          rawInput: exactRawInput,
          displayedReduction,
          displayedRemaining: assertRawDisplayParity(remainingRaw, tokenDecimals(position.decimals), position.scaledUi.activeMultiplier),
          expectedUsdc: order.outAmount,
          minimumUsdc: order.otherAmountThreshold,
          retainedExecutableValue,
          retainedFloor,
          retainedQuote,
        },
      },
      order: {
        inputMint: order.inputMint,
        outputMint: order.outputMint,
        inAmount: order.inAmount,
        outAmount: order.outAmount,
        otherAmountThreshold: order.otherAmountThreshold,
        slippageBps: order.slippageBps,
        priceImpact: order.priceImpact,
        router: order.router,
        mode: order.mode,
        swapMode: order.swapMode,
        feeBps: order.feeBps,
        feeMint: order.feeMint,
        platformFee: order.platformFee,
        expireAt: order.expireAt,
        requestId: order.requestId,
        transaction: order.transaction,
      },
      transaction,
      economicInvariants,
      finalPyth,
      receipt,
      receiptPayload,
      createdAt,
      expiresAt,
    }), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof DrawdownInputError) {
      return NextResponse.json({ state: "refresh_required", code: "INVALID_REQUEST", error: error instanceof Error ? error.message : "Invalid review request." }, { status: 400 });
    }
    if (error instanceof FinalOrderValidationError) {
      return NextResponse.json({ state: error.code, code: error.code.toUpperCase(), error: error.message }, { status: 409 });
    }
    if (error instanceof Error && /Jupiter \/order failed|HTTP 429|Too many requests/i.test(error.message)) {
      return NextResponse.json({
        state: "refresh_required",
        code: "JUPITER_UNAVAILABLE",
        error: "Jupiter could not provide a fresh final order. Wait briefly and refresh the decision.",
      }, { status: 503 });
    }
    return NextResponse.json({
      state: "transaction_invalid",
      code: "TRANSACTION_REVIEW_FAILED",
      error: "The wallet-bound transaction could not be proven safe. Refresh the decision and try again.",
    }, { status: 422 });
  }
}

async function revalidateFinalPyth(
  body: z.infer<typeof reviewRequestSchema>,
  env: ReturnType<typeof readServerEnv>,
  symbol: "AAPLx" | "NVDAx" | "TSLAx",
  displayedReduction: string,
  outAmount: string,
  minimumOutput: string,
): Promise<PythPolicyEvidence | null> {
  if (!body.referenceProtection.required || symbol !== "TSLAx") return null;
  const current = await evaluatePythForPortfolio({
    enabled: env.PYTH_POLICY_ENABLED,
    apiKey: env.PYTH_PRO_API_KEY,
    maxFeedAgeMs: env.PYTH_MAX_FEED_AGE_MS,
    maxConfidenceBps: env.PYTH_MAX_CONFIDENCE_BPS,
    clockSkewMs: env.PYTH_CLOCK_SKEW_MS,
  });
  const reference = current.references.TSLAx;
  if (current.status.service !== "available" || !reference) {
    throw new FinalOrderValidationError("refresh_required", "A fresh authenticated Tesla reference is unavailable for final review.");
  }
  return evaluateExecutableReference({
    symbol: "TSLAx",
    reference,
    displayedSaleAmount: displayedReduction,
    expectedUsdcRaw: outAmount,
    minimumUsdcRaw: minimumOutput,
    config: {
      maxFeedAgeMs: env.PYTH_MAX_FEED_AGE_MS,
      maxConfidenceBps: basisPoints(env.PYTH_MAX_CONFIDENCE_BPS),
      clockSkewMs: env.PYTH_CLOCK_SKEW_MS,
      maxDivergenceBps: basisPoints(body.referenceProtection.maxDivergenceBps),
    },
  });
}
