const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
 await p.goto(process.argv[2]); await p.waitForTimeout(1500); const pn = p.locator('section.panel', { has: p.getByRole('button', { name: /^.+ octave up$/i }) }).first();
 await pn.screenshot({ path: '../octave_ui.png' }); await b.close(); })();
