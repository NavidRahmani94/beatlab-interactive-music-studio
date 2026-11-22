// v0.23.1: Space plays / stops from anywhere, also while a button, slider or menu still has the focus; text fields keep their own Space
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await (await b.newContext({ viewport: { width: 1280, height: 1100 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  let bad = 0; const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.goto(process.argv[2]); await p.waitForTimeout(1200);
  const playing = async () => (await p.getByRole('button', { name: 'Stop (quick)' }).count()) > 0;
  const space = async () => { await p.keyboard.press('Space'); await p.waitForTimeout(900); };
  await p.mouse.click(5, 5); await p.waitForTimeout(200);
  ok('starts stopped', !(await playing()));
  await space(); ok('Space starts playback', await playing());
  await space(); ok('Space stops playback', !(await playing()));
  // focus stays on a button after a mouse click: Space must still toggle once (and not press that button)
  const tab = p.locator('[role=tab]:has-text("LEAD")').first(); await tab.click(); await p.waitForTimeout(300);
  await tab.focus(); await space(); ok('Space plays while a tab button has the focus', await playing());
  await tab.focus(); await space(); ok('Space stops again from the same button', !(await playing()));
  ok('the focused button was not clicked twice (MELODY tab still selected)', (await tab.getAttribute('aria-selected')) === 'true');
  // a slider that was just used
  const range = p.locator('input[type=range]').first();
  if (await range.count()) { const v0 = await range.inputValue(); await range.focus(); await space(); ok('Space plays while a slider has the focus', await playing()); ok('and the slider value did not change', (await range.inputValue()) === v0); await space(); ok('Space stops from the slider', !(await playing())); }
  // text field keeps its own space
  const txt = p.locator('input[type=text], input:not([type]), textarea').first();
  if (await txt.count()) { await txt.focus(); const v = await txt.inputValue(); await p.keyboard.press('Space'); await p.waitForTimeout(500); ok('Space inside a text field does not start playback', !(await playing())); await txt.fill(v); }
  // holding Space (repeat) toggles only once
  await p.mouse.click(5, 5); await p.keyboard.down('Space'); for (let i = 0; i < 4; i++) await p.keyboard.down('Space'); await p.keyboard.up('Space'); await p.waitForTimeout(900);
  ok('holding Space toggles once', await playing());
  await space(); ok('stopped at the end', !(await playing()));
  ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
})();
