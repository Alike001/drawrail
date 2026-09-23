import type { XStockSymbol } from "./assets";
import type {
  DisplayedAmount,
  Multiplier,
  RawTokenAmount,
  UnixTimestampSeconds,
  UsdcRawAmount,
} from "./types";

export type VerifiedScaledState = Readonly<{
  oldMultiplier: Multiplier;
  newMultiplier: Multiplier;
  activeMultiplier: Multiplier;
  activationTimestamp: UnixTimestampSeconds;
  activationWindowBlocked: boolean;
}>;

export type PortfolioPosition = Readonly<{
  symbol: XStockSymbol;
  mint: string;
  tokenProgram: string;
  decimals: number;
  rawBalance: RawTokenAmount;
  displayedBalance: DisplayedAmount;
  tokenAccountCount: number;
  tokenAccounts: ReadonlyArray<{ address: string; raw: string }>;
  scaledUi: VerifiedScaledState;
  state: "verified";
}>;

export type UnavailablePosition = Readonly<{
  symbol: XStockSymbol;
  mint: string;
  state: "unavailable";
  error: string;
}>;

export type PortfolioSnapshot = Readonly<{
  wallet: string;
  generatedAt: string;
  chainSlot: number;
  chainTime: UnixTimestampSeconds;
  usdc: Readonly<{
    mint: string;
    tokenProgram: string;
    decimals: number;
    rawBalance: UsdcRawAmount;
    tokenAccountCount: number;
    tokenAccounts: ReadonlyArray<{ address: string; raw: string }>;
  }>;
  positions: ReadonlyArray<PortfolioPosition | UnavailablePosition>;
}>;
