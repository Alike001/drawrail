import { describe, expect, it } from "vitest";
import { ASSET_REGISTRY, assetByMint } from "./assets";

describe("closed asset registry", () => {
  it("resolves an allowlisted mint", () => {
    expect(assetByMint(ASSET_REGISTRY.AAPLx.mint).symbol).toBe("AAPLx");
  });

  it("fails closed for an unsupported mint", () => {
    expect(() => assetByMint("11111111111111111111111111111111"))
      .toThrow("Unsupported mint");
  });
});
