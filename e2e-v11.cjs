const { chromium } = require('playwright');
const URL = process.argv[2]; const results = [];
const ok = (n, c, d = '') => { results.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  [' + d + ']' : '')); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1000);
  await p.click('button[role="tab"]:text-is("DRUMS")');
  const clap = i => p.getAttribute(`button[aria-label="clap step ${i}"]`, 'aria-pressed');
  ok('undo/redo start disabled', await p.isDisabled('button[aria-label="Undo"]') && await p.isDisabled('button[aria-label="Redo"]'));
  const c0 = await clap(2);
  await p.click('button[aria-label="clap step 2"]'); await p.waitForTimeout(800);
  ok('a change enables undo', !(await p.isDisabled('button[aria-label="Undo"]')) && (await clap(2)) !== c0);
  await p.click('button[aria-label="Undo"]'); await p.waitForTimeout(200);
  ok('undo reverts the step', (await clap(2)) === c0);
  ok('redo is now enabled', !(await p.isDisabled('button[aria-label="Redo"]')));
  await p.click('button[aria-label="Redo"]'); await p.waitForTimeout(200);
  ok('redo applies it again', (await clap(2)) !== c0);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  ok('Ctrl+Z works', (await clap(2)) === c0);
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(200);
  ok('Ctrl+Shift+Z works', (await clap(2)) !== c0);
  // two quick clicks = one step
  await p.click('button[aria-label="clap step 6"]'); await p.click('button[aria-label="clap step 7"]'); await p.waitForTimeout(800);
  await p.click('button[aria-label="Undo"]'); await p.waitForTimeout(200);
  ok('quick changes undo together', (await clap(6)) === 'false' && (await clap(7)) === 'false' && (await clap(2)) !== c0);
  // delete a track, then undo brings it back with its notes
  await p.click('button[role="tab"]:text-is("MELODY")');
  const notes = () => p.$$eval('section[aria-label="Melody track"] button[aria-pressed="true"][data-step]', e => e.length);
  await p.click('section[aria-label="Melody track"] button[data-step="1"] >> nth=4'); await p.waitForTimeout(800);
  const n0 = await notes();
  await p.click('button[aria-label^="Delete track"]'); await p.waitForTimeout(800);
  let tabs = await p.$$eval('button[role="tab"]', e => e.map(x => x.textContent.trim()));
  ok('track deleted', !tabs.includes('MELODY'), tabs.join('|'));
  await p.click('button[aria-label="Undo"]'); await p.waitForTimeout(300);
  await p.click('button[role="tab"]:text-is("MELODY")');
  ok('undo brings the track and its notes back', (await notes()) === n0 && n0 > 0, `${n0}`);

  // autosave: change, wait, reload -> offered; restore brings it back
  await p.click('button[role="tab"]:text-is("DRUMS")'); await p.click('button[aria-label="clap step 10"]'); await p.waitForTimeout(2500);
  await p.reload(); await p.waitForTimeout(1200);
  ok('after reload the restore banner is shown', await p.isVisible('.restore-banner'));
  await p.click('button:text-is("RESTORE IT")'); await p.click('button[role="tab"]:text-is("DRUMS")');
  ok('restore brings back the unsaved change', (await clap(10)) === 'true' && (await clap(2)) !== c0);
  ok('restored project is marked unsaved', /UNSAVED/i.test(await p.textContent('body')));
  // discard
  await p.click('button[aria-label="clap step 12"]'); await p.waitForTimeout(2500); await p.reload(); await p.waitForTimeout(1200);
  await p.click('button:text-is("DISCARD")'); await p.reload(); await p.waitForTimeout(1000);
  ok('discarded autosave is gone', !(await p.isVisible('.restore-banner')));
  // saving clears it
  await p.click('button[role="tab"]:text-is("DRUMS")'); await p.click('button[aria-label="clap step 3"]'); await p.waitForTimeout(2500);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:text-is("SAVE")')]); await dl.path(); await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(1000);
  ok('after SAVE nothing is offered', !(await p.isVisible('.restore-banner')));
  ok('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED', results.filter(Boolean).length + '/' + results.length);
})();
