const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(process.argv[2]); await p.waitForTimeout(1000);
  const out = await p.evaluate(async () => {
    const { renderProjectToWav } = await import('/exporter.ts'); const { defaultProject } = await import('/project.ts'); const { defaultPatternData } = await import('/song.ts'); const { FX_IDS } = await import('/fx.ts');
    const notes = [0, 4, 8, 12, 16, 20, 24, 28].map((s, i) => ({ id: 'n' + i, pitch: ['C4', 'E4', 'G4', 'A4'][i % 4], step: s, lengthSteps: 3, velocity: 0.9 }));
    const run = async fx => {
      const pr = defaultProject(); pr.patterns = [defaultPatternData('x', notes)]; pr.master = { ...pr.master, reverbMix: 0, compAmount: 0 };
      pr.channels = { ...pr.channels, melody: { ...pr.channels.melody, reverbSend: 0, delaySend: 0, fx } };
      const r = await renderProjectToWav(pr, 1, { mode: 'pattern', pattern: 0, format: 'wav16' });
      const ab = await r.blob.arrayBuffer(); const v = new DataView(ab); const n = (ab.byteLength - 44) / 2; let pk = 0, sum = 0, nan = 0, diff = 0; const arr = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = v.getInt16(44 + i * 2, true) / 32768; arr[i] = x; pk = Math.max(pk, Math.abs(x)); sum += x * x; }
      return { arr, pk: +pk.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4) };
    };
    const dry = await run([]); const res = { dry: { pk: dry.pk, rms: dry.rms } };
    for (const t of FX_IDS) for (const a of [0.5, 1]) {
      const r = await run([{ id: 'fx1', type: t, amount: a, on: true }]); let d = 0; const m = Math.min(r.arr.length, dry.arr.length); for (let i = 0; i < m; i++) d += Math.abs(r.arr[i] - dry.arr[i]); res[t + '@' + a] = { pk: r.pk, rms: r.rms, diff: +(d / m).toFixed(4) };
    }
    const chain = await run([{ id: 'fx1', type: 'distortion', amount: 0.5, on: true }, { id: 'fx2', type: 'chorus', amount: 0.5, on: true }, { id: 'fx3', type: 'bitcrusher', amount: 0.5, on: false }]); res.chain = { pk: chain.pk, rms: chain.rms };
    return res;
  });
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(18), JSON.stringify(v));
  console.log(errs.join('|')); await b.close();
})();
