import "server-only";
import { ASSET_REGISTRY, XSTOCKS } from "@/domain/assets";
import type { PortfolioSnapshot, PortfolioPosition, UnavailablePosition } from "@/domain/portfolio";
import { activeMultiplier, assertRawDisplayParity, isInActivationWindow, scaledUiState } from "@/domain/scaled-ui";
import { tokenDecimals, unixTimestampSeconds, usdcRawAmount } from "@/domain/types";
import {
  readAggregatedBalance,
  readAndVerifyMint,
  readChainTime,
  SolanaRpcClient,
} from "./rpc";
import type { PythFeatureStatus } from "./pyth/service";

export async function readDecisionPortfolio(
  rpc: SolanaRpcClient,
  wallet: string,
  generatedAt = new Date(),
): Promise<PortfolioSnapshot> {
  const chainTime = await readChainTime(rpc);
  const [usdcMint, usdcBalance] = await Promise.all([
    readAndVerifyMint(rpc, ASSET_REGISTRY.USDC),
    readAggregatedBalance(rpc, wallet, ASSET_REGISTRY.USDC),
  ]);

  const positions = await Promise.all(XSTOCKS.map(async (asset): Promise<PortfolioPosition | UnavailablePosition> => {
    try {
      const [mint, balance] = await Promise.all([
        readAndVerifyMint(rpc, asset),
        readAggregatedBalance(rpc, wallet, asset),
      ]);
      if (!mint.scaledUi) throw new Error("Scaled UI Amount state is missing");
      const scaled = scaledUiState(
        mint.scaledUi.oldMultiplier,
        mint.scaledUi.newMultiplier,
        unixTimestampSeconds(mint.scaledUi.activationTimestamp),
      );
      const active = activeMultiplier(scaled, chainTime.timestamp);
      return {
        symbol: asset.symbol,
        mint: asset.mint,
        tokenProgram: mint.ownerProgram,
        decimals: mint.decimals,
        rawBalance: balance.raw,
        displayedBalance: assertRawDisplayParity(balance.raw, tokenDecimals(mint.decimals), active),
        tokenAccountCount: balance.tokenAccountCount,
        tokenAccounts: balance.tokenAccounts,
        scaledUi: {
          oldMultiplier: scaled.oldMultiplier,
          newMultiplier: scaled.newMultiplier,
          activeMultiplier: active,
          activationTimestamp: scaled.activationTimestamp,
          activationWindowBlocked: isInActivationWindow(
            scaled.activationTimestamp,
            chainTime.timestamp,
            900n,
          ),
        },
        state: "verified",
      };
    } catch (error) {
      return {
        symbol: asset.symbol,
        mint: asset.mint,
        state: "unavailable",
        error: error instanceof Error ? error.message : "Unknown live mint-state error",
      };
    }
  }));

  return {
    wallet,
    generatedAt: generatedAt.toISOString(),
    chainSlot: chainTime.slot,
    chainTime: chainTime.timestamp,
    usdc: {
      mint: ASSET_REGISTRY.USDC.mint,
      tokenProgram: usdcMint.ownerProgram,
      decimals: usdcMint.decimals,
      rawBalance: usdcRawAmount(usdcBalance.raw),
      tokenAccountCount: usdcBalance.tokenAccountCount,
      tokenAccounts: usdcBalance.tokenAccounts,
    },
    positions,
  };
}

export function serializePortfolio(snapshot: PortfolioSnapshot, pyth: PythFeatureStatus) {
  return {
    wallet: snapshot.wallet,
    generatedAt: snapshot.generatedAt,
    network: "solana-mainnet-beta",
    appMode: "mainnet-read-only",
    readOnly: true,
    chainSlot: snapshot.chainSlot,
    chainTime: snapshot.chainTime.toString(),
    pyth,
    usdc: {
      ...snapshot.usdc,
      rawBalance: snapshot.usdc.rawBalance.toString(),
    },
    positions: snapshot.positions.map((position) => position.state === "unavailable" ? position : ({
      ...position,
      rawBalance: position.rawBalance.toString(),
      scaledUi: {
        ...position.scaledUi,
        activationTimestamp: position.scaledUi.activationTimestamp.toString(),
      },
    })),
  };
}
