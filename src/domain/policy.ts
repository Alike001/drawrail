import Decimal from "decimal.js";
import { ASSET_REGISTRY, XSTOCK_SYMBOLS, type XStockSymbol } from "./assets";
import { ceilDiv } from "./money";
import type { PortfolioPosition, PortfolioSnapshot, UnavailablePosition } from "./portfolio";
import { REASON_COPY, type ReasonCode } from "./reasons";
import { rawToDisplayedOfficial } from "./scaled-ui";
import {
  rawTokenAmount,
  tokenDecimals,
  usdcRawAmount,
  type BasisPoints,
  type RawTokenAmount,
  type UsdcRawAmount,
} from "./types";
import type { JupiterQuote } from "@/server/jupiter";
import type { PythPolicyEvidence, PythServiceStatus } from "./pyth";

export type DecisionOutcome = "actionable" | "blocked" | "target-already-met" | "refresh-required";
export type CandidateStatus = "selected" | "eligible" | "lower-ranked" | "rejected" | "unavailable" | "not-held";

export type PolicyInputs = Readonly<{
  targetUsdc: UsdcRawAmount;
  retainedFloors: Readonly<Record<XStockSymbol, UsdcRawAmount>>;
  maxSlippageBps: BasisPoints;
  referenceProtection?: Readonly<{
    required: boolean;
    maxDivergenceBps: BasisPoints;
    serviceStatus: PythServiceStatus;
    serviceMessage: string;
    evaluations: Readonly<Partial<Record<XStockSymbol, PythPolicyEvidence>>>;
  }>;
}>;

export type QuoteProvider = Readonly<{
  quote(inputMint: string, outputMint: string, amount: RawTokenAmount, slippage: BasisPoints): Promise<JupiterQuote>;
}>;

export type PolicyCheck = Readonly<{
  code: string;
  status: "passed" | "blocked" | "not-enabled";
  label: string;
}>;

export type CandidateDecision = Readonly<{
  symbol: XStockSymbol;
  mint: string;
  status: CandidateStatus;
  reasonCode: ReasonCode;
  reason: string;
  reasonCodes: readonly ReasonCode[];
  rawBalance?: RawTokenAmount;
  displayedBalance?: string;
  rawInput?: RawTokenAmount;
  displayedReduction?: string;
  displayedRemaining?: string;
  expectedUsdc?: UsdcRawAmount;
  minimumUsdc?: UsdcRawAmount;
  currentExecutableValue?: UsdcRawAmount;
  retainedExecutableValue?: UsdcRawAmount;
  retainedFloor?: UsdcRawAmount;
  quote?: JupiterQuote;
  retainedQuote?: JupiterQuote | null;
  expiresAt?: string;
  quoteRequests?: number;
  checks: readonly PolicyCheck[];
  inspect?: Readonly<Record<string, unknown>>;
  pyth?: PythPolicyEvidence;
}>;

export type DrawdownDecision = Readonly<{
  outcome: DecisionOutcome;
  wallet: string;
  createdAt: string;
  expiresAt: string | null;
  targetUsdc: UsdcRawAmount;
  existingUsdc: UsdcRawAmount;
  missingUsdc: UsdcRawAmount;
  maxSlippageBps: BasisPoints;
  selected: CandidateDecision | null;
  candidates: readonly CandidateDecision[];
  pyth: Readonly<{ status: "not-enabled" | "available" | "blocked"; reasonCode: ReasonCode; message: string; service: PythServiceStatus }>;
  chainSlot: number;
}>;

export type EvaluationOptions = Readonly<{
  now?: Date;
  maxRpcAgeSeconds?: bigint;
  quoteTtlSeconds?: bigint;
  maxQuoteRequestsPerCandidate?: number;
}>;

type QuoteEvidence = Readonly<{ quote: JupiterQuote; expiresAtMs: bigint }>;

