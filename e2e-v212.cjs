// v0.21.2: audio buffer mode (SMOOTH / FAST) in the STATS panel, and the shape sounds with a shorter tail
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); let bad = 0; const errs = [];
  const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  const delayOf = async (mode) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(m => { if (m) localStorage.setItem('beatlab.audiomode', m); }, mode);
    await p.goto(process.argv[2]); await p.waitForTimeout(1200);
    await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }))); await p.waitForTimeout(1500);
    await p.getByRole('button', { name: /System monitor/ }).click(); await p.waitForTimeout(600);
    const row = await p.locator('.sys-row:has-text("AUDIO DELAY") b').innerText(); const pressed = await p.getByRole('button', { name: 'SMOOTH', exact: true }).getAttribute('aria-pressed'); const safeOn = await p.getByRole('button', { name: 'SAFE', exact: true }).getAttribute('aria-pressed');
    const buf = await p.evaluate(() => { const e = performance.getEntriesByType('resource').map(r => r.name).filter(n => /deps\/tone\.js/.test(n)).pop(); return import(e).then(T => T.getContext().rawContext.baseLatency); });
    await ctx.close(); return { row, pressed, safeOn, buf };
  };
  const def = await delayOf(null), fast = await delayOf('fast'), smooth = await delayOf('smooth'), safe = await delayOf('safe');
  console.log('default', JSON.stringify(def), 'fast', JSON.stringify(fast), 'smooth', JSON.stringify(smooth));
  ok('SMOOTH is the default mode', def.pressed === 'true');
  ok('FAST mode is remembered and shown', fast.pressed === 'false');
  ok('the SMOOTH mode asks for a bigger audio buffer than FAST', smooth.buf > fast.buf, `smooth ${smooth.buf} fast ${fast.buf}`);
  ok('SAFE mode asks for a much bigger buffer (about 80 ms) than SMOOTH', safe.buf > smooth.buf * 2 && safe.buf > 0.07, `safe ${safe.buf}`);
  ok('AUDIO DELAY is shown in the monitor', /ms|n\/a/.test(def.row), def.row);
  // the first quick key tap (before the audio engine is ready) must not hang
  for (const mode of ['smooth', 'fast']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(m => localStorage.setItem('beatlab.audiomode', m), mode);
    await p.goto(process.argv[2]); await p.waitForTimeout(1200);
    await p.evaluate(async () => { window.__rec = { chunks: [] }; const rn = performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/rig\.ts/.test(n)).pop(); const { Rig } = await import(rn); const ready = Rig.prototype.ready;
      Rig.prototype.ready = async function () { await ready.call(this); if (this.__tp) return; this.__tp = true; const c = this.safety.context; const src = 'class R extends AudioWorkletProcessor{process(i){const c=i[0];if(c&&c[0]){this.port.postMessage(c[0].slice());}return true;}}registerProcessor("rec-w",R);';
        await c.addAudioWorkletModule(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })), 'rec-w'); const node = c.createAudioWorkletNode('rec-w', { numberOfInputs: 1, numberOfOutputs: 0 }); node.port.onmessage = e => { window.__rec.chunks.push(e.data); }; this.safety.connect(node); }; });
    await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }))); await p.waitForTimeout(60); await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true })));
    await p.waitForTimeout(4500); await p.evaluate(() => { window.__rec.chunks = []; }); await p.waitForTimeout(1500);
    const tail = await p.evaluate(() => { let m = 0; window.__rec.chunks.forEach(c => c.forEach(v => { m = Math.max(m, Math.abs(v)); })); return m; });
    ok(`${mode}: a very quick first key tap (before the audio engine is ready) does not hang`, tail < 0.01, 'tail peak ' + tail.toFixed(3));
    await ctx.close();
  }
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close();
})();
