const { chromium } = require("playwright");
const BASE = "http://localhost:3003";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);

  // Scroll to Roles section
  await page.evaluate(() => {
    const el = document.querySelector("#roles");
    if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/roles-current.png" });
  console.log("Saved roles screenshot");

  await browser.close();
}
main().catch(e => console.error(e));
