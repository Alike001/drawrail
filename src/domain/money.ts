import { rawTokenAmount, usdcRawAmount, type RawTokenAmount, type UsdcRawAmount } from "./types";

export function parseDecimalToRaw(value: string, decimals: number): RawTokenAmount {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error("Enter a positive decimal amount");
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) throw new Error(`Use no more than ${decimals} decimal places`);
  const raw = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "");
  return rawTokenAmount(raw || "0");
}

export function parseUsdc(value: string): UsdcRawAmount {
  return usdcRawAmount(parseDecimalToRaw(value, 6));
}

export function formatRawAmount(value: bigint, decimals: number, maxFraction = decimals): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(decimals, "0").slice(0, maxFraction)
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function formatUsdc(value: UsdcRawAmount, maxFraction = 2): string {
  return formatRawAmount(value, 6, maxFraction);
}

export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Division denominator must be positive");
  if (numerator < 0n) throw new Error("Division numerator cannot be negative");
  return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}
