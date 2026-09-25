import { mkdir } from "node:fs/promises";
import { chromium, type BrowserContext } from "playwright-core";

const baseUrl = process.env.DRAWRAIL_SCREENSHOT_URL ?? "https://drawrail.vercel.app";
const walletAddress = process.env.DRAWRAIL_SCREENSHOT_WALLET ?? "2QfBNK2WDwSLoUQRb1zAnp3KM12N9hQ8q6ApwUMnWW2T";
const output = new URL("../stocklana-context/screenshots/", import.meta.url).pathname;

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });

try {
  await capturePage("/", 1440, 1000, "final-landing-desktop.png");
  await capturePage("/", 390, 844, "final-landing-mobile.png", true);
  await capturePage("/validation", 1440, 1000, "final-mainnet-receipt.png");
  await capturePage("/validation", 390, 844, "final-mainnet-receipt-mobile.png", true);
  await captureElement("/validation", ".recorded-review", "final-recorded-transaction-review.png");
  await captureElement("/validation", ".pyth-proof", "final-pyth-pass-block.png");

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await registerNonSigningWallet(context);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  await page.evaluate("window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: ({ register }) => register(window.__drawRailTestWallet) }))");
  await page.getByRole("button", { name: /Evidence Wallet/ }).click();
  await page.getByRole("heading", { name: "Available liquidity and supported exposure." }).waitFor({ timeout: 45_000 });
  await page.screenshot({ path: `${output}final-connected-portfolio.png`, fullPage: true });

  const currentUsdc = Number((await page.locator(".liquidity-card strong").innerText()).replace(/[$,]/g, ""));
  await page.getByRole("button", { name: /Request USDC/ }).click();
  await page.locator("#target").fill((currentUsdc + 1).toFixed(6));
  const floorInputs = page.locator(".floor-row input");
  await floorInputs.nth(0).fill("0");
  await floorInputs.nth(1).fill("999999");
  await floorInputs.nth(2).fill("999999");
  await page.screenshot({ path: `${output}final-request-usdc.png`, fullPage: true });

  await page.getByRole("button", { name: "Evaluate portfolio" }).click();
  await page.getByRole("heading", { name: /One position can meet|No position can safely/ }).waitFor({ timeout: 90_000 });
  await page.screenshot({ path: `${output}final-actionable-decision.png`, fullPage: true });
  const blocked = page.locator(".candidate-row.rejected").first();
  if (await blocked.count()) await blocked.screenshot({ path: `${output}final-blocked-retained-floor.png` });

  await context.close();
} finally {
  await browser.close();
}

async function captureElement(path: string, selector: string, name: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  await page.locator(selector).screenshot({ path: `${output}${name}` });
  await context.close();
}

async function capturePage(path: string, width: number, height: number, name: string, isMobile = false) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${output}${name}`, fullPage: true });
  await context.close();
}

async function registerNonSigningWallet(context: BrowserContext) {
  await context.addInitScript({ content: `
    (() => {
      const account = Object.freeze({ address: ${JSON.stringify(walletAddress)}, publicKey: new Uint8Array(32), chains: Object.freeze(["solana:mainnet"]), features: Object.freeze(["solana:signTransaction"]) });
      const wallet = Object.freeze({
        version: "1.0.0", name: "Evidence Wallet", icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>", chains: Object.freeze(["solana:mainnet"]), accounts: Object.freeze([]),
        features: Object.freeze({
          "standard:connect": Object.freeze({ version: "1.0.0", connect: async () => ({ accounts: [account] }) }),
          "standard:disconnect": Object.freeze({ version: "1.0.0", disconnect: async () => undefined }),
          "standard:events": Object.freeze({ version: "1.0.0", on: () => () => undefined }),
          "solana:signTransaction": Object.freeze({ version: "1.0.0", supportedTransactionVersions: Object.freeze([0]), signTransaction: async () => { throw new Error("Signing is forbidden in the final screenshot harness."); } }),
        }),
      });
      window.__drawRailTestWallet = wallet;
      window.addEventListener("wallet-standard:app-ready", (event) => event.detail.register(wallet));
    })();
  ` });
}
