"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { formatRawAmount, parseUsdc } from "@/domain/money";
import { EnvironmentBadge } from "../components/environment-badge";
import type { CandidateDto, DecisionDto, PortfolioDto } from "./types";

type Stage = "wallet" | "portfolio" | "request" | "decision" | "review";
type Floors = Record<"AAPLx" | "NVDAx" | "TSLAx", string>;

const EMPTY_FLOORS: Floors = { AAPLx: "0", NVDAx: "0", TSLAx: "0" };

export function DrawdownApp({ defaultWallet, appMode }: { defaultWallet: string; appMode: string }) {
  const [wallet, setWallet] = useState(defaultWallet);
  const [portfolio, setPortfolio] = useState<PortfolioDto | null>(null);
  const [decision, setDecision] = useState<DecisionDto | null>(null);
  const [stage, setStage] = useState<Stage>("wallet");
  const [target, setTarget] = useState("80");
  const [floors, setFloors] = useState<Floors>(EMPTY_FLOORS);
  const [slippage, setSlippage] = useState("0.5");
  const [busy, setBusy] = useState<"portfolio" | "decision" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existing = portfolio ? formatRawAmount(BigInt(portfolio.usdc.rawBalance), 6, 2) : "0";
  const missing = useMemo(() => {
    if (!portfolio) return "0";
    try {
      const requested = parseUsdc(target);
      const held = BigInt(portfolio.usdc.rawBalance);
      return formatRawAmount(requested > held ? requested - held : 0n, 6, 2);
    } catch {
      return "—";
    }
  }, [portfolio, target]);

  async function loadPortfolio(event: FormEvent) {
    event.preventDefault();
    setBusy("portfolio");
    setError(null);
    setDecision(null);
    try {
      const response = await fetch(`/api/portfolio?wallet=${encodeURIComponent(wallet.trim())}`, { cache: "no-store" });
      const body = await response.json() as PortfolioDto | { error: string };
      if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Portfolio read failed");
      setPortfolio(body);
      setStage("portfolio");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The portfolio could not be loaded.");
    } finally {
      setBusy(null);
    }
  }

  async function evaluate(event: FormEvent) {
    event.preventDefault();
    if (!portfolio) return;
    setBusy("decision");
    setError(null);
    setDecision(null);
    try {
      const response = await fetch("/api/drawdown/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: portfolio.wallet,
          targetUsdc: target,
          retainedFloors: floors,
          maxSlippageBps: percentToBasisPoints(slippage),
          referenceProtection: "not-enabled",
        }),
      });
      const body = await response.json() as DecisionDto | { error: string };
      if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Evaluation failed");
      setDecision(body);
      setStage("decision");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The portfolio could not be evaluated.");
    } finally {
      setBusy(null);
    }
  }

  function openReview() {
    if (!decision?.expiresAt || Date.parse(decision.expiresAt) <= Date.now()) {
      setError("This quote has expired. Refresh the decision before reviewing it.");
      return;
    }
    setError(null);
    setStage("review");
  }

  const funded = portfolio?.positions.filter((position) => position.state === "verified" && BigInt(position.rawBalance ?? "0") > 0n) ?? [];

  return (
    <main className="app-page">
      <header className="app-header">
        <Link href="/" className="wordmark">DrawRail</Link>
        <div className="app-header-meta">
          <EnvironmentBadge mode={appMode} />
          {portfolio && <span className="wallet-chip" title={portfolio.wallet}>{shorten(portfolio.wallet)}</span>}
        </div>
      </header>

      <div className="app-shell">
        <div className="app-context">
          <p className="eyebrow">Portfolio drawdown</p>
          <p>Cash need first. Preservation rules second. Execution third.</p>
        </div>

        {error && <div className="alert alert-error" role="alert"><b>Action needed</b><span>{error}</span></div>}

        {stage === "wallet" && (
          <section className="connect-panel panel" aria-labelledby="connect-title">
            <div>
              <span className="screen-index">01</span>
              <p className="eyebrow">Read-only access</p>
              <h1 id="connect-title">Load a Solana portfolio without signing anything.</h1>
              <p>DrawRail reads USDC and the three supported xStocks from mainnet. It cannot move funds, request a signature, or submit a transaction in this milestone.</p>
            </div>
            <form onSubmit={loadPortfolio} className="wallet-form">
              <label htmlFor="wallet">Wallet public key</label>
              <input id="wallet" value={wallet} onChange={(event) => setWallet(event.target.value)} required autoComplete="off" placeholder="Enter a public address" />
              <small>Developer/read-only control · Never enter a private key or seed phrase.</small>
              <button className="button" disabled={busy === "portfolio"}>{busy === "portfolio" ? "Reading live portfolio…" : "Load read-only wallet"}</button>
            </form>
          </section>
        )}

        {portfolio && stage === "portfolio" && (
          <PortfolioScreen portfolio={portfolio} fundedCount={funded.length} onRequest={() => setStage("request")} onChangeWallet={() => { setPortfolio(null); setStage("wallet"); }} />
        )}

        {portfolio && stage === "request" && (
          <RequestScreen
            portfolio={portfolio}
            target={target}
            setTarget={setTarget}
            floors={floors}
            setFloors={setFloors}
            slippage={slippage}
            setSlippage={setSlippage}
            existing={existing}
            missing={missing}
            busy={busy === "decision"}
            onSubmit={evaluate}
            onBack={() => setStage("portfolio")}
          />
        )}

        {portfolio && decision && stage === "decision" && (
          <DecisionScreen
            decision={decision}
            onBack={() => setStage("request")}
            onRefresh={(event) => void evaluate(event)}
            onReview={openReview}
            busy={busy === "decision"}
          />
        )}

        {portfolio && decision?.selected && stage === "review" && (
          <ReviewScreen decision={decision} onBack={() => setStage("decision")} />
        )}
      </div>
    </main>
  );
}

