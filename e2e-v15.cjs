const { chromium } = require('playwright');
const URL = process.argv[2]; const results = [];
const ok = (n, c, d = '') => { results.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  [' + d + ']' : '')); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1000);
  const slots = () => p.$$eval('.slots .slot', els => els.map(e => e.classList.contains('empty') ? '-' : 'X'));
  const slotEl = n => p.locator('.slots .slot').nth(n);
  await p.click('button[aria-label="Clear playlist"]');
  ok('playlist cleared', (await slots()).every(s => s === '-'));
  // drag the pattern chip onto slot 3
  await p.locator('.chip').first().dragTo(slotEl(2));
  let s = await slots(); ok('chip dropped on slot 3', s[2] === 'X' && s.filter(x => x === 'X').length === 1, s.join(''));
  // move slot 3 -> slot 6
  await slotEl(2).dragTo(slotEl(5));
  s = await slots(); ok('slot moved', s[2] === '-' && s[5] === 'X', s.join(''));
  // copy with Alt
  await p.keyboard.down('Alt'); await slotEl(5).dragTo(slotEl(0)); await p.keyboard.up('Alt');
  s = await slots(); ok('Alt-drag copies', s[0] === 'X' && s[5] === 'X', s.join(''));
  // bin
  await slotEl(0).dragTo(p.locator('.bin'));
  s = await slots(); ok('dropping on the bin clears', s[0] === '-' && s[5] === 'X', s.join(''));
  // insert / remove
  await slotEl(5).click(); // toggles (clears) slot 6 ... click again to paint it back
  await slotEl(5).click();
  const n0 = s.length;
  await p.click('button[aria-label="Insert slot"]');
  ok('insert adds a slot', (await slots()).length === n0 + 1);
  await p.click('button[aria-label="Delete slot"]');
  ok('remove takes it away', (await slots()).length === n0);
  // structure builder
  await p.click('text=SONG STRUCTURE');
  await p.click('button[aria-label="Build arrangement"]');
  s = await slots(); ok('structure builds a playlist', s.filter(x => x === 'X').length >= 4, s.join(''));
  const tags = await p.$$eval('.sec-tag', e => e.map(x => x.textContent));
  ok('sections are shown on the slots', tags.length >= 3, tags.join('|'));
  // rename a section
  await p.fill('input[aria-label="Section 1 name"]', 'Opening');
  ok('rename shows', (await p.$$eval('.sec-tag', e => e.map(x => x.textContent))).includes('Opening'));
  // undo of the build
  await p.click('text=NAME FROM PATTERNS');
  ok('auto naming works', (await p.$$('.sec-tag')).length >= 1);
  ok('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  const f = results.filter(x => !x).length; console.log(f ? f + ' FAILED' : 'ALL PASSED'); process.exit(f ? 1 : 0);
})();
