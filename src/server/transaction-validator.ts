import "server-only";
import { createHash } from "node:crypto";
import { findAssociatedTokenPda } from "@solana-program/token-2022";
import {
  address,
  assertIsBlockhash,
  createSolanaRpc,
  fetchAddressesForLookupTables,
  getAccountMetasFromCompiledTransactionMessage,
  getCompiledTransactionMessageDecoder,
  getInstructionsFromCompiledTransactionMessage,
  getTransactionDecoder,
  isSignerRole,
  type Address,
} from "@solana/kit";
import { TOKEN_2022_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS } from "@/domain/assets";
import { SolanaRpcClient } from "./rpc";

type LookupTableMap = Readonly<Record<string, readonly string[]>>;

export type TransactionValidationDependencies = Readonly<{
  resolveLookupTables?: (addresses: readonly string[]) => Promise<LookupTableMap>;
  isBlockhashValid?: (blockhash: string) => Promise<boolean>;
  validatePrograms?: (programs: readonly string[]) => Promise<void>;
  validateTokenDeltas?: (request: SimulationValidationRequest) => Promise<SimulationValidationEvidence>;
}>;

export type SimulationValidationRequest = Readonly<{
  transactionBase64: string;
  inputTokenAccount: string;
  outputTokenAccount: string;
  expectedRawInput: bigint;
  minimumOutput: bigint;
  rpcUrl: string;
}>;

export type SimulationValidationEvidence = Readonly<{
  inputDebit: string;
  outputCredit: string;
}>;

export type TransactionValidationEvidence = Readonly<{
  version: "legacy" | 0;
  recentBlockhash: string;
  messageHash: string;
  transactionBytes: number;
  signatureSlots: number;
  walletSignaturePresent: boolean;
  walletSignatureIsEmpty: boolean;
  signerAddresses: readonly string[];
  additionalSignerAddresses: readonly string[];
  lookupTables: readonly string[];
  resolvedAddressCount: number;
  outerProgramIds: readonly string[];
  inputTokenAccount: string;
  outputTokenAccount: string;
  simulatedInputDebit: string;
  simulatedOutputCredit: string;
  invariants: readonly Readonly<{ code: string; status: "passed"; detail: string }>[];
}>;

