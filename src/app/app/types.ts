export type PortfolioDto = {
  wallet: string;
  generatedAt: string;
  network: string;
  appMode: string;
  readOnly: true;
  chainSlot: number;
  chainTime: string;
  pyth: {
    service: "disabled" | "available" | "unavailable" | "not_entitled" | "unhealthy" | "unit_unverified";
    referenceProtection: "available" | "unavailable";
    message: string;
  };
  usdc: {
    mint: string;
    tokenProgram: string;
    decimals: number;
    rawBalance: string;
    tokenAccountCount: number;
    tokenAccounts: Array<{ address: string; raw: string }>;
  };
  positions: Array<{
    symbol: "AAPLx" | "NVDAx" | "TSLAx";
    mint: string;
    state: "verified" | "unavailable";
    error?: string;
    tokenProgram?: string;
    decimals?: number;
    rawBalance?: string;
    displayedBalance?: string;
    tokenAccountCount?: number;
    tokenAccounts?: Array<{ address: string; raw: string }>;
    scaledUi?: {
      oldMultiplier: string;
      newMultiplier: string;
      activeMultiplier: string;
      activationTimestamp: string;
      activationWindowBlocked: boolean;
    };
  }>;
};

export type CandidateDto = {
  symbol: "AAPLx" | "NVDAx" | "TSLAx";
  mint: string;
  status: "selected" | "eligible" | "lower-ranked" | "rejected" | "unavailable" | "not-held";
  reasonCode: string;
  reason: string;
  reasonCodes: string[];
  rawBalance?: string;
  displayedBalance?: string;
  rawInput?: string;
  displayedReduction?: string;
  displayedRemaining?: string;
  expectedUsdc?: string;
  minimumUsdc?: string;
  currentExecutableValue?: string;
  retainedExecutableValue?: string;
  retainedFloor?: string;
  expiresAt?: string;
  quoteRequests?: number;
  checks: Array<{ code: string; status: "passed" | "blocked" | "not-enabled"; label: string }>;
  quote?: {
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
  };
  retainedQuote?: CandidateDto["quote"] | null;
  inspect?: Record<string, unknown>;
  pyth?: {
    status: "valid" | "blocked";
    reasonCode: string;
    message: string;
    divergenceBps?: string;
    thresholdBps: string;
    representation?: Record<string, unknown>;
    reference?: Record<string, unknown>;
    representationAgeUs?: string;
    referenceAgeUs?: string;
  };
};

export type DecisionDto = {
  outcome: "actionable" | "blocked" | "target-already-met" | "refresh-required";
  wallet: string;
  createdAt: string;
  expiresAt: string | null;
  targetUsdc: string;
  existingUsdc: string;
  missingUsdc: string;
  maxSlippageBps: string;
  selected: CandidateDto | null;
  candidates: CandidateDto[];
  pyth: {
    status: "not-enabled" | "available" | "blocked";
    reasonCode: string;
    message: string;
    service: PortfolioDto["pyth"]["service"];
  };
  chainSlot: number;
};
