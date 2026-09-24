import { z } from "zod";
import { basisPoints, rawTokenAmount, type BasisPoints, type RawTokenAmount } from "@/domain/types";

const stringOrNumber = z.union([z.string(), z.number()]).transform(String);
const optionalStringOrNumber = stringOrNumber.nullish().transform((value) => value ?? null);

const platformFeeSchema = z.object({
  feeBps: stringOrNumber.optional(),
  feeMint: z.string().optional(),
}).passthrough().nullable().optional();

const orderSchema = z.object({
  inAmount: z.string().regex(/^\d+$/),
  outAmount: z.string().regex(/^\d+$/),
  otherAmountThreshold: z.string().regex(/^\d+$/),
  slippageBps: stringOrNumber,
  priceImpact: optionalStringOrNumber,
  priceImpactPct: optionalStringOrNumber,
  router: z.string().nullish(),
  mode: z.string().nullish(),
  swapMode: z.string().nullish(),
  feeBps: optionalStringOrNumber,
  feeMint: z.string().nullish(),
  platformFee: platformFeeSchema,
  expireAt: optionalStringOrNumber,
  requestId: z.string().nullish(),
  inputMint: z.string().optional(),
  outputMint: z.string().optional(),
  transaction: z.string().min(1).nullable().optional(),
}).passthrough();

export type JupiterQuote = Readonly<{
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: string;
  priceImpact: string | null;
  router: string | null;
  mode: string | null;
  swapMode: string | null;
  feeBps: string | null;
  feeMint: string | null;
  platformFee: Record<string, unknown> | null;
  expireAt: string | null;
  requestId: string | null;
}>;

export type JupiterFinalOrder = JupiterQuote & Readonly<{
  inputMint: string;
  outputMint: string;
  transaction: string;
  requestId: string;
}>;

export class JupiterClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async quote(inputMint: string, outputMint: string, amount: RawTokenAmount, slippage: BasisPoints) {
    if (amount <= 0n) throw new Error("Jupiter quote amount must be positive");
    const url = new URL("order", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", amount.toString());
    url.searchParams.set("slippageBps", slippage.toString());
    const parsed = await this.fetchOrder(url);
    if (parsed.transaction !== null && parsed.transaction !== undefined) {
      throw new Error("Quote-only Jupiter request unexpectedly returned a transaction");
    }
    return normalizeQuote(parsed);
  }

  async finalOrder(inputMint: string, outputMint: string, amount: RawTokenAmount, slippage: BasisPoints, taker: string): Promise<JupiterFinalOrder> {
    if (amount <= 0n) throw new Error("Jupiter order amount must be positive");
    const url = new URL("order", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", amount.toString());
    url.searchParams.set("slippageBps", slippage.toString());
    url.searchParams.set("taker", taker);
    const parsed = await this.fetchOrder(url);
    return normalizeFinalOrder(parsed);
  }

  private async fetchOrder(url: URL) {
    const response = await fetch(url, {
      headers: this.apiKey ? { "x-api-key": this.apiKey } : undefined,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new Error(`Jupiter /order failed with HTTP ${response.status}: ${body}`);
    }
    return orderSchema.parse(await response.json());
  }
}

function normalizeQuote(parsed: z.infer<typeof orderSchema>): JupiterQuote {
  return {
    inAmount: parsed.inAmount,
    outAmount: parsed.outAmount,
    otherAmountThreshold: parsed.otherAmountThreshold,
    slippageBps: parsed.slippageBps,
    priceImpact: parsed.priceImpact ?? parsed.priceImpactPct,
    router: parsed.router ?? null,
    mode: parsed.mode ?? null,
    swapMode: parsed.swapMode ?? null,
    feeBps: parsed.feeBps,
    feeMint: parsed.feeMint ?? null,
    platformFee: parsed.platformFee ? { ...parsed.platformFee } : null,
    expireAt: parsed.expireAt,
    requestId: parsed.requestId ?? null,
  };
}

export function parseJupiterQuote(value: unknown): JupiterQuote {
  return normalizeQuote(orderSchema.parse(value));
}

export function parseJupiterFinalOrder(value: unknown): JupiterFinalOrder {
  return normalizeFinalOrder(orderSchema.parse(value));
}

function normalizeFinalOrder(parsed: z.infer<typeof orderSchema>): JupiterFinalOrder {
  if (!parsed.inputMint || !parsed.outputMint || !parsed.transaction || !parsed.requestId) {
    throw new Error("Final Jupiter order is missing transaction-binding fields");
  }
  return {
    ...normalizeQuote(parsed),
    inputMint: parsed.inputMint,
    outputMint: parsed.outputMint,
    transaction: parsed.transaction,
    requestId: parsed.requestId,
  };
}

export async function quoteRetainedPosition(
  client: JupiterClient,
  inputMint: string,
  outputMint: string,
  balance: RawTokenAmount,
  proposedSale: RawTokenAmount,
  slippage: BasisPoints = basisPoints(50n),
) {
  if (proposedSale > balance) throw new Error("Proposed sale exceeds raw balance");
  const retainedRaw = rawTokenAmount(balance - proposedSale);
  return {
    balanceRaw: balance.toString(),
    proposedSaleRaw: proposedSale.toString(),
    retainedRaw: retainedRaw.toString(),
    quote: retainedRaw === 0n ? null : await client.quote(inputMint, outputMint, retainedRaw, slippage),
  };
}
