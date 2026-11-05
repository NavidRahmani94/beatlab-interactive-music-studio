// piano keys with a NON-Latin layout: the browser reports key "ش" but code "KeyA"
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } }); let bad = 0; const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.goto(process.argv[2]); await p.waitForTimeout(1200);
  await p.evaluate(async () => { window.__rec = { chunks: [] }; const rn = performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/rig\.ts/.test(n)).pop(); const { Rig } = await import(rn || '/rig.ts'); const ready = Rig.prototype.ready;
    Rig.prototype.ready = async function () { await ready.call(this); if (this.__tp) return; this.__tp = true; const ctx = this.safety.context; const src = 'class R extends AudioWorkletProcessor{process(i){const c=i[0];if(c&&c[0]){this.port.postMessage(c[0].slice());}return true;}}registerProcessor("rec-w",R);';
      await ctx.addAudioWorkletModule(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })), 'rec-w'); const node = ctx.createAudioWorkletNode('rec-w', { numberOfInputs: 1, numberOfOutputs: 0 }); node.port.onmessage = e => { window.__rec.chunks.push(e.data); }; this.safety.connect(node); }; });
  const peak = async (ms) => { await p.evaluate(() => { window.__rec.chunks = []; }); await p.waitForTimeout(ms); return p.evaluate(() => { let m = 0; window.__rec.chunks.forEach(c => c.forEach(v => { m = Math.max(m, Math.abs(v)); })); return +m.toFixed(3); }); };
  const press = async (key, code) => { await p.evaluate(([k, c]) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: c, bubbles: true })), [key, code]); const pk = await peak(500); await p.evaluate(([k, c]) => window.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: c, bubbles: true })), [key, code]); await p.waitForTimeout(150); return pk; };
  await p.locator('[role=tab]:has-text("MELODY")').first().click(); await p.waitForTimeout(300);
  ok('Persian layout (key ش, code KeyA) plays a note', (await press('ش', 'KeyA')) > 0.03);
  ok('Persian layout, W key (ص) plays a note', (await press('ص', 'KeyW')) > 0.03);
  ok('US layout still plays', (await press('a', 'KeyA')) > 0.03);
  await p.waitForTimeout(1800); ok('a key that is not a piano key stays silent', (await press('q', 'KeyQ')) < 0.03);
  await p.locator('[role=tab]:has-text("DRUMS")').first().click(); ok('drums: Persian A (ش) = kick', (await press('ش', 'KeyA')) > 0.03);
  console.log(errs.length ? errs.join('\n') : 'no page errors'); console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close();
})();
