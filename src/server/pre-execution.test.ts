import { describe, expect, it } from "vitest";
import { unixTimestampSeconds } from "@/domain/types";
import { assertMultiplierUnchangedAndSafe } from "./pre-execution";

const state = { active: "1", old: "1", next: "1.01", activationTimestamp: "2000" };

describe("last-moment multiplier revalidation", () => {
  it("accepts unchanged state outside the activation window", () => {
    expect(() => assertMultiplierUnchangedAndSafe(state, state, unixTimestampSeconds(1000))).not.toThrow();
  });

  it("blocks a multiplier change after signing", () => {
    expect(() => assertMultiplierUnchangedAndSafe(state, { ...state, active: "1.01" }, unixTimestampSeconds(3000))).toThrow("changed");
  });

  it("blocks entering the inclusive activation window after signing", () => {
    expect(() => assertMultiplierUnchangedAndSafe(state, state, unixTimestampSeconds(1100))).toThrow("activation");
    expect(() => assertMultiplierUnchangedAndSafe(state, state, unixTimestampSeconds(2900))).toThrow("activation");
  });
});
