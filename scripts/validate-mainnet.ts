import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMainnetCorrectnessReport } from "../src/server/validation";
import { readServerEnv } from "../src/server/env";

async function main() {
  const wallet = process.argv[2];
  if (!wallet) throw new Error("Usage: npm run validate:mainnet -- <wallet-public-key>");

  const env = readServerEnv();
  const report = await createMainnetCorrectnessReport({
    wallet,
    rpcUrl: env.SOLANA_RPC_URL,
    jupiterBaseUrl: env.JUPITER_BASE_URL,
    jupiterApiKey: env.JUPITER_API_KEY,
  });

  const directory = resolve("validation-artifacts");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const safeTimestamp = report.generatedAt.replaceAll(":", "-");
  const outputPath = resolve(directory, `drawrail-mainnet-report-${safeTimestamp}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.stderr.write(`Saved local read-only report to ${outputPath}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
