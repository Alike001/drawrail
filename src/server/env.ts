import { z } from "zod";

const envSchema = z.object({
  SOLANA_RPC_URL: z.string().url().default("https://api.mainnet-beta.solana.com"),
  JUPITER_API_KEY: z.string().min(1).optional(),
  JUPITER_BASE_URL: z.string().url().default("https://api.jup.ag/swap/v2"),
  PYTH_PRO_API_KEY: z.string().min(1).optional(),
  PYTH_POLICY_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  PYTH_MAX_FEED_AGE_MS: z.string().regex(/^\d+$/).default("5000").transform(BigInt),
  PYTH_MAX_CONFIDENCE_BPS: z.string().regex(/^\d+$/).default("100").transform(BigInt),
  PYTH_CLOCK_SKEW_MS: z.string().regex(/^\d+$/).default("1000").transform(BigInt),
  NEXT_PUBLIC_APP_MODE: z.enum(["synthetic-devnet", "mainnet-read-only", "mainnet-funded"])
    .default("mainnet-read-only"),
  NEXT_PUBLIC_READ_ONLY_WALLET: z.string().optional(),
});

export function readServerEnv(source: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(source);
}
