export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type RawTokenAmount = Brand<bigint, "RawTokenAmount">;
export type UsdcRawAmount = Brand<bigint, "UsdcRawAmount">;
export type DisplayedAmount = Brand<string, "DisplayedAmount">;
export type Multiplier = Brand<string, "Multiplier">;
export type BasisPoints = Brand<bigint, "BasisPoints">;
export type UnixTimestampSeconds = Brand<bigint, "UnixTimestampSeconds">;
export type TokenDecimals = Brand<bigint, "TokenDecimals">;

export const rawTokenAmount = (value: bigint | string): RawTokenAmount => {
  const parsed = typeof value === "bigint" ? value : BigInt(value);
  if (parsed < 0n) throw new Error("Raw token amount cannot be negative");
  return parsed as RawTokenAmount;
};

export const usdcRawAmount = (value: bigint | string): UsdcRawAmount =>
  rawTokenAmount(value) as unknown as UsdcRawAmount;

export const multiplier = (value: string): Multiplier => value as Multiplier;
export const displayedAmount = (value: string): DisplayedAmount => value as DisplayedAmount;

export const basisPoints = (value: bigint | string): BasisPoints => {
  const parsed = BigInt(value);
  if (parsed < 0n || parsed > 10_000n) throw new Error("Basis points out of range");
  return parsed as BasisPoints;
};

export const unixTimestampSeconds = (value: bigint | string | number): UnixTimestampSeconds =>
  BigInt(value) as UnixTimestampSeconds;

export const tokenDecimals = (value: bigint | string | number): TokenDecimals => {
  const parsed = BigInt(value);
  if (parsed < 0n || parsed > 255n) throw new Error("Token decimals out of range");
  return parsed as TokenDecimals;
};
