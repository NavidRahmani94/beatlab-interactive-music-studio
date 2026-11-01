const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(process.argv[2]); await p.waitForTimeout(1000);
  const out = await p.evaluate(async () => {
    const { renderProjectToWav } = await import('/exporter.ts'); const { defaultProject } = await import('/project.ts'); const { defaultPatternData } = await import('/song.ts');
    const res = {};
    for (const [name, semis, cents] of [['440', 0, 0], ['432', 0, -32], ['up2', 2, 0]]) {
      const pr = defaultProject(); pr.patterns = [defaultPatternData('x', [{ id: 'n1', pitch: 'A4', step: 0, lengthSteps: 16, velocity: 0.9 }])];
      pr.tracks = pr.tracks.map(t => t.id === 'melody' ? { ...t, instrument: 'sineLead' in {} ? 'sineLead' : t.instrument } : t);
      pr.master = { ...pr.master, reverbMix: 0, compAmount: 0 }; pr.tuning = { semitones: semis, cents };
      const r = await renderProjectToWav(pr, 1, { mode: 'pattern', pattern: 0, format: 'wav16' });
      const ab = await r.blob.arrayBuffer(); const v = new DataView(ab); const n16 = (ab.byteLength - 44) / 2 / 2; const d = new Float32Array(n16);
      for (let i = 0; i < n16; i++) d[i] = v.getInt16(44 + i * 4, true) / 32768;
      const n = 1 << 14, s = Math.floor(0.5 * 44100); let best = 0, bf = 0;
      for (let f = 380; f <= 600; f += 0.5) { let re = 0, im = 0; for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); const a = 2 * Math.PI * f * (i + s) / 44100; re += d[i + s] * w * Math.cos(a); im += d[i + s] * w * Math.sin(a); } const m = re * re + im * im; if (m > best) { best = m; bf = f; } }
      res[name] = bf;
    }
    return res;
  });
  console.log(JSON.stringify(out), errs.join('|')); await b.close();
})();
