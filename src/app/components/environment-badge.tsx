export function EnvironmentBadge({ mode = "mainnet-read-only" }: { mode?: string }) {
  const label = mode === "synthetic-devnet"
    ? "Devnet — synthetic assets"
    : mode === "mainnet-funded"
      ? "Mainnet — real transaction"
      : "Mainnet — Read only";
  return <span className={`environment-badge ${mode}`}><i aria-hidden />{label}</span>;
}
