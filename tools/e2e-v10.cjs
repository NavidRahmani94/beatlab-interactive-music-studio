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
  const tabs = () => p.$$eval('button[role="tab"]', e => e.map(x => x.textContent.trim()));
  const status = async () => (await p.textContent('.status')).trim();

  let t = await tabs();
  ok('default tabs: drums, 4 tracks, synth lab', JSON.stringify(t) === JSON.stringify(['DRUMS', 'MELODY', 'AMBIENT', 'ARPEGGIO', 'SYNTH', 'SYNTH LAB']), t.join('|'));

  // rename Ambient
  await p.click('button[role="tab"]:text-is("AMBIENT")');
  await p.fill('input[aria-label="Track name"]', 'Pads');
  t = await tabs(); ok('renaming Ambient changes its tab', t.includes('PADS') && !t.includes('AMBIENT'), t.join('|'));
  ok('the panel and the mixer use the new name', (await p.textContent('section[aria-label="Pads track"] .panel-label')).startsWith('PADS') && /PADS/.test(await p.textContent('.mixer, [aria-label="Mixer"], body')));
  // rename Melody
  await p.click('button[role="tab"]:text-is("MELODY")');
  await p.fill('input[aria-label="Track name"]', 'Lead tune');
  t = await tabs(); ok('renaming Melody works', t.includes('LEAD TUNE'));

  // SYNTH tab has its own piano roll and keeps its own notes
  await p.click('button[role="tab"]:text-is("SYNTH")');
  ok('SYNTH tab shows a piano roll', (await p.$$('section[aria-label="Synth track"] button[data-step]')).length > 0);
  const before = await p.$$eval('section[aria-label="Synth track"] button[aria-pressed="true"][data-step]', e => e.length);
  await p.click('section[aria-label="Synth track"] button[data-step="2"] >> nth=3');
  const after = await p.$$eval('section[aria-label="Synth track"] button[aria-pressed="true"][data-step]', e => e.length);
  ok('a note can be placed on the SYNTH track', after === before + 1, `${before}->${after}`);
  await p.click('button[role="tab"]:text-is("LEAD TUNE")');
  const melodyHas = await p.$$eval('section[aria-label="Lead tune track"] button[aria-pressed="true"][data-step]', e => e.length);
  await p.click('button[role="tab"]:text-is("SYNTH")');
  const synthStill = await p.$$eval('section[aria-label="Synth track"] button[aria-pressed="true"][data-step]', e => e.length);
  ok('notes stay on their own track', synthStill === after && melodyHas !== synthStill, `${melodyHas} vs ${synthStill}`);

  // add tracks
  await p.click('button[aria-label="Add track"]');
  await p.click('button[aria-label="Add Melody track"]');
  t = await tabs(); ok('adding a Melody track adds a tab and selects it', t.length === 7 && /MELODY/.test(t[t.length - 2]) && await p.$('section[aria-label^="Melody"]') !== null, t.join('|'));
  await p.click('section[aria-label^="Melody"] button[data-step="0"] >> nth=5');
  const mixCount = await p.textContent('.panel-label:has-text("CHANNELS")');
  ok('mixer gets a channel for the new track', /9 CHANNELS/.test(mixCount), mixCount);
  while ((await tabs()).length < 10) { await p.click('button[aria-label="Add track"]'); await p.click('button[aria-label="Add Arpeggio track"]'); }
  ok('track limit: + TRACK disabled at 8 tracks', await p.isDisabled('button[aria-label="Add track"]'));
  // delete one
  await p.click('button[aria-label^="Delete track"]');
  t = await tabs(); ok('delete removes the tab', t.length === 9, t.join('|'));

  // synth lab: notes track inside the lab
  await p.click('button[role="tab"]:has-text("SYNTH LAB")');
  await p.click('button:has-text("NEW SYNTH")');
  ok('lab asks for a notes track when none uses this synth', await p.isVisible('text=no note track yet'));
  // free a slot first
  await p.click('button[role="tab"]:text-is("SYNTH")'); await p.click('button[aria-label^="Delete track"]');
  await p.click('button[role="tab"]:has-text("SYNTH LAB")');
  await p.click('button:has-text("NOTES TRACK")');
  ok('lab now embeds the piano roll', (await p.$$('.lab-notes button[data-step]')).length > 0);
  await p.click('.lab-notes button[data-step="4"] >> nth=6');
  ok('a note can be placed from inside the lab', (await p.$$('.lab-notes button[aria-pressed="true"][data-step]')).length === 1);
  await p.screenshot({ path: path.join(OUT, 'lab_notes.png') });

  // play (no errors), save, convert to v4, reopen
  await p.click('button.play >> nth=0'); await p.waitForTimeout(1500); await p.click('button.stop >> nth=0');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:text-is("SAVE")')]);
  const saved = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok('saved as schema 5 with the renamed tracks', saved.schemaVersion === 5 && saved.tracks.some(x => x.name === 'Pads') && saved.tracks.some(x => x.name === 'Lead tune'), saved.tracks.map(x => x.name).join(','));
  const v4 = { ...saved, schemaVersion: 4, synths: [], arp: saved.tracks.find(x => x.id === 'arp').arp, tracks: { melody: 'bell', ambient: 'warmPad', arp: 'pluck' },
    patterns: saved.patterns.map(x => ({ name: x.name, drums: x.drums, melody: x.notes.melody || [], ambient: x.notes.ambient || [], arp: x.notes.arp || [] })),
    channels: Object.fromEntries(['kick', 'snare', 'hat', 'clap', 'melody', 'ambient', 'arp'].map(k => [k, saved.channels[k]])) };
  fs.writeFileSync(path.join(OUT, 'old_v4.beatlab.json'), JSON.stringify(v4));
  await p.setInputFiles('input[type="file"]', path.join(OUT, 'old_v4.beatlab.json')); await p.waitForTimeout(600);
  t = await tabs(); ok('an old version-4 file opens with the four standard tracks', JSON.stringify(t) === JSON.stringify(['DRUMS', 'MELODY', 'AMBIENT', 'ARPEGGIO', 'SYNTH', 'SYNTH LAB']), t.join('|') + ' / ' + await status());

  // export with a renamed + extra track
  await p.click('button[role="tab"]:text-is("AMBIENT")'); await p.fill('input[aria-label="Track name"]', 'Strings bed');
  await p.click('button[aria-label="Add track"]'); await p.click('button[aria-label="Add Synth track"]');
  await p.click('[aria-label="Play mode"] >> text="PATTERN"');
  const [ex] = await Promise.all([p.waitForEvent('download', { timeout: 300000 }), p.click('button.export-btn')]);
  const size = fs.statSync(await ex.path()).size; ok('WAV export works with renamed / added tracks', size > 100000, size + ' bytes');

  // phone
  const phone = await b.newPage({ viewport: { width: 390, height: 800 } }); await phone.goto(URL); await phone.waitForTimeout(800);
  for (let i = 0; i < 4; i++) { await phone.click('button[aria-label="Add track"]'); await phone.click('button[aria-label="Add Melody track"]'); }
  const over = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('phone: no sideways page scroll with 8 tracks', over <= 1, `${over}px`);
  await phone.screenshot({ path: path.join(OUT, 'phone_tracks.png') });

  ok('no console / page errors', errs.length === 0, errs.slice(0, 3).join('|'));
  await b.close();
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED', results.filter(Boolean).length + '/' + results.length);
})();
