// v0.22.0 sound engine 2 for the whole live sound: tracks (song playback), keyboard, with the switch
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let bad = 0; const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  const run = async (e2) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    if (!e2) await p.addInitScript(() => localStorage.setItem('beatlab.engine2', 'off'));
    await p.goto(process.argv[2]); await p.waitForTimeout(1200);
    await p.evaluate(async () => { window.__rec = { chunks: [] }; window.__rigs = []; const rn = performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/rig\.ts/.test(n)).pop(); const { Rig } = await import(rn || '/rig.ts'); const ready = Rig.prototype.ready;
      Rig.prototype.ready = async function () { window.__rigs.push(this); await ready.call(this); if (this.__tp) return; this.__tp = true; const c = this.safety.context; const src = 'class R extends AudioWorkletProcessor{process(i){const c=i[0];if(c&&c[0]){this.port.postMessage(c[0].slice());}return true;}}registerProcessor("rec-w",R);';
        await c.rawContext.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: 'application/javascript' }))); const node = c.createAudioWorkletNode('rec-w', { numberOfInputs: 1, numberOfOutputs: 0 }); node.port.onmessage = e => { window.__rec.chunks.push(e.data); }; this.safety.connect(node); }; });
    const peak = async (ms) => { await p.evaluate(() => { window.__rec.chunks = []; }); await p.waitForTimeout(ms); return p.evaluate(() => { let m = 0; window.__rec.chunks.forEach(c => c.forEach(v => { m = Math.max(m, Math.abs(v)); })); let s=0,n=0; window.__rec.chunks.forEach(c => c.forEach(v => { s += v*v; n++; })); return 'peak ' + m.toFixed(3) + ' rms ' + Math.sqrt(s/Math.max(1,n)).toFixed(4); }); };
    // keyboard note creates the engine
    await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }))); await p.waitForTimeout(250); await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }))); await p.waitForTimeout(2500);
    const classes = await p.evaluate(() => { const r = window.__rigs[0]; return [...r.tracks.values()].map(t => t.voice.synth.constructor.name); });
    ok(`[engine2 ${e2}] track voices: ${[...new Set(classes)].join(',')}`, e2 ? classes.length > 0 && classes.every(c => c === 'WorkletSynth' || c === 'PatchSynth' || c === '_PolySynth') && classes.some(c => c === 'WorkletSynth') : !classes.includes('WorkletSynth'));
    // song playback (the demo song has melody / arp / ambient notes)
    await p.getByRole('button', { name: 'Play (quick)' }).click(); const a = await peak(4000); console.log(e2 ? 'ENGINE2' : 'OLD', a);
    await p.getByRole('button', { name: 'Stop (quick)' }).click(); await p.waitForTimeout(3500); const q = await peak(1200); ;
    // keyboard hold + release
    await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }))); const h = await peak(600); await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }))); await p.waitForTimeout(3500);
    ;
    ok(`[${e2}] no page errors`, errs.length === 0, errs.join('|').slice(0, 300));
    await ctx.close();
  };
  await run(true); await run(false);
  console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
})();
