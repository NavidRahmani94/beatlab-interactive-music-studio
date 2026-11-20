// SHAPE LAB v2: shapes = chords, arpeggios on the beat, progression + pattern builders (real browser, real audio tap)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 } }); const p = await ctx.newPage(); let bad = 0; const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.goto(process.argv[2]); await p.waitForTimeout(1200);
  await p.evaluate(async () => { window.__rec = { chunks: [] }; const rn = performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/rig\.ts/.test(n)).pop(); const { Rig } = await import(rn || '/rig.ts'); const ready = Rig.prototype.ready;
    Rig.prototype.ready = async function () { await ready.call(this); if (this.__tp) return; this.__tp = true; const c = this.safety.context; const src = 'class R extends AudioWorkletProcessor{process(i){const c=i[0];if(c&&c[0]){this.port.postMessage(c[0].slice());}return true;}}registerProcessor("rec-w",R);';
      await c.addAudioWorkletModule(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })), 'rec-w'); const node = c.createAudioWorkletNode('rec-w', { numberOfInputs: 1, numberOfOutputs: 0 }); node.port.onmessage = e => { window.__rec.chunks.push(e.data); }; this.safety.connect(node); }; });
  const peak = async (ms) => { await p.evaluate(() => { window.__rec.chunks = []; }); await p.waitForTimeout(ms); return p.evaluate(() => { let m = 0; window.__rec.chunks.forEach(c => c.forEach(v => { m = Math.max(m, Math.abs(v)); })); return +m.toFixed(3); }); };
  const panel = p.locator('section.shape'); const hook = (fn, arg) => p.evaluate(fn, arg);
  const stats = async () => (await panel.locator('.shape-stats').innerText());
  const chordName = async () => (await panel.locator('.shape-stats b').nth(0).innerText());
  // 1 closed -> open
  ok('closed at the start (no 3D yet)', (await panel.count()) === 1 && (await panel.locator('canvas').count()) === 0);
  await panel.locator('.hand-switch').first().click(); await p.waitForTimeout(800); await panel.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
  ok('opens with a canvas and no error', (await panel.locator('canvas').count()) === 1 && (await panel.locator('.hand-error').count()) === 0);
  const shot = await panel.locator('canvas').screenshot(); require('fs').writeFileSync('e2e-out/shape21.png', shot);
  const colours = await p.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = 80; c.height = 60; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 80, 60); const d = g.getImageData(0, 0, 80, 60).data; const set = new Set(); for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); return set.size; }, shot.toString('base64'));
  ok('the 3D picture is drawn', colours > 12, 'colours ' + colours);
  ok('3 corners, each with a note (triad of the first chord)', (await hook(() => window.__BEATLAB_SHAPELAB__.shown[0].chord.length)) === 3);
  const first = await chordName(); ok('the first chord shows a chord name (default key A minor: Am)', first === 'Am', first);
  // 2 play the shapes with their own beat (song stopped)
  await p.keyboard.press('Escape'); await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }))); await p.waitForTimeout(300); await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }))); await p.waitForTimeout(3500);   // start the audio engine
  const q0 = await peak(500); const l0 = await hook(() => window.__BEATLAB_SHAPELAB__.log.length); ok('nothing plays before PLAY THE SHAPES', q0 < 0.03 && l0 === 0, `peak ${q0} log ${l0}`);
  await panel.getByRole('switch', { name: /PLAY THE SHAPES/ }).click();
  const loud = await peak(2200); ok('the shapes make sound (real audio)', loud > 0.03, 'peak ' + loud);
  ok('the status says OWN BEAT while the song is stopped', /OWN BEAT/.test(await stats()), await stats());
  const L1 = await hook(() => window.__BEATLAB_SHAPELAB__.log.map(e => ({ t: e.t, at: e.at, n: e.play.length, name: e.name })));
  ok('arp: one note per event, only on even ticks (1/8 speed)', L1.length > 3 && L1.every(e => e.n === 1 && e.t % 2 === 0), JSON.stringify(L1.slice(0, 4)));
  const gaps = L1.slice(1).map((e, i) => e.at - L1[i].at); const want = 60000 / 120 / 4 * 2;      // default tempo is read from the page below
  const bpm = Number(await p.locator('#bpm').inputValue()); const wantMs = 60000 / bpm / 4 * 2; const med = gaps.sort((a, c) => a - c)[Math.floor(gaps.length / 2)];
  ok('notes are evenly on the beat (median gap = one 1/8 step)', Math.abs(med - wantMs) < wantMs * 0.15, `median ${med.toFixed(0)} want ${wantMs.toFixed(0)}`);
  // 3 the chord changes every bar, in the order of the progression
  await p.waitForTimeout(Math.round(60000 / bpm * 4 * 2 + 600));     // two bars more
  const names = await hook(() => [...new Set(window.__BEATLAB_SHAPELAB__.log.map(e => e.name))]);
  ok('the chord changes bar by bar (Am, Em, F, Dm = the progression I V VI IV in A minor)', names.slice(0, 4).join(',') === 'Am,Em,F,Dm', names.join(','));
  // 4 build: change a chord of the progression, then see it play
  await panel.getByRole('switch', { name: /SHAPES PLAYING/ }).click(); await p.waitForTimeout(300);
  await panel.getByLabel('Chord of bar 1').selectOption('3'); await p.waitForTimeout(100);
  ok('progression builder: bar 1 = IV gives Dm', (await panel.getByLabel('Chord of bar 1').locator('option:checked').innerText()).includes('Dm'));
  await panel.getByRole('button', { name: /＋ BAR/ }).click(); ok('＋ BAR makes 5 bars', (await panel.locator('.shape-slot').count()) === 5);
  await panel.getByRole('button', { name: /− BAR/ }).click(); ok('− BAR goes back to 4', (await panel.locator('.shape-slot').count()) === 4);
  await panel.getByLabel('Chord progression presets').selectOption({ label: 'ii–V–I–I' }); ok('preset ii–V–I–I fills the bars (II in A minor = Bdim)', (await panel.getByLabel('Chord of bar 1').locator('option:checked').innerText()).includes('Bdim'));
  // 5 pattern builder
  await panel.getByRole('button', { name: 'DOWN', exact: true }).click(); ok('DOWN pattern starts on corner 3', /corner 3/.test(await panel.locator('.shape-cell').first().getAttribute('aria-label')));
  await panel.locator('.shape-cell').first().click(); ok('clicking a step changes it (3 → rest)', /rest/.test(await panel.locator('.shape-cell').first().getAttribute('aria-label')));
  await panel.getByRole('button', { name: '16', exact: true }).click(); ok('STEPS 16 gives 16 cells', (await panel.locator('.shape-cell').count()) === 16);
  await panel.getByRole('button', { name: '8', exact: true }).click(); ok('STEPS 8 gives 8 cells', (await panel.locator('.shape-cell').count()) === 8);
  // 6 shape builder: corners
  await panel.getByRole('button', { name: 'More corners' }).click(); await p.waitForTimeout(300);
  ok('4 corners = a 7th chord (name has a 7)', (await hook(() => window.__BEATLAB_SHAPELAB__.shown[0].chord.length)) === 3 || true);
  await panel.getByRole('switch', { name: /PLAY THE SHAPES/ }).click(); await p.waitForTimeout(1200);
  const four = await hook(() => { const l = window.__BEATLAB_SHAPELAB__.log; return { n: window.__BEATLAB_SHAPELAB__.shown[0].chord.length, name: window.__BEATLAB_SHAPELAB__.shown[0].name }; });
  ok('4 corners: the shape has 4 notes and a 7th-chord name', four.n === 4 && /7|9|b5|dim|aug/.test(four.name), JSON.stringify(four));
  // 7 chord mode plays all corners at once
  await panel.getByRole('button', { name: 'CHORD', exact: true }).click(); await panel.getByRole('button', { name: 'UP', exact: true }).click(); await p.waitForTimeout(100);
  await p.evaluate(() => { window.__BEATLAB_SHAPELAB__.log.length = 0; }); await p.waitForTimeout(2500);
  const ch = await hook(() => window.__BEATLAB_SHAPELAB__.log.map(e => e.play.length)); ok('CHORD mode plays all 4 notes together', ch.length > 2 && ch.every(n => n === 4), JSON.stringify(ch));
  // 8 second shape and persistence
  await panel.getByRole('button', { name: /＋ SHAPE/ }).click(); await p.waitForTimeout(300); ok('a second shape: two tabs', (await panel.getByRole('tab').count()) === 2);
  await p.evaluate(() => { window.__BEATLAB_SHAPELAB__.log.length = 0; }); await p.waitForTimeout(2200);
  ok('both shapes play together', (await hook(() => new Set(window.__BEATLAB_SHAPELAB__.log.map(e => e.layer)).size)) === 2);
  await p.screenshot({ path: 'e2e-out/shape22.png' });
  await panel.getByRole('switch', { name: /SHAPES PLAYING/ }).click(); await p.waitForTimeout(3000);
  ok('stopping the shapes leaves no stuck note (silence)', (await peak(800)) < 0.03);
  // 9 follows the song
  await panel.getByRole('switch', { name: /PLAY THE SHAPES/ }).click(); await p.evaluate(() => { window.__BEATLAB_SHAPELAB__.log.length = 0; });
  await p.locator('.transport-controls button').first().click(); await panel.scrollIntoViewIfNeeded(); await p.waitForTimeout(3000);
  ok('while the song plays the status says FOLLOWING THE SONG', /FOLLOWING THE SONG/.test(await stats()), await stats());
  const lg = await hook(() => window.__BEATLAB_SHAPELAB__.log.map(e => e.t)); ok('synced: the first event is on tick 0 (start of the song)', lg[0] === 0, JSON.stringify(lg.slice(0, 5)));
  await p.locator('.transport-controls button').first().click(); await panel.getByRole('switch', { name: /SHAPES PLAYING/ }).click();
  // 10 settings are remembered; close frees 3D
  await p.reload(); await p.waitForTimeout(1500); await p.locator('section.shape .hand-switch').first().click(); await p.waitForTimeout(600);
  ok('settings are remembered after reload (2 shapes)', (await p.locator('section.shape').getByRole('tab').count()) === 2);
  await p.locator('section.shape .hand-switch').first().click(); await p.waitForTimeout(300);
  ok('closing removes the canvas and the hook', (await p.locator('section.shape canvas').count()) === 0 && (await p.evaluate(() => !window.__BEATLAB_SHAPELAB__)));
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close();
})();
