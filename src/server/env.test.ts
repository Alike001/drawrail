import { describe, expect, it } from "vitest";
import { readServerEnv } from "./env";

describe("execution environment gate", () => {
  it("stays disabled when credentials are absent or the public RPC is used", () => {
    expect(readServerEnv({ NODE_ENV: "test" }).executionCredentialsConfigured).toBe(false);
    expect(readServerEnv({
      NODE_ENV: "test",
      SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
      JUPITER_API_KEY: "test-key",
      DECISION_RECEIPT_SECRET: "test-only-receipt-secret-with-at-least-32-bytes",
    }).executionCredentialsConfigured).toBe(false);
  });

  it("requires all three configured production values and keeps funded execution opt-in", () => {
    const env = readServerEnv({
      NODE_ENV: "test",
      SOLANA_RPC_URL: "https://rpc.example.test",
      JUPITER_API_KEY: "test-key",
      DECISION_RECEIPT_SECRET: "test-only-receipt-secret-with-at-least-32-bytes",
    });
    expect(env.executionCredentialsConfigured).toBe(true);
    expect(env.FUNDED_EXECUTION_ENABLED).toBe(false);
  });
});
