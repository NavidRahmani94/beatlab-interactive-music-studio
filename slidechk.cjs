const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(process.argv[2]); await p.waitForTimeout(1000);
  const out = await p.evaluate(async (insts) => {
    const { renderProjectToWav } = await import('/exporter.ts'); const { defaultProject } = await import('/project.ts'); const { defaultPatternData } = await import('/song.ts');
    const res = {};
    for (const inst of insts) for (const slide of [false, true]) {
      const notes = [{ id: 'a', pitch: 'A3', step: 0, lengthSteps: 8, velocity: 0.9, ...(slide ? { slide: true } : {}) }, { id: 'b', pitch: 'A4', step: 8, lengthSteps: 4, velocity: 0.9 }];
      const pr = defaultProject(); pr.bpm = 120; pr.patterns = [defaultPatternData('x', notes)]; pr.master = { ...pr.master, reverbMix: 0, compAmount: 0 };
      pr.tracks = pr.tracks.map(t => t.id === 'melody' ? { ...t, instrument: inst } : t); pr.channels = { ...pr.channels, melody: { ...pr.channels.melody, reverbSend: 0, delaySend: 0 } };
      const r = await renderProjectToWav(pr, 1, { mode: 'pattern', pattern: 0, format: 'wav16' });
      const ab = await r.blob.arrayBuffer(); const v = new DataView(ab); const n = (ab.byteLength - 44) / 4; const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = v.getInt16(44 + i * 4, true) / 32768;
      // note a: 0..1.0 s at 120 bpm (8 sixteenths = 1.0 s) + lead-in 0.05
      const f = (t0) => { const s = Math.floor((t0 + 0.05) * 44100), L = 4096; let best = 0, bf = 0; for (let fr = 100; fr <= 1000; fr += 2) { let re = 0, im = 0; for (let i = 0; i < L; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / L); const a = 2 * Math.PI * fr * i / 44100; re += d[s + i] * w * Math.cos(a); im += d[s + i] * w * Math.sin(a); } const m = re * re + im * im; if (m > best) { best = m; bf = fr; } } return bf; };
      res[inst + (slide ? ' SLIDE' : ' plain')] = [f(0.15), f(0.5), f(0.85)];
    }
    return res;
  }, ['electricPiano', 'sawLead']);
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(24), JSON.stringify(v));
  console.log(errs.join('|')); await b.close();
})();
