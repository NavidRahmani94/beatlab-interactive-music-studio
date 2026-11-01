const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
 await p.goto(process.argv[2]); await p.waitForTimeout(1500); await p.getByRole('button', { name: /^play/i }).first().click(); await p.waitForTimeout(3000);
 await p.locator('.mixer').scrollIntoViewIfNeeded(); await p.locator('.mixer').screenshot({ path: '../mixer_lvl.png' }); await b.close(); })();
