import type { JupiterFinalOrder } from "@/server/jupiter";
import type { BasisPoints, RawTokenAmount, UsdcRawAmount } from "./types";

export type FinalOrderInvariant = Readonly<{
  code: string;
  status: "passed";
  detail: string;
}>;

export class FinalOrderValidationError extends Error {
  constructor(readonly code: "policy_changed" | "refresh_required" | "transaction_invalid", message: string) {
    super(message);
  }
}

export function validateFinalOrderEconomics(order: JupiterFinalOrder, expected: Readonly<{
  inputMint: string;
  outputMint: string;
  rawInput: RawTokenAmount;
  missingUsdc: UsdcRawAmount;
  maxSlippageBps: BasisPoints;
  retainedExecutableValue: UsdcRawAmount;
  retainedFloor: UsdcRawAmount;
}>): readonly FinalOrderInvariant[] {
  if (order.inputMint !== expected.inputMint) {
    throw new FinalOrderValidationError("transaction_invalid", "The final order uses the wrong input mint.");
  }
  if (order.outputMint !== expected.outputMint) {
    throw new FinalOrderValidationError("transaction_invalid", "The final order does not pay the allowlisted USDC mint.");
  }
  if (BigInt(order.inAmount) !== expected.rawInput) {
    throw new FinalOrderValidationError("policy_changed", "The final order changed the selected raw input amount.");
  }
  if (BigInt(order.otherAmountThreshold) < expected.missingUsdc) {
    throw new FinalOrderValidationError("refresh_required", "The final order minimum no longer covers the missing USDC.");
  }
  if (BigInt(order.outAmount) < BigInt(order.otherAmountThreshold)) {
    throw new FinalOrderValidationError("transaction_invalid", "The final order minimum exceeds its expected output.");
  }
  if (BigInt(order.slippageBps) > expected.maxSlippageBps) {
    throw new FinalOrderValidationError("policy_changed", "The final order exceeds the selected slippage limit.");
  }
  if (order.swapMode !== null && order.swapMode !== "ExactIn") {
    throw new FinalOrderValidationError("transaction_invalid", "The final order is not ExactIn.");
  }
  if (expected.retainedExecutableValue < expected.retainedFloor) {
    throw new FinalOrderValidationError("policy_changed", "The refreshed remaining position no longer preserves its retained floor.");
  }
  return [
    { code: "input-mint", status: "passed", detail: "Selected xStock mint matches the final order" },
    { code: "output-mint", status: "passed", detail: "Output is the allowlisted USDC mint" },
    { code: "raw-input", status: "passed", detail: "Exact selected raw input is unchanged" },
    { code: "minimum-output", status: "passed", detail: "Reviewed minimum covers missing USDC" },
    { code: "slippage", status: "passed", detail: "Final order remains within the slippage policy" },
    { code: "retained-floor", status: "passed", detail: "Refreshed remaining-position quote preserves the floor" },
  ];
}
