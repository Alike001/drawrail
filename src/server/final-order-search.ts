import "server-only";
import type { BasisPoints, RawTokenAmount } from "@/domain/types";
import { rawTokenAmount, usdcRawAmount, type UsdcRawAmount } from "@/domain/types";
import type { JupiterFinalOrder } from "./jupiter";

export type FinalOrderProvider = Readonly<{
  finalOrder: (
    inputMint: string,
    outputMint: string,
    amount: RawTokenAmount,
    slippage: BasisPoints,
    taker: string,
  ) => Promise<JupiterFinalOrder>;
}>;

export type FinalOrderSearchResult = Readonly<{
  order: JupiterFinalOrder;
  rawInput: RawTokenAmount;
  attempts: number;
  initialRawInput: string;
  initialMinimumOutput: string;
}>;

export async function findCoveringFinalOrder(input: Readonly<{
  provider: FinalOrderProvider;
  inputMint: string;
  outputMint: string;
  initialRawInput: RawTokenAmount;
  maximumRawInput: RawTokenAmount;
  requiredMinimumOutput: UsdcRawAmount;
  slippageBps: BasisPoints;
  taker: string;
  maxAttempts?: number;
}>): Promise<FinalOrderSearchResult> {
  const maxAttempts = input.maxAttempts ?? 5;
  if (maxAttempts < 1 || maxAttempts > 8) throw new Error("Final-order search attempt limit is invalid");
  let rawInput = input.initialRawInput;
  let initialMinimumOutput: string | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const order = await input.provider.finalOrder(
      input.inputMint,
      input.outputMint,
      rawInput,
      input.slippageBps,
      input.taker,
    );
    if (order.inAmount !== rawInput.toString()) throw new Error("Final Jupiter order changed the requested raw input");
    initialMinimumOutput ??= order.otherAmountThreshold;
    const minimumOutput = usdcRawAmount(order.otherAmountThreshold);
    if (minimumOutput >= input.requiredMinimumOutput) {
      return {
        order,
        rawInput,
        attempts: attempt,
        initialRawInput: input.initialRawInput.toString(),
        initialMinimumOutput,
      };
    }
    if (minimumOutput === 0n || rawInput >= input.maximumRawInput) break;
    const proportional = ceilDiv(rawInput * input.requiredMinimumOutput, minimumOutput);
    const next = proportional > rawInput ? proportional : rawInput + 1n;
    rawInput = rawTokenAmount(next > input.maximumRawInput ? input.maximumRawInput : next);
  }
  throw new Error("No wallet-bound final order covered the required minimum output within the bounded search");
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}
