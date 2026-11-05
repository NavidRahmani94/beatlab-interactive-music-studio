// SHAPE LAB v0.21.1: own sound per shape (independent of tracks / tabs) + CONVERT TO PATTERN (real browser, real audio tap)
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
  const panel = p.locator('section.shape');
  await panel.locator('.hand-switch').first().click(); await p.waitForTimeout(700); await panel.scrollIntoViewIfNeeded();
  // the audio engine must exist: a click on a corner would do, here a computer-keyboard note
  await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }))); await p.waitForTimeout(300); await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }))); await p.waitForTimeout(3500);
  const sound = panel.getByLabel('Sound of this shape'); const vol = panel.getByLabel('Volume of this shape');
  ok('every shape shows its own SOUND and VOLUME controls', (await sound.count()) === 1 && (await vol.count()) === 1);
  ok('shape 1 starts with Electric Piano-like default (a real instrument id)', ['electricPiano'].includes(await sound.inputValue()), await sound.inputValue());
  await panel.getByRole('button', { name: /＋ SHAPE/ }).click(); await p.waitForTimeout(200);
  ok('shape 2 has a different sound than shape 1', (await sound.inputValue()) !== 'electricPiano', await sound.inputValue());
  await panel.getByRole('tab', { name: 'SHAPE 2' }).click(); await panel.getByRole('button', { name: /× ?|✕/ }).first().click().catch(() => {}); await p.waitForTimeout(200);
  await panel.getByRole('tab', { name: 'SHAPE 1' }).click();
  // independence: play the shapes, then go to the DRUMS tab: the shape sound continues, no melody track needed
  await panel.getByRole('switch', { name: /PLAY THE SHAPES/ }).click(); const a1 = await peak(2200); ok('the shape is heard with its own sound', a1 > 0.03, 'peak ' + a1);
  await p.locator('[role=tab]:has-text("DRUMS")').first().click(); await panel.scrollIntoViewIfNeeded(); const a2 = await peak(2200); ok('still heard when the DRUMS tab is open (not tied to the open track)', a2 > 0.03, 'peak ' + a2);
  await p.locator('[role=tab]:has-text("MELODY")').first().click(); await panel.scrollIntoViewIfNeeded();
  // volume
  await vol.fill('-30'); await vol.dispatchEvent('input'); await p.waitForTimeout(300); const quiet = await peak(2200);
  await vol.fill('0'); await vol.dispatchEvent('input'); await p.waitForTimeout(300); const loud = await peak(2200);
  ok('shape volume works: -30 dB is much quieter than 0 dB', loud > 0.05 && quiet < loud * 0.5, `quiet ${quiet} loud ${loud}`);
  // another sound
  await sound.selectOption('pluck'); await p.waitForTimeout(500); ok('another sound can be chosen and still plays', (await peak(2200)) > 0.03);
  await panel.getByRole('switch', { name: /SHAPES PLAYING/ }).click(); await p.waitForTimeout(3000); ok('stopping leaves silence', (await peak(800)) < 0.03);
  // convert
  const tabsBefore = await p.locator('[role=tab][class*="tab"]').count();
  const patName = await p.evaluate(() => document.body.innerText.match(/PATTERN \d+/)?.[0] ?? 'PATTERN 1');
  await panel.getByRole('button', { name: /CONVERT TO PATTERN/ }).click(); await p.waitForTimeout(700);
  const msg = await panel.locator('.shape-stats').last().innerText(); ok('a message says the melody track was made', /Made the melody track/.test(msg), msg);
  ok('the new track is named after the open pattern (Intro) plus the shape', msg.includes('Intro · SHAPE 1'), msg);
  ok('a new track tab appeared', (await p.locator('[role=tab][class*="tab"]').count()) === tabsBefore + 1);
  ok('the new track is open and has notes in the piano roll (velocity lane shows them)', (await p.locator('.vel-note').count()) >= 8, String(await p.locator('.vel-note').count()));
  ok('a 4-bar progression made 2 patterns', /2 patterns/.test(msg), msg);
  // the new notes really play with the song
  await p.locator('.transport-controls button').first().click(); const song = await peak(2500); await p.locator('.transport-controls button').first().click(); ok('the song plays (new track included)', song > 0.03, String(song));
  // remembered
  await p.reload(); await p.waitForTimeout(1500); await p.locator('section.shape .hand-switch').first().click(); await p.waitForTimeout(600);
  ok('sound and volume of the shape are remembered after reload', (await p.locator('section.shape').getByLabel('Sound of this shape').inputValue()) === 'pluck' && (await p.locator('section.shape').getByLabel('Volume of this shape').inputValue()) === '0');
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close();
})();