function PortfolioScreen({ portfolio, fundedCount, onRequest, onChangeWallet }: {
  portfolio: PortfolioDto; fundedCount: number; onRequest: () => void; onChangeWallet: () => void;
}) {
  return (
    <section className="screen-stack" aria-labelledby="portfolio-title">
      <div className="screen-heading">
        <div><p className="eyebrow">Live portfolio</p><h1 id="portfolio-title">Available liquidity and supported exposure.</h1></div>
        <button className="text-button" onClick={onChangeWallet}>Change wallet</button>
      </div>
      <div className="liquidity-card">
        <div><span>USDC already available</span><strong>${formatRawAmount(BigInt(portfolio.usdc.rawBalance), 6, 2)}</strong></div>
        <p>Counted first in every drawdown request.</p>
      </div>
      <div className="position-grid">
        {portfolio.positions.map((position) => <PositionCard key={position.symbol} position={position} />)}
      </div>
      <div className="data-note">Live at Solana slot {portfolio.chainSlot.toLocaleString()} · {new Date(portfolio.generatedAt).toLocaleString()}</div>
      {fundedCount === 0
        ? <div className="alert"><b>No supported xStocks found</b><span>This wallet has no AAPLx, NVDAx, or TSLAx position to reduce.</span></div>
        : <button className="button primary-action" onClick={onRequest}>Request USDC <span aria-hidden>→</span></button>}
      <details className="inspect"><summary>Inspect balances</summary><div className="inspect-grid">
        <InspectRow label="USDC mint" value={portfolio.usdc.mint} />
        <InspectRow label="USDC raw balance" value={portfolio.usdc.rawBalance} />
        <InspectRow label="USDC token accounts" value={String(portfolio.usdc.tokenAccountCount)} />
        <InspectRow label="RPC slot" value={String(portfolio.chainSlot)} />
      </div></details>
    </section>
  );
}

