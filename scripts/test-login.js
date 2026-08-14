const { chromium } = require("playwright");
const BASE = "http://localhost:3003";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Capture console errors
  page.on("console", msg => console.log("CONSOLE:", msg.type(), msg.text()));
  page.on("pageerror", err => console.log("PAGE ERROR:", err.message));

  console.log("1. Going to login...");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  console.log("2. Filling login form...");
  await page.fill('#username', "admin");
  await page.fill('#password', "admin123");
  await page.click('button[type="submit"]');

  console.log("3. Waiting for redirect...");
  await page.waitForURL(BASE + "/", { timeout: 15000 }).catch(() => console.log("  No redirect, URL:", page.url()));
  await page.waitForTimeout(5000);

  console.log("4. Current URL:", page.url());
  console.log("5. Page title:", await page.title());

  // Check page content
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log("6. Body text:", bodyText);

  // Check for specific sections
  const hasSchedules = await page.locator("text=Meeting Schedules").count();
  const hasAnnouncements = await page.locator("text=Announcements").count();
  console.log("7. Has 'Meeting Schedules':", hasSchedules);
  console.log("8. Has 'Announcements':", hasAnnouncements);

  await page.screenshot({ path: "/tmp/test-screenshot.png" });
  console.log("9. Screenshot saved to /tmp/test-screenshot.png");

  await browser.close();
}

main().catch(e => console.error(e));
