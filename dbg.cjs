const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(() => { window.__osc = 0; const o = BaseAudioContext.prototype.createOscillator; BaseAudioContext.prototype.createOscillator = function () { window.__osc++; return o.apply(this, arguments); }; });
  const p = await ctx.newPage(); p.on('console', m => console.log('console:', m.text().slice(0, 200))); p.on('pageerror', e => console.log('ERR', e));
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(1000);
  await p.click('button:text-is("MELODY")'); await p.waitForTimeout(300);
  console.log('start', await p.evaluate(() => window.__osc));
  await p.keyboard.down('a'); await p.waitForTimeout(3000); console.log('after key a', await p.evaluate(() => window.__osc)); await p.keyboard.up('a');
  const lab = p.locator('section[aria-label="Melody track"] .mlabel.key').nth(3); const box = await lab.boundingBox();
  console.log(JSON.stringify(box), await p.evaluate(([x,y]) => { const e = document.elementFromPoint(x,y); return e.tagName + '.' + e.className + ' ' + (e.getAttribute('aria-label')||''); }, [box.x + 8, box.y + 6])); await p.mouse.move(box.x + 8, box.y + 6); await p.mouse.down(); await p.waitForTimeout(800); console.log('after label', await p.evaluate(() => window.__osc)); await p.mouse.up();
  await b.close();
})();