function PositionCard({ position }: { position: PortfolioDto["positions"][number] }) {
  if (position.state === "unavailable") {
    return <article className="position-card unavailable"><div className="position-symbol"><span>{position.symbol.slice(0, 1)}</span><div><b>{position.symbol}</b><small>Unavailable</small></div></div><p>Live mint state could not be verified. This asset will fail closed.</p></article>;
  }
  const blocked = position.scaledUi?.activationWindowBlocked;
  return (
    <article className="position-card">
      <div className="position-symbol"><span>{position.symbol.slice(0, 1)}</span><div><b>{position.symbol}</b><small>{BigInt(position.rawBalance ?? "0") === 0n ? "Not held" : "Supported position"}</small></div></div>
      <strong className="position-balance">{compactDecimal(position.displayedBalance ?? "0")}</strong>
      <p>Displayed economic units</p>
      <span className={`state-pill ${blocked ? "blocked" : "stable"}`}>{blocked ? "Activation blocked" : "Multiplier stable"}</span>
      <details className="inspect nested"><summary>Inspect</summary><div className="inspect-grid">
        <InspectRow label="Mint" value={position.mint} />
        <InspectRow label="Raw balance" value={position.rawBalance ?? "—"} />
        <InspectRow label="Token accounts" value={String(position.tokenAccountCount ?? 0)} />
        <InspectRow label="Active multiplier" value={position.scaledUi?.activeMultiplier ?? "—"} />
        <InspectRow label="Pending multiplier" value={position.scaledUi?.newMultiplier ?? "—"} />
        <InspectRow label="Activation timestamp" value={position.scaledUi?.activationTimestamp ?? "—"} />
      </div></details>
    </article>
  );
}

function RequestScreen(props: {
  portfolio: PortfolioDto; target: string; setTarget: (value: string) => void;
  floors: Floors; setFloors: (value: Floors) => void; slippage: string; setSlippage: (value: string) => void;
  existing: string; missing: string; busy: boolean; onSubmit: (event: FormEvent) => void; onBack: () => void;
}) {
  return (
    <section className="screen-stack request-screen" aria-labelledby="request-title">
      <div className="screen-heading"><div><p className="eyebrow">Set the request</p><h1 id="request-title">How much USDC do you need?</h1></div><button className="text-button" onClick={props.onBack}>Back to portfolio</button></div>
      <form onSubmit={props.onSubmit}>
        <div className="request-grid">
          <div className="panel request-input-panel">
            <label htmlFor="target">Target wallet balance</label>
            <div className="currency-input"><span>$</span><input id="target" inputMode="decimal" value={props.target} onChange={(event) => props.setTarget(event.target.value)} required pattern="\d+(\.\d{1,6})?" /><b>USDC</b></div>
            <div className="need-equation"><div><span>Target</span><b>${props.target || "0"}</b></div><i>−</i><div><span>Already available</span><b>${props.existing}</b></div><i>=</i><div><span>Still needed</span><b>${props.missing}</b></div></div>
          </div>
          <div className="panel policy-panel">
            <div className="panel-title"><span>Preservation rules</span><small>Minimum exposure after the drawdown</small></div>
            {(["AAPLx", "NVDAx", "TSLAx"] as const).map((symbol) => (
              <label className="floor-row" key={symbol}><span>{symbol}<small>Keep at least</small></span><div><i>$</i><input inputMode="decimal" value={props.floors[symbol]} onChange={(event) => props.setFloors({ ...props.floors, [symbol]: event.target.value })} required pattern="\d+(\.\d{1,6})?" /></div></label>
            ))}
            <label className="floor-row slippage-row"><span>Maximum slippage<small>System maximum: 1%</small></span><div><input inputMode="decimal" min="0" max="1" step="0.01" value={props.slippage} onChange={(event) => props.setSlippage(event.target.value)} required /><i>%</i></div></label>
          </div>
        </div>
        <div className="pyth-disabled"><div><span className="status-icon neutral">○</span><div><b>Pyth reference protection</b><p>Not enabled yet. No reference-price, market-session, confidence, or publisher check will be claimed.</p></div></div><span className="state-pill neutral">Not enabled</span></div>
        <div className="form-footer"><p>DrawRail will re-read the portfolio and use live Jupiter ExactIn quotes. No signature or transaction will be requested.</p><button className="button" disabled={props.busy}>{props.busy ? "Evaluating balances → multipliers → quotes…" : "Evaluate portfolio"}</button></div>
      </form>
    </section>
  );
}

