import { describe, expect, it } from "vitest";
import {
  activeMultiplier,
  assertRawDisplayParity,
  displayedToConservativeRaw,
  isInActivationWindow,
  rawToDisplayedOfficial,
  scaledUiState,
} from "./scaled-ui";
import {
  displayedAmount,
  rawTokenAmount,
  tokenDecimals,
  unixTimestampSeconds,
} from "./types";

const state = scaledUiState(
  "1.0026642075893797",
  "1.0032690125398187",
  unixTimestampSeconds(2_000),
);

describe("Scaled UI multiplier selection", () => {
  it("uses the old multiplier before activation", () => {
    expect(activeMultiplier(state, unixTimestampSeconds(1_999))).toBe("1.0026642075893797");
  });

  it("uses the new multiplier exactly at activation", () => {
    expect(activeMultiplier(state, unixTimestampSeconds(2_000))).toBe("1.0032690125398187");
  });

  it("uses the new multiplier after activation", () => {
    expect(activeMultiplier(state, unixTimestampSeconds(2_001))).toBe("1.0032690125398187");
  });
});

describe("inclusive activation window", () => {
  it.each([
    [1_099, false],
    [1_100, true],
    [1_999, true],
    [2_000, true],
    [2_900, true],
    [2_901, false],
  ])("classifies now=%i", (now, expected) => {
    expect(isInActivationWindow(
      unixTimestampSeconds(2_000),
      unixTimestampSeconds(now),
      900n,
    )).toBe(expected);
  });

  it("never blocks a zero activation timestamp", () => {
    expect(isInActivationWindow(unixTimestampSeconds(0), unixTimestampSeconds(0))).toBe(false);
  });
});

describe("raw and displayed conversion parity", () => {
  const decimals = tokenDecimals(8);
  const active = state.newMultiplier;

  it("converts raw to displayed using official behavior", () => {
    expect(rawToDisplayedOfficial(rawTokenAmount(1_000_000n), decimals, active))
      .toBe("0.01003269");
  });

  it("converts a displayed reduction to a conservative raw integer", () => {
    const raw = displayedToConservativeRaw(displayedAmount("0.01"), decimals, active);
    expect(raw).toBe(996_741n);
    expect(Number(rawToDisplayedOfficial(raw, decimals, active))).toBeLessThanOrEqual(0.01);
  });

  it("matches the official helper at zero and boundary-shaped inputs", () => {
    for (const raw of [0n, 1n, 99_999_999n, 100_000_000n, 999_999_999_999_999n]) {
      expect(() => assertRawDisplayParity(rawTokenAmount(raw), decimals, active)).not.toThrow();
    }
  });

  it("preserves precision for balances larger than normal demo values", () => {
    expect(assertRawDisplayParity(rawTokenAmount(1_000_000_000_000_000n), decimals, active))
      .toBe("10032690.12539819");
  });

  it("rejects malformed negative raw and displayed values", () => {
    expect(() => rawTokenAmount(-1n)).toThrow();
    expect(() => displayedToConservativeRaw(displayedAmount("not-a-number"), decimals, active)).toThrow();
  });
});
