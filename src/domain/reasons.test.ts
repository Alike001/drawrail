import { describe, expect, it } from "vitest";
import { REASON_CODES, REASON_COPY } from "./reasons";

describe("stable policy reason vocabulary", () => {
  it("keeps every required reason code mapped to interface copy", () => {
    expect(REASON_CODES).toEqual([
      "TARGET_ALREADY_MET", "ZERO_BALANCE", "UNSUPPORTED_ASSET_STATE", "MULTIPLIER_WINDOW",
      "INSUFFICIENT_POSITION", "RETAINED_FLOOR", "NO_JUPITER_ROUTE", "QUOTE_EXPIRED",
      "SLIPPAGE_LIMIT", "RPC_STALE", "QUOTE_SEARCH_EXHAUSTED", "ELIGIBLE", "SELECTED",
      "LOWER_RANKED", "PYTH_NOT_ENABLED",
    ]);
    for (const code of REASON_CODES) expect(REASON_COPY[code].length).toBeGreaterThan(12);
  });
});
