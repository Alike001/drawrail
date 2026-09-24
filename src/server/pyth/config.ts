import type { XStockSymbol } from "@/domain/assets";

export const PYTH_CATALOG_URL = "https://pyth.dourolabs.app/v1/symbols";
export const PYTH_REST_URL = "https://pyth-lazer.dourolabs.app/v1/latest_price";
export const PYTH_CHANNEL = "fixed_rate@200ms";

export const PYTH_SYMBOLS: Readonly<Record<XStockSymbol, Readonly<{ representation: string; reference: string }>>> = {
  AAPLx: { representation: "Crypto.AAPLX/USD", reference: "Equity.US.AAPL/USD" },
  NVDAx: { representation: "Crypto.NVDAX/USD", reference: "Equity.US.NVDA/USD" },
  TSLAx: { representation: "Crypto.TSLAX/USD", reference: "Equity.US.TSLA/USD" },
};
