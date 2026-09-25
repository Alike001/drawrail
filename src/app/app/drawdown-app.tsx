"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Wallet } from "@wallet-standard/base";
import { formatRawAmount, parseUsdc } from "@/domain/money";
import { canBuildWalletReview, canRefreshTransactionOnly, type ReviewState } from "@/domain/review-state";
import { signReviewedTransaction, useWalletStandard } from "@/wallet/wallet-standard";
import { EnvironmentBadge } from "../components/environment-badge";
import type { CandidateDto, DecisionDto, ExecutionResultDto, PortfolioDto, TransactionReviewDto } from "./types";

type Stage = "wallet" | "portfolio" | "request" | "decision" | "review";
type Floors = Record<"AAPLx" | "NVDAx" | "TSLAx", string>;

const EMPTY_FLOORS: Floors = { AAPLx: "0", NVDAx: "0", TSLAx: "0" };

export function DrawdownApp({ defaultWallet, appMode }: { defaultWallet: string; appMode: string }) {
  const walletStandard = useWalletStandard();
  const [readOnlyWallet, setReadOnlyWallet] = useState(defaultWallet);
  const [walletMode, setWalletMode] = useState<"connected" | "read-only" | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioDto | null>(null);
  const [decision, setDecision] = useState<DecisionDto | null>(null);
  const [review, setReview] = useState<TransactionReviewDto | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>("decision_ready");
  const [executionResult, setExecutionResult] = useState<ExecutionResultDto | null>(null);
  const [signOnlyEvidence, setSignOnlyEvidence] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("wallet");
  const [target, setTarget] = useState("80");
  const [floors, setFloors] = useState<Floors>(EMPTY_FLOORS);
  const [slippage, setSlippage] = useState("0.5");
  const [referenceProtection, setReferenceProtection] = useState(false);
  const [divergenceLimit, setDivergenceLimit] = useState("1");
  const [busy, setBusy] = useState<"portfolio" | "decision" | "review" | "signing" | "executing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previousConnectedWallet = useRef<string | null>(null);

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

  const loadPortfolioAddress = useCallback(async (address: string, mode: "connected" | "read-only") => {
    setBusy("portfolio");
    setError(null);
    setDecision(null);
    setReview(null);
    setExecutionResult(null);
    setSignOnlyEvidence(null);
    try {
      const response = await fetch(`/api/portfolio?wallet=${encodeURIComponent(address.trim())}`, { cache: "no-store" });
      const body = await response.json() as PortfolioDto | { error: string };
      if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Portfolio read failed");
      setPortfolio(body);
      setWalletMode(mode);
      setStage("portfolio");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The portfolio could not be loaded.");
      setStage("wallet");
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    const next = walletStandard.connection?.address ?? null;
    if (next === previousConnectedWallet.current) return;
    const hadWallet = previousConnectedWallet.current !== null;
    previousConnectedWallet.current = next;
    setPortfolio(null);
    setDecision(null);
    setReview(null);
    setExecutionResult(null);
    setReviewState(hadWallet ? "wallet_changed" : "decision_ready");
    setWalletMode(next ? "connected" : null);
    setStage("wallet");
    if (next) void loadPortfolioAddress(next, "connected");
  }, [walletStandard.connection?.address, loadPortfolioAddress]);

  async function loadReadOnlyPortfolio(event: FormEvent) {
    event.preventDefault();
    await loadPortfolioAddress(readOnlyWallet, "read-only");
  }

  async function evaluate(event: FormEvent) {
    event.preventDefault();
    if (!portfolio) return;
    setBusy("decision");
    setError(null);
    setDecision(null);
    setReview(null);
    setExecutionResult(null);
    setReviewState("decision_ready");
    try {
      const response = await fetch("/api/drawdown/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: portfolio.wallet,
          targetUsdc: target,
          retainedFloors: floors,
          maxSlippageBps: percentToBasisPoints(slippage),
          referenceProtection: {
            required: referenceProtection,
            maxDivergenceBps: percentToBasisPoints(divergenceLimit),
          },
        }),
      });
      const body = await response.json() as DecisionDto | { error: string };
      if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Evaluation failed");
      setDecision(body);
      setReviewState("decision_ready");
      setStage("decision");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The portfolio could not be evaluated.");
    } finally {
      setBusy(null);
    }
  }

  async function signReview(mode: "sign-only" | "execute") {
    if (!review || !walletStandard.connection || reviewState !== "review_ready") return;
    if (Date.parse(review.expiresAt) <= Date.now()) {
      setReviewState("quote_expired");
      return;
    }
    setError(null);
    setBusy(mode === "sign-only" ? "signing" : "executing");
    try {
      const preSign = await fetch("/api/drawdown/pre-sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receipt: review.receipt, requestId: review.order.requestId }),
      });
      if (!preSign.ok) {
        const blocked = await preSign.json() as { error?: string };
        setReviewState("refresh_required");
        throw new Error(blocked.error ?? "The order is no longer safe to sign.");
      }
      const signedTransaction = await signReviewedTransaction(walletStandard.connection, review.order.transaction);
      const endpoint = mode === "sign-only" ? "/api/drawdown/sign-only" : "/api/drawdown/execute";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedTransaction, receipt: review.receipt, requestId: review.order.requestId }),
      });
      const body = await response.json() as ExecutionResultDto | { state: "sign_only_verified" | "transaction_invalid" | "unavailable"; error?: string; messageHashBeforeWallet?: string; messageHashAfterWallet?: string; broadcast?: boolean };
      if (mode === "sign-only") {
        if (!response.ok || body.state !== "sign_only_verified") throw new Error(body.error ?? "Sign-only validation failed.");
        setSignOnlyEvidence(`Signature verified. Message ${body.messageHashAfterWallet?.slice(0, 12)}… was unchanged and was not broadcast.`);
        setReviewState("refresh_required");
        return;
      }
      const execution = body as ExecutionResultDto;
      setExecutionResult(execution);
      if (!response.ok && execution.state !== "unknown") setError(execution.error ?? "The signed drawdown was not submitted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Wallet signing was cancelled or failed.");
    } finally {
      setBusy(null);
    }
  }

  async function checkExecutionStatus() {
    if (!review) return;
    setBusy("executing");
    setError(null);
    try {
      const response = await fetch("/api/drawdown/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ receipt: review.receipt }) });
      const body = await response.json() as ExecutionResultDto;
      setExecutionResult(body);
      if (!response.ok) setError(body.error ?? "The existing submission status is still unknown.");
    } finally {
      setBusy(null);
    }
  }

  async function openReview(transactionOnlyRefresh = false) {
    if (!decision?.expiresAt || (!transactionOnlyRefresh && Date.parse(decision.expiresAt) <= Date.now())) {
      setError("This quote has expired. Refresh the decision before reviewing it.");
      setReviewState("quote_expired");
      return;
    }
    if (!walletStandard.connection || walletMode !== "connected" || walletStandard.connection.address !== decision.wallet) {
      setError("Connect the same wallet used for this decision before building its exact transaction review.");
      setReviewState("wallet_changed");
      return;
    }
    setError(null);
    setReview(null);
    setReviewState("building_transaction");
    setStage("review");
    setBusy("review");
    try {
      const response = await fetch("/api/drawdown/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: decision.wallet,
          targetUsdc: target,
          retainedFloors: floors,
          maxSlippageBps: percentToBasisPoints(slippage),
          referenceProtection: {
            required: referenceProtection,
            maxDivergenceBps: percentToBasisPoints(divergenceLimit),
          },
          expectedDecision: {
            createdAt: decision.createdAt,
            selectedSymbol: decision.selected!.symbol,
            selectedRawInput: decision.selected!.rawInput,
          },
        }),
      });
      setReviewState("validating_transaction");
      const body = await response.json() as TransactionReviewDto | { state?: ReviewState; error: string };
      if (!response.ok || "error" in body) {
        const state = "state" in body && body.state ? body.state : "transaction_invalid";
        setReviewState(state);
        throw new Error("error" in body ? body.error : "Transaction review failed");
      }
      if (walletStandard.connection.address !== body.wallet) {
        setReviewState("wallet_changed");
        throw new Error("The connected wallet changed while the transaction was being reviewed.");
      }
      setDecision(body.decision);
      setReview(body);
      setReviewState("review_ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The exact transaction review could not be built.");
    } finally {
      setBusy(null);
    }
  }

  function refreshExpiredReview() {
    if (!decision) return;
    const policySnapshotStillRecent = canRefreshTransactionOnly(decision.createdAt);
    if (policySnapshotStillRecent) {
      void openReview(true);
      return;
    }
    setReview(null);
    setExecutionResult(null);
    setStage("decision");
    setReviewState("refresh_required");
  }

  const funded = portfolio?.positions.filter((position) => position.state === "verified" && BigInt(position.rawBalance ?? "0") > 0n) ?? [];
  const changePolicy = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setDecision(null);
    setReview(null);
    setReviewState("policy_changed");
  };

  return (
    <main className="app-page">
      <header className="app-header">
        <Link href="/" className="wordmark">DrawRail</Link>
        <div className="app-header-meta">
          <EnvironmentBadge mode={appMode} />
          {walletStandard.connection && <span className="wallet-chip" title={walletStandard.connection.address}>{walletStandard.connection.name} · {shorten(walletStandard.connection.address)}</span>}
          {!walletStandard.connection && portfolio && <span className="wallet-chip read-only" title={portfolio.wallet}>Read only · {shorten(portfolio.wallet)}</span>}
        </div>
      </header>

      <div className="app-shell">
        <div className="app-context">
          <p className="eyebrow">Portfolio drawdown</p>
          <p>{appMode === "mainnet-funded" ? "Real transaction mode · Review every amount before signing." : "Public safe mode · Live review available; financial execution disabled."}</p>
        </div>

        {error && <div className="alert alert-error" role="alert"><b>Action needed</b><span>{error}</span></div>}

        {stage === "wallet" && (
          <WalletEntryScreen
            wallets={walletStandard.wallets}
            connecting={walletStandard.connecting}
            walletError={walletStandard.error}
            onConnect={(wallet) => void walletStandard.connect(wallet)}
            readOnlyWallet={readOnlyWallet}
            setReadOnlyWallet={setReadOnlyWallet}
            onReadOnlySubmit={loadReadOnlyPortfolio}
            busy={busy === "portfolio"}
          />
        )}

        {portfolio && stage === "portfolio" && (
          <PortfolioScreen portfolio={portfolio} fundedCount={funded.length} walletMode={walletMode} walletName={walletStandard.connection?.name} onDisconnect={() => void walletStandard.disconnect()} onRequest={() => setStage("request")} onChangeWallet={() => { setPortfolio(null); setDecision(null); setReview(null); setWalletMode(null); setStage("wallet"); }} />
        )}

        {portfolio && stage === "request" && (
          <RequestScreen
            portfolio={portfolio}
            target={target}
            setTarget={changePolicy(setTarget)}
            floors={floors}
            setFloors={changePolicy(setFloors)}
            slippage={slippage}
            setSlippage={changePolicy(setSlippage)}
            referenceProtection={referenceProtection}
            setReferenceProtection={changePolicy(setReferenceProtection)}
            divergenceLimit={divergenceLimit}
            setDivergenceLimit={changePolicy(setDivergenceLimit)}
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
            onReview={() => void openReview(false)}
            canReview={canBuildWalletReview(walletMode, walletStandard.connection?.address ?? null, decision.wallet)}
            busy={busy === "decision"}
          />
        )}

        {portfolio && decision?.selected && stage === "review" && (
          review
            ? <ReviewScreen review={review} walletName={walletStandard.connection?.name ?? "Connected wallet"} reviewState={reviewState} executionResult={executionResult} signOnlyEvidence={signOnlyEvidence} busy={busy} decisionCreatedAt={decision.createdAt} onSignOnly={() => void signReview("sign-only")} onExecute={() => void signReview("execute")} onCheckStatus={() => void checkExecutionStatus()} onExpired={() => setReviewState("quote_expired")} onBack={() => setStage("decision")} onRefreshTransaction={refreshExpiredReview} onRefreshDecision={() => { setReview(null); setExecutionResult(null); setStage("decision"); setReviewState("refresh_required"); }} />
            : <ReviewProgress state={reviewState} busy={busy === "review"} onBack={() => setStage("decision")} />
        )}
      </div>
    </main>
  );
}

