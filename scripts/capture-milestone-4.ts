import { mkdir } from "node:fs/promises";
import { chromium, type BrowserContext } from "playwright-core";

const baseUrl = process.env.DRAWRAIL_SCREENSHOT_URL ?? "http://localhost:3000";
const walletAddress = process.env.DRAWRAIL_SCREENSHOT_WALLET ?? "2QfBNK2WDwSLoUQRb1zAnp3KM12N9hQ8q6ApwUMnWW2T";
const output = new URL("../stocklana-context/screenshots/", import.meta.url).pathname;

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });

try {
  await captureLanding(1440, 1000, "milestone-4-landing-desktop.png");
  await captureLanding(390, 844, "milestone-4-landing-mobile.png", true);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await registerReadOnlyTestWallet(context);
  const page = await context.newPage();
  page.on("console", (message) => process.stdout.write(`[browser] ${message.text()}\n`));
  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  await page.evaluate("window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: ({ register }) => register(window.__drawRailTestWallet) }))");
  process.stdout.write(`[wallet-harness] injected=${await page.evaluate("Boolean(window.__drawRailTestWallet)")} options=${await page.locator(".wallet-option").count()}\n`);
  await page.getByRole("button", { name: /Test Wallet/ }).click();
  await page.getByRole("heading", { name: "Available liquidity and supported exposure." }).waitFor({ timeout: 45_000 });
  await page.screenshot({ path: `${output}milestone-4-connected-portfolio.png`, fullPage: true });

  const currentUsdc = Number((await page.locator(".liquidity-card strong").innerText()).replace(/[$,]/g, ""));
  await page.getByRole("button", { name: /Request USDC/ }).click();
  await page.locator("#target").fill((currentUsdc + 1).toFixed(2));
  const floorInputs = page.locator(".floor-row input");
  await floorInputs.nth(0).fill("0");
  await floorInputs.nth(1).fill("999999");
  await floorInputs.nth(2).fill("999999");
  await page.screenshot({ path: `${output}milestone-4-request-usdc.png`, fullPage: true });

  await page.getByRole("button", { name: "Evaluate portfolio" }).click();
  await page.getByRole("heading", { name: /position can meet|No position can safely/ }).waitFor({ timeout: 90_000 });
  await page.screenshot({ path: `${output}milestone-4-actionable-decision.png`, fullPage: true });
  await page.locator(".candidate-row.rejected, .candidate-row.unavailable").first().screenshot({ path: `${output}milestone-4-blocked-alternative.png` });

  const reviewButton = page.getByRole("button", { name: /Build exact review/ });
  if (await reviewButton.isEnabled()) {
    await reviewButton.click();
    try {
      await page.getByRole("heading", { name: "The exact wallet-bound message is ready to inspect." }).waitFor({ timeout: 20_000 });
      await page.screenshot({ path: `${output}milestone-4-exact-transaction-review.png`, fullPage: true });
    } catch {
      await page.screenshot({ path: `${output}milestone-4-review-unavailable.png`, fullPage: true });
    }
  }
  await context.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await registerReadOnlyTestWallet(mobileContext);
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  await mobilePage.evaluate("window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: ({ register }) => register(window.__drawRailTestWallet) }))");
  await mobilePage.getByRole("button", { name: /Test Wallet/ }).click();
  await mobilePage.getByRole("heading", { name: "Available liquidity and supported exposure." }).waitFor({ timeout: 45_000 });
  await mobilePage.screenshot({ path: `${output}milestone-4-connected-portfolio-mobile.png`, fullPage: true });
  await mobileContext.close();
} finally {
  await browser.close();
}

async function captureLanding(width: number, height: number, name: string, isMobile = false) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${output}${name}`, fullPage: true });
  await context.close();
}

async function registerReadOnlyTestWallet(context: BrowserContext) {
  await context.addInitScript({ content: `
    (() => {
      const account = Object.freeze({
        address: ${JSON.stringify(walletAddress)},
        publicKey: new Uint8Array(32),
        chains: Object.freeze(["solana:mainnet"]),
        features: Object.freeze(["solana:signTransaction"]),
      });
      const wallet = Object.freeze({
        version: "1.0.0",
        name: "Test Wallet",
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
        chains: Object.freeze(["solana:mainnet"]),
        accounts: Object.freeze([]),
        features: Object.freeze({
          "standard:connect": Object.freeze({ version: "1.0.0", connect: async () => ({ accounts: [account] }) }),
          "standard:disconnect": Object.freeze({ version: "1.0.0", disconnect: async () => undefined }),
          "standard:events": Object.freeze({ version: "1.0.0", on: () => () => undefined }),
          "solana:signTransaction": Object.freeze({
            version: "1.0.0",
            supportedTransactionVersions: Object.freeze([0]),
            signTransaction: async () => { throw new Error("Signing is forbidden in the Milestone 4 screenshot harness."); },
          }),
        }),
      });
      window.__drawRailTestWallet = wallet;
      window.addEventListener("wallet-standard:app-ready", (event) => event.detail.register(wallet));
    })();
  ` });
}
