import Decimal from "decimal.js";
import { ASSET_REGISTRY, XSTOCKS } from "@/domain/assets";
import {
  activeMultiplier,
  assertRawDisplayParity,
  isInActivationWindow,
  scaledUiState,
} from "@/domain/scaled-ui";
import { basisPoints, rawTokenAmount, tokenDecimals, unixTimestampSeconds } from "@/domain/types";
import { JupiterClient, quoteRetainedPosition } from "./jupiter";
import { readPortfolioState, SolanaRpcClient } from "./rpc";

export type ValidationOptions = Readonly<{
  wallet: string;
  rpcUrl: string;
  jupiterBaseUrl?: string;
  jupiterApiKey?: string;
  quoteRawAmount?: bigint;
  slippageBps?: bigint;
  generatedAt?: Date;
}>;

export async function createMainnetCorrectnessReport(options: ValidationOptions) {
  const rpc = new SolanaRpcClient(options.rpcUrl);
  const jupiter = new JupiterClient(
    options.jupiterBaseUrl ?? "https://api.jup.ag/swap/v2",
    options.jupiterApiKey,
  );
  const quoteRaw = rawTokenAmount(options.quoteRawAmount ?? 1_000_000n);
  const slippage = basisPoints(options.slippageBps ?? 50n);
  const portfolio = await readPortfolioState(rpc, options.wallet);

  const assets = portfolio.rows.map(({ asset, mint, balance }) => {
    if (!mint.scaledUi) {
      const display = new Decimal(balance.raw.toString())
        .div(new Decimal(10).pow(mint.decimals))
        .toFixed(mint.decimals)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
      return {
        symbol: asset.symbol,
        mint: asset.mint,
        verifiedProgram: mint.ownerProgram,
        verifiedDecimals: mint.decimals,
        rawBalance: balance.raw.toString(),
        displayedBalance: display || "0",
        tokenAccountCount: balance.tokenAccountCount,
        tokenAccounts: balance.tokenAccounts,
        scaledUi: null,
      };
    }
    const state = scaledUiState(
      mint.scaledUi.oldMultiplier,
      mint.scaledUi.newMultiplier,
      unixTimestampSeconds(mint.scaledUi.activationTimestamp),
    );
    const active = activeMultiplier(state, portfolio.chainTime.timestamp);
    const displayed = assertRawDisplayParity(balance.raw, tokenDecimals(mint.decimals), active);
    return {
      symbol: asset.symbol,
      mint: asset.mint,
      verifiedProgram: mint.ownerProgram,
      verifiedDecimals: mint.decimals,
      rawBalance: balance.raw.toString(),
      displayedBalance: displayed,
      tokenAccountCount: balance.tokenAccountCount,
      tokenAccounts: balance.tokenAccounts,
      scaledUi: {
        oldMultiplier: state.oldMultiplier,
        newMultiplier: state.newMultiplier,
        activationTimestamp: state.activationTimestamp.toString(),
        activeMultiplier: active,
        safetyWindowSeconds: "900",
        activationWindowBlocked: isInActivationWindow(
          state.activationTimestamp,
          portfolio.chainTime.timestamp,
          900n,
        ),
      },
    };
  });

  const quotes = await Promise.all(XSTOCKS.map(async (asset) => ({
    symbol: asset.symbol,
    quote: await jupiter.quote(asset.mint, ASSET_REGISTRY.USDC.mint, quoteRaw, slippage),
  })));

  const retainedPositionQuotes = await Promise.all(
    portfolio.rows
      .filter(({ asset, balance }) => asset.requiresScaledUiAmount && balance.raw > 1n)
      .map(async ({ asset, balance }) => {
        const proposedSale = rawTokenAmount(balance.raw / 10n > 0n ? balance.raw / 10n : 1n);
        return {
          symbol: asset.symbol,
          ...(await quoteRetainedPosition(
            jupiter,
            asset.mint,
            ASSET_REGISTRY.USDC.mint,
            balance.raw,
            proposedSale,
            slippage,
          )),
        };
      }),
  );

  return {
    reportVersion: 1,
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    network: "solana-mainnet-beta",
    wallet: options.wallet,
    readOnly: true,
    transactionRequested: false,
    transactionExecuted: false,
    chainTime: {
      slot: portfolio.chainTime.slot,
      unixTimestamp: portfolio.chainTime.timestamp.toString(),
    },
    quoteInputRaw: quoteRaw.toString(),
    requestedSlippageBps: slippage.toString(),
    assets,
    quotes,
    retainedPositionQuotes,
  };
}
