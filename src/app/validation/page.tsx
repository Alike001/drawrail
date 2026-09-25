import Link from "next/link";

const signature = "4fk7YBSP2pjGoxbW91CHZZaU9dStZ5y2M73j3UTbdYefk5ESjTmnYvwQx2gwnEAnctorjzX58KASAvx2PULdM2uN";

export default function ValidationPage() {
  return <main className="validation-page">
    <nav className="public-nav" aria-label="Validation navigation"><Link href="/" className="wordmark">DrawRail</Link><Link href="/app" className="button button-small">Launch DrawRail <span aria-hidden>↗</span></Link></nav>
    <section className="validation-hero shell">
      <div><p className="eyebrow">Recorded Mainnet validation · 24 September 2026</p><h1>One reviewed drawdown, proven by wallet balance changes.</h1><p className="lede">This page replays recorded evidence from DrawRail’s completed low-value AAPLx → USDC validation. It does not construct, sign, submit, or repeat a transaction.</p></div>
      <span className="evidence-stamp"><i aria-hidden>✓</i> Finalized on Solana</span>
    </section>
    <section className="recorded-review shell" aria-label="Recorded exact transaction review">
      <div className="receipt-heading"><div><p className="eyebrow">Recorded exact review · superseded by finalized evidence</p><h2>The wallet approved these bound economics.</h2></div><span className="decision-state read-only">Cannot be reused</span></div>
      <div className="request-summary review-request-summary"><div><span>Requested liquidity</span><strong>$0.50</strong></div><i>→</i><div><span>Selected position</span><strong>AAPLx</strong></div><i>→</i><div className="summary-emphasis"><span>Reviewed minimum</span><strong>$0.500002</strong></div></div>
      <div className="review-card"><div className="review-leg"><span>Reduce</span><strong>≈0.001499 AAPLx</strong><small>Exact raw input: 149435</small></div><span className="review-arrow" aria-hidden>→</span><div className="review-leg receive"><span>Expected</span><strong>0.502515 USDC</strong><small>Minimum: 0.500002 USDC</small></div></div>
      <div className="review-facts"><div><span>Wallet / destination</span><b>4C2Gz…bkwvR</b></div><div><span>Router</span><b>Metis</b></div><div><span>Jupiter fee</span><b>10 bps · USDC</b></div><div><span>Retained floors</span><b>Preserved</b></div><div><span>Multiplier window</span><b>Safe</b></div><div><span>Reference protection</span><b>Not applied · AAPLx</b></div></div>
      <div className="alert"><b>Recorded validation evidence</b><span>This expired review is shown for audit and demo only. It cannot open a wallet, call Jupiter, or move funds.</span></div>
    </section>
    <section className="validation-receipt shell" aria-label="Recorded settlement receipt">
      <div className="receipt-heading"><div><p className="eyebrow">Settlement receipt</p><h2>Drawdown complete</h2></div><span className="decision-state actionable">Recorded evidence</span></div>
      <div className="review-card"><div className="review-leg"><span>Reduced</span><strong>≈0.001499 AAPLx</strong><small>149435 raw debit</small></div><span className="review-arrow" aria-hidden>→</span><div className="review-leg receive"><span>Wallet received</span><strong>0.502515 USDC</strong><small>Reviewed minimum: 0.500002 USDC</small></div></div>
      <div className="receipt-proof-grid">
        <div><span>Jupiter route</span><b>Metis · Success / 0</b></div><div><span>Gross route output</span><b>503018 raw USDC</b></div><div><span>Output-mint fee</span><b>503 raw USDC · 10 bps</b></div><div><span>RPC wallet credit</span><b>502515 raw USDC</b></div><div><span>Solana slot</span><b>450156253</b></div><div><span>Automatic retries</span><b>None</b></div>
      </div>
      <div className="rules-review"><p className="eyebrow">Verified invariants</p><div className="check-grid"><div className="check passed"><span>✓</span>Wallet debit matched the reviewed raw input</div><div className="check passed"><span>✓</span>RPC credit exceeded the reviewed minimum</div><div className="check passed"><span>✓</span>Jupiter wallet totals reconciled</div><div className="check passed"><span>✓</span>User signed the exact reviewed message</div></div></div>
      <a className="button proof-button" href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer">View transaction on Solscan <span aria-hidden>↗</span></a>
      <details className="inspect transaction-inspect"><summary>Inspect recorded evidence</summary><div className="inspect-grid"><div><dt>Transaction signature</dt><dd>{signature}</dd></div><div><dt>Raw AAPLx debit</dt><dd>149435</dd></div><div><dt>Reviewed expected / minimum</dt><dd>502515 / 500002 raw USDC</dd></div><div><dt>Jupiter route / wallet output</dt><dd>503018 / 502515 raw USDC</dd></div><div><dt>Pyth protection</dt><dd>Not applied — AAPLx validation</dd></div><div><dt>Evidence authority</dt><dd>Solana RPC owner/mint balance deltas</dd></div></div></details>
    </section>
    <section className="pyth-proof shell section-rule">
      <div className="section-heading"><p className="eyebrow">Pyth sponsor evidence · TSLAx only</p><h2>Fresh Tesla reference versus executable TSLAx economics.</h2></div>
      <div className="pyth-proof-grid"><article><span className="state-pill">Pass · 100 bps limit</span><h3>17.229701 bps from reference</h3><p>Authenticated feed 1435 was fresh in pre-market, with valid confidence and publisher count. TSLAx remained eligible.</p></article><article><span className="state-pill blocked">Blocked · 17 bps limit</span><h3>The same candidate was refused</h3><p>The executable price exceeded the tighter user limit, proving Pyth materially changes candidate eligibility.</p></article></div>
      <p className="data-note">AAPLx and NVDAx reference protection remain unavailable under the current trial entitlement. DrawRail does not claim otherwise.</p>
    </section>
    <footer className="public-footer shell"><span>Recorded evidence only · No transaction action on this page</span><Link href="/">Back to DrawRail</Link></footer>
  </main>;
}
