export default function Page() {
  return (
    <main>
      <p className="eyebrow">Stocklana · Milestone 1</p>
      <h1>Read-only mainnet correctness</h1>
      <p>
        Supply a Solana wallet public key. This surface reads supported balances, validates live mint
        metadata and Scaled UI state, and obtains quote-only Jupiter orders. It never asks for a
        signature and never submits a transaction.
      </p>
      <form action="/api/validate" method="get">
        <label htmlFor="wallet">Wallet public key</label>
        <input id="wallet" name="wallet" required autoComplete="off" />
        <button type="submit">Generate JSON report</button>
      </form>
      <code>npm run validate:mainnet -- &lt;wallet-public-key&gt;</code>
    </main>
  );
}
