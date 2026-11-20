const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } }); let bad = 0; const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  const panel = p.locator('section.panel', { has: p.getByRole('button', { name: /^.+ octave up$/i }) }).first();
  const rows = () => panel.evaluate(el => [...new Set([...el.querySelectorAll('[data-midi]')].map(e => +e.dataset.midi))].sort((a, b) => a - b));
  const before = await rows(); ok('easy shows one octave', before.length >= 5 && before.length <= 9, before.join());
  const up = panel.getByRole('button', { name: /^.+ octave up$/i }).first(); const down = panel.getByRole('button', { name: /^.+ octave down$/i }).first();
  ok('octave buttons exist in EASY', await up.count() === 1 && await down.count() === 1);
  await up.click(); const r1 = await rows(); ok('octave up shows rows 12 higher', r1[0] === before[0] + 12, r1.join());
  await down.click(); await down.click(); const r2 = await rows(); ok('octave down shows rows 12 lower than start', r2[0] === before[0] - 12, r2.join());
  // place a note, move all notes up an octave
  const cell = panel.locator(`[data-midi="${r2[2]}"][data-step="0"]`).first(); await cell.click();
  await panel.getByRole('button', { name: /notes one octave up$/i }).first().click(); await p.waitForTimeout(200);
  ok('note moved out of this view (shows the outside-the-view hint)', await panel.getByText(/OUTSIDE THIS VIEW STILL PLAY/).count() === 1);
  await panel.getByRole('button', { name: /^.+ octave up$/i }).first().click();
  ok('go to the octave above: the moved note is there', (await panel.locator(`[data-midi="${r2[2] + 12}"][data-step="0"].on`).count()) === 1);
  const nBefore = await p.getByRole('button', { name: /^.+ octave up$/i }).count();
  await panel.getByRole('button', { name: /^advanced$/i }).first().click(); await p.waitForTimeout(300);
  ok('advanced hides octave selector', await p.getByRole('button', { name: /^.+ octave up$/i }).count() === nBefore - 1);
  console.log(errs.length ? errs.join('\n') : 'no page errors'); ok('no page errors', errs.length === 0);
  console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close();
})();