function WalletEntryScreen(props: {
  wallets: readonly Wallet[];
  connecting: string | null;
  walletError: string | null;
  onConnect: (wallet: Wallet) => void;
  readOnlyWallet: string;
  setReadOnlyWallet: (value: string) => void;
  onReadOnlySubmit: (event: FormEvent) => void;
  busy: boolean;
}) {
  return (
    <section className="connect-panel panel wallet-connect-panel" aria-labelledby="connect-title">
      <div>
        <span className="screen-index">01</span>
        <p className="eyebrow">Wallet-owned portfolio</p>
        <h1 id="connect-title">Connect your Solana wallet.</h1>
        <p>Connection only shares your public address. DrawRail does not request a message or transaction signature.</p>
        <div className="wallet-options" aria-label="Compatible wallets">
          {props.wallets.length === 0
            ? <div className="wallet-empty"><b>No compatible injected wallet detected</b><span>Install or unlock a Wallet Standard wallet with Solana v0 transaction support.</span></div>
            : props.wallets.map((wallet) => <button key={wallet.name} className="wallet-option" onClick={() => props.onConnect(wallet)} disabled={props.connecting !== null}>
              <span className="wallet-option-mark">{wallet.name.slice(0, 1)}</span><span><b>{wallet.name}</b><small>Wallet Standard · Mainnet</small></span><i>{props.connecting === wallet.name ? "Connecting…" : "Connect"}</i>
            </button>)}
        </div>
        {props.walletError && <p className="field-error">{props.walletError}</p>}
      </div>
      <details className="developer-wallet-control">
        <summary>Developer read-only address</summary>
        <form onSubmit={props.onReadOnlySubmit} className="wallet-form">
          <label htmlFor="wallet">Wallet public key</label>
          <input id="wallet" value={props.readOnlyWallet} onChange={(event) => props.setReadOnlyWallet(event.target.value)} required autoComplete="off" placeholder="Enter a public address" />
          <small>Read-only mode cannot construct a wallet-bound review. Never enter a private key or seed phrase.</small>
          <button className="button button-secondary" disabled={props.busy}>{props.busy ? "Reading live portfolio…" : "Load read-only wallet"}</button>
        </form>
      </details>
    </section>
  );
}

