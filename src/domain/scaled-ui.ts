import Decimal from "decimal.js";
import {
  amountToUiAmountForScaledUiAmountMintWithoutSimulation,
  uiAmountToAmountForScaledUiAmountMintWithoutSimulation,
} from "@solana-program/token-2022";
import {
  displayedAmount,
  multiplier,
  rawTokenAmount,
  type DisplayedAmount,
  type Multiplier,
  type RawTokenAmount,
  type TokenDecimals,
  type UnixTimestampSeconds,
} from "./types";

Decimal.set({ precision: 80, rounding: Decimal.ROUND_HALF_EVEN });

export type ScaledUiState = Readonly<{
  oldMultiplier: Multiplier;
  newMultiplier: Multiplier;
  activationTimestamp: UnixTimestampSeconds;
}>;

export function activeMultiplier(
  state: ScaledUiState,
  now: UnixTimestampSeconds,
): Multiplier {
  return state.activationTimestamp !== 0n && now >= state.activationTimestamp
    ? state.newMultiplier
    : state.oldMultiplier;
}

export function isInActivationWindow(
  activation: UnixTimestampSeconds,
  now: UnixTimestampSeconds,
  windowSeconds = 900n,
): boolean {
  if (activation === 0n) return false;
  const distance = activation >= now ? activation - now : now - activation;
  return distance <= windowSeconds;
}

export function rawToDisplayedHighPrecision(
  raw: RawTokenAmount,
  decimals: TokenDecimals,
  active: Multiplier,
): DisplayedAmount {
  const value = new Decimal(raw.toString())
    .mul(active)
    .div(new Decimal(10).pow(decimals.toString()));
  const fixed = value.toFixed(Number(decimals), Decimal.ROUND_HALF_EVEN);
  const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
  return displayedAmount(trimmed);
}

export function rawToDisplayedOfficial(
  raw: RawTokenAmount,
  decimals: TokenDecimals,
  active: Multiplier,
): DisplayedAmount {
  const value = amountToUiAmountForScaledUiAmountMintWithoutSimulation(
    raw,
    Number(decimals),
    Number(active),
  );
  return displayedAmount(value);
}

export function displayedToConservativeRaw(
  intended: DisplayedAmount,
  decimals: TokenDecimals,
  active: Multiplier,
): RawTokenAmount {
  const factor = new Decimal(10).pow(decimals.toString());
  let candidate = rawTokenAmount(
    new Decimal(intended).div(active).mul(factor).floor().toFixed(0),
  );
  const officialCandidate = rawTokenAmount(
    uiAmountToAmountForScaledUiAmountMintWithoutSimulation(
      intended,
      Number(decimals),
      Number(active),
    ),
  );
  if (candidate !== officialCandidate) {
    throw new Error(
      `Scaled UI conversion parity mismatch: highPrecision=${candidate} official=${officialCandidate}`,
    );
  }
  while (new Decimal(rawToDisplayedOfficial(candidate, decimals, active)).gt(intended)) {
    if (candidate === 0n) throw new Error("Unable to find conservative raw amount");
    candidate = rawTokenAmount(candidate - 1n);
  }
  return candidate;
}

export function assertRawDisplayParity(
  raw: RawTokenAmount,
  decimals: TokenDecimals,
  active: Multiplier,
): DisplayedAmount {
  const highPrecision = rawToDisplayedHighPrecision(raw, decimals, active);
  const official = rawToDisplayedOfficial(raw, decimals, active);
  if (!new Decimal(highPrecision).eq(official)) {
    throw new Error(
      `Scaled UI display parity mismatch: highPrecision=${highPrecision} official=${official}`,
    );
  }
  return official;
}

export const scaledUiState = (
  oldValue: string,
  newValue: string,
  activationTimestamp: UnixTimestampSeconds,
): ScaledUiState => ({
  oldMultiplier: multiplier(oldValue),
  newMultiplier: multiplier(newValue),
  activationTimestamp,
});