export async function evaluateDrawdown(
  snapshot: PortfolioSnapshot,
  input: PolicyInputs,
  quotes: QuoteProvider,
  options: EvaluationOptions = {},
): Promise<DrawdownDecision> {
  if (input.targetUsdc <= 0n) throw new Error("Target USDC must be greater than zero");
  if (input.maxSlippageBps > 100n) throw new Error("Maximum slippage cannot exceed 100 basis points");
  const now = options.now ?? new Date();
  const nowMs = BigInt(now.getTime());
  const missing = input.targetUsdc > snapshot.usdc.rawBalance
    ? usdcRawAmount(input.targetUsdc - snapshot.usdc.rawBalance)
    : usdcRawAmount(0n);
  const base = {
    wallet: snapshot.wallet,
    createdAt: now.toISOString(),
    targetUsdc: input.targetUsdc,
    existingUsdc: snapshot.usdc.rawBalance,
    missingUsdc: missing,
    maxSlippageBps: input.maxSlippageBps,
    pyth: decisionPythState(input),
    chainSlot: snapshot.chainSlot,
  };

  if (missing === 0n) {
    return {
      ...base,
      outcome: "target-already-met",
      expiresAt: null,
      selected: null,
      candidates: snapshot.positions.map(targetMetCandidate),
    };
  }

  const maxRpcAge = options.maxRpcAgeSeconds ?? 120n;
  const chainAge = BigInt(Math.floor(now.getTime() / 1000)) - snapshot.chainTime;
  if (chainAge > maxRpcAge || chainAge < -30n) {
    return {
      ...base,
      outcome: "refresh-required",
      expiresAt: null,
      selected: null,
      candidates: snapshot.positions.map((position) => simpleCandidate(
        position,
        "unavailable",
        "RPC_STALE",
      )),
    };
  }

  const candidates: CandidateDecision[] = [];
  for (const position of snapshot.positions) {
    candidates.push(await evaluateCandidate(position, missing, input, quotes, nowMs, options));
  }

  const eligible = candidates.filter((candidate) => candidate.status === "eligible");
  eligible.sort(compareEligible);
  const winner = eligible[0];
  const ranked = candidates.map((candidate): CandidateDecision => {
    if (!winner || candidate.status !== "eligible") return candidate;
    if (candidate.symbol === winner.symbol) {
      return {
        ...candidate,
        status: "selected",
        reasonCode: "SELECTED",
        reason: "Uses the smallest share of a policy-compliant position under the V1 ranking rule.",
        reasonCodes: uniqueReasons([...candidate.reasonCodes, "SELECTED"]),
      };
    }
    return {
      ...candidate,
      status: "lower-ranked",
      reasonCode: "LOWER_RANKED",
      reason: "This position is eligible, but another eligible position requires a smaller percentage reduction.",
      reasonCodes: uniqueReasons([...candidate.reasonCodes, "LOWER_RANKED"]),
    };
  });
  const selected = ranked.find((candidate) => candidate.status === "selected") ?? null;
  const anyExpired = ranked.some((candidate) => candidate.reasonCode === "QUOTE_EXPIRED");
  const searchFailed = ranked.some((candidate) => candidate.reasonCode === "QUOTE_SEARCH_EXHAUSTED");
  return {
    ...base,
    outcome: selected ? "actionable" : anyExpired || searchFailed ? "refresh-required" : "blocked",
    expiresAt: selected?.expiresAt ?? null,
    selected,
    candidates: XSTOCK_SYMBOLS.map((symbol) => ranked.find((candidate) => candidate.symbol === symbol)!),
  };
}

