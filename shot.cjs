const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [w, h, n] of [[1280, 1000, 'desk'], [390, 800, 'phone']]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    await p.goto('http://localhost:4173/'); await p.waitForTimeout(1200);
    await p.locator('.timeline').scrollIntoViewIfNeeded(); await p.locator('.transport').screenshot({ path: `/tmp/tl_${n}.png` });
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); console.log(n, 'horizontal overflow', over);
  }
  await b.close();
})();
