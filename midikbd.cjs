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
  console.log('MIDI panel button:', await p.locator('section.midi .panel-label button').first().innerText());
  const connectVisible = await p.locator('button:has-text("CONNECT KEYBOARD")').count(); console.log('connect button visible before opening panel:', connectVisible);
  await p.locator('section.midi .panel-label button').first().click(); await p.waitForTimeout(200);
  console.log('connect button visible after opening:', await p.locator('button:has-text("CONNECT KEYBOARD")').count());
  await p.locator('button:has-text("CONNECT KEYBOARD")').click(); await p.waitForTimeout(1500);
  console.log('requestMIDIAccess calls:', await p.evaluate(() => window.__midiAsked), '| status text:', (await p.locator('section.midi').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
  console.log('handler attached:', await p.evaluate(() => typeof window.__midiIn.onmidimessage));
  // play a key on the open tab (melody first)
  await p.locator('[role=tab]:has-text("MELODY")').first().click(); await p.waitForTimeout(300);
  console.log('open tab:', await p.locator('[role=tab][aria-selected=true]').first().innerText());
  await send([0x90, 60, 100]); console.log('melody note-on  -> peak', await peak(800)); await send([0x80, 60, 0]); await p.waitForTimeout(600);
  await p.locator('[role=tab]:has-text("DRUMS")').first().click(); await p.waitForTimeout(300);
  await send([0x90, 36, 110]); console.log('drums kick (36) -> peak', await peak(600));

  await p.locator('[role=tab]:has-text("MELODY")').first().click(); await p.waitForTimeout(300);
  const notes = [21, 36, 48, 55, 60, 64, 72, 84, 96, 108];
  for (const n of notes) { await send([0x90, n, 90]); const pk = await peak(500); await send([0x80, n, 0]); await p.waitForTimeout(150); console.log('note', n, '-> peak', pk); }
  await send([0x90, 60, 90]); await send([0x90, 64, 90]); await send([0x90, 67, 90]); console.log('chord C-E-G -> peak', await peak(600)); await send([0x80, 60, 0]); await send([0x80, 64, 0]); await send([0x80, 67, 0]); await p.waitForTimeout(300);
  let dead = 0; for (let i = 0; i < 25; i++) { await send([0x90, 60 + (i % 7), 100]); const pk = await peak(120); await send([0x80, 60 + (i % 7), 0]); await p.waitForTimeout(40); if (pk < 0.02) dead++; }
  console.log('25 quick presses, silent ones:', dead);
  // note-on with velocity 0 as note-off, channel 5, and running status junk
  await send([0x95, 62, 100]); console.log('channel 6 note-on -> peak', await peak(500)); await send([0x95, 62, 0]);
  await send([0xFE]); await send([0xF8]); await send([0xB0, 64, 127]); await send([0xE0, 0, 64]);
  await send([0x90, 62, 100]); console.log('after active-sensing / pedal / pitchbend -> peak', await peak(500)); await send([0x80, 62, 0]);
  // while the song plays
  await p.locator('button.play').first().click(); await p.waitForTimeout(800); await send([0x90, 67, 100]); console.log('while playing -> peak (includes song)', await peak(500)); await send([0x80, 67, 0]);
  console.log('errors:', errs.join(' | ') || 'none'); await b.close();
})();