async function evaluateCandidate(
  position: PortfolioPosition | UnavailablePosition,
  missing: UsdcRawAmount,
  input: PolicyInputs,
  provider: QuoteProvider,
  nowMs: bigint,
  options: EvaluationOptions,
): Promise<CandidateDecision> {
  const pyth = candidatePythState(input, position.symbol);
  if (position.state === "unavailable") {
    return simpleCandidate(position, "unavailable", "UNSUPPORTED_ASSET_STATE", position.error, undefined, pyth);
  }
  if (position.rawBalance === 0n) return simpleCandidate(position, "not-held", "ZERO_BALANCE", undefined, undefined, pyth);
  if (position.scaledUi.activationWindowBlocked) {
    return simpleCandidate(position, "unavailable", "MULTIPLIER_WINDOW", undefined, [
      check("registry", "passed", "Supported mint and live state verified"),
      check("multiplier-window", "blocked", "Inside the inclusive ±15-minute activation window"),
      pythCheck(pyth),
    ], pyth);
  }
  if (input.referenceProtection?.required && pyth.reasonCode !== "PYTH_VALID") {
    return simpleCandidate(position, "rejected", pyth.reasonCode, undefined, [
      check("registry", "passed", "Supported mint and live state verified"),
      check("multiplier-window", "passed", "Outside the multiplier activation window"),
      pythCheck(pyth),
    ], pyth);
  }

  const budget = new QuoteBudget(provider, options.maxQuoteRequestsPerCandidate ?? 5);
  const ttl = options.quoteTtlSeconds ?? 30n;
  try {
    const full = await quoteEvidence(budget, position.mint, position.rawBalance, input.maxSlippageBps, nowMs, ttl);
    if (isExpired(full, nowMs)) return quotedRejection(position, input, full, "QUOTE_EXPIRED", budget.count);
    if (BigInt(full.quote.slippageBps) > input.maxSlippageBps) {
      return quotedRejection(position, input, full, "SLIPPAGE_LIMIT", budget.count);
    }
    if (BigInt(full.quote.otherAmountThreshold) < missing) {
      return quotedRejection(position, input, full, "INSUFFICIENT_POSITION", budget.count, {
        currentExecutableValue: usdcRawAmount(full.quote.otherAmountThreshold),
      });
    }

    const sale = await findSafeRawInput(
      budget,
      position,
      missing,
      input.maxSlippageBps,
      full,
      nowMs,
      ttl,
    );
    if (isExpired(sale, nowMs)) return quotedRejection(position, input, sale, "QUOTE_EXPIRED", budget.count);
    if (BigInt(sale.quote.slippageBps) > input.maxSlippageBps) {
      return quotedRejection(position, input, sale, "SLIPPAGE_LIMIT", budget.count);
    }
    const rawInput = rawTokenAmount(sale.quote.inAmount);
    const remainingRaw = rawTokenAmount(position.rawBalance - rawInput);
    const retained = remainingRaw === 0n
      ? null
      : await quoteEvidence(budget, position.mint, remainingRaw, input.maxSlippageBps, nowMs, ttl);
    if (retained && isExpired(retained, nowMs)) {
      return quotedRejection(position, input, retained, "QUOTE_EXPIRED", budget.count);
    }
    if (retained && BigInt(retained.quote.slippageBps) > input.maxSlippageBps) {
      return quotedRejection(position, input, retained, "SLIPPAGE_LIMIT", budget.count);
    }
    const retainedValue = usdcRawAmount(retained?.quote.otherAmountThreshold ?? "0");
    const floor = input.retainedFloors[position.symbol];
    const shared = candidateEvidence(position, input, full, sale, retained, rawInput, remainingRaw, budget.count);
    if (retainedValue < floor) {
      return {
        ...shared,
        status: "rejected",
        reasonCode: "RETAINED_FLOOR",
        reason: `The conservative remaining-position quote is below the retained floor.`,
        reasonCodes: ["RETAINED_FLOOR", pyth.reasonCode],
        checks: [
          check("registry", "passed", "Supported mint and live state verified"),
          check("multiplier-window", "passed", "Outside the multiplier activation window"),
          check("slippage", "passed", "Quote is within the selected maximum slippage"),
          check("retained-floor", "blocked", "Conservative remaining value is below the retained floor"),
          pythCheck(pyth),
        ],
        pyth: pyth.evidence,
      };
    }
    return {
      ...shared,
      status: "eligible",
      reasonCode: "ELIGIBLE",
      reason: REASON_COPY.ELIGIBLE,
      reasonCodes: ["ELIGIBLE", pyth.reasonCode],
      checks: [
        check("registry", "passed", "Supported mint and live state verified"),
        check("multiplier-window", "passed", "Outside the multiplier activation window"),
        check("slippage", "passed", "Quote is within the selected maximum slippage"),
        check("retained-floor", "passed", "Conservative remaining value preserves the retained floor"),
        pythCheck(pyth),
      ],
      pyth: pyth.evidence,
    };
  } catch (error) {
    if (error instanceof QuoteBudgetExceeded) {
      return simpleCandidate(position, "unavailable", "QUOTE_SEARCH_EXHAUSTED", undefined, undefined, pyth);
    }
    const message = error instanceof Error ? error.message : "Unknown Jupiter quote failure";
    const noRoute = /no route|no quote|404/i.test(message);
    return simpleCandidate(position, "unavailable", noRoute ? "NO_JUPITER_ROUTE" : "QUOTE_SEARCH_EXHAUSTED", undefined, undefined, pyth);
  }
}

