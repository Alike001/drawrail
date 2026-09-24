"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import {
  StandardConnect,
  StandardDisconnect,
  StandardEvents,
  type StandardConnectFeature,
  type StandardDisconnectFeature,
  type StandardEventsFeature,
} from "@wallet-standard/features";
import { SolanaSignTransaction, type SolanaSignTransactionFeature } from "@solana/wallet-standard-features";

export const SOLANA_MAINNET_CHAIN = "solana:mainnet";

type DrawRailWallet = Wallet & {
  features: Wallet["features"] & StandardConnectFeature & StandardEventsFeature & SolanaSignTransactionFeature & Partial<StandardDisconnectFeature>;
};

export type ConnectedWallet = Readonly<{
  name: string;
  address: string;
  wallet: DrawRailWallet;
  account: WalletAccount;
}>;

export function isDrawRailWallet(wallet: Wallet): wallet is DrawRailWallet {
  const connect = wallet.features[StandardConnect] as StandardConnectFeature[typeof StandardConnect] | undefined;
  const events = wallet.features[StandardEvents] as StandardEventsFeature[typeof StandardEvents] | undefined;
  const signing = wallet.features[SolanaSignTransaction] as SolanaSignTransactionFeature[typeof SolanaSignTransaction] | undefined;
  return wallet.chains.includes(SOLANA_MAINNET_CHAIN)
    && typeof connect?.connect === "function"
    && typeof events?.on === "function"
    && typeof signing?.signTransaction === "function"
    && signing.supportedTransactionVersions.includes(0);
}

export async function connectDrawRailWallet(wallet: Wallet): Promise<ConnectedWallet> {
  if (!isDrawRailWallet(wallet)) throw new Error("This wallet does not support mainnet v0 transaction signing through Wallet Standard.");
  const result = await wallet.features[StandardConnect].connect();
  const account = result.accounts.find((candidate) => candidate.chains.includes(SOLANA_MAINNET_CHAIN)
    && candidate.features.includes(SolanaSignTransaction));
  if (!account) throw new Error("The wallet did not authorize a compatible Solana mainnet account.");
  return { name: wallet.name, address: account.address, wallet, account };
}

export async function disconnectDrawRailWallet(connection: ConnectedWallet): Promise<void> {
  const disconnect = connection.wallet.features[StandardDisconnect] as StandardDisconnectFeature[typeof StandardDisconnect] | undefined;
  if (disconnect) await disconnect.disconnect();
}

export async function signReviewedTransaction(
  connection: ConnectedWallet,
  transactionBase64: string,
): Promise<string> {
  const transaction = base64ToBytes(transactionBase64);
  const [result] = await connection.wallet.features[SolanaSignTransaction].signTransaction({
    account: connection.account,
    chain: SOLANA_MAINNET_CHAIN,
    transaction,
  });
  if (!result?.signedTransaction?.length) throw new Error("The wallet did not return a signed transaction.");
  return bytesToBase64(result.signedTransaction);
}

export function walletIdentityChanged(previous: string | null, next: string | null) {
  return previous !== next;
}

export function useWalletStandard() {
  const [wallets, setWallets] = useState<readonly Wallet[]>([]);
  const [connection, setConnection] = useState<ConnectedWallet | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const registry = getWallets();
    const refresh = () => setWallets(registry.get());
    refresh();
    const offRegister = registry.on("register", refresh);
    const offUnregister = registry.on("unregister", refresh);
    return () => { offRegister(); offUnregister(); };
  }, []);

  useEffect(() => {
    if (!connection) return;
    return connection.wallet.features[StandardEvents].on("change", ({ accounts }) => {
      if (!accounts) return;
      const account = accounts.find((candidate) => candidate.chains.includes(SOLANA_MAINNET_CHAIN)
        && candidate.features.includes(SolanaSignTransaction));
      setConnection(account ? { ...connection, address: account.address, account } : null);
    });
  }, [connection]);

  const compatibleWallets = useMemo(() => wallets.filter(isDrawRailWallet), [wallets]);

  const connect = useCallback(async (wallet: Wallet) => {
    setConnecting(wallet.name);
    setError(null);
    try {
      const result = await connectDrawRailWallet(wallet);
      setConnection(result);
      return result;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Wallet connection failed.";
      setError(message);
      return null;
    } finally {
      setConnecting(null);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (connection) await disconnectDrawRailWallet(connection);
    setConnection(null);
    setError(null);
  }, [connection]);

  return { wallets: compatibleWallets, connection, connecting, error, connect, disconnect };
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}