function PortfolioScreen({ portfolio, fundedCount, walletMode, walletName, onDisconnect, onRequest, onChangeWallet }: {
  portfolio: PortfolioDto; fundedCount: number; walletMode: "connected" | "read-only" | null; walletName?: string; onDisconnect: () => void; onRequest: () => void; onChangeWallet: () => void;
}) {
  return (
    <section className="screen-stack" aria-labelledby="portfolio-title">
      <div className="screen-heading">
        <div><p className="eyebrow">Live portfolio</p><h1 id="portfolio-title">Available liquidity and supported exposure.</h1></div>
        <div className="portfolio-wallet-actions"><span className={`state-pill ${walletMode === "connected" ? "stable" : "neutral"}`}>{walletMode === "connected" ? `${walletName ?? "Wallet"} connected` : "Read-only address"}</span><button className="text-button" onClick={walletMode === "connected" ? onDisconnect : onChangeWallet}>{walletMode === "connected" ? "Disconnect" : "Change address"}</button></div>
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
  referenceProtection: boolean; setReferenceProtection: (value: boolean) => void;
  divergenceLimit: string; setDivergenceLimit: (value: string) => void;
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
        <ReferenceProtectionControl {...props} />
        <div className="form-footer"><p>DrawRail will re-read the portfolio and use live Jupiter ExactIn quotes. No signature or transaction will be requested.</p><button className="button" disabled={props.busy}>{props.busy ? "Evaluating balances → multipliers → quotes…" : "Evaluate portfolio"}</button></div>
      </form>
    </section>
  );
}

