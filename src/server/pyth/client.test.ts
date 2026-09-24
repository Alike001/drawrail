import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { fetchLatestPyth, fetchPythCatalog } from "./client";
import type { PythFeedMetadata } from "@/domain/pyth";

const feed: PythFeedMetadata = {
  id: 1792, symbol: "Crypto.AAPLX/USD", description: "APPLE XSTOCK / US DOLLAR", exponent: -8,
  minPublishers: 3, minChannel: "fixed_rate@200ms", state: "stable", quoteCurrency: "USD",
  marketSessionMinPublishers: { regular: 3 },
};

describe("Pyth authenticated client", () => {
  it("parses the required latest-price fields and never returns authorization data", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ parsed: { timestampUs: "1790228536200000", priceFeeds: [{
      priceFeedId: 1792, price: "25000000000", exponent: -8, confidence: "100000", publisherCount: 4,
      marketSession: "regular", feedUpdateTimestamp: 1790228536200000,
    }] } }), { status: 200 })) as unknown as typeof fetch;
    const result = await fetchLatestPyth("test-only-secret", [feed], fetcher);
    expect(result[0]).toMatchObject({ symbol: feed.symbol, feedId: 1792, channel: "fixed_rate@200ms" });
    expect(JSON.stringify(result)).not.toContain("test-only-secret");
  });

  it("classifies entitlement and API failures without exposing the upstream body", async () => {
    const denied = vi.fn(async () => new Response("account detail", { status: 403 })) as unknown as typeof fetch;
    await expect(fetchLatestPyth("test-only-secret", [feed], denied)).rejects.toMatchObject({ status: 403 });
    const unavailable = vi.fn(async () => new Response("internal detail", { status: 503 })) as unknown as typeof fetch;
    await expect(fetchLatestPyth("test-only-secret", [feed], unavailable)).rejects.toMatchObject({ status: 503 });
  });

  it("rejects malformed payloads and safely represents a missing feed", async () => {
    const malformed = vi.fn(async () => new Response(JSON.stringify({ parsed: { timestampUs: 4, priceFeeds: [] } }), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchLatestPyth("test-only-secret", [feed], malformed)).rejects.toThrow();
    const missing = vi.fn(async () => new Response(JSON.stringify({ parsed: { timestampUs: "1790228536200000", priceFeeds: [] } }), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchLatestPyth("test-only-secret", [feed], missing)).resolves.toEqual([]);
  });

  it("parses catalog publisher minima and rejects malformed catalog data", async () => {
    const valid = vi.fn(async () => new Response(JSON.stringify([{
      pyth_lazer_id: 1792, symbol: feed.symbol, description: feed.description, exponent: -8,
      min_publishers: 3, min_channel: "fixed_rate@200ms", state: "stable", quote_currency: "USD",
      market_sessions: { regular: { min_pub: 3 } },
    }]), { status: 200 })) as unknown as typeof fetch;
    expect((await fetchPythCatalog(valid))[0].marketSessionMinPublishers.regular).toBe(3);
    const invalid = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchPythCatalog(invalid)).rejects.toThrow();
  });
});