export async function validateUnsignedJupiterTransaction(input: Readonly<{
  transactionBase64: string;
  wallet: string;
  inputMint: string;
  outputMint: string;
  inputTokenProgram: string;
  outputTokenProgram: string;
  expectedRawInput: bigint;
  minimumOutput: bigint;
  rpcUrl: string;
}>, dependencies: TransactionValidationDependencies = {}): Promise<TransactionValidationEvidence> {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.transactionBase64)) throw new Error("Malformed base64 transaction");
  const wire = Buffer.from(input.transactionBase64, "base64");
  if (wire.length === 0 || wire.length > 1_232) throw new Error("Transaction wire size is invalid");
  const transaction = getTransactionDecoder().decode(wire);
  const compiled = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  if (compiled.version !== "legacy" && compiled.version !== 0) throw new Error("Unsupported transaction version");
  assertIsBlockhash(compiled.lifetimeToken);

  const lookupTables = compiled.version === 0
    ? (compiled.addressTableLookups ?? []).map((lookup) => lookup.lookupTableAddress)
    : [];
  const tableMap = lookupTables.length === 0
    ? {}
    : await (dependencies.resolveLookupTables ?? defaultLookupResolver(input.rpcUrl))(lookupTables);
  const loaded = compiled.version === 0 ? resolveLoadedAddresses(compiled.addressTableLookups ?? [], tableMap) : undefined;
  const accountMetas = getAccountMetasFromCompiledTransactionMessage(compiled, loaded);
  const instructions = getInstructionsFromCompiledTransactionMessage(compiled, loaded);
  const feePayer = compiled.staticAccounts[0];
  if (feePayer !== input.wallet) throw new Error("Connected wallet is not the transaction fee payer");

  const signerAddresses = accountMetas.filter((meta) => isSignerRole(meta.role)).map((meta) => meta.address);
  if (!signerAddresses.includes(address(input.wallet))) throw new Error("Connected wallet is not a required transaction signer");
  const walletSignature = transaction.signatures[address(input.wallet)];
  if (walletSignature !== null) throw new Error("Jupiter returned a transaction already signed for the connected wallet");

  const accountSet = new Set(accountMetas.map((meta) => meta.address));
  for (const required of [input.inputMint, input.outputMint, input.inputTokenProgram, input.outputTokenProgram]) {
    if (!accountSet.has(address(required))) throw new Error(`Required transaction account is missing: ${required}`);
  }
  const [inputTokenAccount] = await findAssociatedTokenPda({
    owner: address(input.wallet), tokenProgram: address(input.inputTokenProgram), mint: address(input.inputMint),
  });
  const [outputTokenAccount] = await findAssociatedTokenPda({
    owner: address(input.wallet), tokenProgram: address(input.outputTokenProgram), mint: address(input.outputMint),
  });
  if (!accountSet.has(inputTokenAccount)) throw new Error("Wallet input token account is absent from the transaction");
  if (!accountSet.has(outputTokenAccount)) throw new Error("Wallet USDC destination is absent from the transaction");

  const outerProgramIds = [...new Set(instructions.map((instruction) => instruction.programAddress))];
  if (outerProgramIds.length === 0) throw new Error("Transaction contains no executable instructions");
  await (dependencies.validatePrograms ?? defaultProgramValidator(input.rpcUrl))(outerProgramIds);
  const blockhashValid = await (dependencies.isBlockhashValid ?? defaultBlockhashValidator(input.rpcUrl))(compiled.lifetimeToken);
  if (!blockhashValid) throw new Error("Transaction recent blockhash is no longer valid");
  const simulation = await (dependencies.validateTokenDeltas ?? defaultTokenDeltaValidator)({
    transactionBase64: input.transactionBase64,
    inputTokenAccount,
    outputTokenAccount,
    expectedRawInput: input.expectedRawInput,
    minimumOutput: input.minimumOutput,
    rpcUrl: input.rpcUrl,
  });

  return {
    version: compiled.version,
    recentBlockhash: compiled.lifetimeToken,
    messageHash: createHash("sha256").update(Buffer.from(transaction.messageBytes)).digest("hex"),
    transactionBytes: wire.length,
    signatureSlots: Object.keys(transaction.signatures).length,
    walletSignaturePresent: input.wallet in transaction.signatures,
    walletSignatureIsEmpty: walletSignature === null,
    signerAddresses,
    additionalSignerAddresses: signerAddresses.filter((signer) => signer !== input.wallet),
    lookupTables,
    resolvedAddressCount: accountMetas.length,
    outerProgramIds,
    inputTokenAccount,
    outputTokenAccount,
    simulatedInputDebit: simulation.inputDebit,
    simulatedOutputCredit: simulation.outputCredit,
    invariants: [
      { code: "version", status: "passed", detail: `Supported ${compiled.version === "legacy" ? "legacy" : "v0"} message` },
      { code: "fee-payer", status: "passed", detail: "Connected wallet is fee payer and required signer" },
      { code: "unsigned-wallet", status: "passed", detail: "The connected wallet signature slot is empty" },
      { code: "blockhash", status: "passed", detail: "Recent blockhash is present and valid" },
      { code: "lookup-tables", status: "passed", detail: `${lookupTables.length} lookup table(s) resolved` },
      { code: "mints", status: "passed", detail: "Allowlisted input and USDC output mints are referenced" },
      { code: "token-accounts", status: "passed", detail: "Wallet input ATA and USDC destination ATA are referenced" },
      { code: "programs", status: "passed", detail: `${outerProgramIds.length} outer program account(s) are executable` },
      { code: "simulated-token-deltas", status: "passed", detail: "Simulation debits the exact raw input and credits at least the reviewed minimum" },
    ],
  };
}

