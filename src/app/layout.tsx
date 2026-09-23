import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Stocklana — Policy-preserving portfolio drawdown",
  description: "Turn tokenized-stock exposure into USDC without breaking the portfolio rules you already chose.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