function DecisionScreen({ decision, onBack, onRefresh, onReview, busy }: {
  decision: DecisionDto; onBack: () => void; onRefresh: (event: FormEvent) => void; onReview: () => void; busy: boolean;
}) {
  if (decision.outcome === "target-already-met") {
    return <section className="empty-decision panel"><span className="status-icon selected">✓</span><p className="eyebrow">Target already met</p><h1>You already have enough USDC.</h1><p>Your wallet holds ${usdc(decision.existingUsdc)}, which covers the ${usdc(decision.targetUsdc)} target. No xStock sale is needed.</p><button className="button" onClick={onBack}>Change request</button></section>;
  }
  return (
    <section className="screen-stack decision-screen" aria-labelledby="decision-title">
      <div className="screen-heading"><div><p className="eyebrow">Portfolio decision</p><h1 id="decision-title">{decision.selected ? "One position can meet the request." : "No position can safely meet this request."}</h1></div><span className={`decision-state ${decision.outcome}`}>{decision.outcome === "actionable" ? "Actionable" : decision.outcome === "refresh-required" ? "Refresh required" : "Blocked"}</span></div>
      <div className="request-summary">
        <div><span>Requested</span><strong>${usdc(decision.targetUsdc)}</strong></div>
        <i>−</i><div><span>Existing USDC</span><strong>${usdc(decision.existingUsdc)}</strong></div>
        <i>=</i><div className="summary-emphasis"><span>Additional liquidity</span><strong>${usdc(decision.missingUsdc)}</strong></div>
      </div>
      {decision.selected && <SelectedDecision candidate={decision.selected} />}
      <div className="alternatives"><div className="section-row"><div><p className="eyebrow">Every supported position</p><h2>Why each candidate landed here</h2></div><span>Deterministic V1 rule</span></div>{decision.candidates.map((candidate) => <CandidateRow key={candidate.symbol} candidate={candidate} />)}</div>
      <div className="decision-actions">
        <button className="text-button" onClick={onBack}>Change request</button>
        <form onSubmit={onRefresh}><button className="button button-secondary" disabled={busy}>{busy ? "Refreshing…" : "Refresh decision"}</button></form>
        {decision.selected && <button className="button" onClick={onReview}>Review drawdown <span aria-hidden>→</span></button>}
      </div>
    </section>
  );
}

function SelectedDecision({ candidate }: { candidate: CandidateDto }) {
  return (
    <article className="selected-decision">
      <div className="selected-label"><span className="status-icon selected">✓</span><div><span>Selected position</span><strong>{candidate.symbol}</strong></div></div>
      <div className="selected-numbers">
        <div><span>Displayed reduction</span><strong>{compactDecimal(candidate.displayedReduction ?? "0")} {candidate.symbol}</strong></div>
        <div><span>Expected USDC</span><strong>${usdc(candidate.expectedUsdc)}</strong></div>
        <div className="minimum"><span>Reviewed minimum</span><strong>${usdc(candidate.minimumUsdc)}</strong></div>
        <div><span>Remaining exposure</span><strong>${usdc(candidate.retainedExecutableValue)}</strong></div>
      </div>
      <p className="selection-reason">{candidate.reason}</p>
      <div className="check-grid">{candidate.checks.map((item) => <div key={item.code} className={`check ${item.status}`}><span>{item.status === "passed" ? "✓" : item.status === "blocked" ? "×" : "○"}</span>{item.label}</div>)}</div>
      <CandidateInspect candidate={candidate} />
    </article>
  );
}

function CandidateRow({ candidate }: { candidate: CandidateDto }) {
  const label = candidate.status === "not-held" ? "Not held" : candidate.status === "lower-ranked" ? "Lower ranked" : candidate.status[0].toUpperCase() + candidate.status.slice(1);
  return (
    <article className={`candidate-row ${candidate.status}`}>
      <div className="candidate-identity"><span className="asset-monogram">{candidate.symbol[0]}</span><div><h3>{candidate.symbol}</h3><span className={`candidate-label ${candidate.status}`}>{label}</span></div></div>
      <div className="candidate-reason"><b>{candidate.reasonCode.replaceAll("_", " ")}</b><p>{candidate.reason}</p>{candidate.reasonCode === "RETAINED_FLOOR" && <small>Would leave approximately ${usdc(candidate.retainedExecutableValue)} against a ${usdc(candidate.retainedFloor)} floor.</small>}</div>
      {candidate.minimumUsdc && <div className="candidate-output"><span>Minimum output</span><b>${usdc(candidate.minimumUsdc)}</b></div>}
      {candidate.quote && <CandidateInspect candidate={candidate} />}
    </article>
  );
}

