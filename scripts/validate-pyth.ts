import { loadEnvFile } from "node:process";
import https from "node:https";
import { XSTOCK_SYMBOLS } from "../src/domain/assets";
import { fetchLatestPyth, fetchPythCatalog, PythHttpError } from "../src/server/pyth/client";
import { PYTH_SYMBOLS, PYTH_UNIT_ALIGNMENT_VERIFIED } from "../src/server/pyth/config";

try { loadEnvFile(".env.local"); } catch { /* exported variables are also supported */ }

async function main() {
  const apiKey = process.env.PYTH_PRO_API_KEY;
  if (!apiKey) throw new Error("PYTH_PRO_API_KEY is not configured. The key was not read or printed.");
  const catalog = await fetchPythCatalog(ipv4Fetch);
  const bySymbol = new Map(catalog.map((feed) => [feed.symbol, feed]));
  const resolved = new Map(Object.values(PYTH_SYMBOLS).flatMap((pair) => [pair.representation, pair.reference]).map((symbol) => {
    const feed = bySymbol.get(symbol);
    if (!feed) throw new Error(`Required Pyth feed missing: ${symbol}`);
    return [symbol, feed] as const;
  }));
  const observations = new Map<number, Awaited<ReturnType<typeof fetchLatestPyth>>[number]>();
  const feeds = [];
  for (const metadata of resolved.values()) {
    try {
      const [observation] = await fetchLatestPyth(apiKey, [metadata], ipv4Fetch);
      if (observation) observations.set(metadata.id, observation);
      feeds.push({
        symbol: metadata.symbol,
        feedId: metadata.id,
        catalogState: metadata.state,
        minChannel: metadata.minChannel,
        catalogMinPublishers: metadata.minPublishers,
        marketSessionMinPublishers: metadata.marketSessionMinPublishers,
        entitlement: observation ? "accessible" : "feed_missing",
        observation: observation ? {
          price: observation.price,
          exponent: observation.exponent,
          confidence: observation.confidence,
          publisherCount: observation.publisherCount,
          marketSession: observation.marketSession,
          timestampUs: observation.timestampUs,
          feedUpdateTimestamp: observation.feedUpdateTimestamp,
          ageUs: (BigInt(observation.timestampUs) - BigInt(observation.feedUpdateTimestamp)).toString(),
          channel: observation.channel,
        } : null,
      });
    } catch (error) {
      feeds.push({
        symbol: metadata.symbol,
        feedId: metadata.id,
        catalogState: metadata.state,
        minChannel: metadata.minChannel,
        catalogMinPublishers: metadata.minPublishers,
        marketSessionMinPublishers: metadata.marketSessionMinPublishers,
        entitlement: error instanceof PythHttpError && error.status === 403 ? "denied_403" : "unavailable",
        observation: null,
      });
    }
  }
  const pairs = XSTOCK_SYMBOLS.map((symbol) => {
    const names = PYTH_SYMBOLS[symbol];
    const representation = resolved.get(names.representation)!;
    const reference = resolved.get(names.reference)!;
    return {
      symbol,
      representationFeedId: representation.id,
      referenceFeedId: reference.id,
      bothAccessible: observations.has(representation.id) && observations.has(reference.id),
      displayedUnitAlignment: PYTH_UNIT_ALIGNMENT_VERIFIED[symbol] ? "verified" : "unverified",
      divergenceBps: null,
    };
  });
  const report = {
    generatedAt: new Date().toISOString(),
    api: "Pyth Pro REST POST /v1/latest_price",
    channel: "fixed_rate@200ms",
    keyConfigured: true,
    feeds,
    pairs,
    demoReady: feeds.every((feed) => feed.entitlement === "accessible")
      && pairs.every((pair) => pair.displayedUnitAlignment === "verified"),
    note: "No API key, authorization header, or upstream error body is included.",
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const ipv4Fetch = ((input: string | URL | Request, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
  const url = input instanceof Request ? input.url : input.toString();
  const request = https.request(url, {
    method: init?.method ?? "GET",
    headers: init?.headers as Record<string, string> | undefined,
    family: 4,
    timeout: 10_000,
  }, (response) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("end", () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode ?? 500, headers: response.headers as HeadersInit })));
  });
  request.on("timeout", () => request.destroy(new Error("Pyth request timed out")));
  request.on("error", reject);
  if (typeof init?.body === "string") request.write(init.body);
  request.end();
})) as typeof fetch;

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Pyth validation failed"}\n`);
  process.exitCode = 1;
});
