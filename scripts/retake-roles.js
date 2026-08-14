const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const BASE = "http://localhost:3003";
const OUT = "/home/lucas/nb/noticeboard/docs/screenshots";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Hide logo
  await page.addStyleTag({ content: `img[src*="jwnb_logo"] { visibility: hidden !important; }` });

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(5000);

  // Scroll to Roles & Assignments section
  await page.evaluate(() => {
    const el = document.querySelector("#roles");
    if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "03-roles.png") });
  console.log("Saved 03-roles.png");

  await browser.close();
}
main().catch(e => console.error(e));
