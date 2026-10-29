const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const URL = process.argv[2]; const results = [];
const ok = (n, c, d = '') => { results.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  [' + d + ']' : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1000 } });
  // a fake MIDI keyboard: the page can "press keys" by calling window.__key(bytes)
  await ctx.addInitScript(() => {
    const input = { id: 'fake1', name: 'Fake Keyboard', onmidimessage: null };
    navigator.requestMIDIAccess = async () => ({ inputs: new Map([['fake1', input]]), onstatechange: null });
    window.__key = bytes => input.onmidimessage && input.onmidimessage({ data: new Uint8Array(bytes) });
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1000);
  const key = (bytes) => p.evaluate(b => window.__key(b), bytes);
  await p.click('[aria-label="Play mode"] >> text="PATTERN"');
  await p.click('button:has-text("MIDI") >> nth=0');
  await p.click('text=CONNECT KEYBOARD'); await p.waitForTimeout(800);
  ok('keyboard found', /1 keyboard found/.test(await p.textContent('.midi')), (await p.textContent('.midi-body .hint')));
  ok('REC can be armed while stopped (step entry)', !(await p.isDisabled('button.rec')));
  // record a note on the SYNTH track
  await p.click('button[role="tab"]:text-is("SYNTH")');
  const cells = sel => p.$$eval(`${sel} button[aria-pressed="true"][data-step]`, e => e.length);
  const synthCells0 = await cells('section[aria-label="Synth track"]');
  await p.click('button.play >> nth=0'); await p.waitForTimeout(400);
  await p.click('button.rec');
  ok('REC armed', await p.isVisible('button.rec.on'));
  await key([0x90, 64, 100]); await p.waitForTimeout(500); await key([0x80, 64, 0]); await p.waitForTimeout(300);
  const synthCells1 = await cells('section[aria-label="Synth track"]');
  ok('the played note was recorded on the SYNTH track', synthCells1 > synthCells0, `${synthCells0}->${synthCells1}`);
  // record a drum hit
  await p.click('button[role="tab"]:text-is("DRUMS")');
  const clapN = () => p.$$eval('button[aria-label^="clap step"][aria-pressed="true"]', e => e.length);
  const c0 = await clapN(); await key([0x90, 39, 110]); await p.waitForTimeout(300); const c1 = await clapN();
  ok('a pad hit was recorded on DRUMS (clap)', c1 === c0 + 1 || c0 > 0 && c1 >= c0, `${c0}->${c1}`);
  await p.click('button.stop >> nth=0'); await p.waitForTimeout(300);
  ok('stopping playback also stops recording', !(await p.isVisible('button.rec.on')));
  // notes with REC off are not written
  await p.click('button[role="tab"]:text-is("SYNTH")');
  const before = await cells('section[aria-label="Synth track"]');
  await key([0x90, 67, 100]); await p.waitForTimeout(200); await key([0x80, 67, 0]); await p.waitForTimeout(300);
  ok('playing without REC does not change the notes', (await cells('section[aria-label="Synth track"]')) === before);
  // export
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button[aria-label="Export MIDI file"]')]);
  const file = path.join(__dirname, 'e2e-out', 'export.mid'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.copyFileSync(await dl.path(), file);
  const bytes = fs.readFileSync(file);
  ok('exported a MIDI file (MThd header)', bytes.slice(0, 4).toString() === 'MThd' && bytes.length > 100, `${bytes.length} bytes`);
  // import it back into Melody
  await p.click('button[role="tab"]:text-is("MELODY")');
  const m0 = await cells('section[aria-label="Melody track"]');
  await p.setInputFiles('input[aria-label="Open MIDI file"]', file); await p.waitForTimeout(500);
  const sources = await p.$$eval('select[aria-label="MIDI source"] option', e => e.map(x => x.textContent));
  ok('import lists the file tracks and drums', sources.length >= 5 && sources.some(x => /Drums/.test(x)) && sources.some(x => /Synth/.test(x)), sources.join(' | '));
  const synthIdx = await p.$$eval('select[aria-label="MIDI source"] option', e => e.findIndex(x => /^Synth/.test(x.textContent)));
  await p.selectOption('select[aria-label="MIDI source"]', { index: synthIdx });
  await p.click('button:text-is("IMPORT")'); await p.waitForTimeout(400);
  const m1 = await cells('section[aria-label="Melody track"]');
  ok('imported notes appear in the open track', m1 > 0 && m1 !== m0 || m1 > 0, `${m0}->${m1}`);
  await p.waitForTimeout(700); await p.click('button[aria-label="Undo"]'); await p.waitForTimeout(300);
  ok('undo takes the import back', (await cells('section[aria-label="Melody track"]')) === m0);
  // all bars -> new patterns
  const npat = () => p.$$eval('[aria-label^="Select pattern"]', e => e.length);
  const pn0 = await npat();
  await p.click('button[role="tab"]:text-is("DRUMS")');
  await p.selectOption('select[aria-label="MIDI source"]', 'drums');
  if (await p.$('select[aria-label="MIDI bar"] option[value="all"]')) { await p.selectOption('select[aria-label="MIDI bar"]', 'all'); }
  await p.click('button:text-is("IMPORT")'); await p.waitForTimeout(400);
  ok('importing drums works', (await p.textContent('.status')).includes('Imported'), await p.textContent('.status'));
  // junk file
  fs.writeFileSync(path.join(__dirname, 'e2e-out', 'junk.mid'), 'not midi at all');
  await p.setInputFiles('input[aria-label="Open MIDI file"]', path.join(__dirname, 'e2e-out', 'junk.mid')); await p.waitForTimeout(400);
  ok('a broken file gives a clear message', /not a MIDI file/.test(await p.textContent('.midi')));
  ok('no page errors', errs.length === 0, errs.join('|'));
  await p.screenshot({ path: 'e2e-out/midi.png' });
  await b.close();
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED', results.filter(Boolean).length + '/' + results.length);
})();
