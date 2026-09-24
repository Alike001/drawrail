import { describe, expect, it, vi } from "vitest";
import { findAssociatedTokenPda } from "@solana-program/token-2022";
import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  blockhash,
  compileTransaction,
  compressTransactionMessageUsingAddressLookupTables,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
} from "@solana/kit";
import { ASSET_REGISTRY } from "@/domain/assets";
import { validateUnsignedJupiterTransaction, type TransactionValidationDependencies } from "./transaction-validator";

const WALLET = address("2QfBNK2WDwSLoUQRb1zAnp3KM12N9hQ8q6ApwUMnWW2T");
const JUPITER = address("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
const LOOKUP = address("3oy9ojnsDzqmMNi87Gs7Hn5v3MPVqnWjG9k8BmzKR7yW");
const BLOCKHASH = blockhash("4vAhwGzTFgJgC6pPespe1NwpcBZ4AGoEW8sXbFU1yfhK");

async function fixture(options: { version?: 0 | 1; lookup?: boolean; data?: number } = {}) {
  const inputMint = address(ASSET_REGISTRY.TSLAx.mint);
  const outputMint = address(ASSET_REGISTRY.USDC.mint);
  const [inputAta] = await findAssociatedTokenPda({ owner: WALLET, tokenProgram: address(ASSET_REGISTRY.TSLAx.expectedProgram), mint: inputMint });
  const [outputAta] = await findAssociatedTokenPda({ owner: WALLET, tokenProgram: address(ASSET_REGISTRY.USDC.expectedProgram), mint: outputMint });
  const instruction = {
    programAddress: JUPITER,
    accounts: [
      { address: WALLET, role: AccountRole.WRITABLE_SIGNER },
      { address: inputAta, role: AccountRole.WRITABLE },
      { address: outputAta, role: AccountRole.WRITABLE },
      { address: inputMint, role: AccountRole.READONLY },
      { address: outputMint, role: AccountRole.READONLY },
      { address: address(ASSET_REGISTRY.TSLAx.expectedProgram), role: AccountRole.READONLY },
      { address: address(ASSET_REGISTRY.USDC.expectedProgram), role: AccountRole.READONLY },
    ],
    data: new Uint8Array([options.data ?? 1]),
  };
  const version = options.version ?? 0;
  const baseMessage = pipe(
    createTransactionMessage({ version }),
    (value) => setTransactionMessageFeePayer(WALLET, value),
    (value) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: BLOCKHASH, lastValidBlockHeight: 999n }, value),
    (value) => appendTransactionMessageInstruction(instruction, value),
  );
  const table: Record<Address, Address[]> = { [LOOKUP]: [inputMint, outputMint, inputAta, outputAta] };
  if (options.lookup && version === 0) {
    const compressed = compressTransactionMessageUsingAddressLookupTables(
      baseMessage as Extract<typeof baseMessage, { version: 0 }>,
      table,
    );
    return { transaction: getBase64EncodedWireTransaction(compileTransaction(compressed)), table };
  }
  return { transaction: getBase64EncodedWireTransaction(compileTransaction(baseMessage)), table };
}

function dependencies(table: Readonly<Record<string, readonly string[]>> = {}): TransactionValidationDependencies {
  return {
    resolveLookupTables: async () => table,
    isBlockhashValid: async () => true,
    validatePrograms: async (programs) => { expect(programs).toContain(JUPITER); },
    validateTokenDeltas: async (request) => ({
      inputDebit: request.expectedRawInput.toString(),
      outputCredit: request.minimumOutput.toString(),
    }),
  };
}

const input = (transactionBase64: string) => ({
  transactionBase64,
  wallet: WALLET,
  inputMint: ASSET_REGISTRY.TSLAx.mint,
  outputMint: ASSET_REGISTRY.USDC.mint,
  inputTokenProgram: ASSET_REGISTRY.TSLAx.expectedProgram,
  outputTokenProgram: ASSET_REGISTRY.USDC.expectedProgram,
  expectedRawInput: 123n,
  minimumOutput: 456n,
  rpcUrl: "https://api.test",
});

describe("unsigned Jupiter transaction validation", () => {
  it("deserializes and validates a v0 wallet-bound message", async () => {
    const built = await fixture();
    const result = await validateUnsignedJupiterTransaction(input(built.transaction), dependencies());
    expect(result.version).toBe(0);
    expect(result.walletSignatureIsEmpty).toBe(true);
    expect(result.messageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.inputTokenAccount).toBe("HEt4iSZBgtWAaaUy5A3uWVd3qdAjkyABKubJMoiCyKdD");
    expect(result.simulatedInputDebit).toBe("123");
    expect(result.simulatedOutputCredit).toBe("456");
  });

  it("resolves address lookup tables before validating accounts", async () => {
    const built = await fixture({ lookup: true });
    const result = await validateUnsignedJupiterTransaction(input(built.transaction), dependencies(built.table));
    expect(result.lookupTables).toEqual([LOOKUP]);
    expect(result.resolvedAddressCount).toBeGreaterThan(4);
  });

  it("fails closed when an address lookup table cannot be resolved", async () => {
    const built = await fixture({ lookup: true });
    await expect(validateUnsignedJupiterTransaction(input(built.transaction), dependencies({}))).rejects.toThrow("could not be resolved");
  });

  it("rejects malformed and unsupported transactions", async () => {
    await expect(validateUnsignedJupiterTransaction(input("not base64"), dependencies())).rejects.toThrow("Malformed");
    const versionOne = await fixture({ version: 1 });
    await expect(validateUnsignedJupiterTransaction(input(versionOne.transaction), dependencies())).rejects.toThrow("Unsupported");
  });

  it("rejects a wrong wallet or missing required mint", async () => {
    const built = await fixture();
    await expect(validateUnsignedJupiterTransaction({ ...input(built.transaction), wallet: "11111111111111111111111111111111" }, dependencies())).rejects.toThrow("fee payer");
    await expect(validateUnsignedJupiterTransaction({ ...input(built.transaction), inputMint: ASSET_REGISTRY.AAPLx.mint }, dependencies())).rejects.toThrow("Required transaction account");
  });

  it("hashes identical message bytes identically and modified bytes differently", async () => {
    const first = await fixture({ data: 1 });
    const same = await fixture({ data: 1 });
    const changed = await fixture({ data: 2 });
    const [a, b, c] = await Promise.all([
      validateUnsignedJupiterTransaction(input(first.transaction), dependencies()),
      validateUnsignedJupiterTransaction(input(same.transaction), dependencies()),
      validateUnsignedJupiterTransaction(input(changed.transaction), dependencies()),
    ]);
    expect(a.messageHash).toBe(b.messageHash);
    expect(a.messageHash).not.toBe(c.messageHash);
  });

  it("rejects an expired recent blockhash", async () => {
    const built = await fixture();
    await expect(validateUnsignedJupiterTransaction(input(built.transaction), {
      ...dependencies(), isBlockhashValid: async () => false,
    })).rejects.toThrow("blockhash");
  });

  it("binds simulation to the exact reviewed raw debit and minimum credit", async () => {
    const built = await fixture();
    const validateTokenDeltas = vi.fn(async (request: { expectedRawInput: bigint; minimumOutput: bigint }) => {
      expect(request.expectedRawInput).toBe(123n);
      expect(request.minimumOutput).toBe(456n);
      return { inputDebit: "123", outputCredit: "456" };
    });
    await validateUnsignedJupiterTransaction(input(built.transaction), {
      ...dependencies(),
      validateTokenDeltas,
    });
    expect(validateTokenDeltas).toHaveBeenCalledOnce();
  });
});