async function defaultTokenDeltaValidator(request: SimulationValidationRequest): Promise<SimulationValidationEvidence> {
  const rpc = new SolanaRpcClient(request.rpcUrl);
  const before = await rpc.call<{ value: ReadonlyArray<RpcAccountData | null> }>("getMultipleAccounts", [[
    request.inputTokenAccount,
    request.outputTokenAccount,
  ], { encoding: "base64", commitment: "confirmed" }]);
  const simulated = await rpc.call<{ value: {
    err: unknown;
    accounts: ReadonlyArray<RpcAccountData | null> | null;
  } }>("simulateTransaction", [request.transactionBase64, {
    encoding: "base64",
    commitment: "confirmed",
    sigVerify: false,
    replaceRecentBlockhash: true,
    accounts: { encoding: "base64", addresses: [request.inputTokenAccount, request.outputTokenAccount] },
  }]);
  if (simulated.value.err !== null) throw new Error("Unsigned transaction simulation failed");
  if (!simulated.value.accounts || simulated.value.accounts.length !== 2) {
    throw new Error("Unsigned transaction simulation did not return required token accounts");
  }
  const inputDebit = tokenAmount(before.value[0]) - tokenAmount(simulated.value.accounts[0]);
  const outputCredit = tokenAmount(simulated.value.accounts[1]) - tokenAmount(before.value[1]);
  if (inputDebit !== request.expectedRawInput) throw new Error("Simulated input debit does not match the reviewed raw input");
  if (outputCredit < request.minimumOutput) throw new Error("Simulated USDC credit is below the reviewed minimum output");
  return { inputDebit: inputDebit.toString(), outputCredit: outputCredit.toString() };
}

type RpcAccountData = Readonly<{ data: readonly [string, string] }>;

function tokenAmount(account: RpcAccountData | null | undefined): bigint {
  if (!account) return 0n;
  const bytes = Buffer.from(account.data[0], "base64");
  if (bytes.length < 72) throw new Error("Token account data is malformed");
  return bytes.readBigUInt64LE(64);
}

function resolveLoadedAddresses(
  lookups: readonly Readonly<{ lookupTableAddress: Address; writableIndexes: readonly number[]; readonlyIndexes: readonly number[] }>[],
  tables: LookupTableMap,
) {
  const writable: Address[] = [];
  const readonly: Address[] = [];
  for (const lookup of lookups) {
    const entries = tables[lookup.lookupTableAddress];
    if (!entries) throw new Error(`Address lookup table could not be resolved: ${lookup.lookupTableAddress}`);
    for (const index of lookup.writableIndexes) {
      if (!entries[index]) throw new Error("Address lookup writable index is out of range");
      writable.push(address(entries[index]));
    }
    for (const index of lookup.readonlyIndexes) {
      if (!entries[index]) throw new Error("Address lookup readonly index is out of range");
      readonly.push(address(entries[index]));
    }
  }
  return { writable, readonly };
}

function defaultLookupResolver(rpcUrl: string) {
  return async (addresses: readonly string[]): Promise<LookupTableMap> => {
    const typed = addresses.map(address);
    const result = await fetchAddressesForLookupTables(typed, createSolanaRpc(rpcUrl), { commitment: "confirmed" });
    return Object.fromEntries(Object.entries(result).map(([key, values]) => [key, values]));
  };
}

function defaultBlockhashValidator(rpcUrl: string) {
  return async (recentBlockhash: string) => {
    const result = await new SolanaRpcClient(rpcUrl).call<{ value: boolean }>("isBlockhashValid", [
      recentBlockhash,
      { commitment: "confirmed" },
    ]);
    return result.value;
  };
}

function defaultProgramValidator(rpcUrl: string) {
  return async (programs: readonly string[]) => {
    const result = await new SolanaRpcClient(rpcUrl).call<{ value: ReadonlyArray<{ executable: boolean } | null> }>(
      "getMultipleAccounts",
      [programs, { encoding: "base64", commitment: "confirmed" }],
    );
    if (result.value.length !== programs.length || result.value.some((accountInfo) => !accountInfo?.executable)) {
      throw new Error("An outer instruction program is missing or not executable");
    }
  };
}

export const DEFAULT_INPUT_TOKEN_PROGRAM = TOKEN_2022_PROGRAM_ADDRESS;
export const DEFAULT_OUTPUT_TOKEN_PROGRAM = TOKEN_PROGRAM_ADDRESS;
