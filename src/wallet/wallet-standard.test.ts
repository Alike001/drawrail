import { describe, expect, it, vi } from "vitest";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect, StandardDisconnect, StandardEvents } from "@wallet-standard/features";
import { SolanaSignTransaction } from "@solana/wallet-standard-features";
import {
  connectDrawRailWallet,
  disconnectDrawRailWallet,
  isDrawRailWallet,
  walletIdentityChanged,
} from "./wallet-standard";

const account: WalletAccount = {
  address: "2QfBNK2WDwSLoUQRb1zAnp3KM12N9hQ8q6ApwUMnWW2T",
  publicKey: new Uint8Array(32),
  chains: ["solana:mainnet"],
  features: [SolanaSignTransaction],
};

function fixture(supportedTransactionVersions: readonly (0 | "legacy")[] = [0]) {
  const connect = vi.fn(async () => ({ accounts: [account] }));
  const disconnect = vi.fn(async () => undefined);
  const signTransaction = vi.fn();
  const wallet = {
    version: "1.0.0",
    name: "Test Wallet",
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
    chains: ["solana:mainnet"],
    accounts: [],
    features: {
      [StandardConnect]: { version: "1.0.0", connect },
      [StandardDisconnect]: { version: "1.0.0", disconnect },
      [StandardEvents]: { version: "1.0.0", on: vi.fn(() => () => undefined) },
      [SolanaSignTransaction]: { version: "1.0.0", supportedTransactionVersions, signTransaction },
    },
  } as unknown as Wallet;
  return { wallet, connect, disconnect, signTransaction };
}

describe("Wallet Standard connection boundary", () => {
  it("connects a compatible injected wallet without asking it to sign", async () => {
    const { wallet, connect, signTransaction } = fixture();
    expect(isDrawRailWallet(wallet)).toBe(true);
    const result = await connectDrawRailWallet(wallet);
    expect(result.address).toBe(account.address);
    expect(result.name).toBe("Test Wallet");
    expect(connect).toHaveBeenCalledOnce();
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("disconnects through the wallet feature", async () => {
    const { wallet, disconnect } = fixture();
    const connection = await connectDrawRailWallet(wallet);
    await disconnectDrawRailWallet(connection);
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("rejects wallets without v0 transaction support", () => {
    const { wallet } = fixture(["legacy"]);
    expect(isDrawRailWallet(wallet)).toBe(false);
  });

  it("distinguishes wallet changes from stable and disconnected state", () => {
    expect(walletIdentityChanged(account.address, account.address)).toBe(false);
    expect(walletIdentityChanged(account.address, "wallet-b")).toBe(true);
    expect(walletIdentityChanged(account.address, null)).toBe(true);
  });
});
