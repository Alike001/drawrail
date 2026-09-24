export const TOKEN_PROGRAM_ADDRESS = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ADDRESS = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ASSET_REGISTRY_VERSION = "drawrail-mainnet-v1-2026-09-24";

export type SupportedSymbol = "AAPLx" | "NVDAx" | "TSLAx" | "USDC";
export type XStockSymbol = Exclude<SupportedSymbol, "USDC">;

export type AssetDefinition = Readonly<{
  symbol: SupportedSymbol;
  mint: string;
  expectedProgram: typeof TOKEN_PROGRAM_ADDRESS | typeof TOKEN_2022_PROGRAM_ADDRESS;
  expectedDecimals: number;
  requiresScaledUiAmount: boolean;
}>;

export const ASSET_REGISTRY = {
  AAPLx: {
    symbol: "AAPLx",
    mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    expectedProgram: TOKEN_2022_PROGRAM_ADDRESS,
    expectedDecimals: 8,
    requiresScaledUiAmount: true,
  },
  NVDAx: {
    symbol: "NVDAx",
    mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    expectedProgram: TOKEN_2022_PROGRAM_ADDRESS,
    expectedDecimals: 8,
    requiresScaledUiAmount: true,
  },
  TSLAx: {
    symbol: "TSLAx",
    mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    expectedProgram: TOKEN_2022_PROGRAM_ADDRESS,
    expectedDecimals: 8,
    requiresScaledUiAmount: true,
  },
  USDC: {
    symbol: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    expectedProgram: TOKEN_PROGRAM_ADDRESS,
    expectedDecimals: 6,
    requiresScaledUiAmount: false,
  },
} as const satisfies Record<SupportedSymbol, AssetDefinition>;

export const XSTOCKS = [ASSET_REGISTRY.AAPLx, ASSET_REGISTRY.NVDAx, ASSET_REGISTRY.TSLAx] as const;
export const XSTOCK_SYMBOLS = ["AAPLx", "NVDAx", "TSLAx"] as const satisfies readonly XStockSymbol[];
export const SUPPORTED_ASSETS = Object.values(ASSET_REGISTRY);

export function assetByMint(mint: string): AssetDefinition {
  const asset = SUPPORTED_ASSETS.find((candidate) => candidate.mint === mint);
  if (!asset) throw new Error(`Unsupported mint: ${mint}`);
  return asset;
}
