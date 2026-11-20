const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }); const c = await b.newContext({ permissions: ['camera'], viewport: { width: 1280, height: 1000 } }); const p = await c.newPage();
 await p.addInitScript(() => { window.__BEATLAB_HAND_MOCK__ = async () => ({ detect: () => window.__hands ?? [], close() {} }); });
 await p.goto(process.argv[2]); await p.waitForTimeout(1200); const pn = p.locator('section.hand'); await pn.scrollIntoViewIfNeeded(); await pn.screenshot({ path: '../hand_off.png' });
 await pn.getByRole('switch').click(); await p.waitForTimeout(1500); await pn.screenshot({ path: '../hand_on.png' }); await b.close(); })();
