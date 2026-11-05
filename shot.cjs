const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 })).newPage();
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(1200); await p.locator('[role=tab]:has-text("MELODY")').first().click(); await p.waitForTimeout(300);
  for (const [k, c] of [['a', 'KeyA'], ['d', 'KeyD']]) await p.evaluate(([k, c]) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: c, bubbles: true })), [k, c]);
  await p.waitForTimeout(500); await p.locator('.roll-wrap').first().scrollIntoViewIfNeeded(); await p.locator('.roll-wrap').first().screenshot({ path: '../live.png' }); await b.close(); })();
