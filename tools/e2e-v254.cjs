// v0.25.4: THIS PATTERN / LISTEN ALONE only borrow the PATTERN mode; after STOP the whole song plays again
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await (await b.newContext({ viewport: { width: 1280, height: 1300 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  let bad = 0; const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.goto(process.argv[2]); await p.waitForTimeout(1200);
  const modeSel = async () => (await p.locator('.seg button.sel', { hasText: /^(PATTERN|SONG)$/ }).first().textContent());
  ok('starts in SONG mode', (await modeSel()) === 'SONG');
  await p.locator('[role=tab]:has-text("MELODY")').first().click(); await p.waitForTimeout(300);
  const tools = p.locator('.roll-tools').first();
  await tools.locator('.mini-play.pat').click(); await p.waitForTimeout(700);
  ok('THIS PATTERN switches to PATTERN mode while it plays', (await modeSel()) === 'PATTERN');
  await tools.locator('.mini-play.pat').click(); await p.waitForTimeout(500);
  ok('after stopping, the mode is SONG again', (await modeSel()) === 'SONG');
  await tools.locator('.mini-play:not(.pat)').click(); await p.waitForTimeout(700);
  ok('PLAY now plays the whole song', (await modeSel()) === 'SONG' && (await tools.locator('.mini-play.pat.on').count()) === 0);
  await tools.locator('.mini-play:not(.pat)').click(); await p.waitForTimeout(400);
  // a mode that the user chose by hand stays
  await p.locator('.seg button', { hasText: /^PATTERN$/ }).first().click(); await p.waitForTimeout(200);
  await tools.locator('.mini-play:not(.pat)').click(); await p.waitForTimeout(500); await tools.locator('.mini-play:not(.pat)').click(); await p.waitForTimeout(400);
  ok('a mode chosen by hand is kept after STOP', (await modeSel()) === 'PATTERN');
  ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
})();
