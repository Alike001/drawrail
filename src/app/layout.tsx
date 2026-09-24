import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "DrawRail — Policy-preserving liquidity on Solana",
  description: "Policy-preserving liquidity for tokenized-stock portfolios on Solana.",
  openGraph: {
    title: "DrawRail",
    description: "Request USDC from a tokenized-stock portfolio and let DrawRail find a policy-compliant position reduction using live Solana state and Jupiter liquidity.",
    siteName: "DrawRail",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
