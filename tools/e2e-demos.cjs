const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, 'e2e-out'); fs.mkdirSync(OUT, { recursive: true });
const URL = process.argv[2];
const NAMES = [['Lo-Fi Chill', 'Groove A'], ['House 124', 'Groove'], ['Trap 140', 'Hook'], ['Persian Mood', 'Avaz'], ['Synthwave 108', 'Verse'], ['Chiptune 150', 'Level']];
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_TUNNEL/.test(m.text())) errs.push(m.text()); }); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1000);
  for (const [name, pat] of NAMES) {
    await p.selectOption('select[aria-label="Load sample project"]', name);
    await p.waitForTimeout(300);
    await p.click('[aria-label="Play mode"] >> text="PATTERN"');
    await p.click(`button[aria-label="Select pattern ${pat}"]`);
    const t0 = Date.now();
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 280000 }), p.click('button.export-btn')]);
    const f = path.join(OUT, 'demo_' + name.replace(/\W+/g, '_') + '.wav'); await d.saveAs(f);
    console.log(name, pat, ((Date.now() - t0) / 1000).toFixed(1) + 's', (await p.textContent('.status')).trim().slice(0, 110));
  }
  console.log('errors', errs);
  await b.close();
})();