async function findSafeRawInput(
  budget: QuoteBudget,
  position: PortfolioPosition,
  missing: UsdcRawAmount,
  slippage: BasisPoints,
  full: QuoteEvidence,
  nowMs: bigint,
  ttl: bigint,
): Promise<QuoteEvidence> {
  const fullOutput = BigInt(full.quote.otherAmountThreshold);
  const estimate = rawTokenAmount(
    minBigInt(position.rawBalance, maxBigInt(1n, ceilDiv(missing * position.rawBalance, fullOutput))),
  );
  if (estimate === position.rawBalance) return full;
  if (budget.remaining <= 1) throw new QuoteBudgetExceeded("Quote search request budget exhausted");

  // Start from the full-position executable ratio, then accept only an amount
  // that independently receives a live quote covering the requested gap.
  let candidate = estimate;
  for (let iteration = 0; iteration < 3 && budget.remaining > 1; iteration += 1) {
    const evidence = await quoteEvidence(budget, position.mint, candidate, slippage, nowMs, ttl);
    const output = BigInt(evidence.quote.otherAmountThreshold);
    if (output >= missing) return evidence;
    if (output === 0n) break;
    let corrected = ceilDiv(candidate * missing, output);
    if (corrected <= candidate) corrected = candidate + 1n;
    if (corrected === candidate || corrected <= 0n || corrected > position.rawBalance) break;
    candidate = rawTokenAmount(corrected);
  }
  throw new QuoteBudgetExceeded("Quote search could not resolve a covering raw input");
}

function candidateEvidence(
  position: PortfolioPosition,
  input: PolicyInputs,
  full: QuoteEvidence,
  sale: QuoteEvidence,
  retained: QuoteEvidence | null,
  rawInput: RawTokenAmount,
  remainingRaw: RawTokenAmount,
  quoteRequests: number,
): Omit<CandidateDecision, "status" | "reasonCode" | "reason" | "reasonCodes" | "checks"> {
  const displayedReduction = rawToDisplayedOfficial(
    rawInput,
    tokenDecimals(position.decimals),
    position.scaledUi.activeMultiplier,
  );
  const displayedRemaining = rawToDisplayedOfficial(
    remainingRaw,
    tokenDecimals(position.decimals),
    position.scaledUi.activeMultiplier,
  );
  const expiries = [sale.expiresAtMs, retained?.expiresAtMs].filter((value): value is bigint => value !== undefined);
  const expires = expiries.reduce((minimum, value) => value < minimum ? value : minimum);
  return {
    symbol: position.symbol,
    mint: position.mint,
    rawBalance: position.rawBalance,
    displayedBalance: position.displayedBalance,
    rawInput,
    displayedReduction,
    displayedRemaining,
    expectedUsdc: usdcRawAmount(sale.quote.outAmount),
    minimumUsdc: usdcRawAmount(sale.quote.otherAmountThreshold),
    currentExecutableValue: usdcRawAmount(full.quote.otherAmountThreshold),
    retainedExecutableValue: usdcRawAmount(retained?.quote.otherAmountThreshold ?? "0"),
    retainedFloor: input.retainedFloors[position.symbol],
    quote: sale.quote,
    retainedQuote: retained?.quote ?? null,
    expiresAt: new Date(Number(expires)).toISOString(),
    quoteRequests,
    inspect: {
      tokenProgram: position.tokenProgram,
      decimals: position.decimals,
      tokenAccountCount: position.tokenAccountCount,
      activeMultiplier: position.scaledUi.activeMultiplier,
      oldMultiplier: position.scaledUi.oldMultiplier,
      newMultiplier: position.scaledUi.newMultiplier,
      activationTimestamp: position.scaledUi.activationTimestamp.toString(),
      activationWindowBlocked: position.scaledUi.activationWindowBlocked,
      remainingRaw: remainingRaw.toString(),
    },
  };
}

