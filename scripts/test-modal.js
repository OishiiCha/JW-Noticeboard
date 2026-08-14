const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on("console", msg => {
    if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text());
  });

  await page.goto("http://localhost:3003", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(5000);

  // Find and click a notice that opens the media modal (look for PhotoViewer toolbar)
  // First, let's click each image card until we find one with the media layout
  const result = await page.evaluate(async () => {
    const cards = Array.from(document.querySelectorAll("img[src*='/api/files/']"));
    for (const img of cards) {
      const card = img.closest("[class*='cursor-pointer']");
      if (!card) continue;
      card.click();
      await new Promise(r => setTimeout(r, 1500));
      // Check if the modal has the media layout (PhotoViewer with embedded toolbar)
      const dialog = document.querySelector("[role='dialog']");
      if (dialog) {
        const hasPhotoViewer = dialog.querySelector("button[title='Zoom in'], button[aria-label='Zoom in']");
        if (hasPhotoViewer) {
          return { found: true, src: img.src };
        }
        // Close and try next
        const closeBtn = dialog.querySelector("button[title='Close'], [data-slot='dialog-close']");
        if (closeBtn) closeBtn.click();
        await new Promise(r => setTimeout(r, 500));
      }
    }
    return { found: false };
  });
  console.log("Result:", JSON.stringify(result));
  await page.waitForTimeout(2000);

  if (!result.found) {
    console.log("No media modal found. Let's check what notices have fileName with image ext...");
    const resp = await fetch("http://localhost:3003/api/notices?visitor=true");
    const data = await resp.json();
    for (const n of data) {
      if (n.fileUrl || n.thumbnailUrl) {
        console.log(n.title?.substring(0, 40), "fileName:", n.fileName, "thumbnailUrl:", n.thumbnailUrl, "fileUrl:", n.fileUrl);
      }
    }
    await browser.close();
    return;
  }

  // Take screenshot of modal
  await page.screenshot({ path: "/tmp/modal-normal.png" });

  // Check the modal dimensions
  const modalInfo = await page.evaluate(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return "no dialog";
    const rect = dialog.getBoundingClientRect();
    const img = dialog.querySelector("img[class*='object-contain']");
    const mediaPane = img?.parentElement?.parentElement;
    return {
      dialog: { w: Math.round(rect.width), h: Math.round(rect.height), classes: dialog.className.substring(0, 150) },
      mediaPane: mediaPane ? { w: Math.round(mediaPane.getBoundingClientRect().width), h: Math.round(mediaPane.getBoundingClientRect().height), classes: mediaPane.className.substring(0, 150) } : null,
      img: img ? { w: Math.round(img.getBoundingClientRect().width), h: Math.round(img.getBoundingClientRect().height), naturalW: img.naturalWidth, naturalH: img.naturalHeight } : null,
    };
  });
  console.log("Modal info (normal):", JSON.stringify(modalInfo, null, 2));

  // Click expand button
  const expandClicked = await page.evaluate(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return "no dialog";
    const buttons = Array.from(dialog.querySelectorAll("button"));
    const expandBtn = buttons.find(b => b.getAttribute("title") === "Expand" || b.getAttribute("aria-label") === "Expand");
    if (expandBtn) {
      expandBtn.click();
      return "clicked";
    }
    return "buttons: " + buttons.map(b => b.getAttribute("title") || b.getAttribute("aria-label") || "?").join(", ");
  });
  console.log("Expand:", expandClicked);
  await page.waitForTimeout(1000);

  await page.screenshot({ path: "/tmp/modal-expanded.png" });

  const modalInfo2 = await page.evaluate(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return "no dialog";
    const rect = dialog.getBoundingClientRect();
    const img = dialog.querySelector("img[class*='object-contain']");
    const mediaPane = img?.parentElement?.parentElement;
    return {
      dialog: { w: Math.round(rect.width), h: Math.round(rect.height) },
      mediaPane: mediaPane ? { w: Math.round(mediaPane.getBoundingClientRect().width), h: Math.round(mediaPane.getBoundingClientRect().height) } : null,
      img: img ? { w: Math.round(img.getBoundingClientRect().width), h: Math.round(img.getBoundingClientRect().height) } : null,
    };
  });
  console.log("Modal info (expanded):", JSON.stringify(modalInfo2, null, 2));

  await browser.close();
}
main().catch(e => console.error(e));
