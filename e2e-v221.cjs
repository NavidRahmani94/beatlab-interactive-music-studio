// v0.22.1: the piano roll lights the row of a note that is played from the computer keyboard (and a click on a note name), in easy and advanced
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await (await b.newContext({ viewport: { width: 1280, height: 1100 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  let bad = 0; const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.goto(process.argv[2]); await p.waitForTimeout(1200);
  await p.locator('[role=tab]:has-text("MELODY")').first().click(); await p.waitForTimeout(400);
  const live = () => p.locator('.roll .mrow.live .mlabel').allInnerTexts();
  ok('nothing is lit before a key is pressed', (await live()).length === 0);
  const key = (k, c, down) => p.evaluate(([k, c, d]) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { key: k, code: c, bubbles: true })), [k, c, down]);
  await key('a', 'KeyA', true); await p.waitForTimeout(150); const l1 = await live(); ok('pressing a key lights one row', l1.length === 1, JSON.stringify(l1));
  await key('s', 'KeyS', true); await p.waitForTimeout(150); const l2 = await live(); ok('two keys light two rows (chord)', l2.length === 2, JSON.stringify(l2));
  await key('a', 'KeyA', false); await key('s', 'KeyS', false); await p.waitForTimeout(500); ok('the lights go out after release', (await live()).length === 0);
  const adv = p.getByRole('switch', { name: /ADVANCED/i }).or(p.getByRole('button', { name: /ADVANCED/i })).first();
  if (await adv.count()) { await adv.click(); await p.waitForTimeout(300); await key('d', 'KeyD', true); await p.waitForTimeout(150); ok('also lit in ADVANCED mode', (await live()).length === 1, JSON.stringify(await live())); await key('d', 'KeyD', false); await p.waitForTimeout(400); }
  const label = p.locator('.roll .mlabel.key').nth(2); await label.dispatchEvent('pointerdown', { pointerId: 1 }).catch(() => {}); await p.waitForTimeout(150);
  ok('clicking a note name lights its row too', (await live()).length === 1, JSON.stringify(await live())); await label.dispatchEvent('pointerup', { pointerId: 1 }).catch(() => {}); await p.waitForTimeout(300);
  ok('no page errors', errs.length === 0, errs.join('|').slice(0, 300)); console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
})();
