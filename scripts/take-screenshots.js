const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:3003";
const OUT = "/home/lucas/nb/noticeboard/docs/screenshots";

// CSS to hide the logo for screenshots
const HIDE_LOGO_CSS = `
  img[src*="jwnb_logo"] { visibility: hidden !important; }
  link[rel*="icon"] { display: none !important; }
`;

async function injectHiddenLogo(page) {
  await page.addStyleTag({ content: HIDE_LOGO_CSS });
}

async function safeScroll(page, text) {
  try {
    const el = await page.locator(`text=${text}`).first();
    await el.scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(1500);
    return true;
  } catch {
    console.log(`  (Section "${text}" not found, skipping)`);
    return false;
  }
}

async function clickCard(page, text) {
  return await page.evaluate((searchText) => {
    const cards = document.querySelectorAll("[class*='cursor-pointer']");
    for (const card of cards) {
      if (card.textContent && card.textContent.includes(searchText)) {
        card.click();
        return true;
      }
    }
    return false;
  }, text);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // Clear old screenshots
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith(".png")) fs.unlinkSync(path.join(OUT, f));
  }

  const browser = await chromium.launch({ headless: true });

  // ─── Desktop (1440x900) ───
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dpage = await desktop.newPage();

  // Login as admin
  console.log("Logging in as admin...");
  await dpage.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await injectHiddenLogo(dpage);
  await dpage.waitForTimeout(2000);

  // Fill login form (username field, not email)
  try {
    await dpage.fill('#username', "admin");
    await dpage.fill('#password', "admin123");
    await dpage.click('button[type="submit"]');
    // Wait for redirect to complete
    await dpage.waitForURL(BASE + "/", { timeout: 15000 }).catch(() => {});
    await dpage.waitForTimeout(3000);
    console.log("  Logged in, URL:", dpage.url());
  } catch (e) {
    console.log("  Login failed:", e.message);
  }

  // Navigate to main page and wait for content
  await dpage.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await injectHiddenLogo(dpage);
  // Wait for the main content to appear
  await dpage.waitForSelector("text=Meeting Schedules", { timeout: 30000 }).catch(() => {});
  await dpage.waitForSelector("text=Announcements", { timeout: 10000 }).catch(() => {});
  await dpage.waitForTimeout(3000);

  // ─── 1. Hero + noticeboard top ───
  console.log("1. Hero + noticeboard top...");
  await dpage.screenshot({ path: path.join(OUT, "01-noticeboard-top.png") });

  // ─── 2. Meeting schedules ───
  console.log("2. Meeting schedules...");
  await safeScroll(dpage, "Meeting Schedules");
  await dpage.screenshot({ path: path.join(OUT, "02-schedules.png") });

  // ─── 3. Roles & Assignments ───
  console.log("3. Roles & Assignments...");
  await safeScroll(dpage, "Roles & Assignments");
  await dpage.screenshot({ path: path.join(OUT, "03-roles.png") });

  // ─── 4. Upcoming Events ───
  console.log("4. Upcoming Events...");
  await safeScroll(dpage, "Upcoming Events");
  await dpage.screenshot({ path: path.join(OUT, "04-events.png") });

  // ─── 5. Announcements grid ───
  console.log("5. Announcements...");
  await safeScroll(dpage, "Announcements");
  await dpage.screenshot({ path: path.join(OUT, "05-announcements.png") });

  // ─── 6. Detail modal (image notice) ───
  console.log("6. Detail modal (image)...");
  await dpage.evaluate(() => window.scrollTo(0, 0));
  await dpage.waitForTimeout(500);
  await safeScroll(dpage, "Kingdom Hall Cleanup");
  await dpage.waitForTimeout(500);
  if (await clickCard(dpage, "Kingdom Hall Cleanup")) {
    await dpage.waitForTimeout(2500);
    await dpage.screenshot({ path: path.join(OUT, "06-detail-modal.png") });
    await dpage.keyboard.press("Escape");
    await dpage.waitForTimeout(500);
  }

  // ─── 7. Add Item picker ───
  console.log("7. Add Item picker...");
  await dpage.evaluate(() => window.scrollTo(0, 0));
  await dpage.waitForTimeout(500);
  // Click the floating + button via JS
  try {
    const clicked = await dpage.evaluate(() => {
      const btn = document.querySelector("button.fixed.bottom-6.right-6");
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (clicked) {
      await dpage.waitForTimeout(2000);
      await dpage.screenshot({ path: path.join(OUT, "07-add-item-picker.png") });
      // Click "Midweek Meeting Schedule" option
      const scheduleClicked = await dpage.evaluate(() => {
        const els = document.querySelectorAll("*");
        for (const el of els) {
          if (el.textContent && el.textContent.includes("Midweek") && el.children.length < 3) {
            el.click(); return true;
          }
        }
        return false;
      });
      if (scheduleClicked) {
        await dpage.waitForTimeout(2500);
        await dpage.screenshot({ path: path.join(OUT, "08-schedule-modal.png") });
        await dpage.keyboard.press("Escape");
        await dpage.waitForTimeout(500);
      } else {
        await dpage.keyboard.press("Escape");
        await dpage.waitForTimeout(500);
      }
    } else {
      console.log("  (Add button not found)");
    }
  } catch {
    console.log("  (Add button not found)");
  }

  // ─── 8. Admin Settings modal ───
  console.log("8. Admin Settings...");
  // Wait for admin UI to load
  await dpage.waitForTimeout(2000);
  try {
    // Try clicking Manage button via JS (more reliable)
    const clicked = await dpage.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      for (const btn of buttons) {
        if (btn.textContent && btn.textContent.includes("Manage")) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      await dpage.waitForTimeout(3000);
      await dpage.screenshot({ path: path.join(OUT, "09-settings-meetings.png") });

      // Click Display tab
      const displayClicked = await dpage.evaluate(() => {
        const btns = document.querySelectorAll("button");
        for (const b of btns) {
          if (b.textContent && b.textContent.trim() === "Display") { b.click(); return true; }
        }
        return false;
      });
      if (displayClicked) {
        await dpage.waitForTimeout(1500);
        await dpage.screenshot({ path: path.join(OUT, "10-settings-display.png") });
      }

      // Click Map tab
      const mapClicked = await dpage.evaluate(() => {
        const btns = document.querySelectorAll("button");
        for (const b of btns) {
          if (b.textContent && b.textContent.trim() === "Map") { b.click(); return true; }
        }
        return false;
      });
      if (mapClicked) {
        await dpage.waitForTimeout(1500);
        await dpage.screenshot({ path: path.join(OUT, "11-settings-map.png") });
      }

      // Click Conventions tab
      const convClicked = await dpage.evaluate(() => {
        const btns = document.querySelectorAll("button");
        for (const b of btns) {
          if (b.textContent && b.textContent.trim() === "Conventions") { b.click(); return true; }
        }
        return false;
      });
      if (convClicked) {
        await dpage.waitForTimeout(1500);
        await dpage.screenshot({ path: path.join(OUT, "12-settings-conventions.png") });
      }

      // Close settings
      await dpage.keyboard.press("Escape");
      await dpage.waitForTimeout(500);
    } else {
      console.log("  (Manage button not found)");
    }
  } catch (e) {
    console.log("  (Settings error:", e.message, ")");
  }

  // ─── 10. Full page ───
  console.log("10. Full page...");
  await dpage.evaluate(() => window.scrollTo(0, 0));
  await dpage.waitForTimeout(500);
  await dpage.screenshot({ path: path.join(OUT, "13-full-page.png"), fullPage: true });

  await desktop.close();

  // ─── Mobile (390x844) ───
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  });
  const mpage = await mobile.newPage();

  console.log("11. Mobile: login + top...");
  await mpage.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await injectHiddenLogo(mpage);
  await mpage.waitForTimeout(2000);
  try {
    await mpage.fill('#username', "admin");
    await mpage.fill('#password', "admin123");
    await mpage.click('button[type="submit"]');
    await mpage.waitForURL(BASE + "/", { timeout: 15000 }).catch(() => {});
    await mpage.waitForTimeout(3000);
  } catch {}

  await mpage.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await injectHiddenLogo(mpage);
  await mpage.waitForSelector("text=Meeting Schedules", { timeout: 30000 }).catch(() => {});
  await mpage.waitForTimeout(3000);
  await mpage.screenshot({ path: path.join(OUT, "14-mobile-top.png") });

  console.log("12. Mobile: schedules...");
  await safeScroll(mpage, "Meeting Schedules");
  await mpage.screenshot({ path: path.join(OUT, "15-mobile-schedules.png") });

  console.log("13. Mobile: detail modal...");
  await mpage.evaluate(() => window.scrollTo(0, 0));
  await mpage.waitForTimeout(500);
  await safeScroll(mpage, "Kingdom Hall Cleanup");
  if (await clickCard(mpage, "Kingdom Hall Cleanup")) {
    await mpage.waitForTimeout(2500);
    await mpage.screenshot({ path: path.join(OUT, "16-mobile-detail-modal.png") });
    await mpage.keyboard.press("Escape");
  }

  await mobile.close();
  await browser.close();

  console.log("\n=== Screenshots complete! ===");
  const files = fs.readdirSync(OUT).filter(f => f.endsWith(".png"));
  console.log(`Saved ${files.length} screenshots to ${OUT}`);
  for (const f of files.sort()) {
    const stat = fs.statSync(path.join(OUT, f));
    console.log(`  ${f} (${(stat.size / 1024).toFixed(0)} KB)`);
  }
}

main().catch(e => { console.error("Screenshot error:", e); process.exit(1); });
