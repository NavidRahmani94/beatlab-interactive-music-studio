const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(1000);
  await p.click('button[role="tab"]:text-is("SYNTH")'); await p.click('text=CHORD BUILDER'); await p.click('button[aria-label^="Insert chord"] >> nth=0'); await p.click('button[aria-label^="Insert chord"] >> nth=3');
  await p.locator('.vel-lane').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.locator('section[aria-label="Synth track"] .roll-wrap').screenshot({ path: '/tmp/vel.png' }); await b.close();
})();