function ReferenceProtectionControl(props: {
  portfolio: PortfolioDto;
  referenceProtection: boolean;
  setReferenceProtection: (value: boolean) => void;
  divergenceLimit: string;
  setDivergenceLimit: (value: string) => void;
}) {
  const available = props.portfolio.pyth.assets.TSLAx.status === "available";
  return <div className={`pyth-control ${available ? "available" : "unavailable"}`}>
    <div>
      <span className={`status-icon ${available ? "selected" : "neutral"}`}>{available ? "✓" : "○"}</span>
      <div>
        <b>Tesla reference protection</b>
        <p>{available ? "Blocks TSLAx when its live Jupiter execution price is too far from a fresh Pyth Tesla reference." : props.portfolio.pyth.message}</p>
        <small>AAPLx: {pythAssetLabel(props.portfolio.pyth.assets.AAPLx.status)} · NVDAx: {pythAssetLabel(props.portfolio.pyth.assets.NVDAx.status)} · TSLAx: {pythAssetLabel(props.portfolio.pyth.assets.TSLAx.status)}</small>
      </div>
    </div>
    {available ? <div className="pyth-policy-inputs">
      <label className="protection-toggle"><input type="checkbox" checked={props.referenceProtection} onChange={(event) => props.setReferenceProtection(event.target.checked)} /> <span>Reference protection</span></label>
      {props.referenceProtection && <label>Maximum gap <span className="inline-percent"><input inputMode="decimal" min="0" max="10" step="0.01" value={props.divergenceLimit} onChange={(event) => props.setDivergenceLimit(event.target.value)} required /><i>%</i></span></label>}
    </div> : <span className="state-pill neutral">{pythStatusLabel(props.portfolio.pyth.service)}</span>}
  </div>;
}

function DecisionScreen({ decision, onBack, onRefresh, onReview, canReview, busy }: {
  decision: DecisionDto; onBack: () => void; onRefresh: (event: FormEvent) => void; onReview: () => void; canReview: boolean; busy: boolean;
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
      <div className={`reference-result ${decision.pyth.status}`}><b>Reference protection</b><span>{decision.pyth.message}</span></div>
      {decision.selected && <SelectedDecision candidate={decision.selected} />}
      <div className="alternatives"><div className="section-row"><div><p className="eyebrow">Every supported position</p><h2>Why each candidate landed here</h2></div><span>Deterministic V1 rule</span></div>{decision.candidates.map((candidate) => <CandidateRow key={candidate.symbol} candidate={candidate} />)}</div>
      <div className="decision-actions">
        <button className="text-button" onClick={onBack}>Change request</button>
        <form onSubmit={onRefresh}><button className="button button-secondary" disabled={busy}>{busy ? "Refreshing…" : "Refresh decision"}</button></form>
        {decision.selected && <button className="button" onClick={onReview} disabled={!canReview}>{canReview ? <>Build exact review <span aria-hidden>→</span></> : "Connect wallet to review"}</button>}
      </div>
      {decision.selected && !canReview && <div className="alert"><b>Read-only decision</b><span>Connect the same wallet to obtain and validate a wallet-bound Jupiter transaction. A pasted address cannot sign or execute.</span></div>}
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
      {candidate.pyth && <ReferenceEvidence candidate={candidate} />}
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
      <div className="candidate-reason"><b>{candidate.reasonCode.replaceAll("_", " ")}</b><p>{candidate.reason}</p>{candidate.reasonCode === "RETAINED_FLOOR" && <small>Would leave approximately ${usdc(candidate.retainedExecutableValue)} against a ${usdc(candidate.retainedFloor)} floor.</small>}{candidate.pyth && <ReferenceEvidence candidate={candidate} />}</div>
      {candidate.minimumUsdc && <div className="candidate-output"><span>Minimum output</span><b>${usdc(candidate.minimumUsdc)}</b></div>}
      {candidate.quote && <CandidateInspect candidate={candidate} />}
    </article>
  );
}

