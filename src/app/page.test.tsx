import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "./page";
import { EnvironmentBadge } from "./components/environment-badge";
import ValidationPage from "./validation/page";

describe("public product explanation", () => {
  it("explains the product and labels marketing data as illustrative without a wallet", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html).toContain("Need liquidity? Keep your portfolio rules.");
    expect(html).toContain("DrawRail turns tokenized-stock exposure into USDC");
    expect(html).toContain("Illustrative example");
    expect(html).toContain('data-kind="illustrative"');
    expect(html).toContain('href="/app"');
    expect(html).toContain("Launch DrawRail");
    expect(html).not.toContain("Connect wallet");
  });

  it("renders explicit environment provenance labels", () => {
    expect(renderToStaticMarkup(<EnvironmentBadge mode="mainnet-read-only" />)).toContain("Mainnet — read only");
    expect(renderToStaticMarkup(<EnvironmentBadge mode="synthetic-devnet" />)).toContain("Devnet — synthetic assets");
  });

  it("labels recorded Mainnet settlement and Pyth evidence without offering a transaction action", () => {
    const html = renderToStaticMarkup(<ValidationPage />);
    expect(html).toContain("Recorded Mainnet validation");
    expect(html).toContain("502515");
    expect(html).toContain("Cannot be reused");
    expect(html).toContain("17.229701 bps");
    expect(html).toContain("No transaction action on this page");
    expect(html).not.toContain("Sign and execute");
  });
});
