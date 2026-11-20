// v0.21.3 sound engine 2 (AudioWorklet): shapes really use it, make sound, can be switched off, no hanging notes
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let bad = 0; const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  const run = async (engine2) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    if (!engine2) await p.addInitScript(() => localStorage.setItem('beatlab.engine2', 'off'));
    await p.goto(process.argv[2]); await p.waitForTimeout(1200);
    await p.evaluate(async () => { window.__rec = { chunks: [] }; window.__rigs = []; const rn = performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/rig\.ts/.test(n)).pop(); const { Rig } = await import(rn || '/rig.ts'); const ready = Rig.prototype.ready;
      Rig.prototype.ready = async function () { window.__rigs.push(this); await ready.call(this); if (this.__tp) return; this.__tp = true; const c = this.safety.context; const src = 'class R extends AudioWorkletProcessor{process(i){const c=i[0];if(c&&c[0]){this.port.postMessage(c[0].slice());}return true;}}registerProcessor("rec-w",R);';
        await c.rawContext.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: 'application/javascript' }))); const node = c.createAudioWorkletNode('rec-w', { numberOfInputs: 1, numberOfOutputs: 0 }); node.port.onmessage = e => { window.__rec.chunks.push(e.data); }; this.safety.connect(node); }; });
    const peak = async (ms) => { await p.evaluate(() => { window.__rec.chunks = []; }); await p.waitForTimeout(ms); return p.evaluate(() => { let m = 0; window.__rec.chunks.forEach(c => c.forEach(v => { m = Math.max(m, Math.abs(v)); })); return +m.toFixed(3); }); };
    const panel = p.locator('section.shape');
    await panel.locator('.hand-switch').first().click(); await p.waitForTimeout(700); await panel.scrollIntoViewIfNeeded();
    await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }))); await p.waitForTimeout(300); await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }))); await p.waitForTimeout(3500);
    const kind = await p.evaluate(() => { const r = window.__rigs[0]; const v = [...r.shapeVoices.values()][0]; return v ? v.voice.synth.constructor.name : 'none'; });
    ok(`[engine2 ${engine2 ? 'on' : 'off'}] shape voice class: ${kind}`, engine2 ? kind === 'WorkletSynth' : kind !== 'WorkletSynth' && kind !== 'none', kind);
    await panel.getByRole('button', { name: /＋ SHAPE/ }).click(); await panel.getByRole('button', { name: /＋ SHAPE/ }).click().catch(() => {}); await p.waitForTimeout(300);
    await panel.getByRole('switch', { name: /PLAY THE SHAPES/ }).click(); const a1 = await peak(3000); ok(`[${engine2}] 3 shapes make sound`, a1 > 0.03 && a1 < 1.5, 'peak ' + a1);
    const sound = panel.getByLabel('Sound of this shape');
    for (const id of ['supersaw', 'choirPad', 'bell', 'bass']) { await sound.selectOption(id).catch(() => {}); await p.waitForTimeout(500); const a = await peak(1800); ok(`[${engine2}] ${id} is heard`, a > 0.02, 'peak ' + a); }
    await panel.getByRole('switch', { name: /SHAPES PLAYING/ }).click(); await p.waitForTimeout(3500); ok(`[${engine2}] stopping leaves silence (no hanging note)`, (await peak(1000)) < 0.02);
    ok(`[${engine2}] no page errors`, errs.length === 0, errs.join('|').slice(0, 300));
    await ctx.close();
  };
  await run(true); await run(false);
  console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
})();