function ReferenceEvidence({ candidate }: { candidate: CandidateDto }) {
  const evidence = candidate.pyth!;
  return <div className={`reference-evidence ${evidence.status}`}>
    <b>{evidence.status === "valid" ? "PASS" : "BLOCKED"}</b>
    <span>{evidence.status === "valid" ? `Fresh ${stockName(candidate.symbol)} reference` : evidence.reasonCode === "PYTH_DIVERGENCE" && evidence.divergenceDirection ? `Current executable ${candidate.symbol} price is ${evidence.divergenceDirection} the fresh Tesla reference.` : evidence.message}</span>
    {evidence.divergenceBps && <small>{candidate.symbol} is {bpsToPercent(evidence.divergenceBps)}% from reference · Limit {bpsToPercent(evidence.thresholdBps)}%</small>}
  </div>;
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
    {candidate.pyth && <>
      <InspectRow label="Pyth policy result" value={`${candidate.pyth.reasonCode}: ${candidate.pyth.message}`} />
      <InspectRow label="Divergence" value={candidate.pyth.divergenceBps ? `${candidate.pyth.divergenceBps} bps` : "not calculated"} />
      <InspectRow label="Divergence threshold" value={`${candidate.pyth.thresholdBps} bps`} />
      <InspectRow label="Pyth reference feed ID" value={candidate.pyth.reference ? String(candidate.pyth.reference.feedId) : "unavailable"} />
      <InspectRow label="Pyth session" value={candidate.pyth.reference?.marketSession ?? "unavailable"} />
      <InspectRow label="Pyth timestampUs" value={candidate.pyth.reference?.timestampUs ?? "unavailable"} />
      <InspectRow label="Pyth feedUpdateTimestamp" value={candidate.pyth.reference?.feedUpdateTimestamp ?? "unavailable"} />
      <InspectRow label="Pyth feed age" value={candidate.pyth.referenceAgeUs ? `${candidate.pyth.referenceAgeUs} μs` : "unavailable"} />
      <InspectRow label="Pyth confidence" value={candidate.pyth.reference?.confidence ?? "unavailable"} />
      <InspectRow label="Pyth publisher count" value={candidate.pyth.reference ? String(candidate.pyth.reference.publisherCount) : "unavailable"} />
      <InspectRow label="Pyth reference price" value={candidate.pyth.reference ? `${candidate.pyth.reference.price} × 10^${candidate.pyth.reference.exponent}` : "unavailable"} />
      <InspectRow label="Displayed TSLAx sale" value={candidate.pyth.displayedSaleAmount ?? "unavailable"} />
      <InspectRow label="Jupiter expected output" value={candidate.pyth.expectedUsdcOutput ?? "unavailable"} />
      <InspectRow label="Jupiter minimum output" value={candidate.pyth.minimumUsdcOutput ?? "unavailable"} />
      <InspectRow label="Executable TSLAx price" value={candidate.pyth.executablePrice ?? "unavailable"} />
      <InspectRow label="Minimum-output price" value={candidate.pyth.minimumExecutablePrice ?? "unavailable"} />
    </>}
  </div></details>;
}

function ReviewProgress({ state, busy, onBack }: { state: ReviewState; busy: boolean; onBack: () => void }) {
  const labels: Record<ReviewState, string> = {
    decision_ready: "Decision ready",
    building_transaction: "Building wallet-bound Jupiter order…",
    validating_transaction: "Validating transaction message and lookup tables…",
    review_ready: "Review ready",
    quote_expired: "Quote expired",
    policy_changed: "Policy or live economics changed",
    wallet_changed: "Wallet changed",
    transaction_invalid: "Transaction could not be validated",
    refresh_required: "Fresh decision required",
  };
  return <section className="empty-decision panel review-progress"><span className={`status-icon ${busy ? "neutral" : "blocked"}`}>{busy ? "…" : "×"}</span><p className="eyebrow">Exact transaction review</p><h1>{labels[state]}</h1><p>{busy ? "DrawRail is obtaining a fresh final order, resolving its v0 message, and binding it to the reviewed policy." : "No transaction was accepted. Return to the decision and refresh live state."}</p><button className="button button-secondary" onClick={onBack}>Back to decision</button></section>;
}

