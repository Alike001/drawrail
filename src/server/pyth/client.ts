import { z } from "zod";
import type { PythFeedMetadata, PythObservation } from "@/domain/pyth";
import { PYTH_CATALOG_URL, PYTH_CHANNEL, PYTH_REST_URL } from "./config";

const catalogSchema = z.array(z.object({
  pyth_lazer_id: z.number().int().nonnegative(),
  symbol: z.string(),
  description: z.string(),
  exponent: z.number().int(),
  min_publishers: z.number().int().nonnegative(),
  min_channel: z.string(),
  state: z.string(),
  quote_currency: z.string(),
  market_sessions: z.record(z.string(), z.object({ min_pub: z.number().int().nonnegative() })).default({}),
}));

const latestSchema = z.object({
  parsed: z.object({
    timestampUs: z.string().regex(/^\d+$/),
    priceFeeds: z.array(z.object({
      priceFeedId: z.number().int().nonnegative(),
      price: z.string().regex(/^-?\d+$/),
      exponent: z.number().int(),
      confidence: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative().safe()]).transform(String),
      publisherCount: z.number().int().nonnegative(),
      marketSession: z.string(),
      feedUpdateTimestamp: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative().safe()]).transform(String),
    })),
  }),
});

export class PythHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function fetchPythCatalog(fetcher: typeof fetch = fetch): Promise<PythFeedMetadata[]> {
  const response = await fetcher(PYTH_CATALOG_URL, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new PythHttpError(response.status, "Pyth catalog unavailable");
  return catalogSchema.parse(await response.json()).map((feed) => ({
    id: feed.pyth_lazer_id,
    symbol: feed.symbol,
    description: feed.description,
    exponent: feed.exponent,
    minPublishers: feed.min_publishers,
    minChannel: feed.min_channel,
    state: feed.state,
    quoteCurrency: feed.quote_currency,
    marketSessionMinPublishers: Object.fromEntries(Object.entries(feed.market_sessions).map(([session, value]) => [session, value.min_pub])),
  }));
}

export async function fetchLatestPyth(
  apiKey: string,
  feeds: readonly PythFeedMetadata[],
  fetcher: typeof fetch = fetch,
): Promise<PythObservation[]> {
  const response = await fetcher(PYTH_REST_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      priceFeedIds: feeds.map((feed) => feed.id),
      properties: ["price", "publisherCount", "exponent", "confidence", "marketSession", "feedUpdateTimestamp"],
      formats: [],
      channel: PYTH_CHANNEL,
      parsed: true,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new PythHttpError(response.status, response.status === 403 ? "Pyth entitlement denied" : "Pyth latest-price request failed");
  const payload = latestSchema.parse(await response.json());
  const metadataById = new Map(feeds.map((feed) => [feed.id, feed]));
  return payload.parsed.priceFeeds.map((feed) => {
    const metadata = metadataById.get(feed.priceFeedId);
    if (!metadata) throw new Error("Pyth returned an unexpected feed");
    return {
      feedId: feed.priceFeedId,
      symbol: metadata.symbol,
      price: feed.price,
      exponent: feed.exponent,
      confidence: feed.confidence,
      publisherCount: feed.publisherCount,
      marketSession: feed.marketSession,
      timestampUs: payload.parsed.timestampUs,
      feedUpdateTimestamp: feed.feedUpdateTimestamp,
      channel: PYTH_CHANNEL,
    };
  });
}
