const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto(process.argv[2]); await p.waitForTimeout(1000);
  const out = await p.evaluate(async (insts) => {
    const { renderProjectToWav } = await import('/exporter.ts'); const { defaultProject } = await import('/project.ts'); const { defaultPatternData } = await import('/song.ts');
    const ac = (d, t0) => { const s = Math.floor((t0 + 0.05) * 44100), L = 2500; const a = []; for (let lag = 40; lag <= 400; lag++) { let sum = 0, e = 0; for (let i = 0; i < L; i++) { sum += d[s + i] * d[s + i + lag]; e += d[s + i] * d[s + i]; } a.push(e > 1e-6 ? sum / e : 0); } const mx = Math.max(...a); if (mx < 0.3) return 0; const i = a.findIndex((v, k) => v > 0.9 * mx && (k === 0 || v >= a[k - 1]) && (k === a.length - 1 || v >= a[k + 1])); return Math.round(44100 / (40 + i)); };
    const rms = (d, t0, w) => { const s = Math.floor((t0 + 0.05) * 44100), L = Math.floor(w * 44100); let e = 0; for (let i = 0; i < L; i++) e += d[s + i] ** 2; return Math.sqrt(e / L); };
    const res = {};
    for (const inst of insts) for (const slide of [false, true]) {
      const notes = [{ id: 'a', pitch: 'C4', step: 0, lengthSteps: 4, velocity: 0.9, ...(slide ? { slide: true } : {}) }, { id: 'b', pitch: 'C5', step: 4, lengthSteps: 8, velocity: 0.9 }];
      const pr = defaultProject(); pr.bpm = 100; pr.patterns = [defaultPatternData('x', notes)]; pr.master = { ...pr.master, reverbMix: 0, compAmount: 0 };
      pr.tracks = pr.tracks.map(t => t.id === 'melody' ? { ...t, instrument: inst } : t); pr.channels = { ...pr.channels, melody: { ...pr.channels.melody, reverbSend: 0, delaySend: 0 } };
      const r = await renderProjectToWav(pr, 1, { mode: 'pattern', pattern: 0, format: 'wav16' });
      const ab = await r.blob.arrayBuffer(); const v = new DataView(ab); const n = (ab.byteLength - 44) / 4; const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = v.getInt16(44 + i * 4, true) / 32768;
      // step = 0.15 s: note a 0..0.6 (glide), note b starts at 0.6
      const env = []; for (let t = 0; t < 1.6; t += 0.05) env.push(Math.round(rms(d, t, 0.05) * 1000)); res[inst + (slide ? ' SLIDE' : ' plain')] = { env, f: [0.05, 0.25, 0.45, 0.8, 1.2].map(t => ac(d, t)), attackRatio: +(rms(d, 0.6, 0.02) / Math.max(1e-6, rms(d, 0.56, 0.02))).toFixed(2) };
    }
    return res;
  }, ['electricPiano', 'sawLead']);
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(24), 'env(x1000/50ms)', JSON.stringify(v.env), 'freq @.05,.25,.45,.8,1.2s =', JSON.stringify(v.f), ' level jump at B start x' + v.attackRatio);
  await b.close();
})();
