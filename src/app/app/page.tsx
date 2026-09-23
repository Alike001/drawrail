import { DrawdownApp } from "./drawdown-app";

export default function AppPage() {
  return (
    <DrawdownApp
      defaultWallet={process.env.NEXT_PUBLIC_READ_ONLY_WALLET ?? ""}
      appMode={process.env.NEXT_PUBLIC_APP_MODE ?? "mainnet-read-only"}
    />
  );
}
