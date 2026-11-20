const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } }); let bad = 0; const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  const n = await p.locator('.lvl[data-ch]').count(); ok('every mixer channel has L/R meters', n >= 5, n);
  const w = () => p.evaluate(() => [...document.querySelectorAll('.lvl[data-ch]')].map(e => [e.dataset.ch, parseFloat(e.querySelector('.b0 i').style.width) || 0, parseFloat(e.querySelector('.b1 i').style.width) || 0]));
  const w2 = () => w();
  const idle = await w(); ok('meters empty when stopped', idle.every(x => x[1] === 0 && x[2] === 0), JSON.stringify(idle));
  await p.getByRole('button', { name: /^play/i }).first().click(); await p.waitForTimeout(1500);
  const offscreen = await w2(); ok('mixer off screen: meters stay idle (saves CPU)', offscreen.every(x => x[1] === 0 && x[2] === 0), JSON.stringify(offscreen));
  await p.locator('.mixer').scrollIntoViewIfNeeded(); await p.waitForTimeout(2000);
  let peak = {}; for (let i = 0; i < 40; i++) { (await w()).forEach(x => { peak[x[0]] = [Math.max(peak[x[0]]?.[0] || 0, x[1]), Math.max(peak[x[0]]?.[1] || 0, x[2])]; }); await p.waitForTimeout(80); }
  console.log(JSON.stringify(peak));
  ok('some channel shows signal while playing', Object.values(peak).some(v => v[0] > 5 || v[1] > 5));
  ok('kick channel moves', (peak.kick?.[0] || 0) > 5, JSON.stringify(peak.kick));
  // hard-pan the kick left: R must stay silent, L must move
  const knob = p.getByRole('slider', { name: /kick pan/i }).first(); await knob.focus(); for (let i = 0; i < 4; i++) await p.keyboard.press('Shift+ArrowLeft');
  await p.waitForTimeout(600); let pk = [0, 0]; for (let i = 0; i < 40; i++) { const r = (await w()).find(x => x[0] === 'kick'); pk = [Math.max(pk[0], r[1]), Math.max(pk[1], r[2])]; await p.waitForTimeout(80); }
  console.log('kick after hard-left pan', JSON.stringify(pk)); ok('hard-left pan: L moves, R silent', pk[0] > 5 && pk[1] < 2, JSON.stringify(pk));
  console.log(errs.length ? errs.join('\n') : 'no page errors'); ok('no page errors', errs.length === 0);
  console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close();
})();
