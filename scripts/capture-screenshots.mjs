import { chromium } from "playwright";
const BASE = process.env.SCREENSHOT_URL ?? "http://127.0.0.1:3110";
const OUT = "docs/screenshots";

async function capture(label, scrollY = 0, fullPage = false) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  if (scrollY > 0) { await page.evaluate(y => window.scrollTo(0, y), scrollY); await page.waitForTimeout(500); }
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage });
  console.log(`Captured: ${label}.png`);
  await browser.close();
}

async function main() {
  await capture("00-full-page", 0, true);
  await capture("01-dashboard-hero");
  await capture("02-integration-health-workflows", 600);
  await capture("03-step-execution-trace", 1400);
  await capture("04-approval-gates", 2200);
  await capture("05-cost-tracking-audit", 3000);
}
main().catch(e => { console.error(e); process.exit(1); });
