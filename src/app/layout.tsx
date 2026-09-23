import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Stocklana Milestone 1",
  description: "Read-only mainnet correctness validation",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