function compareEligible(a: CandidateDecision, b: CandidateDecision): number {
  const left = a.rawInput! * b.rawBalance!;
  const right = b.rawInput! * a.rawBalance!;
  if (left !== right) return left < right ? -1 : 1;
  const impact = new Decimal(a.quote?.priceImpact ?? "0").abs()
    .cmp(new Decimal(b.quote?.priceImpact ?? "0").abs());
  if (impact !== 0) return impact;
  return XSTOCK_SYMBOLS.indexOf(a.symbol) - XSTOCK_SYMBOLS.indexOf(b.symbol);
}

class QuoteBudgetExceeded extends Error {}

class QuoteBudget {
  count = 0;
  private readonly cache = new Map<string, JupiterQuote>();
  constructor(private readonly provider: QuoteProvider, private readonly maximum: number) {}
  get remaining() { return this.maximum - this.count; }
  async quote(mint: string, amount: RawTokenAmount, slippage: BasisPoints) {
    const key = `${mint}:${amount}:${slippage}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    if (this.count >= this.maximum) throw new QuoteBudgetExceeded("Quote search request budget exhausted");
    this.count += 1;
    const quote = await this.provider.quote(mint, ASSET_REGISTRY.USDC.mint, amount, slippage);
    this.cache.set(key, quote);
    return quote;
  }
}

async function quoteEvidence(
  budget: QuoteBudget,
  mint: string,
  amount: RawTokenAmount,
  slippage: BasisPoints,
  nowMs: bigint,
  ttlSeconds: bigint,
): Promise<QuoteEvidence> {
  const quote = await budget.quote(mint, amount, slippage);
  return { quote, expiresAtMs: parseExpiryMs(quote.expireAt) ?? nowMs + ttlSeconds * 1_000n };
}

export function parseExpiryMs(value: string | null): bigint | null {
  if (value === null) return null;
  if (/^\d+$/.test(value)) {
    const parsed = BigInt(value);
    return parsed < 10_000_000_000n ? parsed * 1_000n : parsed;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? BigInt(parsed) : null;
}

function isExpired(evidence: QuoteEvidence, nowMs: bigint) {
  return evidence.expiresAtMs <= nowMs;
}

function targetMetCandidate(position: PortfolioPosition | UnavailablePosition): CandidateDecision {
  return simpleCandidate(position, position.state === "verified" && position.rawBalance === 0n ? "not-held" : "unavailable", "TARGET_ALREADY_MET");
}

function simpleCandidate(
  position: PortfolioPosition | UnavailablePosition,
  status: CandidateStatus,
  reasonCode: ReasonCode,
  detail?: string,
  checks?: readonly PolicyCheck[],
  pyth: CandidatePythState = NOT_ENABLED_PYTH,
): CandidateDecision {
  return {
    symbol: position.symbol,
    mint: position.mint,
    status,
    reasonCode,
    reason: detail ? `${REASON_COPY[reasonCode]} ${detail}` : REASON_COPY[reasonCode],
    reasonCodes: uniqueReasons([reasonCode, pyth.reasonCode]),
    ...(position.state === "verified" ? {
      rawBalance: position.rawBalance,
      displayedBalance: position.displayedBalance,
      inspect: {
        tokenProgram: position.tokenProgram,
        decimals: position.decimals,
        tokenAccountCount: position.tokenAccountCount,
        activeMultiplier: position.scaledUi.activeMultiplier,
        oldMultiplier: position.scaledUi.oldMultiplier,
        newMultiplier: position.scaledUi.newMultiplier,
        activationTimestamp: position.scaledUi.activationTimestamp.toString(),
        activationWindowBlocked: position.scaledUi.activationWindowBlocked,
      },
    } : {}),
    checks: checks ?? [pythCheck(pyth)],
    pyth: pyth.evidence,
  };
}

function quotedRejection(
  position: PortfolioPosition,
  input: PolicyInputs,
  evidence: QuoteEvidence,
  reasonCode: ReasonCode,
  quoteRequests: number,
  extra: Partial<CandidateDecision> = {},
): CandidateDecision {
  return {
    ...simpleCandidate(position, "rejected", reasonCode, undefined, undefined, candidatePythState(input, position.symbol)),
    retainedFloor: input.retainedFloors[position.symbol],
    quote: evidence.quote,
    expiresAt: new Date(Number(evidence.expiresAtMs)).toISOString(),
    quoteRequests,
    ...extra,
  };
}

function check(code: string, status: PolicyCheck["status"], label: string): PolicyCheck {
  return { code, status, label };
}

type CandidatePythState = Readonly<{ reasonCode: ReasonCode; message: string; evidence?: PythPolicyEvidence }>;
const NOT_ENABLED_PYTH: CandidatePythState = { reasonCode: "PYTH_NOT_ENABLED", message: REASON_COPY.PYTH_NOT_ENABLED };

function candidatePythState(input: PolicyInputs, symbol: XStockSymbol): CandidatePythState {
  const policy = input.referenceProtection;
  if (!policy?.required) return NOT_ENABLED_PYTH;
  if (policy.serviceStatus !== "available") {
    const reasonCode: ReasonCode = policy.serviceStatus === "not_entitled"
      ? "PYTH_NOT_ENTITLED"
      : policy.serviceStatus === "unit_unverified" ? "PYTH_UNIT_UNVERIFIED" : "PYTH_UNAVAILABLE";
    return { reasonCode, message: policy.serviceMessage };
  }
  const evidence = policy.evaluations[symbol];
  return evidence
    ? { reasonCode: evidence.reasonCode, message: evidence.message, evidence }
    : { reasonCode: "PYTH_FEED_MISSING", message: REASON_COPY.PYTH_FEED_MISSING };
}

function decisionPythState(input: PolicyInputs): DrawdownDecision["pyth"] {
  const policy = input.referenceProtection;
  if (!policy?.required) return { status: "not-enabled", reasonCode: "PYTH_NOT_ENABLED", message: REASON_COPY.PYTH_NOT_ENABLED, service: policy?.serviceStatus ?? "disabled" };
  if (policy.serviceStatus !== "available") {
    const state = candidatePythState(input, "AAPLx");
    return { status: "blocked", reasonCode: state.reasonCode, message: state.message, service: policy.serviceStatus };
  }
  return { status: "available", reasonCode: "PYTH_VALID", message: "Reference protection is required for every candidate.", service: "available" };
}

function pythCheck(pyth: CandidatePythState): PolicyCheck {
  return check("pyth-reference", pyth.reasonCode === "PYTH_NOT_ENABLED" ? "not-enabled" : pyth.reasonCode === "PYTH_VALID" ? "passed" : "blocked", pyth.message);
}

function uniqueReasons(codes: readonly ReasonCode[]): ReasonCode[] {
  return [...new Set(codes)];
}

function minBigInt(a: bigint, b: bigint) { return a < b ? a : b; }
function maxBigInt(a: bigint, b: bigint) { return a > b ? a : b; }
