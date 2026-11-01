const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    window.__rec = { chunks: [], sr: 44100 };
    const rn = performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/rig\.ts/.test(n)).pop(); const { Rig } = await import(rn || '/rig.ts'); {
      const ready = Rig.prototype.ready;
      Rig.prototype.ready = async function () {
        await ready.call(this); if (this.__tp) return; this.__tp = true; window.__tapped = 'yes';
        const ctx = this.safety.context; const src = 'class R extends AudioWorkletProcessor{process(i){const c=i[0];if(c&&c[0]){this.port.postMessage(c[0].slice());}return true;}}registerProcessor("rec-w",R);';
        await ctx.addAudioWorkletModule(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })), 'rec-w');
        const node = ctx.createAudioWorkletNode('rec-w', { numberOfInputs: 1, numberOfOutputs: 0 }); window.__rec.sr = ctx.rawContext.sampleRate;
        node.port.onmessage = e => { window.__rec.chunks.push(e.data); }; this.safety.connect(node);
      };
    }
  });
  await p.locator('button:text-is("NEW")').click(); await p.waitForTimeout(400);
  await p.locator('[role=tab]:has-text("MELODY")').first().click(); await p.waitForTimeout(300);
  await p.locator('button:has-text("CLEAR MELODY")').first().click();
  // advanced view not needed: easy rows C4 (bottom) ... place note E4-ish at step 0 and C5-ish at step 8
  await p.locator('[aria-label="Note length"] button').nth(2).click();
  const rows = await p.locator('button[data-step="0"]').count();
  await p.locator('button[data-step="0"]').nth(rows - 1).click();     // lowest row
  await p.locator('button[data-step="8"]').nth(0).click();            // highest row
  // make first note 8 steps long by dragging? use the length picker instead: click the cell again would delete. set via keyboard: simply slide
  await p.locator('.slide-btn').first().click();
  console.log('slide on:', await p.locator('.slide-btn.on').count());
  await p.locator('button[aria-label^="Listen to MELODY"], button:has-text("LISTEN TO MELODY ALONE")').first().click();
  await p.waitForTimeout(1000); console.log('indicator', await p.locator('.indicator').innerText(), 'tap', await p.evaluate(() => window.__tapped + ' ' + window.__rec.chunks.length)); await p.waitForTimeout(7000); console.log("tap after", await p.evaluate(() => window.__tapped + " " + window.__rec.chunks.length));
  const data = await p.evaluate(() => { const c = window.__rec.chunks; const n = c.reduce((a, x) => a + x.length, 0); const o = new Float32Array(n); let k = 0; c.forEach(x => { o.set(x, k); k += x.length; }); return { sr: window.__rec.sr, d: Array.from(o.slice(0, Math.min(n, 44100 * 5))) }; });
  console.log('samples', data.d.length, 'errs', errs.join('|'));
  const d = Float32Array.from(data.d); const sr = data.sr;
  // find first sound
  let s0 = 0; while (s0 < d.length && Math.abs(d[s0]) < 0.01) s0++;
  const f = (t) => { const s = s0 + Math.floor(t * sr), L = 4096; let best = 0, bf = 0; for (let fr = 100; fr <= 1200; fr += 2) { let re = 0, im = 0; for (let i = 0; i < L; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / L); const a = 2 * Math.PI * fr * i / sr; re += d[s + i] * w * Math.cos(a); im += d[s + i] * w * Math.sin(a); } const m = re * re + im * im; if (m > best) { best = m; bf = fr; } } return bf; };
  console.log('freq at 0.05,0.25,0.5,0.75,1.0,1.2 s from first sound:', [0.02, 0.25, 0.5, 0.75, 1.0].map(f), 'bpm info', await 0);
  await b.close();
})();
