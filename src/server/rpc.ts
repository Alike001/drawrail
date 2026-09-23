import { address } from "@solana/kit";
import { z } from "zod";
import { SUPPORTED_ASSETS, type AssetDefinition } from "@/domain/assets";
import { rawTokenAmount, unixTimestampSeconds } from "@/domain/types";

const rpcEnvelope = z.object({
  jsonrpc: z.literal("2.0"),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});

let requestId = 0;

export class SolanaRpcClient {
  constructor(private readonly url: string) {
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      throw new Error("SOLANA_RPC_URL must be an HTTP(S) URL");
    }
  }

  async call<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Solana RPC ${method} failed with HTTP ${response.status}`);
    const envelope = rpcEnvelope.parse(await response.json());
    if (envelope.error) {
      throw new Error(`Solana RPC ${method} failed: ${envelope.error.code} ${envelope.error.message}`);
    }
    if (envelope.result === undefined) throw new Error(`Solana RPC ${method} returned no result`);
    return envelope.result as T;
  }
}

const accountInfoResult = z.object({
  context: z.object({ slot: z.number().int().nonnegative() }),
  value: z.object({
    owner: z.string(),
    executable: z.boolean(),
    data: z.object({
      program: z.string(),
      parsed: z.object({
        type: z.string(),
        info: z.record(z.string(), z.unknown()),
      }),
    }),
  }).nullable(),
});

const tokenAccountsResult = z.object({
  context: z.object({ slot: z.number().int().nonnegative() }),
  value: z.array(z.object({
    pubkey: z.string(),
    account: z.object({
      owner: z.string(),
      data: z.object({
        parsed: z.object({
          type: z.literal("account"),
          info: z.object({
            mint: z.string(),
            owner: z.string(),
            tokenAmount: z.object({ amount: z.string().regex(/^\d+$/), decimals: z.number().int() }),
          }),
        }),
      }),
    }),
  })),
});

export type ParsedMint = Readonly<{
  mint: string;
  ownerProgram: string;
  decimals: number;
  slot: number;
  scaledUi: null | {
    oldMultiplier: string;
    newMultiplier: string;
    activationTimestamp: bigint;
  };
}>;

export async function readAndVerifyMint(
  rpc: SolanaRpcClient,
  asset: AssetDefinition,
): Promise<ParsedMint> {
  const parsed = accountInfoResult.parse(await rpc.call("getAccountInfo", [
    asset.mint,
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]));
  if (!parsed.value) throw new Error(`${asset.symbol} mint account is missing`);
  if (parsed.value.owner !== asset.expectedProgram) {
    throw new Error(`${asset.symbol} program mismatch: ${parsed.value.owner}`);
  }
  if (parsed.value.data.parsed.type !== "mint") throw new Error(`${asset.symbol} is not a mint`);
  const info = parsed.value.data.parsed.info;
  const decimals = z.number().int().parse(info.decimals);
  if (decimals !== asset.expectedDecimals) {
    throw new Error(`${asset.symbol} decimals mismatch: ${decimals}`);
  }
  const extensions = z.array(z.object({
    extension: z.string(),
    state: z.record(z.string(), z.unknown()),
  })).default([]).parse(info.extensions);
  const scaled = extensions.find((extension) => extension.extension === "scaledUiAmountConfig");
  if (asset.requiresScaledUiAmount && !scaled) {
    throw new Error(`${asset.symbol} is missing Scaled UI Amount extension`);
  }
  if (!asset.requiresScaledUiAmount && scaled) {
    throw new Error(`${asset.symbol} unexpectedly has Scaled UI Amount extension`);
  }
  const scaledState = scaled
    ? z.object({
        multiplier: z.string().regex(/^\d+(?:\.\d+)?$/),
        newMultiplier: z.string().regex(/^\d+(?:\.\d+)?$/),
        newMultiplierEffectiveTimestamp: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]),
      }).parse(scaled.state)
    : null;
  return {
    mint: asset.mint,
    ownerProgram: parsed.value.owner,
    decimals,
    slot: parsed.context.slot,
    scaledUi: scaledState ? {
      oldMultiplier: scaledState.multiplier,
      newMultiplier: scaledState.newMultiplier,
      activationTimestamp: BigInt(scaledState.newMultiplierEffectiveTimestamp),
    } : null,
  };
}

export type AggregatedBalance = Readonly<{
  mint: string;
  raw: ReturnType<typeof rawTokenAmount>;
  tokenAccountCount: number;
  tokenAccounts: ReadonlyArray<{ address: string; raw: string }>;
  slot: number;
}>;

export async function readAggregatedBalance(
  rpc: SolanaRpcClient,
  wallet: string,
  asset: AssetDefinition,
): Promise<AggregatedBalance> {
  address(wallet);
  const parsed = tokenAccountsResult.parse(await rpc.call("getTokenAccountsByOwner", [
    wallet,
    { mint: asset.mint },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]));
  let total = 0n;
  const accounts = parsed.value.map(({ pubkey, account }) => {
    const info = account.data.parsed.info;
    if (account.owner !== asset.expectedProgram) throw new Error(`${asset.symbol} token account program mismatch`);
    if (info.owner !== wallet || info.mint !== asset.mint || info.tokenAmount.decimals !== asset.expectedDecimals) {
      throw new Error(`${asset.symbol} token account metadata mismatch`);
    }
    const raw = BigInt(info.tokenAmount.amount);
    total += raw;
    return { address: pubkey, raw: raw.toString() };
  });
  return {
    mint: asset.mint,
    raw: rawTokenAmount(total),
    tokenAccountCount: accounts.length,
    tokenAccounts: accounts,
    slot: parsed.context.slot,
  };
}

export async function readChainTime(rpc: SolanaRpcClient) {
  const slot = await rpc.call<number>("getSlot", [{ commitment: "confirmed" }]);
  const timestamp = await rpc.call<number | null>("getBlockTime", [slot]);
  if (timestamp === null || !Number.isSafeInteger(timestamp)) {
    throw new Error("Unable to obtain a safe confirmed block time");
  }
  return { slot, timestamp: unixTimestampSeconds(timestamp) };
}

export async function readPortfolioState(rpc: SolanaRpcClient, wallet: string) {
  address(wallet);
  const [chainTime, ...rows] = await Promise.all([
    readChainTime(rpc),
    ...SUPPORTED_ASSETS.map(async (asset) => ({
      asset,
      mint: await readAndVerifyMint(rpc, asset),
      balance: await readAggregatedBalance(rpc, wallet, asset),
    })),
  ]);
  return { wallet, chainTime, rows };
}
