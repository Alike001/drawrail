import { describe, expect, it } from "vitest";
import { formatRawAmount, parseDecimalToRaw, parseUsdc } from "./money";

describe("fixed-point formatting", () => {
  it("parses and formats USDC without number precision loss", () => {
    const raw = parseUsdc("9007199254740993.123456");
    expect(raw).toBe(9_007_199_254_740_993_123_456n);
    expect(formatRawAmount(raw, 6, 6)).toBe("9007199254740993.123456");
  });

  it("rejects excess precision and scientific notation", () => {
    expect(() => parseDecimalToRaw("1.0000001", 6)).toThrow("6 decimal places");
    expect(() => parseUsdc("1e3")).toThrow();
  });
});
