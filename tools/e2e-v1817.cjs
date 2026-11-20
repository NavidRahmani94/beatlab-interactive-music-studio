const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } }); let bad = 0;
  const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  const cells = p.locator('[data-midi][data-step="0"]'); const n = await cells.count(); ok('piano roll has rows', n > 4, n);
  const mid = await cells.nth(Math.floor(n / 2)).getAttribute('data-midi'); const mid2 = await cells.nth(Math.floor(n / 2) + 2).getAttribute('data-midi');
  const cell = (m, s) => p.locator(`[data-midi="${m}"][data-step="${s}"]`).first();
  await cell(mid, 0).click(); await cell(mid2, 4).click();
  const btn = p.locator('.slide-btn').nth(1); ok('two slide buttons', (await p.locator('.slide-btn').count()) >= 2);
  await btn.click(); ok('slide on', (await p.locator('.slide-btn.on').count()) === 1);
  await cell(mid, 8).click(); ok('slide still on after adding another note', (await p.locator('.slide-btn.on').count()) === 1, await p.locator('.slide-btn.on').count());
  await cell(mid, 8).click(); ok('slide still on after removing a note', (await p.locator('.slide-btn.on').count()) === 1);
  console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close();
})();
