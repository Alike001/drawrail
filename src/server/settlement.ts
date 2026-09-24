import "server-only";
import { z } from "zod";
import type { JupiterExecutionResult } from "./jupiter";
import { SolanaRpcClient } from "./rpc";

const tokenBalanceSchema = z.object({
  mint: z.string(),
  owner: z.string().optional(),
  uiTokenAmount: z.object({ amount: z.string().regex(/^\d+$/) }),
});
const transactionSchema = z.object({
  slot: z.number().int().nonnegative(),
  blockTime: z.number().int().nullable().optional(),
  meta: z.object({
    err: z.unknown().nullable(),
    preTokenBalances: z.array(tokenBalanceSchema).nullish(),
    postTokenBalances: z.array(tokenBalanceSchema).nullish(),
  }).nullable(),
}).nullable();

export type SettlementResult = Readonly<{
  status: "confirmed" | "confirmed_needs_investigation" | "failed" | "unknown";
  signature: string;
  slot: string | null;
  blockTime: string | null;
  inputDebit: string | null;
  usdcCredit: string | null;
  jupiterFeeAmount: string | null;
  discrepancies: readonly string[];
}>;

export async function reconcileSettlement(input: Readonly<{
  rpcUrl: string;
  signature: string;
  wallet: string;
  inputMint: string;
  outputMint: string;
  reviewedRawInput: string;
  reviewedMinimumOutput: string;
  feeMint: string | null;
  jupiter: JupiterExecutionResult;
}>): Promise<SettlementResult> {
  const rpc = new SolanaRpcClient(input.rpcUrl);
  const raw = await rpc.call<unknown>("getTransaction", [input.signature, {
    commitment: "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 0,
  }]);
  const transaction = transactionSchema.parse(raw);
  if (!transaction?.meta) return { status: "unknown", signature: input.signature, slot: null, blockTime: null, inputDebit: null, usdcCredit: null, jupiterFeeAmount: null, discrepancies: [] };
  if (transaction.meta.err !== null) {
    return { status: "failed", signature: input.signature, slot: String(transaction.slot), blockTime: transaction.blockTime == null ? null : String(transaction.blockTime), inputDebit: null, usdcCredit: null, jupiterFeeAmount: null, discrepancies: [] };
  }
  const preInput = ownerMintTotal(transaction.meta.preTokenBalances ?? [], input.wallet, input.inputMint);
  const postInput = ownerMintTotal(transaction.meta.postTokenBalances ?? [], input.wallet, input.inputMint);
  const preOutput = ownerMintTotal(transaction.meta.preTokenBalances ?? [], input.wallet, input.outputMint);
  const postOutput = ownerMintTotal(transaction.meta.postTokenBalances ?? [], input.wallet, input.outputMint);
  const inputDebit = preInput - postInput;
  const usdcCredit = postOutput - preOutput;
  const discrepancies: string[] = [];
  if (inputDebit !== BigInt(input.reviewedRawInput)) discrepancies.push("INPUT_DEBIT_MISMATCH");
  if (usdcCredit < BigInt(input.reviewedMinimumOutput)) discrepancies.push("OUTPUT_BELOW_REVIEWED_MINIMUM");
  compareJupiter(input.jupiter.totalInputAmount, inputDebit, "JUPITER_TOTAL_INPUT_MISMATCH", discrepancies);
  compareJupiter(input.jupiter.totalOutputAmount, usdcCredit, "JUPITER_TOTAL_OUTPUT_MISMATCH", discrepancies);
  const jupiterFeeAmount = validateRouteAccounting(input, discrepancies);
  return {
    status: discrepancies.length ? "confirmed_needs_investigation" : "confirmed",
    signature: input.signature,
    slot: String(transaction.slot),
    blockTime: transaction.blockTime == null ? null : String(transaction.blockTime),
    inputDebit: inputDebit.toString(),
    usdcCredit: usdcCredit.toString(),
    jupiterFeeAmount,
    discrepancies,
  };
}

function validateRouteAccounting(
  input: Readonly<{
    inputMint: string;
    outputMint: string;
    feeMint: string | null;
    jupiter: JupiterExecutionResult;
  }>,
  discrepancies: string[],
): string | null {
  const totalInput = optionalBigInt(input.jupiter.totalInputAmount);
  const routeInput = optionalBigInt(input.jupiter.inputAmountResult);
  const totalOutput = optionalBigInt(input.jupiter.totalOutputAmount);
  const routeOutput = optionalBigInt(input.jupiter.outputAmountResult);
  if (input.feeMint === input.inputMint) {
    if (totalInput !== null && routeInput !== null && totalInput < routeInput) discrepancies.push("JUPITER_FEE_ACCOUNTING_MISMATCH");
    if (totalOutput !== null && routeOutput !== null && totalOutput !== routeOutput) discrepancies.push("JUPITER_FEE_ACCOUNTING_MISMATCH");
    return totalInput !== null && routeInput !== null && totalInput >= routeInput ? (totalInput - routeInput).toString() : null;
  }
  if (input.feeMint === input.outputMint) {
    if (totalInput !== null && routeInput !== null && totalInput !== routeInput) discrepancies.push("JUPITER_FEE_ACCOUNTING_MISMATCH");
    if (totalOutput !== null && routeOutput !== null && routeOutput < totalOutput) discrepancies.push("JUPITER_FEE_ACCOUNTING_MISMATCH");
    return totalOutput !== null && routeOutput !== null && routeOutput >= totalOutput ? (routeOutput - totalOutput).toString() : null;
  }
  if (totalInput !== null && routeInput !== null && totalInput !== routeInput) discrepancies.push("JUPITER_FEE_ACCOUNTING_MISMATCH");
  if (totalOutput !== null && routeOutput !== null && totalOutput !== routeOutput) discrepancies.push("JUPITER_FEE_ACCOUNTING_MISMATCH");
  return null;
}

function optionalBigInt(value: string | null): bigint | null {
  return value === null ? null : BigInt(value);
}

function ownerMintTotal(rows: readonly z.infer<typeof tokenBalanceSchema>[], owner: string, mint: string): bigint {
  return rows.reduce((total, row) => row.owner === owner && row.mint === mint ? total + BigInt(row.uiTokenAmount.amount) : total, 0n);
}

function compareJupiter(value: string | null, actual: bigint, code: string, output: string[]): void {
  if (value !== null && BigInt(value) !== actual) output.push(code);
}
