import { beforeEach, describe, expect, it } from "vitest";
import { getSubmission, recordSubmission, reserveExecution, resetExecutionStoreForTests } from "./execution-store";

describe("single-instance execution replay protection", () => {
  beforeEach(resetExecutionStoreForTests);

  it("refuses a second reservation even after an unknown result", () => {
    reserveExecution("receipt");
    recordSubmission("receipt", { signature: null, outcome: "unknown" });
    expect(() => reserveExecution("receipt")).toThrow("already been submitted");
    expect(getSubmission("receipt")?.outcome).toBe("unknown");
  });
});