function ReviewScreen({ review, walletName, reviewState, executionResult, signOnlyEvidence, busy, decisionCreatedAt, onSignOnly, onExecute, onCheckStatus, onExpired, onBack, onRefreshTransaction, onRefreshDecision }: {
  review: TransactionReviewDto;
  walletName: string;
  reviewState: ReviewState;
  executionResult: ExecutionResultDto | null;
  signOnlyEvidence: string | null;
  busy: "portfolio" | "decision" | "review" | "signing" | "executing" | null;
  decisionCreatedAt: string;
  onSignOnly: () => void;
  onExecute: () => void;
  onCheckStatus: () => void;
  onExpired: () => void;
  onBack: () => void;
  onRefreshTransaction: () => void;
  onRefreshDecision: () => void;
}) {
  const selected = review.decision.selected!;
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.max(0, Math.ceil((Date.parse(review.expiresAt) - Date.now()) / 1000)));
  useEffect(() => {
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil((Date.parse(review.expiresAt) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [review.expiresAt]);
  useEffect(() => { if (remainingSeconds === 0 && reviewState === "review_ready") onExpired(); }, [remainingSeconds, reviewState, onExpired]);
  const expired = reviewState === "quote_expired" || remainingSeconds === 0;
  const usable = reviewState === "review_ready" && !expired;
  const unchanged = review.decision.candidates.filter((candidate) => candidate.symbol !== selected.symbol);
  const policySnapshotStillRecent = canRefreshTransactionOnly(decisionCreatedAt);
  if (executionResult) return <SettlementScreen review={review} result={executionResult} busy={busy === "executing"} onCheckStatus={onCheckStatus} onRefresh={onRefreshDecision} />;
  return (
    <section className="screen-stack review-screen" aria-labelledby="review-title">
      <div className="screen-heading"><div><p className="eyebrow">Verified transaction review</p><h1 id="review-title">The exact wallet-bound message is ready to inspect.</h1></div><span className={`decision-state ${expired || remainingSeconds < 10 ? "blocked" : "actionable"}`}>{expired ? "Quote expired" : remainingSeconds < 10 ? `Expires in about ${remainingSeconds}s — act now` : `About ${remainingSeconds}s remaining`}</span></div>
      <div className="request-summary review-request-summary">
        <div><span>You requested</span><strong>${usdc(review.decision.targetUsdc)}</strong></div>
        <i>−</i><div><span>Already available</span><strong>${usdc(review.decision.existingUsdc)}</strong></div>
        <i>=</i><div className="summary-emphasis"><span>DrawRail will raise</span><strong>${usdc(review.decision.missingUsdc)}</strong></div>
      </div>
      <div className="review-card">
        <div className="review-leg"><span>Selected position · Reduce</span><strong>{compactDecimal(selected.displayedReduction ?? "0")} {selected.symbol}</strong><small>Exact raw input: {review.order.inAmount}</small></div>
        <span className="review-arrow" aria-hidden>→</span>
        <div className="review-leg receive"><span>Expected</span><strong>${usdc(review.order.outAmount)} USDC</strong><small>Minimum: ${usdc(review.order.otherAmountThreshold)} USDC</small></div>
      </div>
      <div className="review-facts">
        <div><span>Connected wallet</span><b title={review.wallet}>{walletName} · {shorten(review.wallet)}</b></div>
        <div><span>Remaining {selected.symbol} exposure</span><b>${usdc(selected.retainedExecutableValue)}</b></div>
        <div><span>Retained floor</span><b>${usdc(selected.retainedFloor)}</b></div>
        <div><span>Other positions</span><b>{unchanged.map((candidate) => candidate.symbol).join(", ")} unchanged</b></div>
        <div><span>Jupiter fee</span><b>{review.order.feeBps ? `${review.order.feeBps} bps · ${review.order.feeMint ? shorten(review.order.feeMint) : "mint not returned"}` : "Not returned"}</b></div>
        <div><span>Reference protection</span><b>{review.finalPyth?.status === "valid" ? "Tesla check passed" : review.receiptPayload.pyth.state === "unavailable" ? `Unavailable for ${selected.symbol}` : "Not applied"}</b></div>
      </div>
      <div className="rules-review"><p className="eyebrow">Your rules</p><div className="check-grid">
        {[...selected.checks, ...review.economicInvariants, ...review.transaction.invariants].map((item, index) => <div key={`${item.code}-${index}`} className="check passed"><span>✓</span>{"label" in item ? item.label : item.detail}</div>)}
      </div></div>
      {review.finalPyth && <ReferenceEvidence candidate={{ ...selected, pyth: review.finalPyth }} />}
      <div className={`alert milestone-boundary ${expired ? "alert-error" : ""}`}><b>{expired ? "Quote expired" : "Your wallet has not signed anything yet."}</b><span>{expired ? "This message can no longer progress. Refresh the decision and build a new order." : "Your wallet will sign this exact reviewed message. DrawRail will verify it before the one permitted Jupiter submission."}</span></div>
      {signOnlyEvidence && <div className="alert"><b>Sign-only validation passed</b><span>{signOnlyEvidence} This expired test order cannot be reused.</span></div>}
      {!review.execution.credentialsConfigured && <div className="alert alert-error"><b>Execution unavailable — deployment credentials incomplete</b><span>No wallet prompt or financial submission is available until the server is configured.</span></div>}
      {review.execution.credentialsConfigured && !review.execution.operatorEnabled && <div className="alert"><b>Funded execution gate closed</b><span>Complete sign-only validation, then explicitly enable the operator gate. Current cap: {review.execution.maxMainnetDrawdownUsdc} USDC.</span></div>}
      {review.execution.credentialsConfigured && review.execution.operatorEnabled && !review.execution.fundedMode && <div className="alert"><b>Mainnet read-only mode</b><span>Switch the deployment to its explicit funded-validation mode before the money-moving control can be used.</span></div>}
      {!review.execution.withinSafetyCap && <div className="alert alert-error"><b>Above funded-validation safety cap</b><span>This drawdown exceeds the temporary {review.execution.maxMainnetDrawdownUsdc} USDC deployment cap. It cannot be signed for execution.</span></div>}
      <details className="inspect transaction-inspect"><summary>Inspect transaction</summary><div className="inspect-grid">
        <InspectRow label="Connected wallet / taker" value={review.wallet} />
        <InspectRow label="Input mint" value={review.order.inputMint} />
        <InspectRow label="Output mint" value={review.order.outputMint} />
        <InspectRow label="Raw / displayed input" value={`${review.order.inAmount} / ${selected.displayedReduction} ${selected.symbol}`} />
        <InspectRow label="Expected / minimum output" value={`${review.order.outAmount} / ${review.order.otherAmountThreshold} raw USDC`} />
        <InspectRow label="Final-order sizing attempts" value={String(review.finalOrderSearch.attempts)} />
        <InspectRow label="Initial / final raw input" value={`${review.finalOrderSearch.initialRawInput} / ${review.finalOrderSearch.finalRawInput}`} />
        <InspectRow label="Initial / final minimum output" value={`${review.finalOrderSearch.initialMinimumOutput} / ${review.finalOrderSearch.finalMinimumOutput} raw USDC`} />
        <InspectRow label="Jupiter fee" value={review.order.feeBps ? `${review.order.feeBps} bps in ${review.order.feeMint ?? "unreported mint"}` : "not returned"} />
        <InspectRow label="Platform fee" value={review.order.platformFee ? JSON.stringify(review.order.platformFee) : "not returned"} />
        <InspectRow label="Router / mode" value={`${review.order.router ?? "not returned"} / ${review.order.mode ?? "not returned"}`} />
        <InspectRow label="Request ID" value={review.order.requestId} />
        <InspectRow label="Recent blockhash" value={review.transaction.recentBlockhash} />
        <InspectRow label="Transaction version" value={String(review.transaction.version)} />
        <InspectRow label="Message SHA-256" value={review.transaction.messageHash} />
        <InspectRow label="Decision receipt expiry" value={review.expiresAt} />
        <InspectRow label="Effective expiry basis" value={review.expiry.source.replaceAll("_", " ")} />
        <InspectRow label="Review block height" value={review.expiry.reviewBlockHeight} />
        <InspectRow label="Last valid block height" value={review.order.lastValidBlockHeight ?? "not returned"} />
        <InspectRow label="Lookup tables" value={review.transaction.lookupTables.length ? review.transaction.lookupTables.join(", ") : "none"} />
        <InspectRow label="Resolved accounts" value={String(review.transaction.resolvedAddressCount)} />
        <InspectRow label="Outer programs" value={review.transaction.outerProgramIds.join(", ")} />
        <InspectRow label="Input token account" value={review.transaction.inputTokenAccount} />
        <InspectRow label="USDC destination" value={review.transaction.outputTokenAccount} />
        <InspectRow label="Simulated raw input debit" value={review.transaction.simulatedInputDebit} />
        <InspectRow label="Simulated USDC credit" value={review.transaction.simulatedOutputCredit} />
        <InspectRow label="Registry version" value={review.receiptPayload.registryVersion} />
        <InspectRow label="Pyth evidence hash" value={review.receiptPayload.pyth.evidenceHash ?? "not applied"} />
      </div></details>
      <div className="decision-actions"><button className="text-button" onClick={onBack}>Back to decision</button>{!usable && (policySnapshotStillRecent ? <button className="button button-secondary" onClick={onRefreshTransaction}>Refresh transaction</button> : <button className="button button-secondary" onClick={onRefreshDecision}>Refresh decision</button>)}<button className="button button-secondary" onClick={onSignOnly} disabled={!usable || busy !== null || !review.execution.credentialsConfigured}>{busy === "signing" ? "Waiting for wallet…" : "Sign-only safety check"}</button><button className="button" onClick={onExecute} disabled={!usable || busy !== null || !review.execution.available} title={!review.execution.available ? "Funded execution is disabled in this public deployment." : undefined}>{busy === "executing" ? "Waiting for wallet…" : `Sign and execute drawdown`}</button></div>
    </section>
  );
}

function SettlementScreen({ review, result, busy, onCheckStatus, onRefresh }: { review: TransactionReviewDto; result: ExecutionResultDto; busy: boolean; onCheckStatus: () => void; onRefresh: () => void }) {
  const selected = review.decision.selected!;
  const confirmed = result.state === "confirmed";
  const investigation = result.state === "confirmed_needs_investigation";
  const signature = result.settlement?.signature ?? result.execution?.signature ?? null;
  const title = confirmed ? "Drawdown complete" : investigation ? "Confirmed — needs investigation" : result.state === "unknown" ? "Execution status unknown" : "Drawdown not completed";
  return <section className="screen-stack review-screen" aria-labelledby="settlement-title">
    <div className="screen-heading"><div><p className="eyebrow">Settlement receipt</p><h1 id="settlement-title">{title}</h1></div><span className={`decision-state ${confirmed ? "actionable" : "blocked"}`}>{result.state.replaceAll("_", " ")}</span></div>
    {result.state === "unknown" && <div className="alert alert-error"><b>We submitted this transaction but cannot yet prove its final status.</b><span>DrawRail will not submit it again. Check the same signature onchain before starting another drawdown.</span></div>}
    {investigation && <div className="alert alert-error"><b>The transaction succeeded onchain, but its accounting evidence differs from the review.</b><span>Do not retry. Preserve this receipt for investigation.</span></div>}
    <div className="review-card"><div className="review-leg"><span>Reduced</span><strong>{compactDecimal(selected.displayedReduction ?? "0")} {selected.symbol}</strong><small>{result.settlement?.inputDebit ?? review.order.inAmount} raw</small></div><span className="review-arrow" aria-hidden>→</span><div className="review-leg receive"><span>Raised</span><strong>${usdc(result.settlement?.usdcCredit ?? result.execution?.totalOutputAmount ?? "0")} USDC</strong><small>Reviewed minimum: ${usdc(review.order.otherAmountThreshold)}</small></div></div>
    {signature && <a className="button" href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer">View on Solscan</a>}
    <details className="inspect transaction-inspect"><summary>Inspect settlement</summary><div className="inspect-grid">
      <InspectRow label="Solana signature" value={signature ?? "not returned"} /><InspectRow label="RPC slot" value={result.settlement?.slot ?? result.execution?.slot ?? "unconfirmed"} /><InspectRow label="Raw input" value={review.order.inAmount} /><InspectRow label="Reviewed expected / minimum" value={`${review.order.outAmount} / ${review.order.otherAmountThreshold}`} /><InspectRow label="Actual RPC USDC credit" value={result.settlement?.usdcCredit ?? "not established"} /><InspectRow label="Jupiter total input / output" value={`${result.execution?.totalInputAmount ?? "not returned"} / ${result.execution?.totalOutputAmount ?? "not returned"}`} /><InspectRow label="Jupiter route input / output" value={`${result.execution?.inputAmountResult ?? "not returned"} / ${result.execution?.outputAmountResult ?? "not returned"}`} /><InspectRow label="Jupiter fee" value={review.order.feeBps ? `${review.order.feeBps} bps · ${result.settlement?.jupiterFeeAmount ?? "unreconciled"} raw in ${review.order.feeMint ?? "unreported mint"}` : "not returned"} /><InspectRow label="Router" value={review.order.router ?? "not returned"} /><InspectRow label="Request ID" value={review.order.requestId} /><InspectRow label="Message hash" value={review.transaction.messageHash} /><InspectRow label="Receipt hash" value={review.receiptHash} /><InspectRow label="Discrepancies" value={result.settlement?.discrepancies.join(", ") || "none"} />
    </div></details>
    <div className="decision-actions">{result.state === "unknown" && <button className="button" onClick={onCheckStatus} disabled={busy}>{busy ? "Checking…" : "Check status"}</button>}<button className="button button-secondary" onClick={onRefresh}>Start a fresh drawdown</button></div>
  </section>;
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

function pythStatusLabel(status: PortfolioDto["pyth"]["service"]) {
  return ({
    disabled: "Disabled",
    available: "Available",
    unavailable: "Unavailable",
    not_entitled: "Not entitled",
    unhealthy: "Unhealthy",
    unit_unverified: "Units unverified",
  } as const)[status];
}

function pythAssetLabel(status: PortfolioDto["pyth"]["assets"]["TSLAx"]["status"]) {
  return status === "available" ? "available" : status === "not_entitled" ? "not entitled" : status;
}

function stockName(symbol: CandidateDto["symbol"]) {
  return ({ AAPLx: "Apple", NVDAx: "Nvidia", TSLAx: "Tesla" } as const)[symbol];
}

function bpsToPercent(value: string) {
  const decimal = value.includes(".") ? value : `${value}.0`;
  const [whole, fraction = ""] = decimal.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  const scale = fraction.length + 2;
  const padded = digits.padStart(scale + 1, "0");
  const split = padded.length - scale;
  return `${padded.slice(0, split)}.${padded.slice(split).replace(/0+$/, "") || "00"}`;
}
