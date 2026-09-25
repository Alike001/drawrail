import Link from "next/link";

const example = {
  need: "$80 USDC",
  existing: "$20 USDC",
  missing: "$60",
  rejected: "NVDAx is blocked because selling enough would break its $600 retained floor.",
  selected: "AAPLx is eligible after the same preservation and execution checks.",
} as const;

export default function LandingPage() {
  return (
    <main className="landing">
      <nav className="public-nav" aria-label="Primary navigation">
        <Link href="/" className="wordmark">DrawRail</Link>
        <div className="public-nav-actions"><Link href="/validation" className="proof-link">Mainnet proof</Link><Link href="/app" className="button button-small">Launch DrawRail <span aria-hidden>↗</span></Link></div>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">Policy-preserving liquidity on Solana</p>
          <h1>Need liquidity? Keep your portfolio rules.</h1>
          <p className="lede">DrawRail turns tokenized-stock exposure into USDC without making you manually decide what to sell.</p>
          <p className="precision-line">Turn tokenized-stock exposure into USDC without breaking the portfolio rules you already chose.</p>
          <div className="hero-actions">
            <Link href="/app" className="button">Launch DrawRail <span aria-hidden>↗</span></Link>
            <Link href="/validation" className="text-button">View recorded Mainnet validation</Link>
            <span className="trust-line">Self-custodial · You review and sign · No autonomous trading</span>
          </div>
        </div>

        <aside className="example-card" data-kind="illustrative" aria-label="Illustrative 80 USDC drawdown example">
          <div className="card-kicker"><span>Illustrative example</span><span>01 / Decision</span></div>
          <div className="equation">
            <div><span>Need</span><strong>{example.need}</strong></div>
            <b aria-hidden>−</b>
            <div><span>Already have</span><strong>{example.existing}</strong></div>
            <b aria-hidden>=</b>
            <div className="equation-result"><span>Still need</span><strong>{example.missing}</strong></div>
          </div>
          <div className="example-result blocked-row"><span className="status-dot">×</span><div><b>NVDAx · Blocked</b><p>{example.rejected}</p></div></div>
          <div className="example-result selected-row"><span className="status-dot">✓</span><div><b>AAPLx · Eligible</b><p>{example.selected}</p></div></div>
        </aside>
      </section>

      <section className="steps shell section-rule" aria-labelledby="steps-title">
        <div className="section-heading"><p className="eyebrow">One request, one explainable action</p><h2 id="steps-title">From cash need to reviewed decision.</h2></div>
        <ol className="step-grid">
          <li><span>01</span><h3>Set the need and rules</h3><p>Enter your target USDC, retained-exposure floors, and maximum slippage.</p></li>
          <li><span>02</span><h3>Review the decision</h3><p>See one selected position, every rejected alternative, and the portfolio afterward.</p></li>
          <li><span>03</span><h3>Sign and verify</h3><p>You approve the exact action. Settlement evidence comes from wallet balance changes.</p></li>
        </ol>
      </section>

      <section className="difference shell section-rule">
        <div className="section-heading"><p className="eyebrow">Not another swap screen</p><h2>A swap starts with a token. DrawRail starts with your cash need.</h2></div>
        <div className="comparison">
          <div><span>Manual swap</span><p>“Which token do you want to sell?”</p></div>
          <div className="comparison-emphasis"><span>DrawRail</span><p>“How much USDC do you need, and which exposure must be preserved?”</p></div>
        </div>
      </section>

      <section className="integrations shell section-rule">
        <div className="section-heading"><p className="eyebrow">Why Solana is essential</p><h2>Portfolio state, execution rules, and evidence meet in one wallet action.</h2></div>
        <p><b>Token-2022 and xStocks</b> make raw transaction units differ from displayed economic amounts. <b>Jupiter</b> supplies current xStock → USDC routes. <b>Pyth</b>, when configured and explicitly required, adds session-aware reference protection; DrawRail never pretends that check ran when it did not.</p>
      </section>

      <section className="safety shell section-rule">
        <div><p className="eyebrow">Self-custody by construction</p><h2>Your rules decide what can proceed. Your wallet decides what gets signed.</h2></div>
        <ul>
          <li>DrawRail never stores a private key.</li>
          <li>Multiplier activation windows hard-block action.</li>
          <li>Technical route and amount evidence stays inspectable.</li>
          <li>Settlement is not claimed until wallet changes are verified.</li>
        </ul>
      </section>

      <section className="closing shell">
        <p className="eyebrow">Start with the need</p>
        <h2>Make one policy-compliant drawdown decision.</h2>
        <Link href="/app" className="button button-light">Launch DrawRail <span aria-hidden>↗</span></Link>
        <p>No transaction is sent until you review and sign.</p>
      </section>
      <footer className="public-footer shell"><span>DrawRail · Built for the Solana Foundation Stocklana hackathon</span><Link href="/validation">Verified Mainnet evidence</Link></footer>
    </main>
  );
}