function CandidateInspect({ candidate }: { candidate: CandidateDto }) {
  const quote = candidate.quote;
  return <details className="inspect"><summary>Inspect {candidate.symbol} evidence</summary><div className="inspect-grid">
    <InspectRow label="Mint" value={candidate.mint} />
    <InspectRow label="Raw wallet balance" value={candidate.rawBalance ?? "—"} />
    <InspectRow label="Exact raw input" value={candidate.rawInput ?? "—"} />
    <InspectRow label="Jupiter inAmount" value={quote?.inAmount ?? "—"} />
    <InspectRow label="outAmount" value={quote?.outAmount ?? "—"} />
    <InspectRow label="otherAmountThreshold" value={quote?.otherAmountThreshold ?? "—"} />
    <InspectRow label="Router / mode" value={`${quote?.router ?? "not returned"} / ${quote?.mode ?? "not returned"}`} />
    <InspectRow label="Price impact" value={quote?.priceImpact ?? "not returned"} />
    <InspectRow label="Response slippage" value={quote ? `${quote.slippageBps} bps` : "—"} />
    <InspectRow label="feeBps" value={quote?.feeBps ?? "not returned"} />
    <InspectRow label="feeMint" value={quote?.feeMint ?? "not returned"} />
    <InspectRow label="platformFee" value={quote?.platformFee ? JSON.stringify(quote.platformFee) : "not returned"} />
    <InspectRow label="Request ID" value={quote?.requestId ?? "not returned"} />
    <InspectRow label="Decision expiry" value={candidate.expiresAt ?? "—"} />
    {Object.entries(candidate.inspect ?? {}).map(([key, value]) => <InspectRow key={key} label={key} value={String(value)} />)}
  </div></details>;
}

function ReviewScreen({ decision, onBack }: { decision: DecisionDto; onBack: () => void }) {
  const selected = decision.selected!;
  return (
    <section className="screen-stack review-screen" aria-labelledby="review-title">
      <div className="screen-heading"><div><p className="eyebrow">Read-only review</p><h1 id="review-title">Review the proposed drawdown.</h1></div><span className="decision-state read-only">No signing in Milestone 2</span></div>
      <div className="review-card">
        <div className="review-leg"><span>You would reduce</span><strong>{compactDecimal(selected.displayedReduction ?? "0")} {selected.symbol}</strong><small>Exact raw input: {selected.rawInput}</small></div>
        <span className="review-arrow" aria-hidden>→</span>
        <div className="review-leg receive"><span>You would receive</span><strong>${usdc(selected.expectedUsdc)} USDC</strong><small>Reviewed minimum: ${usdc(selected.minimumUsdc)} USDC</small></div>
      </div>
      <div className="review-facts">
        <div><span>Destination wallet</span><b title={decision.wallet}>{shorten(decision.wallet)}</b></div>
        <div><span>Remaining {selected.symbol} exposure</span><b>${usdc(selected.retainedExecutableValue)}</b></div>
        <div><span>Retained floor</span><b>${usdc(selected.retainedFloor)}</b></div>
        <div><span>Quote expires</span><b>{decision.expiresAt ? new Date(decision.expiresAt).toLocaleTimeString() : "Unavailable"}</b></div>
        <div><span>Jupiter fee</span><b>{selected.quote?.feeBps ? `${selected.quote.feeBps} bps` : "Not returned"}</b></div>
        <div><span>Reference protection</span><b>Not applied</b></div>
      </div>
      <div className="alert milestone-boundary"><b>Signing is intentionally unavailable</b><span>Milestone 2 stops at a live, explainable, read-only review. No transaction was built, signed, broadcast, or sent to Jupiter /execute.</span></div>
      <CandidateInspect candidate={selected} />
      <div className="decision-actions"><button className="text-button" onClick={onBack}>Back to decision</button><button className="button" disabled>Sign in wallet — later milestone</button></div>
    </section>
  );
}

function InspectRow({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function usdc(value?: string) {
  return value === undefined ? "—" : formatRawAmount(BigInt(value), 6, 2);
}

function compactDecimal(value: string, places = 6) {
  const [whole, fraction = ""] = value.split(".");
  const clipped = fraction.slice(0, places).replace(/0+$/, "");
  return clipped ? `${whole}.${clipped}` : whole;
}

function percentToBasisPoints(value: string): string {
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(value.trim());
  if (!match) return "-1";
  return (BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0")).toString();
}

function shorten(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 5)}…${value.slice(-5)}`;
}
