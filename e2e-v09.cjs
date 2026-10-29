const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, 'e2e-out'); fs.mkdirSync(OUT, { recursive: true });
const URL = process.argv[2]; const results = [];
const ok = (n, c, d = '') => { results.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  [' + d + ']' : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_TUNNEL/.test(m.text())) errs.push(m.text()); }); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1200);
  const theme = () => p.evaluate(() => document.documentElement.dataset.theme);
  const status = async () => (await p.textContent('.status')).trim();

  // ---- theme
  const first = await theme(); ok('theme is set on load', first === 'dark' || first === 'light', first);
  await p.click('button[aria-label="Colour theme"]'); const t1 = await theme();
  ok('theme button -> DARK', t1 === 'dark' && /DARK/.test(await p.textContent('.theme-btn')), t1);
  await p.screenshot({ path: path.join(OUT, 'dark.png') });
  await p.click('button[aria-label="Colour theme"]'); const t2 = await theme();
  ok('theme button -> LIGHT', t2 === 'light' && /LIGHT/.test(await p.textContent('.theme-btn')), t2);
  const bg = await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  ok('light theme has a light page background', /^rgb\((2[0-9]{2}|1[89][0-9])/.test(bg), bg);
  await p.screenshot({ path: path.join(OUT, 'light.png') });
  ok('theme choice is remembered after reload', await (async () => { await p.reload(); await p.waitForTimeout(800); return (await theme()) === 'light'; })());

  // ---- instrument library
  const groups = await p.$$eval('select[aria-label="Melody instrument"] optgroup', e => e.map(x => x.label));
  ok('instrument menu is grouped by family', groups.length >= 10, groups.join(' | '));
  const count = await p.$$eval('select[aria-label="Melody instrument"] option', e => e.length);
  ok('70+ instruments in the menu', count >= 70, String(count));
  for (const id of ['santur', 'ney', 'supersaw', 'rhodes', 'acidBass']) {
    await p.selectOption('select[aria-label="Melody instrument"]', id);
    ok('can pick ' + id, (await p.inputValue('select[aria-label="Melody instrument"]')) === id);
  }
  const kits = await p.$$eval('select[aria-label="Drum kit"] option', e => e.length).catch(() => 0);
  await p.click('button[role="tab"]:text-is("DRUMS")');
  const kitCount = await p.$$eval('select[aria-label="Drum kit"] option', e => e.length);
  ok('11 drum kits', kitCount === 11, String(kitCount));
  await p.selectOption('select[aria-label="Drum kit"]', 'trap'); ok('can pick the trap kit', (await p.inputValue('select[aria-label="Drum kit"]')) === 'trap');

  // ---- synth lab
  await p.click('button[role="tab"]:has-text("SYNTH LAB")');
  ok('Synth Lab opens', (await p.$('section[aria-label="Synth Lab"]')) !== null);
  ok('empty state before any synth', (await p.$('.lab-empty')) !== null);
  await p.click('button:has-text("NEW SYNTH")');
  ok('a synth chip appears', (await p.$$('[aria-label="Your synths"] .chip')).length === 1);
  ok('editor has the main sections', (await p.$$('.lab-card')).length >= 8, String((await p.$$('.lab-card')).length));
  await p.selectOption('select[aria-label="Oscillator 1 wave"]', 'square');
  await p.fill('input[aria-label="Synth name"]', 'Test Lead');
  ok('name edit shows on the chip', /Test Lead/.test(await p.textContent('[aria-label="Your synths"] .chip')));
  // knob
  await p.evaluate(() => { const e = document.querySelector('input[aria-label="Cutoff"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, '0.6'); e.dispatchEvent(new Event('input', { bubbles: true })); });
  const cut = await p.textContent('label.knob:has(input[aria-label="Cutoff"]) b');
  ok('cutoff knob updates its readout', /kHz|Hz/.test(cut) && cut !== '1.8 kHz', cut);
  // keys press without errors
  const key = await p.$('button[data-note="C4"]'); const bb = await key.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height - 8); await p.mouse.down(); await p.waitForTimeout(500);
  const wave = await p.evaluate(() => { const c = document.querySelector('canvas.scope'); return !!c; });
  await p.mouse.up(); await p.keyboard.down('a'); await p.waitForTimeout(250); await p.keyboard.up('a');
  ok('keyboard clicks and computer keys do not throw', errs.length === 0 && wave, errs.join('|'));
  await p.screenshot({ path: path.join(OUT, 'lab_light.png'), fullPage: false });
  // use on melody
  await p.click('[aria-label="Use this synth on"] button:text-is("MELODY")');
  ok('USE ON MELODY marks it', /✓/.test(await p.textContent('[aria-label="Use this synth on"] button[aria-pressed="true"]')));
  await p.click('button[role="tab"]:text-is("MELODY")');
  const sel = await p.inputValue('select[aria-label="Melody instrument"]');
  ok('melody track now uses the synth', sel === 'synth:s1', sel);
  const myGroup = await p.$$eval('select[aria-label="Melody instrument"] optgroup', e => e.map(x => x.label)[0]);
  ok('"My synths" group is listed first', /My synths/.test(myGroup), myGroup);
  // library start
  await p.click('button[role="tab"]:has-text("SYNTH LAB")');
  await p.selectOption('select[aria-label="Start from a library sound"]', 'santur');
  ok('library sound opens as a new synth', (await p.$$('[aria-label="Your synths"] .chip')).length === 2);
  await p.click('button:has-text("RANDOM")'); ok('random synth', (await p.$$('[aria-label="Your synths"] .chip')).length === 3);
  await p.click('button:has-text("DUPLICATE")'); ok('duplicate', (await p.$$('[aria-label="Your synths"] .chip')).length === 4);
  // save, reload project
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:text-is("SAVE")')]);
  const saved = path.join(OUT, 'with_synths.beatlab.json'); await dl.saveAs(saved);
  const json = JSON.parse(fs.readFileSync(saved, 'utf8'));
  ok('saved file has schema 5 and 4 synths', json.schemaVersion === 5 && json.synths.length === 4 && json.tracks.find(t => t.id === 'melody').instrument === 'synth:s1', `${json.schemaVersion}/${json.synths.length}`);
  // delete the synth in use
  await p.click('[aria-label="Your synths"] .chip:has-text("Test Lead")');
  await p.click('button:has-text("DELETE")');
  ok('deleting removes the chip', (await p.$$('[aria-label="Your synths"] .chip')).length === 3);
  await p.click('button[role="tab"]:text-is("MELODY")');
  const sel2 = await p.inputValue('select[aria-label="Melody instrument"]');
  ok('track using a deleted synth falls back to default', sel2 === 'electricPiano', sel2);
  // open the saved file again
  await p.setInputFiles('input[aria-label="Open project file"]', saved); await p.waitForTimeout(500);
  await p.click('button[role="tab"]:text-is("MELODY")');
  ok('re-opened project restores synth + track', (await p.inputValue('select[aria-label="Melody instrument"]')) === 'synth:s1', await status());

  // ---- export with a custom synth on melody (pattern mode, short)
  await p.click('[aria-label="Play mode"] >> text="PATTERN"');
  await p.click('button[aria-label="Select pattern Verse"]');
  await p.selectOption('select[aria-label="Export format"]', 'wav16');
  const [d1] = await Promise.all([p.waitForEvent('download', { timeout: 300000 }), p.click('button.export-btn')]);
  await d1.saveAs(path.join(OUT, 'custom_synth.wav'));
  ok('export with a custom synth finished', /Exported/.test(await status()), await status());
  await p.selectOption('select[aria-label="Melody instrument"]', 'bell');
  const [d2] = await Promise.all([p.waitForEvent('download', { timeout: 300000 }), p.click('button.export-btn')]);
  await d2.saveAs(path.join(OUT, 'bell.wav'));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  // phone layout of the Synth Lab, dark theme
  const phone = await ctx.newPage(); await phone.setViewportSize({ width: 390, height: 800 });
  await phone.goto(URL); await phone.waitForTimeout(800);
  await phone.click('button[aria-label="Colour theme"]'); // auto -> dark
  await phone.click('button[role="tab"]:has-text("SYNTH LAB")'); await phone.click('button:has-text("NEW SYNTH")');
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('Synth Lab fits a 390px phone without sideways scrolling', overflow <= 1, 'overflow ' + overflow);
  await phone.screenshot({ path: path.join(OUT, 'lab_phone_dark.png') });
  console.log(results.filter(Boolean).length + '/' + results.length + ' passed');
  await b.close();
})();
