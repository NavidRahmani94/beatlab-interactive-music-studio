const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript(() => {
    // a fake MIDI keyboard
    const input = { id: 'kbd1', name: 'Fake Keyboard', onmidimessage: null };
    const access = { inputs: new Map([['kbd1', input]]), outputs: new Map(), onstatechange: null };
    window.__midiIn = input; window.__midiAsked = 0;
    navigator.requestMIDIAccess = async () => { window.__midiAsked++; return access; };
  });
  await p.goto(process.argv[2]); await p.waitForTimeout(1200);
  await p.evaluate(async () => {
    window.__rec = { chunks: [] };
    const rn = performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/rig\.ts/.test(n)).pop(); const { Rig } = await import(rn || '/rig.ts');
    const ready = Rig.prototype.ready;
    Rig.prototype.ready = async function () { await ready.call(this); if (this.__tp) return; this.__tp = true; const ctx = this.safety.context;
      const src = 'class R extends AudioWorkletProcessor{process(i){const c=i[0];if(c&&c[0]){this.port.postMessage(c[0].slice());}return true;}}registerProcessor("rec-w",R);';
      await ctx.addAudioWorkletModule(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })), 'rec-w');
      const node = ctx.createAudioWorkletNode('rec-w', { numberOfInputs: 1, numberOfOutputs: 0 }); node.port.onmessage = e => { window.__rec.chunks.push(e.data); }; this.safety.connect(node); };
  });
  const peak = async (ms) => { await p.evaluate(() => { window.__rec.chunks = []; }); await p.waitForTimeout(ms); return p.evaluate(() => { let m = 0; window.__rec.chunks.forEach(c => c.forEach(v => { m = Math.max(m, Math.abs(v)); })); return +m.toFixed(3); }); };
  const send = (bytes) => p.evaluate(b => window.__midiIn.onmidimessage && window.__midiIn.onmidimessage({ data: new Uint8Array(b) }), bytes);
  const key = async (k) => { await p.keyboard.down(k); const pk = await peak(500); await p.keyboard.up(k); await p.waitForTimeout(150); return pk; };
  await p.locator('[role=tab]:has-text("MELODY")').first().click(); await p.waitForTimeout(300);
  console.log('A key on melody tab (fresh page)      ->', await key('a'));
  console.log('second press                           ->', await key('s'));
  await p.locator('select[aria-label$="instrument"]').first().focus(); console.log('focus in the INSTRUMENT select, press A ->', await key('a'));
  await p.locator('input[type=range]').first().focus(); console.log('focus on a slider, press A             ->', await key('a'));
  await p.locator('[role=tab]:has-text("MELODY")').first().click(); console.log('after clicking the MELODY tab again     ->', await key('a'));
  await p.locator('button.play').first().click(); await p.waitForTimeout(500); console.log('song playing, press A (peak incl. song) ->', await key('a'));
  await p.locator('button.stop').first().click(); await p.waitForTimeout(300);
  await p.locator('[role=tab]:has-text("DRUMS")').first().click(); console.log('drums tab, key A (kick)                 ->', await key('a'));
  console.log('errors:', errs.join(' | ') || 'none'); await b.close();
})();
