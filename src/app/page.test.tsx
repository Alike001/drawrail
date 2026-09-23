import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "./page";
import { EnvironmentBadge } from "./components/environment-badge";

describe("public product explanation", () => {
  it("explains the product and labels marketing data as illustrative without a wallet", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html).toContain("Turn tokenized-stock exposure into USDC");
    expect(html).toContain("Illustrative example");
    expect(html).toContain('data-kind="illustrative"');
    expect(html).toContain('href="/app"');
    expect(html).not.toContain("Connect wallet");
  });

  it("renders explicit environment provenance labels", () => {
    expect(renderToStaticMarkup(<EnvironmentBadge mode="mainnet-read-only" />)).toContain("Mainnet — Read only");
    expect(renderToStaticMarkup(<EnvironmentBadge mode="synthetic-devnet" />)).toContain("Devnet — synthetic assets");
  });
});
