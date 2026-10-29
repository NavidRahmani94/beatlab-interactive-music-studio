const { chromium } = require('playwright');
const URL = process.argv[2]; const results = [];
const ok = (n, c, d = '') => { results.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  [' + d + ']' : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1000);
  const modes = await p.$$eval('[aria-label="Visual style"] button', e => e.map(x => x.textContent));
  ok('4 styles offered', modes.join() === 'BARS,RINGS,PARTICLES,AURORA', modes.join());
  const snap = () => p.$eval('canvas.viz-canvas', c => { const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < x.length; i += 4) if (x[i] > 0) n++; return n; });
  await p.click('button.play >> nth=0'); await p.waitForTimeout(1500);
  for (const m of modes) {
    await p.click(`[aria-label="Visual style"] button:text-is("${m}")`); await p.waitForTimeout(1200);
    const n = await snap(); ok(`${m} draws something while playing`, n > 200, String(n));
  }
  await p.click('[aria-label="Visual style"] button:text-is("AURORA")');
  await p.reload(); await p.waitForTimeout(800);
  ok('style is remembered', await p.getAttribute('[aria-label="Visual style"] button:text-is("AURORA")', 'aria-pressed') === 'true');
  // frame cost while playing
  await p.click('button.play >> nth=0'); await p.waitForTimeout(800);
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => { n++; performance.now() - t < 2000 ? requestAnimationFrame(f) : r(n / 2); }; f(); }));
  ok('stays smooth while playing (headless, 2 cores)', fps > 20, fps.toFixed(0) + ' fps');
  ok('no page errors', errs.length === 0, errs.join('|'));
  await b.close(); const f = results.filter(x => !x).length; console.log(f ? f + ' FAILED' : 'ALL PASSED'); process.exit(f ? 1 : 0);
})();
