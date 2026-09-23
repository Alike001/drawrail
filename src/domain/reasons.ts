export const REASON_CODES = [
  "TARGET_ALREADY_MET",
  "ZERO_BALANCE",
  "UNSUPPORTED_ASSET_STATE",
  "MULTIPLIER_WINDOW",
  "INSUFFICIENT_POSITION",
  "RETAINED_FLOOR",
  "NO_JUPITER_ROUTE",
  "QUOTE_EXPIRED",
  "SLIPPAGE_LIMIT",
  "RPC_STALE",
  "QUOTE_SEARCH_EXHAUSTED",
  "ELIGIBLE",
  "SELECTED",
  "LOWER_RANKED",
  "PYTH_NOT_ENABLED",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export const REASON_COPY: Readonly<Record<ReasonCode, string>> = {
  TARGET_ALREADY_MET: "Your existing USDC already covers this request.",
  ZERO_BALANCE: "This supported position is not held in the wallet.",
  UNSUPPORTED_ASSET_STATE: "The live mint state could not be verified safely.",
  MULTIPLIER_WINDOW: "Trading is blocked inside the multiplier activation safety window.",
  INSUFFICIENT_POSITION: "This position cannot supply the missing USDC at the current quote.",
  RETAINED_FLOOR: "Selling enough would leave less exposure than your retained floor.",
  NO_JUPITER_ROUTE: "Jupiter did not return an executable quote for this position.",
  QUOTE_EXPIRED: "The quote expired and the decision must be refreshed.",
  SLIPPAGE_LIMIT: "The returned quote exceeds your maximum slippage.",
  RPC_STALE: "The portfolio snapshot is too old to evaluate safely.",
  QUOTE_SEARCH_EXHAUSTED: "A safe raw input could not be resolved within the quote-search limit.",
  ELIGIBLE: "This position passes the current preservation and execution rules.",
  SELECTED: "Selected by the deterministic portfolio rule.",
  LOWER_RANKED: "Eligible, but ranked behind the selected position.",
  PYTH_NOT_ENABLED: "Pyth reference protection is not enabled in this milestone.",
};
