import { describe, expect, it } from "vitest";
import { classifyJupiterEvaluationError } from "./drawdown";

describe("live evaluation failure classification", () => {
  it.each([
    ["Jupiter /order failed with HTTP 401", "JUPITER_AUTH"],
    ["Jupiter /order failed with HTTP 403", "JUPITER_AUTH"],
    ["Jupiter /order failed with HTTP 429", "JUPITER_RATE_LIMIT"],
    ["Jupiter /order transport failed", "JUPITER_UNAVAILABLE"],
    ["No routes found", "JUPITER_UNAVAILABLE"],
  ] as const)("classifies %s", (message, code) => {
    expect(classifyJupiterEvaluationError(new Error(message)).code).toBe(code);
  });
});
