const { chromium } = require("playwright");
const BASE = "http://localhost:3003";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.fill('#username', "admin");
  await page.fill('#password', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(BASE + "/", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Click floating + button
  await page.evaluate(() => {
    const btn = document.querySelector("button.fixed.bottom-6.right-6");
    if (btn) btn.click();
  });
  await page.waitForTimeout(2000);

  // Click Midweek option
  await page.evaluate(() => {
    const els = document.querySelectorAll("*");
    for (const el of els) {
      if (el.textContent && el.textContent.includes("Midweek") && el.children.length < 3) {
        el.click(); return;
      }
    }
  });
  await page.waitForTimeout(2500);

  // Expand AI Prompt & Paste
  await page.evaluate(() => {
    const btns = document.querySelectorAll("button");
    for (const b of btns) {
      if (b.textContent && b.textContent.includes("AI Prompt & Paste")) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: "/tmp/test-ai-prompt.png", fullPage: false });
  console.log("Screenshot saved. URL:", page.url());

  // Also test public talk
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const btn = document.querySelector("button.fixed.bottom-6.right-6");
    if (btn) btn.click();
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const els = document.querySelectorAll("*");
    for (const el of els) {
      if (el.textContent && el.textContent.includes("Public Talk") && el.children.length < 3) {
        el.click(); return;
      }
    }
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const btns = document.querySelectorAll("button");
    for (const b of btns) {
      if (b.textContent && b.textContent.includes("AI Prompt & Paste")) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/test-ai-prompt-public.png", fullPage: false });
  console.log("Public talk screenshot saved.");

  await browser.close();
}

main().catch(e => console.error(e));
